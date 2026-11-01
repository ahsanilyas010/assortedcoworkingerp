// cw-onboarding-submit
// Public endpoint for the membership induction form at
// https://coworking.assorted.group/join. Deployed with JWT verification OFF.
// Validates the payload, inserts with the service role (insert-only for the
// public), creates the member + signup invoice, then best-effort notifies.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import {
  bankLine,
  dateLabel,
  emailShell,
  logMessage,
  normalizePkPhone,
  pkr,
  sendEmail,
  sendWhatsAppTemplate,
} from "./notify.ts";

const DEFAULT_ORIGINS = [
  /^https:\/\/coworking\.assorted\.group$/,
  /^https:\/\/(www\.)?assortedcoworking\.com$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

const cors = (origin: string, extra: string[] = []) => {
  const allowed = DEFAULT_ORIGINS.some((r) => r.test(origin)) || extra.includes(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://coworking.assorted.group",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
    "Content-Type": "application/json",
    Vary: "Origin",
  };
};

const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const json = (h: HeadersInit, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: h });

interface PricingEntry {
  code: string;
  name: string;
  price: number;
  period?: string;
  unit?: string;
  deposit?: boolean;
  addon?: boolean;
}

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  let h = cors(origin);
  if (req.method === "OPTIONS") return new Response(null, { headers: h });
  if (req.method !== "POST") return json(h, { ok: false, error: "method" }, 405);

  let d: Record<string, unknown>;
  try {
    d = JSON.parse(await req.text());
  } catch {
    return json(h, { ok: false, error: "bad_json" }, 400);
  }
  if (s(d.website, 200)) return json(h, { ok: true, member_no: "M-0000" }); // honeypot

  const slug = s(d.tenant, 60) || "assorted-coworking";
  const { data: tenant, error: tErr } = await db.from("cw_tenants").select("*").eq("slug", slug).maybeSingle();
  if (tErr || !tenant) return json(h, { ok: false, error: "tenant" }, 404);
  h = cors(origin, tenant.allowed_origins ?? []);

  const pricing = (tenant.pricing ?? []) as PricingEntry[];
  // "custom": the member typed an agreed monthly amount per seat. It is bounded here and the member
  // stays pending_payment with a flag in the notes until the owner verifies it.
  const isCustom = s(d.plan_code, 40) === "custom";
  const customAmount = Math.round(Number(d.custom_amount) || 0);
  const plan: PricingEntry | undefined = isCustom
    ? customAmount >= 1000 && customAmount <= 500000
      ? { code: "custom", name: "Custom plan", price: customAmount, deposit: true }
      : undefined
    : pricing.find((p) => p.code === s(d.plan_code, 40) && !p.addon);
  const addonEntry = pricing.find((p) => p.code === "meeting_room_addon");

  const full_name = s(d.full_name, 120);
  const phone = normalizePkPhone(s(d.phone, 30));
  const email = s(d.email, 160).toLowerCase();
  const seats = Math.min(50, Math.max(1, Math.floor(Number(d.seats) || 1)));
  const start_date = s(d.start_date, 10);
  const agree = d.agree === true;
  const meeting_room = d.meeting_room === true;

  if (!full_name || !phone || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !plan || !/^\d{4}-\d{2}-\d{2}$/.test(start_date) || !agree) {
    return json(h, { ok: false, error: "missing" }, 422);
  }

  const monthly = Number(plan.price) * seats;
  const addon = meeting_room && addonEntry ? Number(addonEntry.price) : 0;
  const deposit = plan.deposit === false ? 0 : Number(tenant.deposit_per_seat) * seats;
  const total = monthly + addon + deposit;

  // Raw audit row first so nothing is lost even if later steps fail.
  const { data: sub } = await db
    .from("cw_onboarding_submissions")
    .insert({
      tenant_id: tenant.id,
      payload: d,
      ip: req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? null,
      user_agent: req.headers.get("user-agent") ?? null,
    })
    .select("id")
    .single();

  // Re-submission by the same unpaid person updates the pending row instead of duplicating.
  const { data: existing } = await db
    .from("cw_members")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("phone", phone)
    .eq("status", "pending_payment")
    .maybeSingle();

  const memberRow = {
    tenant_id: tenant.id,
    full_name,
    phone,
    email,
    company: s(d.company, 160) || null,
    cnic: s(d.cnic, 20).replace(/\D/g, "") || null,
    plan_code: plan.code,
    plan_name: plan.name + (meeting_room ? " + Meeting Room" : ""),
    plan_price: Number(plan.price),
    seats,
    monthly_fee: monthly + addon,
    deposit,
    start_date,
    billing_day: tenant.billing_day ?? 28,
    status: "pending_payment",
    emergency_contact: s(d.emergency_contact, 160) || null,
    heard_from: s(d.heard_from, 60) || null,
    notes:
      [s(d.notes, 500), isCustom ? `CUSTOM AMOUNT entered by member: ${pkr(customAmount)} per seat. Verify against the payment before activating.` : ""]
        .filter(Boolean)
        .join("\n") || null,
  };

  const q = existing
    ? db.from("cw_members").update(memberRow).eq("id", existing.id).select("id, member_no").single()
    : db.from("cw_members").insert(memberRow).select("id, member_no").single();
  const { data: member, error: mErr } = await q;
  if (mErr || !member) {
    console.error("member upsert failed", mErr);
    return json(h, { ok: false, error: "save" }, 500);
  }
  if (sub?.id) await db.from("cw_onboarding_submissions").update({ member_id: member.id }).eq("id", sub.id);

  // Signup invoice: first month + deposit, due on the start date.
  const period = start_date.slice(0, 7) + "-01";
  const { data: invoice } = await db
    .from("cw_invoices")
    .upsert(
      {
        tenant_id: tenant.id,
        member_id: member.id,
        period_month: period,
        kind: "signup",
        issue_date: new Date().toISOString().slice(0, 10),
        due_date: start_date,
        amount: total,
        status: "sent",
        notes: `${plan.name} × ${seats}${addon ? " + meeting room" : ""}${deposit ? ` + refundable deposit ${pkr(deposit)}` : ""}`,
      },
      { onConflict: "tenant_id,member_id,period_month,kind" },
    )
    .select("id, invoice_no")
    .single();

  const bank = (tenant.bank_details ?? {}) as Record<string, string>;
  const bankText = bankLine(bank);

  // ---- best-effort notifications (never fail the request) ----
  try {
    const wa = await sendWhatsAppTemplate({
      phoneNumberId: tenant.whatsapp_phone_number_id,
      to: phone,
      template: "cw_welcome",
      params: [full_name.split(" ")[0], member.member_no, pkr(total), `${plan.name} × ${seats}`, bankText],
    });
    await logMessage(db, { tenant_id: tenant.id, member_id: member.id, invoice_id: invoice?.id, channel: "whatsapp", template: "cw_welcome", recipient: phone }, wa);

    const em = await sendEmail({
      to: email,
      replyTo: tenant.email ?? undefined,
      subject: `Welcome to ${tenant.name} — ${member.member_no}`,
      html: emailShell(
        `Welcome to ${tenant.name}`,
        `<p>Hi ${full_name.split(" ")[0]},</p>
         <p>We've received your induction form. Your member number is <b>${member.member_no}</b>.</p>
         <table style="border-collapse:collapse;width:100%;margin:12px 0">
           <tr><td>${plan.name} × ${seats}</td><td align="right">${pkr(monthly)}</td></tr>
           ${addon ? `<tr><td>Meeting room access</td><td align="right">${pkr(addon)}</td></tr>` : ""}
           ${deposit ? `<tr><td>Refundable security deposit</td><td align="right">${pkr(deposit)}</td></tr>` : ""}
           <tr><td style="border-top:1px solid #e6e9f0;padding-top:8px"><b>Total payable now</b></td><td align="right" style="border-top:1px solid #e6e9f0;padding-top:8px"><b>${pkr(total)}</b></td></tr>
         </table>
         <p><b>Bank transfer:</b><br>${bank.bank ?? ""}<br>${bank.account_title ?? ""}<br>${bank.account_no ?? ""}</p>
         <p>Please WhatsApp the payment screenshot to +92 321 852 6405 and we'll activate your access from ${dateLabel(new Date(start_date))}.</p>`,
      ),
    });
    await logMessage(db, { tenant_id: tenant.id, member_id: member.id, invoice_id: invoice?.id, channel: "email", template: "welcome", recipient: email }, em);

    if (tenant.owner_email) {
      const own = await sendEmail({
        to: tenant.owner_email,
        subject: `New signup: ${full_name} · ${plan.name} × ${seats} · ${pkr(total)}`,
        html: emailShell(
          "New membership signup",
          `<p><b>${full_name}</b> (${member.member_no})<br>${phone} · ${email}${memberRow.company ? ` · ${memberRow.company}` : ""}</p>
           <p>${plan.name} × ${seats}${addon ? " + meeting room" : ""}, starting ${dateLabel(new Date(start_date))}.<br>
           Invoice ${invoice?.invoice_no ?? ""}: <b>${pkr(total)}</b> (incl. deposit ${pkr(deposit)}).</p>
           ${isCustom ? `<p><b>The member entered a custom amount (${pkr(customAmount)} per seat). Please verify it before activating.</b></p>` : ""}
           <p>Approve the member in the ERP once the payment screenshot arrives.</p>`,
        ),
      });
      await logMessage(db, { tenant_id: tenant.id, member_id: member.id, invoice_id: invoice?.id, channel: "email", template: "owner_new_signup", recipient: tenant.owner_email }, own);
    }
    if (tenant.owner_phone) {
      const ownWa = await sendWhatsAppTemplate({
        phoneNumberId: tenant.whatsapp_phone_number_id,
        to: normalizePkPhone(tenant.owner_phone) ?? tenant.owner_phone,
        template: "cw_owner_new_signup",
        params: [full_name, `${plan.name} × ${seats}`, String(seats), pkr(total)],
      });
      await logMessage(db, { tenant_id: tenant.id, member_id: member.id, invoice_id: invoice?.id, channel: "whatsapp", template: "cw_owner_new_signup", recipient: tenant.owner_phone }, ownWa);
    }
  } catch (e) {
    console.error("notification error", e);
  }

  return json(h, {
    ok: true,
    member_no: member.member_no,
    invoice_no: invoice?.invoice_no ?? null,
    monthly_fee: monthly,
    addon,
    deposit,
    total,
    bank_details: { bank: bank.bank ?? "", account_title: bank.account_title ?? "", account_no: bank.account_no ?? "" },
  });
});
