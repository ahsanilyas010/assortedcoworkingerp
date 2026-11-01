import { format, parseISO } from "date-fns";

export const pkr = (n: number | string | null | undefined) =>
  `Rs ${Math.round(Number(n ?? 0)).toLocaleString("en-PK")}`;

export const fmtDate = (iso: string | null | undefined, f = "d MMM yyyy") => (iso ? format(parseISO(iso), f) : "—");

export const monthLabel = (iso: string) => format(parseISO(iso), "MMMM yyyy");

export const todayIso = () => new Date().toISOString().slice(0, 10);

export const prettyPhone = (p: string) => (p.startsWith("92") && p.length === 12 ? `0${p.slice(2, 5)} ${p.slice(5)}` : p);

export const waLink = (phone: string, text?: string) =>
  `https://wa.me/${phone.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

export const STATUS_STYLES: Record<string, string> = {
  pending_payment: "bg-amber-100 text-amber-800 border-amber-200",
  active: "bg-green-100 text-green-800 border-green-200",
  suspended: "bg-red-100 text-red-800 border-red-200",
  inactive: "bg-slate-100 text-slate-700 border-slate-200",
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  sent: "bg-blue-100 text-blue-800 border-blue-200",
  paid: "bg-green-100 text-green-800 border-green-200",
  overdue: "bg-red-100 text-red-800 border-red-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  skipped: "bg-slate-100 text-slate-600 border-slate-200",
};

export const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Pending payment",
  active: "Active",
  suspended: "Suspended",
  inactive: "Inactive",
  draft: "Needs approval",
  sent: "Unpaid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
  failed: "Failed",
  skipped: "Skipped",
};

export const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  online: "Online",
  cheque: "Cheque",
};

export const EXPENSE_CATEGORIES = ["rent", "utilities", "internet", "salaries", "maintenance", "supplies", "tea_coffee", "marketing", "misc"];
