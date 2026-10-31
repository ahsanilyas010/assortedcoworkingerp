import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/Field";
import { supabase, RECEIPTS_BUCKET } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useTenantId } from "@/context/TenantContext";
import { METHOD_LABELS, pkr, todayIso } from "@/lib/format";
import type { Invoice, Member, PaymentMethod } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  member?: Pick<Member, "id" | "full_name" | "member_no"> | null;
  invoice?: Invoice | null;
}

export function RecordPaymentSheet({ open, onOpenChange, member, invoice }: Props) {
  const tenantId = useTenantId();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [memberId, setMemberId] = useState(member?.id ?? "");
  const [invoiceId, setInvoiceId] = useState(invoice?.id ?? "");
  const [amount, setAmount] = useState(invoice ? String(invoice.amount) : "");
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [paidOn, setPaidOn] = useState(todayIso());
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (open) {
      setMemberId(member?.id ?? "");
      setInvoiceId(invoice?.id ?? "");
      setAmount(invoice ? String(invoice.amount) : "");
      setFile(null);
      setReference("");
      setNotes("");
    }
  }, [open, member, invoice]);

  const members = useQuery({
    queryKey: ["members-lite", tenantId],
    enabled: open && !member,
    queryFn: async () => {
      const { data, error } = await supabase.from("cw_members").select("id, full_name, member_no").eq("tenant_id", tenantId).order("full_name");
      if (error) throw error;
      return data as Pick<Member, "id" | "full_name" | "member_no">[];
    },
  });

  const openInvoices = useQuery({
    queryKey: ["open-invoices", tenantId, memberId],
    enabled: open && !!memberId && !invoice,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cw_invoices")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("member_id", memberId)
        .in("status", ["sent", "overdue", "draft"])
        .order("due_date");
      if (error) throw error;
      return data as Invoice[];
    },
  });

  const selectedInvoice = useMemo(
    () => invoice ?? openInvoices.data?.find((i) => i.id === invoiceId) ?? null,
    [invoice, openInvoices.data, invoiceId],
  );

  useEffect(() => {
    if (selectedInvoice && !invoice) setAmount(String(selectedInvoice.amount));
  }, [selectedInvoice, invoice]);

  const save = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!memberId) throw new Error("Pick a member");
      if (!(amt > 0)) throw new Error("Enter an amount");
      let receipt_path: string | null = null;
      if (file) {
        const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        receipt_path = `${tenantId}/${memberId}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage.from(RECEIPTS_BUCKET).upload(receipt_path, file, { contentType: file.type });
        if (upErr) throw upErr;
      }
      const { error } = await supabase.from("cw_payments").insert({
        tenant_id: tenantId,
        member_id: memberId,
        invoice_id: invoiceId || null,
        amount: amt,
        method,
        paid_on: paidOn,
        reference: reference || null,
        receipt_path,
        notes: notes || null,
        recorded_by: user?.id ?? null,
      });
      if (error) throw error;

      if (invoiceId) {
        const { data: sums } = await supabase.from("cw_payments").select("amount").eq("invoice_id", invoiceId);
        const paid = (sums ?? []).reduce((a, p) => a + Number(p.amount), 0);
        const inv = selectedInvoice;
        if (inv && paid >= Number(inv.amount) - 0.5) {
          await supabase.from("cw_invoices").update({ status: "paid" }).eq("id", invoiceId);
        }
      }
      const { data: m } = await supabase.from("cw_members").select("status").eq("id", memberId).single();
      if (m?.status === "pending_payment") {
        await supabase.from("cw_members").update({ status: "active", activated_at: new Date().toISOString() }).eq("id", memberId);
      }
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      qc.invalidateQueries();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[92vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Record payment</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          {member ? (
            <div className="text-sm">
              <span className="text-muted-foreground">Member: </span>
              <b>{member.full_name}</b> · {member.member_no}
            </div>
          ) : (
            <Field label="Member">
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Choose member" /></SelectTrigger>
                <SelectContent>
                  {members.data?.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name} · {m.member_no}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {invoice ? (
            <div className="text-sm">
              <span className="text-muted-foreground">Invoice: </span>
              <b>{invoice.invoice_no}</b> · {pkr(invoice.amount)}
            </div>
          ) : (
            <Field label="Against invoice (optional)">
              <Select value={invoiceId} onValueChange={setInvoiceId} disabled={!memberId}>
                <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder={openInvoices.data?.length ? "Choose invoice" : "No unpaid invoices"} /></SelectTrigger>
                <SelectContent>
                  {openInvoices.data?.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.invoice_no} · {pkr(i.amount)} · due {i.due_date}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (PKR)">
              <Input type="number" inputMode="numeric" className="h-12 rounded-xl" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Method">
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(METHOD_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Paid on">
              <Input type="date" className="h-12 rounded-xl" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            </Field>
            <Field label="Reference / TID">
              <Input className="h-12 rounded-xl" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bank ref" />
            </Field>
          </div>
          <Field label="Payment screenshot" hint="Saved privately in Supabase Storage.">
            <Input type="file" accept="image/*,application/pdf" className="h-12 rounded-xl pt-2.5" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Field>
          <Field label="Notes">
            <Textarea rows={2} className="rounded-xl" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <Button className="w-full h-12 rounded-xl font-bold" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save payment"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
