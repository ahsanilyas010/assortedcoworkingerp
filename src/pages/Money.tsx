import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Paperclip, Plus } from "lucide-react";
import { supabase, RECEIPTS_BUCKET } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useTenantId } from "@/context/TenantContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field } from "@/components/Field";
import { RecordPaymentSheet } from "@/components/RecordPaymentSheet";
import { EXPENSE_CATEGORIES, METHOD_LABELS, fmtDate, pkr, todayIso } from "@/lib/format";
import type { Expense, Payment, PaymentMethod } from "@/lib/types";

export default function Money() {
  const tenantId = useTenantId();
  const [pay, setPay] = useState(false);
  const [exp, setExp] = useState(false);

  const payments = useQuery({
    queryKey: ["payments", tenantId, "list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cw_payments").select("*, cw_members(full_name, member_no), cw_invoices(invoice_no)").eq("tenant_id", tenantId).order("paid_on", { ascending: false }).limit(200);
      if (error) throw error;
      return data as Payment[];
    },
  });
  const expenses = useQuery({
    queryKey: ["expenses", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("cw_expenses").select("*").eq("tenant_id", tenantId).order("spent_on", { ascending: false }).limit(200);
      if (error) throw error;
      return data as Expense[];
    },
  });

  const month = todayIso().slice(0, 7);
  const inMonth = (p: Payment[] | Expense[] | undefined, k: "paid_on" | "spent_on") =>
    ((p ?? []) as unknown as Array<Record<string, unknown>>).filter((r) => String(r[k]).startsWith(month)).reduce((a, r) => a + Number(r.amount), 0);

  const openReceipt = async (path: string) => {
    const { data, error } = await supabase.storage.from(RECEIPTS_BUCKET).createSignedUrl(path, 300);
    if (error || !data) return toast.error("Could not open receipt");
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">Money</h1>
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 rounded-2xl"><div className="text-xs uppercase text-muted-foreground">Collected this month</div><div className="text-xl font-black text-green-700">{pkr(inMonth(payments.data, "paid_on"))}</div></Card>
        <Card className="p-4 rounded-2xl"><div className="text-xs uppercase text-muted-foreground">Spent this month</div><div className="text-xl font-black text-red-700">{pkr(inMonth(expenses.data, "spent_on"))}</div></Card>
      </div>
      <Tabs defaultValue="payments">
        <TabsList className="grid grid-cols-2 w-full rounded-xl">
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>
        <TabsContent value="payments" className="space-y-2 pt-3">
          <Button size="sm" className="rounded-xl w-full h-11" onClick={() => setPay(true)}><Plus className="h-4 w-4 mr-1" /> Record payment</Button>
          {payments.data?.length === 0 && <Card className="p-4 rounded-2xl text-sm text-muted-foreground">No payments yet.</Card>}
          {payments.data?.map((p) => (
            <Card key={p.id} className="p-4 rounded-2xl flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-semibold truncate">{p.cw_members?.full_name ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{fmtDate(p.paid_on)} · {METHOD_LABELS[p.method]}{p.cw_invoices?.invoice_no ? ` · ${p.cw_invoices.invoice_no}` : ""}{p.reference ? ` · ${p.reference}` : ""}</div>
              </div>
              <div className="text-right shrink-0 ml-3 flex items-center gap-2">
                <b>{pkr(p.amount)}</b>
                {p.receipt_path && <button onClick={() => openReceipt(p.receipt_path!)} className="text-primary"><Paperclip className="h-4 w-4" /></button>}
              </div>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="expenses" className="space-y-2 pt-3">
          <Button size="sm" variant="outline" className="rounded-xl w-full h-11" onClick={() => setExp(true)}><Plus className="h-4 w-4 mr-1" /> Add expense</Button>
          {expenses.data?.length === 0 && <Card className="p-4 rounded-2xl text-sm text-muted-foreground">No expenses yet.</Card>}
          {expenses.data?.map((e) => (
            <Card key={e.id} className="p-4 rounded-2xl flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-semibold truncate">{e.title}</div>
                <div className="text-xs text-muted-foreground">{fmtDate(e.spent_on)} · {e.category.replace("_", " ")} · {METHOD_LABELS[e.method]}</div>
              </div>
              <b className="shrink-0 ml-3">{pkr(e.amount)}</b>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
      <RecordPaymentSheet open={pay} onOpenChange={setPay} />
      <ExpenseSheet open={exp} onOpenChange={setExp} />
    </div>
  );
}

function ExpenseSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const tenantId = useTenantId();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [f, setF] = useState({ title: "", category: "misc", amount: "", spent_on: todayIso(), method: "cash" as PaymentMethod, notes: "" });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const save = useMutation({
    mutationFn: async () => {
      if (!f.title.trim() || !(Number(f.amount) > 0)) throw new Error("Title and amount are required");
      const { error } = await supabase.from("cw_expenses").insert({ tenant_id: tenantId, title: f.title.trim(), category: f.category, amount: Number(f.amount), spent_on: f.spent_on, method: f.method, notes: f.notes || null, created_by: user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Expense added"); qc.invalidateQueries(); onOpenChange(false); setF((s) => ({ ...s, title: "", amount: "", notes: "" })); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader><SheetTitle>Add expense</SheetTitle></SheetHeader>
        <div className="space-y-4 py-4">
          <Field label="Title"><Input className="h-12 rounded-xl" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Electricity bill" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (PKR)"><Input type="number" className="h-12 rounded-xl" value={f.amount} onChange={(e) => set("amount", e.target.value)} /></Field>
            <Field label="Date"><Input type="date" className="h-12 rounded-xl" value={f.spent_on} onChange={(e) => set("spent_on", e.target.value)} /></Field>
            <Field label="Category">
              <Select value={f.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Paid by">
              <Select value={f.method} onValueChange={(v) => set("method", v)}>
                <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Notes"><Textarea rows={2} className="rounded-xl" value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
          <Button className="w-full h-12 rounded-xl font-bold" disabled={save.isPending} onClick={() => save.mutate()}>Save expense</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
