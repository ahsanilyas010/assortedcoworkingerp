// cw-send-invoice
// Sends an invoice (WhatsApp template + email) from the owner PWA.
//   - { invoice_id, approve: true }  approves a DRAFT invoice (draft -> sent) and sends it once.
//   - { invoice_id }                 resends an already-sent or overdue invoice.
// Deployed with verify_jwt ON; the caller must be a member of the invoice's tenant.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { bankLine, dateLabel, emailShell, logMessage, monthLabel, pkr, sendEmail, sendWhatsAppTemplate } from "./notify.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const db = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  const auth = req.headers.get("authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json({ ok: false, error: "unauthorized" }, 401);

  let invoice_id = "";
  let approve = false;
  try {
    const b = JSON.parse(await req.text()) as { invoice_id?: string; approve?: boolean };
    invoice_id = String(b.invoice_id ?? "");
    approve = b.approve === true;
  } catch { /* fallthrough */ }
  if (!invoice_id) return json({ ok: false, error: "invoice_id required" }, 400);

  const { data: inv } = await db.from("cw_invoices").select("*, cw_members(*), cw_tenants(*)").eq("id", invoice_id).maybeSingle();
  if (!inv) return json({ ok: false, error: "invoice not found" }, 404);
  const { data: membership } = await db.from("cw_tenant_users").select("role").eq("tenant_id", inv.tenant_id).eq("user_id", u.user.id).maybeSingle();
  if (!membership) return json({ ok: false, error: "forbidden" }, 403);

  if (inv.status === "paid" || inv.status === "cancelled") return json({ ok: false, error: `Invoice is already ${inv.status}` }, 409);
  if (inv.status === "draft") {
    if (!approve) return json({ ok: false, error: "This invoice is a draft. Approve it first." }, 409);
    // Flip draft -> sent only if it is still a draft, so a double tap cannot send twice.
    const { data: flipped } = await db.from("cw_invoices").update({ status: "sent" }).eq("id", inv.id).eq("status", "draft").select("id");
    if (!flipped || flipped.length === 0) return json({ ok: false, error: "Already approved and sent" }, 409);
  } else if (approve) {
    return json({ ok: false, error: "Already approved and sent" }, 409);
  }

  const m = inv.cw_members, t = inv.cw_tenants;
  const bank = (t.bank_details ?? {}) as Record<string, string>;
  const period = new Date(inv.period_month + "T00:00:00Z");
  const due = new Date(inv.due_date + "T00:00:00Z");
  const first = String(m.full_name).split(" ")[0];
  const month = inv.kind === "monthly" ? monthLabel(period) : inv.kind === "signup" ? "your membership signup" : inv.notes ?? "services";

  const wa = await sendWhatsAppTemplate({
    phoneNumberId: t.whatsapp_phone_number_id,
    to: m.phone,
    template: "cw_monthly_invoice",
    params: [first, inv.invoice_no, month, pkr(inv.amount), dateLabel(due), bankLine(bank)],
  });
  await logMessage(db, { tenant_id: inv.tenant_id, member_id: m.id, invoice_id: inv.id, channel: "whatsapp", template: "cw_monthly_invoice", recipient: m.phone }, wa);

  let em: { status: "sent" | "failed" | "skipped"; ok: boolean; error?: string } = { status: "skipped", ok: false, error: "member has no email" };
  if (m.email) {
    em = await sendEmail({
      to: m.email,
      replyTo: t.email ?? undefined,
      subject: `${t.name} invoice ${inv.invoice_no}${inv.kind === "monthly" ? " — " + month : ""}`,
      html: emailShell(
        `Invoice ${inv.invoice_no}`,
        `<p>Hi ${first},</p><p>Your ${t.name} invoice for ${month}: <b>${pkr(inv.amount)}</b>, due ${dateLabel(due)}.</p>
         <p><b>Bank transfer:</b><br>${bank.bank ?? ""}<br>${bank.account_title ?? ""}<br>${bank.account_no ?? ""}</p>
         <p>Please WhatsApp the payment screenshot to ${t.phone ?? "+92 321 852 6405"} once done. Thank you!</p>`,
      ),
    });
    await logMessage(db, { tenant_id: inv.tenant_id, member_id: m.id, invoice_id: inv.id, channel: "email", template: approve ? "invoice" : "invoice_resend", recipient: m.email }, em);
  }
  return json({ ok: true, approved: approve, whatsapp: wa.status, email: em.status, whatsapp_error: wa.error, email_error: em.error });
});
