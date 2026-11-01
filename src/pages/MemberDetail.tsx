import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, MessageCircle, Pencil, Phone, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useTenantId } from "@/context/TenantContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { RecordPaymentSheet } from "@/components/RecordPaymentSheet";
import { MemberSheet } from "@/components/MemberSheet";
import { fmtDate, monthLabel, pkr, prettyPhone, waLink } from "@/lib/format";
import { describeSend, sendInvoice } from "@/lib/functions";
import type { Invoice, Member, MemberStatus, Payment } from "@/lib/types";

export default function MemberDetail() {
  const { id } = useParams();
  const tenantId = useTenantId();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [pay, setPay] = useState<Invoice | null | false>(false);
  const [edit, setEdit] = useState(false);

  const member = useQuery({
    queryKey: ["member", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cw_members").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as Member;
    },
  });
  const invoices = useQuery({
    queryKey: ["invoices", tenantId, "member", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cw_invoices").select("*").eq("member_id", id!).order("period_month", { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
  });
  const payments = useQuery({
    queryKey: ["payments", tenantId, "member", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cw_payments").select("*").eq("member_id", id!).order("paid_on", { ascending: false });
      if (error) throw error;
      return data as Payment[];
    },
  });

  const setStatus = useMutation({
    mutationFn: async (status: MemberStatus) => {
      const patch: Partial<Member> = { status };
      if (status === "active" && !member.data?.activated_at) patch.activated_at = new Date().toISOString();
      const { error } = await supabase.from("cw_members").update(patch).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status updated"); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const resend = useMutation({
    mutationFn: (invoice_id: string) => sendInvoice(invoice_id, false),
    onSuccess: (d) => { toast.success(describeSend(d)); qc.invalidateQueries({ queryKey: ["messages"] }); },
    onError: (e: Error) => toast.error(`Could not send: ${e.message}`),
  });
  const approve = useMutation({
    mutationFn: (invoice_id: string) => sendInvoice(invoice_id, true),
    onSuccess: (d) => { toast.success(`Approved. ${describeSend(d)}`); qc.invalidateQueries(); },
    onError: (e: Error) => { toast.error(e.message); qc.invalidateQueries(); },
  });

  const m = member.data;
  if (member.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!m) return <p className="text-sm">Member not found. <Link to="/members" className="text-primary">Back</Link></p>;

  const waText = `Hi ${m.full_name.split(" ")[0]}, this is Assorted Coworking.`;

  return (
    <div className="space-y-4">
      <button onClick={() => nav(-1)} className="text-sm text-muted-foreground inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> Back</button>
      <Card className="p-4 rounded-2xl space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-black">{m.full_name}</h1>
            <div className="text-sm text-muted-foreground">{m.member_no}{m.company ? ` · ${m.company}` : ""}</div>
          </div>
          <StatusBadge status={m.status} />
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><div className="text-xs text-muted-foreground">Plan</div>{m.plan_name} × {m.seats}</div>
          <div><div className="text-xs text-muted-foreground">Monthly fee</div><b>{pkr(m.monthly_fee)}</b></div>
          <div><div className="text-xs text-muted-foreground">Deposit held</div>{pkr(m.deposit)}</div>
          <div><div className="text-xs text-muted-foreground">Since</div>{fmtDate(m.start_date)} · bills on {m.billing_day}th</div>
          <div><div className="text-xs text-muted-foreground">Phone</div>{prettyPhone(m.phone)}</div>
          <div><div className="text-xs text-muted-foreground">Email</div><span className="break-all">{m.email ?? "—"}</span></div>
          {m.cnic && <div><div className="text-xs text-muted-foreground">CNIC</div>{m.cnic}</div>}
          {m.emergency_contact && <div><div className="text-xs text-muted-foreground">Emergency</div>{m.emergency_contact}</div>}
        </div>
        {m.notes && <p className="text-sm bg-muted rounded-xl p-3">{m.notes}</p>}
        <div className="flex gap-2 flex-wrap">
          <Button asChild size="sm" variant="outline" className="rounded-xl"><a href={waLink(m.phone, waText)} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4 mr-1" /> WhatsApp</a></Button>
          <Button asChild size="sm" variant="outline" className="rounded-xl"><a href={`tel:+${m.phone}`}><Phone className="h-4 w-4 mr-1" /> Call</a></Button>
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setEdit(true)}><Pencil className="h-4 w-4 mr-1" /> Edit</Button>
          <Button size="sm" className="rounded-xl" onClick={() => setPay(null)}><Plus className="h-4 w-4 mr-1" /> Payment</Button>
        </div>
        <div className="flex gap-2 flex-wrap pt-1 border-t">
          {m.status !== "active" && <Button size="sm" variant="secondary" className="rounded-xl" onClick={() => setStatus.mutate("active")}>Mark active</Button>}
          {m.status === "active" && <Button size="sm" variant="secondary" className="rounded-xl" onClick={() => setStatus.mutate("suspended")}>Suspend</Button>}
          {m.status !== "inactive" && <Button size="sm" variant="ghost" className="rounded-xl text-muted-foreground" onClick={() => setStatus.mutate("inactive")}>Mark left</Button>}
        </div>
      </Card>

      <section className="space-y-2">
        <h2 className="font-bold">Invoices</h2>
        {invoices.data?.length === 0 && <p className="text-sm text-muted-foreground">No invoices yet.</p>}
        {invoices.data?.map((i) => (
          <Card key={i.id} className="p-4 rounded-2xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{i.invoice_no} <span className="text-muted-foreground font-normal text-xs">· {i.kind}</span></div>
                <div className="text-xs text-muted-foreground">{monthLabel(i.period_month)} · due {fmtDate(i.due_date)}</div>
              </div>
              <div className="text-right">
                <div className="font-bold">{pkr(i.amount)}</div>
                <StatusBadge status={i.status} />
              </div>
            </div>
            {i.status === "draft" && (
              <div className="flex gap-2 mt-3">
                <Button size="sm" className="rounded-xl" disabled={approve.isPending} onClick={() => approve.mutate(i.id)}>Approve &amp; send</Button>
              </div>
            )}
            {(i.status === "sent" || i.status === "overdue") && (
              <div className="flex gap-2 mt-3">
                <Button size="sm" className="rounded-xl" onClick={() => setPay(i)}>Record payment</Button>
                <Button size="sm" variant="outline" className="rounded-xl" disabled={resend.isPending} onClick={() => resend.mutate(i.id)}>Resend</Button>
              </div>
            )}
          </Card>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">Payments</h2>
        {payments.data?.length === 0 && <p className="text-sm text-muted-foreground">No payments recorded.</p>}
        {payments.data?.map((p) => (
          <Card key={p.id} className="p-3 rounded-2xl flex items-center justify-between text-sm">
            <div>{fmtDate(p.paid_on)} · {p.method.replace("_", " ")}{p.reference ? ` · ${p.reference}` : ""}</div>
            <b>{pkr(p.amount)}</b>
          </Card>
        ))}
      </section>

      <RecordPaymentSheet open={pay !== false} onOpenChange={(v) => !v && setPay(false)} member={m} invoice={pay || null} />
      <MemberSheet open={edit} onOpenChange={setEdit} member={m} />
    </div>
  );
}
