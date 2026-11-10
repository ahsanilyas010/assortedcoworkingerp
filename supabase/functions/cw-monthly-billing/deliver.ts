// Sends one invoice to a member: WhatsApp template + email with the PDF invoice attached.
// Shared by cw-send-invoice (owner taps Approve / Resend) and cw-monthly-billing (28th auto-send).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";
import { bankLine, dateLabel, emailShell, logMessage, monthLabel, pkr, sendEmail, sendWhatsAppTemplate, splitEmails } from "./notify.ts";
import { buildInvoicePdf } from "./invoice-pdf.ts";

// deno-lint-ignore no-explicit-any
type Row = any;

export interface DeliverResult {
  whatsapp: "sent" | "failed" | "skipped";
  email: "sent" | "failed" | "skipped";
  pdf: boolean;
  whatsapp_error?: string;
  email_error?: string;
  cc: string[];
}

export async function makePdf(inv: Row): Promise<Uint8Array> {
  return await buildInvoicePdf({ tenant: inv.cw_tenants, member: inv.cw_members, invoice: inv });
}

export async function deliverInvoice(
  db: SupabaseClient,
  inv: Row, // cw_invoices row joined with cw_members(*) and cw_tenants(*)
  opts: { template: string; cc?: string[] },
): Promise<DeliverResult> {
  const m = inv.cw_members, t = inv.cw_tenants;
  const bank = (t.bank_details ?? {}) as Record<string, string>;
  const due = new Date(inv.due_date + "T00:00:00Z");
  const first = String(m.full_name).split(" ")[0];
  const month = inv.kind === "monthly" ? monthLabel(new Date(inv.period_month + "T00:00:00Z")) : inv.kind === "signup" ? "your membership signup" : inv.notes ?? "services";

  const wa = await sendWhatsAppTemplate({
    phoneNumberId: t.whatsapp_phone_number_id,
    to: m.phone,
    template: "cw_monthly_invoice",
    params: [first, inv.invoice_no, month, pkr(inv.amount), dateLabel(due), bankLine(bank)],
  });
  await logMessage(db, { tenant_id: inv.tenant_id, member_id: m.id, invoice_id: inv.id, channel: "whatsapp", template: "cw_monthly_invoice", recipient: m.phone }, wa);

  const out: DeliverResult = { whatsapp: wa.status, email: "skipped", pdf: false, whatsapp_error: wa.error, cc: [] };

  // A member may have several addresses in the email field (e.g. a company's finance team):
  // the first is the recipient, the rest are copied.
  const addresses = splitEmails(m.email);
  if (addresses.length === 0) {
    out.email_error = "member has no valid email";
    return out;
  }
  const [to, ...others] = addresses;
  const cc = [...new Set([...others, ...(t.invoice_cc ?? []), ...(opts.cc ?? [])].map((e: string) => e.toLowerCase()))].filter((e) => e !== to);
  out.cc = cc;

  let attachments: { filename: string; content: Uint8Array }[] | undefined;
  try {
    attachments = [{ filename: `${inv.invoice_no}.pdf`, content: await makePdf(inv) }];
    out.pdf = true;
  } catch (e) {
    console.error("pdf generation failed", inv.invoice_no, e);
  }

  const em = await sendEmail({
    to,
    cc,
    replyTo: t.email ?? undefined,
    subject: `${t.name} invoice ${inv.invoice_no}${inv.kind === "monthly" ? " - " + month : ""}`,
    attachments,
    html: emailShell(
      `Invoice ${inv.invoice_no}`,
      `<p>Hi ${first},</p><p>Your ${t.name} invoice for ${month}: <b>${pkr(inv.amount)}</b>, due ${dateLabel(due)}.</p>
       <p>${out.pdf ? "The full invoice is attached as a PDF." : ""}</p>
       <p><b>Bank transfer:</b><br>${bank.bank ?? ""}<br>${bank.account_title ?? ""}<br>${bank.account_no ?? ""}</p>
       <p>Please WhatsApp the payment screenshot to ${t.phone ?? "+92 321 852 6405"} once done. Thank you!</p>`,
    ),
  });
  await logMessage(db, { tenant_id: inv.tenant_id, member_id: m.id, invoice_id: inv.id, channel: "email", template: opts.template, recipient: [to, ...cc.map((c) => "cc:" + c)].join(", ") }, em);
  out.email = em.status;
  out.email_error = em.error;
  return out;
}
