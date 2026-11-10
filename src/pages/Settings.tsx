import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/context/TenantContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { parseEmails } from "@/lib/functions";
import { Field } from "@/components/Field";
import type { PricingEntry, Tenant } from "@/lib/types";

export default function Settings() {
  const { tenant, role, refresh } = useTenant();
  const [t, setT] = useState<Tenant | null>(tenant);
  const [ccText, setCcText] = useState((tenant?.invoice_cc ?? []).join(", "));
  useEffect(() => { setT(tenant); setCcText((tenant?.invoice_cc ?? []).join(", ")); }, [tenant]);
  const owner = role === "owner";

  const save = useMutation({
    mutationFn: async () => {
      if (!t) return;
      const cc = parseEmails(ccText);
      if (cc.invalid.length) throw new Error(`Not a valid email: ${cc.invalid.join(", ")}`);
      const { error } = await supabase.from("cw_tenants").update({
        name: t.name, address: t.address, phone: t.phone, email: t.email, owner_email: t.owner_email, owner_phone: t.owner_phone,
        bank_details: t.bank_details, billing_day: Number(t.billing_day), deposit_per_seat: Number(t.deposit_per_seat), capacity: Number(t.capacity),
        pricing: t.pricing.map((p) => ({ ...p, price: Number(p.price) })),
        invoice_cc: cc.valid, auto_send_invoices: t.auto_send_invoices,
      }).eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Settings saved"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!t) return null;
  const set = (k: keyof Tenant, v: unknown) => setT({ ...t, [k]: v } as Tenant);
  const setBank = (k: string, v: string) => setT({ ...t, bank_details: { ...t.bank_details, [k]: v } });
  const setPlan = (i: number, k: keyof PricingEntry, v: unknown) => {
    const pricing = t.pricing.map((p, idx) => (idx === i ? { ...p, [k]: v } : p));
    setT({ ...t, pricing });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">Settings</h1>
      {!owner && <p className="text-xs text-amber-700">Only owners can change settings.</p>}
      <Card className="p-4 rounded-2xl space-y-3">
        <h2 className="font-bold">Business</h2>
        <Field label="Name"><Input className="h-11 rounded-xl" value={t.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Address"><Input className="h-11 rounded-xl" value={t.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><Input className="h-11 rounded-xl" value={t.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="Email"><Input className="h-11 rounded-xl" value={t.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Owner alert email" hint="Gets an email on every signup"><Input className="h-11 rounded-xl" value={t.owner_email ?? ""} onChange={(e) => set("owner_email", e.target.value)} /></Field>
          <Field label="Owner alert WhatsApp" hint="Your personal number, not the business line"><Input className="h-11 rounded-xl" value={t.owner_phone ?? ""} onChange={(e) => set("owner_phone", e.target.value)} placeholder="03xx…" /></Field>
        </div>
      </Card>
      <Card className="p-4 rounded-2xl space-y-3">
        <h2 className="font-bold">Billing</h2>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Billing day"><Input type="number" min={1} max={28} className="h-11 rounded-xl" value={t.billing_day} onChange={(e) => set("billing_day", e.target.value)} /></Field>
          <Field label="Deposit / seat"><Input type="number" className="h-11 rounded-xl" value={t.deposit_per_seat} onChange={(e) => set("deposit_per_seat", e.target.value)} /></Field>
          <Field label="Capacity (seats)"><Input type="number" className="h-11 rounded-xl" value={t.capacity} onChange={(e) => set("capacity", e.target.value)} /></Field>
        </div>
        <div className="flex items-start justify-between gap-4 rounded-xl border p-3">
          <div>
            <div className="text-sm font-semibold">Send invoices automatically on the {t.billing_day}th</div>
            <p className="text-xs text-muted-foreground">On: every active monthly member gets their invoice (WhatsApp and email with the PDF) without you approving each one. Off: invoices wait as drafts for you to approve one by one.</p>
          </div>
          <Switch checked={t.auto_send_invoices} disabled={!owner} onCheckedChange={(v) => set("auto_send_invoices", v)} />
        </div>
        <Field label="CC on every invoice email" hint="Optional. Separate several addresses with commas.">
          <Input className="h-11 rounded-xl" inputMode="email" placeholder="accounts@example.com" value={ccText} onChange={(e) => setCcText(e.target.value)} />
        </Field>
        <Field label="Bank"><Input className="h-11 rounded-xl" value={t.bank_details.bank ?? ""} onChange={(e) => setBank("bank", e.target.value)} /></Field>
        <Field label="Account title"><Input className="h-11 rounded-xl" value={t.bank_details.account_title ?? ""} onChange={(e) => setBank("account_title", e.target.value)} /></Field>
        <Field label="Account number"><Input className="h-11 rounded-xl" value={t.bank_details.account_no ?? ""} onChange={(e) => setBank("account_no", e.target.value)} /></Field>
      </Card>
      <Card className="p-4 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Plans and prices</h2>
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => set("pricing", [...t.pricing, { code: `plan_${Date.now()}`, name: "New plan", price: 0, period: "month", unit: "seat", deposit: true }])}><Plus className="h-4 w-4" /></Button>
        </div>
        <p className="text-xs text-muted-foreground">These feed the signup form and new invoices. Existing members keep their snapshot price until you edit them.</p>
        {t.pricing.map((p, i) => (
          <div key={p.code} className="grid grid-cols-[1fr_90px_auto_auto] gap-2 items-center">
            <Input className="h-10 rounded-lg" value={p.name} onChange={(e) => setPlan(i, "name", e.target.value)} />
            <Input type="number" className="h-10 rounded-lg" value={p.price} onChange={(e) => setPlan(i, "price", e.target.value)} />
            <label className="flex items-center gap-1 text-[11px]"><Checkbox checked={p.deposit !== false && !p.addon} disabled={!!p.addon} onCheckedChange={(v) => setPlan(i, "deposit", v === true)} />dep.</label>
            <button className="text-muted-foreground" onClick={() => set("pricing", t.pricing.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </Card>
      <Button className="w-full h-12 rounded-xl font-bold" disabled={!owner || save.isPending} onClick={() => save.mutate()}>Save settings</Button>
    </div>
  );
}
