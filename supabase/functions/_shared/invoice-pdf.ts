// Builds a one-page A4 PDF invoice with pdf-lib (pure JS, runs in Deno edge functions and Node).
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "npm:pdf-lib@1.17.1";

export interface InvoicePdfInput {
  tenant: {
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    bank_details?: Record<string, string | undefined> | null;
  };
  member: {
    full_name: string;
    member_no?: string | null;
    company?: string | null;
    phone?: string | null;
    email?: string | null;
    plan_name?: string | null;
    seats?: number | null;
    deposit?: number | string | null;
  };
  invoice: {
    invoice_no: string;
    kind: string;
    status: string;
    period_month: string;
    issue_date?: string | null;
    due_date: string;
    amount: number | string;
    notes?: string | null;
  };
}

interface Line {
  description: string;
  qty: string;
  amount: number;
}

const BLUE = rgb(0.11, 0.27, 0.52);
const INK = rgb(0.06, 0.11, 0.24);
const MUTED = rgb(0.36, 0.4, 0.46);
const RULE = rgb(0.9, 0.91, 0.94);
const TINT = rgb(0.96, 0.97, 0.98);

// Standard PDF fonts only cover Latin-1 plus a few punctuation marks; anything else would throw.
const clean = (s: unknown) => String(s ?? "").replace(/[^\x20-\x7E -ÿ–—‘’“”•]/g, "?");
const money = (n: number | string) => "Rs " + Math.round(Number(n)).toLocaleString("en-US");
const day = (iso?: string | null) =>
  iso ? new Date(iso.slice(0, 10) + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";
const monthName = (iso: string) => new Date(iso.slice(0, 10) + "T00:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export function invoiceLines(inv: InvoicePdfInput["invoice"], m: InvoicePdfInput["member"]): Line[] {
  const amount = Number(inv.amount);
  const seats = Math.max(1, Number(m.seats) || 1);
  const plan = clean(m.plan_name || "Coworking membership");
  if (inv.kind === "signup") {
    const deposit = Number(m.deposit) || 0;
    const rent = amount - deposit;
    if (deposit > 0 && rent > 0) {
      return [
        { description: `${plan} - first month`, qty: String(seats), amount: rent },
        { description: "Refundable security deposit", qty: String(seats), amount: deposit },
      ];
    }
    return [{ description: `${plan} - membership signup`, qty: String(seats), amount }];
  }
  if (inv.kind === "monthly") return [{ description: `${plan} - ${monthName(inv.period_month)}`, qty: String(seats), amount }];
  return [{ description: clean(inv.notes || "Services"), qty: "1", amount }];
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = clean(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

export async function buildInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
  const { tenant, member, invoice } = input;
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${invoice.invoice_no}`);
  pdf.setAuthor(clean(tenant.name));
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28;
  const M = 44;
  const R = W - M;

  const text = (s: string, x: number, y: number, size = 10, font = regular, color = INK) =>
    page.drawText(clean(s), { x, y, size, font, color });
  const right = (s: string, xr: number, y: number, size = 10, font = regular, color = INK) =>
    page.drawText(clean(s), { x: xr - font.widthOfTextAtSize(clean(s), size), y, size, font, color });

  // Header band
  page.drawRectangle({ x: 0, y: 842 - 96, width: W, height: 96, color: BLUE });
  text(tenant.name, M, 842 - 52, 20, bold, rgb(1, 1, 1));
  const addr = [tenant.address, tenant.phone].filter(Boolean).join("  |  ");
  if (addr) text(addr, M, 842 - 72, 8.5, regular, rgb(0.85, 0.9, 0.97));
  right("INVOICE", R, 842 - 54, 24, bold, rgb(1, 1, 1));

  // Meta (right) and bill-to (left)
  let y = 842 - 130;
  text("BILL TO", M, y, 8, bold, MUTED);
  text(member.full_name, M, y - 16, 13, bold);
  let by = y - 32;
  for (const l of [member.company, member.member_no ? `Member ${member.member_no}` : "", member.phone ? (/^\d{10,}$/.test(member.phone) ? "+" + member.phone : member.phone) : "", member.email]) {
    if (l) {
      for (const w of wrap(l, regular, 9.5, 250)) {
        text(w, M, by, 9.5, regular, MUTED);
        by -= 13;
      }
    }
  }

  const meta: [string, string][] = [
    ["Invoice no.", invoice.invoice_no],
    ["Issue date", day(invoice.issue_date)],
    ["Due date", day(invoice.due_date)],
  ];
  if (invoice.kind === "monthly") meta.push(["Period", monthName(invoice.period_month)]);
  let my = y;
  for (const [k, v] of meta) {
    text(k, 360, my, 9, regular, MUTED);
    right(v, R, my, 10, bold);
    my -= 17;
  }

  // Line items table
  y = Math.min(by, my) - 28;
  page.drawRectangle({ x: M, y: y - 6, width: R - M, height: 24, color: TINT });
  text("DESCRIPTION", M + 10, y + 3, 8, bold, MUTED);
  text("QTY", 400, y + 3, 8, bold, MUTED);
  right("AMOUNT", R - 10, y + 3, 8, bold, MUTED);
  y -= 26;
  for (const ln of invoiceLines(invoice, member)) {
    const parts = wrap(ln.description, regular, 10.5, 330);
    parts.forEach((p, i) => {
      text(p, M + 10, y - i * 14, 10.5);
    });
    text(ln.qty, 404, y, 10.5);
    right(money(ln.amount), R - 10, y, 10.5);
    y -= parts.length * 14 + 10;
    page.drawLine({ start: { x: M, y: y + 14 }, end: { x: R, y: y + 14 }, thickness: 0.5, color: RULE });
  }

  // Total
  y -= 34;
  page.drawRectangle({ x: 330, y: y - 14, width: R - 330, height: 40, color: BLUE });
  text("TOTAL DUE", 344, y + 4, 9, bold, rgb(0.85, 0.9, 0.97));
  right(money(invoice.amount), R - 14, y - 2, 16, bold, rgb(1, 1, 1));
  const paid = invoice.status === "paid";
  if (paid) {
    page.drawText("PAID", { x: M + 8, y: y - 8, size: 30, font: bold, color: rgb(0.1, 0.55, 0.3) });
  }
  y -= 52;

  // Payment instructions
  const bank = tenant.bank_details ?? {};
  const rows: [string, string][] = [
    ["Bank", bank.bank ?? ""],
    ["Account title", bank.account_title ?? ""],
    ["Account no.", bank.account_no ?? ""],
  ];
  if (bank.iban) rows.push(["IBAN", bank.iban]);
  const boxH = paid ? 40 : 44 + rows.filter(([, v]) => v).length * 16 + 30;
  page.drawRectangle({ x: M, y: y - boxH + 16, width: R - M, height: boxH, color: TINT, borderColor: RULE, borderWidth: 0.7 });
  let py = y - 6;
  text(paid ? "PAYMENT RECEIVED - THANK YOU" : "HOW TO PAY", M + 14, py, 9, bold, BLUE);
  py -= 20;
  if (!paid) {
    for (const [k, v] of rows) {
      if (!v) continue;
      text(k, M + 14, py, 9.5, regular, MUTED);
      text(v, M + 110, py, 10.5, bold);
      py -= 16;
    }
    for (const w of wrap(`Please transfer the amount by the due date, quote ${invoice.invoice_no} as the reference and WhatsApp the payment screenshot to ${tenant.phone ?? "us"}.`, regular, 9, R - M - 28)) {
      text(w, M + 14, py - 4, 9, regular, MUTED);
      py -= 12;
    }
  }

  // Footer
  page.drawLine({ start: { x: M, y: 70 }, end: { x: R, y: 70 }, thickness: 0.5, color: RULE });
  const foot = [tenant.name, tenant.address, tenant.phone, tenant.email].filter(Boolean).join("  |  ");
  text(foot, M, 54, 8, regular, MUTED);
  text("This is a computer-generated invoice and needs no signature.", M, 42, 8, regular, MUTED);

  return await pdf.save();
}
