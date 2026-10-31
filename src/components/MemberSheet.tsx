import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/Field";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/context/TenantContext";
import { pkr, todayIso } from "@/lib/format";
import type { Member, MemberStatus } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  member?: Member | null; // edit mode when present
}

const normalizePhone = (raw: string) => {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("0")) return "92" + d.slice(1);
  if (d.length === 10 && d.startsWith("3")) return "92" + d;
  return d;
};

export function MemberSheet({ open, onOpenChange, member }: Props) {
  const { tenant } = useTenant();
  const qc = useQueryClient();
  const plans = useMemo(() => (tenant?.pricing ?? []).filter((p) => !p.addon), [tenant]);
  const addon = useMemo(() => (tenant?.pricing ?? []).find((p) => p.code === "meeting_room_addon"), [tenant]);

  const [f, setF] = useState({
    full_name: "", phone: "", email: "", company: "", cnic: "", plan_code: plans[0]?.code ?? "", seats: "1",
    meeting_room: false, start_date: todayIso(), billing_day: String(tenant?.billing_day ?? 28), status: "active" as MemberStatus,
    emergency_contact: "", notes: "",
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!open) return;
    if (member) {
      setF({
        full_name: member.full_name, phone: member.phone, email: member.email ?? "", company: member.company ?? "", cnic: member.cnic ?? "",
        plan_code: member.plan_code, seats: String(member.seats), meeting_room: member.plan_name.includes("Meeting Room"),
        start_date: member.start_date, billing_day: String(member.billing_day), status: member.status,
        emergency_contact: member.emergency_contact ?? "", notes: member.notes ?? "",
      });
    } else {
      setF((s) => ({ ...s, full_name: "", phone: "", email: "", company: "", cnic: "", seats: "1", meeting_room: false, start_date: todayIso(), status: "active", emergency_contact: "", notes: "", plan_code: plans[0]?.code ?? "" }));
    }
  }, [open, member, plans]);

  const plan = plans.find((p) => p.code === f.plan_code);
  const seats = Math.max(1, Number(f.seats) || 1);
  const monthly = plan ? Number(plan.price) * seats + (f.meeting_room && addon ? Number(addon.price) : 0) : 0;
  const deposit = plan && plan.deposit !== false ? Number(tenant?.deposit_per_seat ?? 0) * seats : 0;

  const save = useMutation({
    mutationFn: async () => {
      if (!tenant) throw new Error("No tenant");
      if (!f.full_name.trim()) throw new Error("Name is required");
      const phone = normalizePhone(f.phone);
      if (phone.length < 10) throw new Error("Enter a valid phone");
      if (!plan) throw new Error("Pick a plan");
      const row = {
        tenant_id: tenant.id,
        full_name: f.full_name.trim(),
        phone,
        email: f.email.trim() || null,
        company: f.company.trim() || null,
        cnic: f.cnic.replace(/\D/g, "") || null,
        plan_code: plan.code,
        plan_name: plan.name + (f.meeting_room ? " + Meeting Room" : ""),
        plan_price: Number(plan.price),
        seats,
        monthly_fee: monthly,
        deposit,
        start_date: f.start_date,
        billing_day: Number(f.billing_day) || 28,
        status: f.status,
        emergency_contact: f.emergency_contact.trim() || null,
        notes: f.notes.trim() || null,
        ...(f.status === "active" && !member?.activated_at ? { activated_at: new Date().toISOString() } : {}),
      };
      const q = member ? supabase.from("cw_members").update(row).eq("id", member.id) : supabase.from("cw_members").insert(row);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(member ? "Member updated" : "Member added");
      qc.invalidateQueries();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[92vh] overflow-y-auto">
        <SheetHeader><SheetTitle>{member ? "Edit member" : "Add member"}</SheetTitle></SheetHeader>
        <div className="space-y-4 py-4">
          <Field label="Full name"><Input className="h-12 rounded-xl" value={f.full_name} onChange={(e) => set("full_name", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="WhatsApp number"><Input type="tel" className="h-12 rounded-xl" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0321…" /></Field>
            <Field label="Email"><Input type="email" className="h-12 rounded-xl" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
            <Field label="Company"><Input className="h-12 rounded-xl" value={f.company} onChange={(e) => set("company", e.target.value)} /></Field>
            <Field label="CNIC"><Input className="h-12 rounded-xl" value={f.cnic} onChange={(e) => set("cnic", e.target.value)} /></Field>
          </div>
          <Field label="Plan">
            <Select value={f.plan_code} onValueChange={(v) => set("plan_code", v)}>
              <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Plan" /></SelectTrigger>
              <SelectContent>
                {plans.map((p) => <SelectItem key={p.code} value={p.code}>{p.name} · {pkr(p.price)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Seats"><Input type="number" min={1} className="h-12 rounded-xl" value={f.seats} onChange={(e) => set("seats", e.target.value)} /></Field>
            <Field label="Start date"><Input type="date" className="h-12 rounded-xl" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} /></Field>
            <Field label="Billing day"><Input type="number" min={1} max={28} className="h-12 rounded-xl" value={f.billing_day} onChange={(e) => set("billing_day", e.target.value)} /></Field>
          </div>
          {addon && (
            <label className="flex items-center gap-3 rounded-xl border p-3 text-sm">
              <Checkbox checked={f.meeting_room} onCheckedChange={(v) => set("meeting_room", v === true)} />
              {addon.name} (+{pkr(addon.price)}/month)
            </label>
          )}
          <Field label="Status">
            <Select value={f.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending_payment">Pending payment</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Emergency contact"><Input className="h-12 rounded-xl" value={f.emergency_contact} onChange={(e) => set("emergency_contact", e.target.value)} /></Field>
          <Field label="Notes"><Textarea rows={2} className="rounded-xl" value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-sm flex justify-between">
            <span>Monthly fee</span><b>{pkr(monthly)}</b>
          </div>
          <Button className="w-full h-12 rounded-xl font-bold" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : member ? "Save changes" : "Add member"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
