// cw-monthly-billing
// Creates the invoices for the coming month for every active, monthly, priced member.
//   - tenant.auto_send_invoices = true (default) and the call comes from pg_cron (or body.send = true):
//     every draft invoice of the period is approved and sent straight away (WhatsApp + email with the
//     PDF invoice, default CC applied) and the owner gets a summary email.
//   - tenant.auto_send_invoices = false (or the owner taps "Create drafts" in the app): invoices stay
//     DRAFT and the owner approves each one in the app (cw-send-invoice with approve=true).
//
// Callers:
//   - pg_cron on the 28th: header  x-cw-cron-secret: <secret stored in Vault>
//   - the owner PWA ("Create drafts" / "Preview"): Authorization: Bearer <user JWT>
//     (the user must be an owner in cw_tenant_users for the tenant)
// Body: { tenant_id?: string, member_id?: string, dry_run?: boolean, period?: "YYYY-MM-01", send?: boolean }
//   member_id limits the run to one member (handy for testing or catching up a single invoice).
// Deployed with verify_jwt OFF (the cron path has no user JWT); auth is done here.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { dateLabel, emailShell, logMessage, monthLabel, pkr, sendEmail } from "./notify.ts";
import { deliverInvoice } from "./deliver.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const APP_URL = "https://assortedcoworking-erp.vercel.app";
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info, x-cw-cron-secret",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });

function nextMonthStart(from = new Date()): string {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
  return d.toISOString().slice(0, 10);
}

