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
  whatsapp?: "sent" | "failed" | "skipped";
  email?: "sent" | "failed" | "skipped";
  whatsapp_error?: string;
  email_error?: string;
}

export const sendInvoice = (invoice_id: string, approve = false) => callFn<SendResult>("cw-send-invoice", { invoice_id, approve });

/** One-line summary for a toast after sending. */
export function describeSend(r: SendResult): string {
  const wa = r.whatsapp === "sent" ? "WhatsApp sent" : `WhatsApp ${r.whatsapp ?? "?"}${r.whatsapp_error ? ` (${r.whatsapp_error.slice(0, 80)})` : ""}`;
  const em = r.email === "sent" ? "email sent" : `email ${r.email ?? "?"}${r.email_error ? ` (${r.email_error.slice(0, 80)})` : ""}`;
  return `${wa} · ${em}`;
}
