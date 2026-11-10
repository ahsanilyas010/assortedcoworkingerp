// cw-send-invoice
// Sends an invoice (WhatsApp template + email) from the owner PWA.
//   - { invoice_id, approve: true }  approves a DRAFT invoice (draft -> sent) and sends it once.
//   - { invoice_id }                 resends an already-sent or overdue invoice.
//   - cc: string[]                   optional extra CC addresses for this send (the tenant's default CC is always added).
//   - { invoice_id, action: "pdf" }  returns the invoice PDF as base64 without sending anything.
// Every email carries the full PDF invoice as an attachment.
// Deployed with verify_jwt ON; the caller must be a member of the invoice's tenant.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { splitEmails } from "./notify.ts";
import { deliverInvoice, makePdf } from "./deliver.ts";

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
  let wantPdf = false;
  let cc: string[] = [];
  try {
    const b = JSON.parse(await req.text()) as { invoice_id?: string; approve?: boolean; action?: string; cc?: unknown };
    invoice_id = String(b.invoice_id ?? "");
    approve = b.approve === true;
    wantPdf = b.action === "pdf";
    cc = splitEmails(b.cc).slice(0, 5);
  } catch { /* fallthrough */ }
  if (!invoice_id) return json({ ok: false, error: "invoice_id required" }, 400);

  const { data: inv } = await db.from("cw_invoices").select("*, cw_members(*), cw_tenants(*)").eq("id", invoice_id).maybeSingle();
  if (!inv) return json({ ok: false, error: "invoice not found" }, 404);
  const { data: membership } = await db.from("cw_tenant_users").select("role").eq("tenant_id", inv.tenant_id).eq("user_id", u.user.id).maybeSingle();
  if (!membership) return json({ ok: false, error: "forbidden" }, 403);

  if (wantPdf) {
    const bytes = await makePdf(inv);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return json({ ok: true, filename: `${inv.invoice_no}.pdf`, pdf_base64: btoa(bin) });
  }
  if (inv.status === "paid" || inv.status === "cancelled") return json({ ok: false, error: `Invoice is already ${inv.status}` }, 409);
  if (inv.status === "draft") {
    if (!approve) return json({ ok: false, error: "This invoice is a draft. Approve it first." }, 409);
    // Flip draft -> sent only if it is still a draft, so a double tap cannot send twice.
    const { data: flipped } = await db.from("cw_invoices").update({ status: "sent" }).eq("id", inv.id).eq("status", "draft").select("id");
    if (!flipped || flipped.length === 0) return json({ ok: false, error: "Already approved and sent" }, 409);
  } else if (approve) {
    return json({ ok: false, error: "Already approved and sent" }, 409);
  }

  const r = await deliverInvoice(db, inv, { template: approve ? "invoice" : "invoice_resend", cc });
  return json({ ok: true, approved: approve, whatsapp: r.whatsapp, email: r.email, pdf: r.pdf, cc: r.cc, whatsapp_error: r.whatsapp_error, email_error: r.email_error });
});