async function authorize(req: Request, tenantFilter: string | null): Promise<{ ok: true; tenantIds: string[]; cron: boolean } | { ok: false; status: number; error: string }> {
  const given = req.headers.get("x-cw-cron-secret");
  let cron = Deno.env.get("CW_CRON_SECRET") ?? "";
  if (!cron && given) {
    // The secret lives in Vault (see migration cw_cron_jobs), readable only with the service role.
    const { data } = await db.rpc("cw_get_cron_secret");
    cron = typeof data === "string" ? data : "";
  }
  if (cron && given && given === cron) {
    const { data } = await db.from("cw_tenants").select("id").order("created_at");
    const ids = (data ?? []).map((t) => t.id).filter((id) => !tenantFilter || id === tenantFilter);
    return { ok: true, tenantIds: ids, cron: true };
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: u } = await userClient.auth.getUser();
    if (u?.user) {
      let q = db.from("cw_tenant_users").select("tenant_id").eq("user_id", u.user.id).eq("role", "owner");
      if (tenantFilter) q = q.eq("tenant_id", tenantFilter);
      const { data } = await q;
      const ids = (data ?? []).map((r) => r.tenant_id);
      if (ids.length) return { ok: true, tenantIds: ids, cron: false };
      return { ok: false, status: 403, error: "not an owner of this workspace" };
    }
  }
  return { ok: false, status: 401, error: "unauthorized" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  let body: { tenant_id?: string; dry_run?: boolean; period?: string; send?: boolean; member_id?: string } = {};
  try {
    const t = await req.text();
    body = t ? JSON.parse(t) : {};
  } catch { /* empty body is fine */ }

  const auth = await authorize(req, body.tenant_id ?? null);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

  const period = /^\d{4}-\d{2}-01$/.test(body.period ?? "") ? body.period! : nextMonthStart();
  const periodDate = new Date(period + "T00:00:00Z");
  const dueDate = new Date(periodDate.getTime() + 5 * 86400000).toISOString().slice(0, 10);
  const dry = body.dry_run === true;
  const summary = { ok: true, period, dry_run: dry, members: 0, would_create: 0, created: 0, failed: 0, sent: 0, send_failed: 0, tenants: [] as string[], results: [] as unknown[] };

  for (const tenantId of auth.tenantIds) {
    const { data: tenant } = await db.from("cw_tenants").select("*").eq("id", tenantId).single();
    if (!tenant) continue;
    summary.tenants.push(tenant.slug);
    let mq = db.from("cw_members").select("*").eq("tenant_id", tenantId).eq("status", "active").eq("billing_cycle", "monthly").gt("monthly_fee", 0);
    if (body.member_id) mq = mq.eq("id", body.member_id);
    const { data: members } = await mq;
    let createdHere = 0;

    for (const m of members ?? []) {
      summary.members++;
      const { data: existing } = await db.from("cw_invoices").select("id").eq("tenant_id", tenantId).eq("member_id", m.id).eq("period_month", period).eq("kind", "monthly").maybeSingle();
      if (existing) continue;
      summary.would_create++;
      if (dry) continue;

      const { error } = await db.from("cw_invoices").insert({
        tenant_id: tenantId,
        member_id: m.id,
        period_month: period,
        kind: "monthly",
        issue_date: new Date().toISOString().slice(0, 10),
        due_date: dueDate,
        amount: m.monthly_fee,
        status: "draft",
        notes: `${m.plan_name} × ${m.seats}`,
      });
      if (error) {
        console.error("invoice insert failed", error);
        summary.failed++;
        continue;
      }
      summary.created++;
      createdHere++;
    }

    const month = monthLabel(periodDate);
    const autoSend = !dry && tenant.auto_send_invoices !== false && (auth.cron || body.send === true);

    if (autoSend) {
      // Approve + send every draft of this period. The draft -> sent flip is atomic, so a retry of the
      // job (or a parallel tap in the app) can never send the same invoice twice.
      const { data: drafts } = await db
        .from("cw_invoices")
        .select("*, cw_members(*), cw_tenants(*)")
        .eq("tenant_id", tenantId)
        .eq("period_month", period)
        .eq("kind", "monthly")
        .eq("status", "draft")
        .order("invoice_no");
      const drafts2 = body.member_id ? (drafts ?? []).filter((d) => d.member_id === body.member_id) : (drafts ?? []);
      const lines: string[] = [];
      let ok = 0;
      for (const inv of drafts2) {
        const { data: flipped } = await db.from("cw_invoices").update({ status: "sent" }).eq("id", inv.id).eq("status", "draft").select("id");
        if (!flipped || flipped.length === 0) continue;
        try {
          const r = await deliverInvoice(db, inv, { template: "invoice_auto" });
          const delivered = r.email === "sent" || r.whatsapp === "sent";
          if (delivered) { ok++; summary.sent++; } else summary.send_failed++;
          summary.results.push({ invoice_no: inv.invoice_no, email: r.email, whatsapp: r.whatsapp, pdf: r.pdf, cc: r.cc, email_error: r.email_error });
          lines.push(`<tr><td>${inv.cw_members.full_name}</td><td align="right">${pkr(inv.amount)}</td><td>${r.email === "sent" ? "email sent" : "email " + r.email}${r.email_error ? " (" + r.email_error.slice(0, 60) + ")" : ""}; WhatsApp ${r.whatsapp}</td></tr>`);
        } catch (e) {
          summary.send_failed++;
          lines.push(`<tr><td>${inv.cw_members.full_name}</td><td align="right">${pkr(inv.amount)}</td><td>error: ${String(e).slice(0, 80)}</td></tr>`);
        }
      }
      if (tenant.owner_email && lines.length) {
        const res = await sendEmail({
          to: tenant.owner_email,
          subject: `${ok} of ${lines.length} invoices for ${month} were sent`,
          html: emailShell(
            "Invoices sent",
            `<p>The ${month} invoices (due ${dateLabel(new Date(dueDate + "T00:00:00Z"))}) were sent automatically with the PDF attached.</p>
             <table style="border-collapse:collapse;width:100%;font-size:13px">${lines.join("")}</table>
             <p>Anything that failed can be resent from <a href="${APP_URL}/invoices">Invoices</a>. To approve each invoice by hand instead, turn off auto-send in Settings.</p>`,
          ),
        });
        await logMessage(db, { tenant_id: tenantId, channel: "email", template: "owner_invoices_sent", recipient: tenant.owner_email }, res);
      }
    } else if (!dry && createdHere > 0 && tenant.owner_email) {
      // Tell the owner there is something to approve (email only; members are not contacted).
      const res = await sendEmail({
        to: tenant.owner_email,
        subject: `${createdHere} invoices for ${month} are waiting for your approval`,
        html: emailShell(
          "Invoices ready for approval",
          `<p>${createdHere} draft invoices for <b>${month}</b> were created (due ${dateLabel(new Date(dueDate + "T00:00:00Z"))}).</p>
           <p>Nothing has been sent to members yet. Open the app, review each invoice and tap <b>Approve &amp; send</b>.</p>
           <p><a href="${APP_URL}/invoices?f=draft" style="display:inline-block;background:#1C4585;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:600">Review invoices</a></p>`,
        ),
      });
      await logMessage(db, { tenant_id: tenantId, channel: "email", template: "owner_drafts_ready", recipient: tenant.owner_email }, res);
    }
  }
  return json(summary);
});
