// cw-monthly-billing
// Creates next month's invoice for every active member of a tenant and sends it
// by WhatsApp template + email. Idempotent per (tenant, member, month, kind).
//
// Callers:
//   - pg_cron on the 28th: header  x-cw-cron-secret: <CW_CRON_SECRET>
//   - the owner PWA ("Run now" / "Preview"): Authorization: Bearer <user JWT>
//     (the user must be an owner in cw_tenant_users for the tenant)
// Body: { tenant_id?: string, dry_run?: boolean, period?: "YYYY-MM-01" }
// Deployed with verify_jwt OFF (the cron path has no user JWT); auth is done here.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { bankLine, dateLabel, emailShell, logMessage, monthLabel, pkr, sendEmail, sendWhatsAppTemplate } from "./notify.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
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

async function authorize(req: Request, tenantFilter: string | null): Promise<{ ok: true; tenantIds: string[] } | { ok: false; status: number; error: string }> {
  const given = req.headers.get("x-cw-cron-secret");
  let cron = Deno.env.get("CW_CRON_SECRET") ?? "";
  if (!cron && given) {
    // Fallback: the secret lives in Vault (see migration cw_cron_jobs) and is
    // readable only with the service role.
    const { data } = await db.rpc("cw_get_cron_secret");
    cron = typeof data === "string" ? data : "";
  }
  if (cron && given && given === cron) {
    const { data } = await db.from("cw_tenants").select("id").order("created_at");
    const ids = (data ?? []).map((t) => t.id).filter((id) => !tenantFilter || id === tenantFilter);
    return { ok: true, tenantIds: ids };
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
      if (ids.length) return { ok: true, tenantIds: ids };
      return { ok: false, status: 403, error: "not an owner of this workspace" };
    }
  }
  return { ok: false, status: 401, error: "unauthorized" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  let body: { tenant_id?: string; dry_run?: boolean; period?: string } = {};
  try {
    const t = await req.text();
    body = t ? JSON.parse(t) : {};
  } catch { /* empty body is fine */ }

  const auth = await authorize(req, body.tenant_id ?? null);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

  const period = /^\d{4}-\d{2}-01$/.test(body.period ?? "") ? body.period! : nextMonthStart();
  const periodDate = new Date(period + "T00:00:00Z");
  const dry = body.dry_run === true;
  const summary = { ok: true, period, dry_run: dry, members: 0, would_create: 0, created: 0, sent: 0, failed: 0, skipped: 0, tenants: [] as string[] };

  for (const tenantId of auth.tenantIds) {
    const { data: tenant } = await db.from("cw_tenants").select("*").eq("id", tenantId).single();
    if (!tenant) continue;
    summary.tenants.push(tenant.slug);
    const { data: members } = await db.from("cw_members").select("*").eq("tenant_id", tenantId).eq("status", "active");
    const bank = (tenant.bank_details ?? {}) as Record<string, string>;
    const bankText = bankLine(bank);

    for (const m of members ?? []) {
      summary.members++;
      const { data: existing } = await db.from("cw_invoices").select("id").eq("tenant_id", tenantId).eq("member_id", m.id).eq("period_month", period).eq("kind", "monthly").maybeSingle();
      if (existing) continue;
      summary.would_create++;
      if (dry) continue;

      const { data: inv, error } = await db
        .from("cw_invoices")
        .insert({
          tenant_id: tenantId,
          member_id: m.id,
          period_month: period,
          kind: "monthly",
          issue_date: new Date().toISOString().slice(0, 10),
          due_date: period,
          amount: m.monthly_fee,
          status: "sent",
          notes: `${m.plan_name} × ${m.seats}`,
        })
        .select("*")
        .single();
      if (error || !inv) {
        console.error("invoice insert failed", error);
        summary.failed++;
        continue;
      }
      summary.created++;

      const first = String(m.full_name).split(" ")[0];
      const month = monthLabel(periodDate);
      const wa = await sendWhatsAppTemplate({
        phoneNumberId: tenant.whatsapp_phone_number_id,
        to: m.phone,
        template: "cw_monthly_invoice",
        params: [first, inv.invoice_no, month, pkr(inv.amount), dateLabel(periodDate), bankText],
      });
      await logMessage(db, { tenant_id: tenantId, member_id: m.id, invoice_id: inv.id, channel: "whatsapp", template: "cw_monthly_invoice", recipient: m.phone }, wa);
      if (wa.status === "sent") summary.sent++; else if (wa.status === "failed") summary.failed++; else summary.skipped++;

      if (m.email) {
        const em = await sendEmail({
          to: m.email,
          replyTo: tenant.email ?? undefined,
          subject: `${tenant.name} invoice ${inv.invoice_no} — ${month}`,
          html: emailShell(
            `Invoice ${inv.invoice_no}`,
            `<p>Hi ${first},</p>
             <p>Here is your ${tenant.name} membership invoice for <b>${month}</b>.</p>
             <table style="border-collapse:collapse;width:100%;margin:12px 0">
               <tr><td>${m.plan_name} × ${m.seats}</td><td align="right">${pkr(inv.amount)}</td></tr>
               <tr><td style="border-top:1px solid #e6e9f0;padding-top:8px"><b>Total due by ${dateLabel(periodDate)}</b></td><td align="right" style="border-top:1px solid #e6e9f0;padding-top:8px"><b>${pkr(inv.amount)}</b></td></tr>
             </table>
             <p><b>Bank transfer:</b><br>${bank.bank ?? ""}<br>${bank.account_title ?? ""}<br>${bank.account_no ?? ""}</p>
             <p>Please WhatsApp the payment screenshot to ${tenant.phone ?? "+92 321 852 6405"} once done. Thank you!</p>`,
          ),
        });
        await logMessage(db, { tenant_id: tenantId, member_id: m.id, invoice_id: inv.id, channel: "email", template: "monthly_invoice", recipient: m.email }, em);
        if (em.status === "sent") summary.sent++; else if (em.status === "failed") summary.failed++; else summary.skipped++;
      }
    }
  }
  return json(summary);
});
