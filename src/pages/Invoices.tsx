import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useTenantId } from "@/context/TenantContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Field } from "@/components/Field";
import { StatusBadge } from "@/components/StatusBadge";
import { RecordPaymentSheet } from "@/components/RecordPaymentSheet";
import { fmtDate, monthLabel, pkr, todayIso } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Invoice, Member } from "@/lib/types";

const FILTERS = [
  { v: "open", l: "Unpaid" },
  { v: "overdue", l: "Overdue" },
  { v: "paid", l: "Paid" },
  { v: "", l: "All" },
];

export default function Invoices() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const filter = params.get("f") ?? "open";
  const [pay, setPay] = useState<Invoice | null>(null);
  const [adhoc, setAdhoc] = useState(false);

  const invoices = useQuery({
    queryKey: ["invoices", tenantId, filter],
    queryFn: async () => {
      let q = supabase.from("cw_invoices").select("*, cw_members(full_name, member_no, phone)").eq("tenant_id", tenantId).order("due_date", { ascending: filter !== "paid" }).limit(200);
      if (filter === "open") q = q.in("status", ["sent", "overdue", "draft"]);
      else if (filter) q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      return data as Invoice[];
    },
  });

  const resend = useMutation({
    mutationFn: async (invoice_id: string) => {
      const { data, error } = await supabase.functions.invoke("cw-send-invoice", { body: { invoice_id } });
      if (error) throw error;
      return data as { whatsapp?: string; email?: string };
    },
    onSuccess: (d) => toast.success(`WhatsApp: ${d?.whatsapp ?? "?"} · Email: ${d?.email ?? "?"}`),
    onError: (e: Error) => toast.error(`Could not send: ${e.message}`),
  });
  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cw_invoices").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Invoice cancelled"); qc.invalidateQueries(); },
  });

  const total = (invoices.data ?? []).reduce((a, i) => a + Number(i.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Invoices</h1>
        <Button size="sm" className="rounded-xl" onClick={() => setAdhoc(true)}><Plus className="h-4 w-4 mr-1" /> Invoice</Button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button key={f.v} onClick={() => setParams({ f: f.v })} className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-semibold", filter === f.v ? "bg-primary text-white border-primary" : "bg-card")}>{f.l}</button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{invoices.data?.length ?? 0} invoices · {pkr(total)}</p>
      {invoices.data?.length === 0 && <Card className="p-4 rounded-2xl text-sm text-muted-foreground">Nothing here.</Card>}
      {invoices.data?.map((i) => (
        <Card key={i.id} className="p-4 rounded-2xl">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <Link to={`/members/${i.member_id}`} className="font-semibold truncate block">{i.cw_members?.full_name}</Link>
              <div className="text-xs text-muted-foreground">{i.invoice_no} · {monthLabel(i.period_month)} · due {fmtDate(i.due_date)}</div>
            </div>
            <div className="text-right shrink-0 ml-3">
              <div className="font-bold">{pkr(i.amount)}</div>
              <StatusBadge status={i.status} />
            </div>
          </div>
          {["sent", "overdue", "draft"].includes(i.status) && (
            <div className="flex gap-2 mt-3">
              <Button size="sm" className="rounded-xl" onClick={() => setPay(i)}>Record payment</Button>
              <Button size="sm" variant="outline" className="rounded-xl" disabled={resend.isPending} onClick={() => resend.mutate(i.id)}>Resend</Button>
              <Button size="sm" variant="ghost" className="rounded-xl text-muted-foreground" onClick={() => confirm(`Cancel ${i.invoice_no}?`) && cancel.mutate(i.id)}>Cancel</Button>
            </div>
          )}
        </Card>
      ))}
      <RecordPaymentSheet open={!!pay} onOpenChange={(v) => !v && setPay(null)} member={pay ? { id: pay.member_id, full_name: pay.cw_members?.full_name ?? "", member_no: pay.cw_members?.member_no ?? "" } : null} invoice={pay} />
      <AdhocInvoiceSheet open={adhoc} onOpenChange={setAdhoc} />
    </div>
  );
}

function AdhocInvoiceSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  const [memberId, setMemberId] = useState("");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const members = useQuery({
    queryKey: ["members-lite", tenantId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("cw_members").select("id, full_name, member_no").eq("tenant_id", tenantId).order("full_name");
      if (error) throw error;
      return data as Pick<Member, "id" | "full_name" | "member_no">[];
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!memberId || !(Number(amount) > 0)) throw new Error("Member and amount are required");
      const { error } = await supabase.from("cw_invoices").insert({
        tenant_id: tenantId, member_id: memberId, period_month: todayIso().slice(0, 7) + "-01", kind: "adhoc",
        due_date: due, amount: Number(amount), status: "sent", notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Invoice created"); qc.invalidateQueries(); onOpenChange(false); setAmount(""); setNotes(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader><SheetTitle>New one-off invoice</SheetTitle></SheetHeader>
        <div className="space-y-4 py-4">
          <Field label="Member">
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Choose member" /></SelectTrigger>
              <SelectContent>{members.data?.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name} · {m.member_no}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (PKR)"><Input type="number" className="h-12 rounded-xl" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label="Due date"><Input type="date" className="h-12 rounded-xl" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
          </div>
          <Field label="What is it for?"><Textarea rows={2} className="rounded-xl" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Printing, extra day passes, meeting room…" /></Field>
          <Button className="w-full h-12 rounded-xl font-bold" disabled={save.isPending} onClick={() => save.mutate()}>Create invoice</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
