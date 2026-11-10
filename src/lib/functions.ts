import { supabase } from "@/lib/supabase";

/** Calls an edge function and throws an Error carrying the function's own message. */
export async function callFn<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let msg = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const j = await ctx.json();
        if (j?.error) msg = String(j.error);
      } catch {
        /* keep default message */
      }
    }
    throw new Error(msg);
  }
  return data as T;
}

export interface SendResult {
  ok: boolean;
  approved?: boolean;
  pdf?: boolean;
  cc?: string[];
  whatsapp?: "sent" | "failed" | "skipped";
  email?: "sent" | "failed" | "skipped";
  whatsapp_error?: string;
  email_error?: string;
}

export const sendInvoice = (invoice_id: string, approve = false, cc: string[] = []) => callFn<SendResult>("cw-send-invoice", { invoice_id, approve, cc });

/** Downloads the invoice PDF to the phone/computer (nothing is sent to the member). */
export async function downloadInvoicePdf(invoice_id: string): Promise<void> {
  const r = await callFn<{ filename: string; pdf_base64: string }>("cw-send-invoice", { invoice_id, action: "pdf" });
  const bytes = Uint8Array.from(atob(r.pdf_base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = r.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Splits "a@x.com, b@y.com" into trimmed addresses; returns the invalid ones separately. */
export function parseEmails(raw: string): { valid: string[]; invalid: string[] } {
  const parts = raw.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
  const valid = parts.filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
  return { valid: [...new Set(valid)], invalid: parts.filter((e) => !valid.includes(e)) };
}

/** One-line summary for a toast after sending. */
export function describeSend(r: SendResult): string {
  const wa = r.whatsapp === "sent" ? "WhatsApp sent" : `WhatsApp ${r.whatsapp ?? "?"}${r.whatsapp_error ? ` (${r.whatsapp_error.slice(0, 80)})` : ""}`;
  const em = r.email === "sent" ? "email sent" : `email ${r.email ?? "?"}${r.email_error ? ` (${r.email_error.slice(0, 80)})` : ""}`;
  const extra = [r.pdf ? "PDF attached" : r.email === "sent" ? "no PDF" : "", r.cc && r.cc.length ? `CC ${r.cc.join(", ")}` : ""].filter(Boolean).join(" · ");
  return `${wa} · ${em}${extra ? " · " + extra : ""}`;
}
