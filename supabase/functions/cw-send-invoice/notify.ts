// Shared notification helpers for the Assorted Coworking edge functions.
// Copied verbatim into each function folder as notify.ts at deploy time
// (the MCP deploy uploads one folder per function).
//
// Secrets (set in Supabase > Edge Functions > Secrets):
//   WA_ACCESS_TOKEN  Meta system-user token for the WhatsApp Cloud API
//   RESEND_API_KEY   Resend API key for transactional email
//   RESEND_FROM      optional, e.g. "Assorted Coworking <billing@assorted.business>"
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// Secrets: read the edge function env var first; fall back to Supabase Vault
// through cw_get_secret() (service role only, name allowlist in the database).
const secretCache = new Map<string, string>();
let secretsDb: SupabaseClient | null = null;
export async function getSecret(name: string): Promise<string> {
  const fromEnv = Deno.env.get(name);
  if (fromEnv) return fromEnv;
  const cached = secretCache.get(name);
  if (cached) return cached;
  try {
    secretsDb ??= createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data } = await secretsDb.rpc("cw_get_secret", { p_name: name });
    const v = typeof data === "string" ? data : "";
    if (v) secretCache.set(name, v);
    return v;
  } catch (e) {
    console.error("getSecret failed", name, String(e));
    return "";
  }
}

export type Channel = "whatsapp" | "email";

export interface SendResult {
  ok: boolean;
  status: "sent" | "failed" | "skipped";
  provider_id?: string;
  error?: string;
}

/** Normalise a Pakistani mobile number to WhatsApp wa_id form: 923XXXXXXXXX. */
export function normalizePkPhone(raw: string): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("0")) return "92" + d.slice(1);
  if (d.length === 12 && d.startsWith("92")) return d;
  if (d.length === 10 && d.startsWith("3")) return "92" + d;
  if (d.length >= 10 && d.length <= 15) return d; // international, keep digits
  return null;
}

export async function sendWhatsAppTemplate(opts: {
  phoneNumberId: string;
  to: string; // digits, no +
  template: string;
  params: string[];
  lang?: string;
}): Promise<SendResult> {
  const token = await getSecret("WA_ACCESS_TOKEN");
  if (!token) return { ok: false, status: "skipped", error: "WA_ACCESS_TOKEN not set" };
  if (!opts.phoneNumberId) return { ok: false, status: "skipped", error: "tenant has no whatsapp_phone_number_id" };
  const body = {
    messaging_product: "whatsapp",
    to: opts.to,
    type: "template",
    template: {
      name: opts.template,
      language: { code: opts.lang ?? "en" },
      components: [
        { type: "body", parameters: opts.params.map((text) => ({ type: "text", text })) },
      ],
    },
  };
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${opts.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, status: "failed", error: json?.error?.message ?? `http ${res.status}` };
    }
    return { ok: true, status: "sent", provider_id: json?.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, status: "failed", error: String(e) };
  }
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}): Promise<SendResult> {
  const key = await getSecret("RESEND_API_KEY");
  if (!key) return { ok: false, status: "skipped", error: "RESEND_API_KEY not set" };
  const from = opts.from ?? ((await getSecret("RESEND_FROM")) || "Assorted Coworking <onboarding@resend.dev>");
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, html: opts.html, reply_to: opts.replyTo }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: "failed", error: json?.message ?? `http ${res.status}` };
    return { ok: true, status: "sent", provider_id: json?.id };
  } catch (e) {
    return { ok: false, status: "failed", error: String(e) };
  }
}

export async function logMessage(
  db: SupabaseClient,
  row: {
    tenant_id: string;
    member_id?: string | null;
    invoice_id?: string | null;
    channel: Channel;
    template?: string;
    recipient: string;
    payload?: unknown;
  },
  result: SendResult,
) {
  const { error } = await db.from("cw_message_log").insert({
    ...row,
    status: result.status,
    provider_id: result.provider_id ?? null,
    error: result.error ?? null,
  });
  if (error) console.error("cw_message_log insert failed", error);
}

export const pkr = (n: number) => `Rs ${Math.round(Number(n)).toLocaleString("en-PK")}`;

export const monthLabel = (d: Date) => d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

export const dateLabel = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function bankLine(bank: Record<string, string | undefined>) {
  return [bank.bank, bank.account_title, bank.account_no].filter(Boolean).join(" · ");
}

export function emailShell(title: string, bodyHtml: string, footer = "Assorted Coworking · FF 27, Zarpar Arcade, D-12 Markaz, Islamabad · +92 321 852 6405") {
  return `<!doctype html><html><body style="margin:0;background:#f4f6fa;font-family:Inter,Arial,sans-serif;color:#0f1c3c">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e6e9f0">
    <div style="background:#1C4585;color:#fff;padding:20px 24px;font-size:18px;font-weight:700">${title}</div>
    <div style="padding:24px;font-size:15px;line-height:1.55">${bodyHtml}</div>
    <div style="padding:16px 24px;background:#f4f6fa;font-size:12px;color:#5b6475">${footer}</div>
  </div></body></html>`;
}
