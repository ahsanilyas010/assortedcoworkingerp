// cw-monthly-billing
// Creates DRAFT invoices for the coming month for every active, monthly, priced member.
// Nothing is sent to members here. The owner reviews and approves each invoice in the
// app, which calls cw-send-invoice with approve=true (that is what sends WhatsApp + email).
//
// Callers:
//   - pg_cron on the 28th: header  x-cw-cron-secret: <secret stored in Vault>
//   - the owner PWA ("Create drafts" / "Preview"): Authorization: Bearer <user JWT>
//     (the user must be an owner in cw_tenant_users for the tenant)
// Body: { tenant_id?: string, dry_run?: boolean, period?: "YYYY-MM-01" }
// Deployed with verify_jwt OFF (the cron path has no user JWT); auth is done here.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { dateLabel, emailShell, logMessage, monthLabel, sendEmail } from "./notify.ts";

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

async function authorize(req: Request, tenantFilter: string | null): Promise<{ ok: true; tenantIds: string[] } | { ok: false; status: number; error: string }> {
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
  const dueDate = new Date(periodDate.getTime() + 5 * 86400000).toISOString().slice(0, 10);
  const dry = body.dry_run === true;
  const summary = { ok: true, period, dry_run: dry, members: 0, would_create: 0, created: 0, failed: 0, tenants: [] as string[] };

  for (const tenantId of auth.tenantIds) {
    const { data: tenant } = await db.from("cw_tenants").select("*").eq("id", tenantId).single();
    if (!tenant) continue;
    summary.tenants.push(tenant.slug);
    const { data: members } = await db.from("cw_members").select("*").eq("tenant_id", tenantId).eq("status", "active").eq("billing_cycle", "monthly").gt("monthly_fee", 0);
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

    // Tell the owner there is something to approve (email only; members are not contacted).
    if (!dry && createdHere > 0 && tenant.owner_email) {
      const month = monthLabel(periodDate);
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
