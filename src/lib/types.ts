export interface PricingEntry {
  code: string;
  name: string;
  detail?: string;
  price: number;
  period?: "month" | "day";
  unit?: "seat" | "room" | "pass";
  deposit?: boolean;
  addon?: boolean;
}

export interface BankDetails {
  bank?: string;
  account_title?: string;
  account_no?: string;
  iban?: string;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  bank_details: BankDetails;
  whatsapp_phone_number_id: string | null;
  from_email: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  billing_day: number;
  deposit_per_seat: number;
  capacity: number;
  pricing: PricingEntry[];
  allowed_origins: string[];
}

export type MemberStatus = "pending_payment" | "active" | "suspended" | "inactive";

export interface Member {
  id: string;
  tenant_id: string;
  member_no: string;
  full_name: string;
  phone: string;
  email: string | null;
  company: string | null;
  cnic: string | null;
  plan_code: string;
  plan_name: string;
  plan_price: number;
  seats: number;
  monthly_fee: number;
  deposit: number;
  start_date: string;
  billing_day: number;
  status: MemberStatus;
  emergency_contact: string | null;
  heard_from: string | null;
  notes: string | null;
  activated_at: string | null;
  created_at: string;
}

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

export interface Invoice {
  id: string;
  tenant_id: string;
  member_id: string;
  invoice_no: string;
  period_month: string;
  kind: "monthly" | "signup" | "adhoc";
  issue_date: string;
  due_date: string;
  amount: number;
  status: InvoiceStatus;
  notes: string | null;
  created_at: string;
  cw_members?: Pick<Member, "full_name" | "member_no" | "phone"> | null;
}

export type PaymentMethod = "cash" | "bank_transfer" | "online" | "cheque";

export interface Payment {
  id: string;
  tenant_id: string;
  invoice_id: string | null;
  member_id: string | null;
  amount: number;
  method: PaymentMethod;
  paid_on: string;
  reference: string | null;
  receipt_path: string | null;
  notes: string | null;
  created_at: string;
  cw_members?: Pick<Member, "full_name" | "member_no"> | null;
  cw_invoices?: Pick<Invoice, "invoice_no"> | null;
}

export interface Expense {
  id: string;
  tenant_id: string;
  title: string;
  category: string;
  amount: number;
  spent_on: string;
  method: PaymentMethod;
  notes: string | null;
  created_at: string;
}

export interface MessageLog {
  id: string;
  tenant_id: string;
  member_id: string | null;
  invoice_id: string | null;
  channel: "whatsapp" | "email";
  template: string | null;
  recipient: string;
  status: "sent" | "failed" | "skipped";
  provider_id: string | null;
  error: string | null;
  created_at: string;
  cw_members?: Pick<Member, "full_name" | "member_no"> | null;
}

export interface DashboardMetrics {
  tenant_id: string;
  capacity: number;
  active_seats: number;
  active_members: number;
  pending_members: number;
  mrr: number;
  outstanding: number;
  overdue: number;
  collected_this_month: number;
  expenses_this_month: number;
}
