import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useTenant, useTenantId } from "@/context/TenantContext";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RecordPaymentSheet } from "@/components/RecordPaymentSheet";
import { fmtDate, pkr } from "@/lib/format";
import type { DashboardMetrics, Invoice, Member } from "@/lib/types";

export default function Dashboard() {
  const tenantId = useTenantId();
  const { tenant } = useTenant();
  const [pay, setPay] = useState(false);

  const metrics = useQuery({
    queryKey: ["metrics", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("cw_dashboard_metrics").select("*").eq("tenant_id", tenantId).single();
      if (error) throw error;
      return data as DashboardMetrics;
    },
  });
  const pending = useQuery({
    queryKey: ["members", tenantId, "pending"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cw_members").select("*").eq("tenant_id", tenantId).eq("status", "pending_payment").order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data as Member[];
    },
  });
  const due = useQuery({
    queryKey: ["invoices", tenantId, "due"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cw_invoices").select("*, cw_members(full_name, member_no, phone)").eq("tenant_id", tenantId).in("status", ["sent", "overdue"]).order("due_date").limit(10);
      if (error) throw error;
      return data as Invoice[];
    },
  });

  const m = metrics.data;
  const occupancy = m ? Math.round((m.active_seats / Math.max(1, m.capacity)) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Today</h1>
        <Button size="sm" className="rounded-xl" onClick={() => setPay(true)}><Plus className="h-4 w-4 mr-1" /> Payment</Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Occupancy" value={m ? `${m.active_seats} / ${m.capacity}` : "…"} sub={m ? `${occupancy}% of seats` : undefined} tone={occupancy >= 80 ? "good" : undefined} />
        <StatCard label="Monthly revenue" value={m ? pkr(m.mrr) : "…"} sub={m ? `${m.active_members} active members` : undefined} />
        <StatCard label="Outstanding" value={m ? pkr(m.outstanding) : "…"} sub={m && Number(m.overdue) > 0 ? `${pkr(m.overdue)} overdue` : "nothing overdue"} tone={m && Number(m.overdue) > 0 ? "bad" : undefined} />
        <StatCard label="Collected this month" value={m ? pkr(m.collected_this_month) : "…"} sub={m ? `expenses ${pkr(m.expenses_this_month)}` : undefined} tone="good" />
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Awaiting payment ({pending.data?.length ?? 0})</h2>
          <Link to="/members?status=pending_payment" className="text-sm text-primary">See all</Link>
        </div>
        {pending.data?.length === 0 && <Card className="p-4 rounded-2xl text-sm text-muted-foreground">No new signups waiting. Share the form: {`https://coworking.assorted.group/join`}</Card>}
        {pending.data?.map((p) => (
          <Link key={p.id} to={`/members/${p.id}`} className="block">
            <Card className="p-4 rounded-2xl flex items-center justify-between">
              <div>
                <div className="font-semibold">{p.full_name}</div>
                <div className="text-xs text-muted-foreground">{p.member_no} · {p.plan_name} × {p.seats} · from {fmtDate(p.start_date)}</div>
              </div>
              <div className="text-right">
                <div className="font-bold">{pkr(Number(p.monthly_fee) + Number(p.deposit))}</div>
                <StatusBadge status={p.status} />
              </div>
            </Card>
          </Link>
        ))}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Unpaid invoices</h2>
          <Link to="/invoices" className="text-sm text-primary">See all</Link>
        </div>
        {due.data?.length === 0 && <Card className="p-4 rounded-2xl text-sm text-muted-foreground">Everything is paid up.</Card>}
        {due.data?.map((i) => (
          <Card key={i.id} className="p-4 rounded-2xl flex items-center justify-between">
            <div>
              <div className="font-semibold">{i.cw_members?.full_name}</div>
              <div className="text-xs text-muted-foreground">{i.invoice_no} · due {fmtDate(i.due_date)}</div>
            </div>
            <div className="text-right">
              <div className="font-bold">{pkr(i.amount)}</div>
              <StatusBadge status={i.status} />
            </div>
          </Card>
        ))}
      </section>
      <p className="text-xs text-muted-foreground">Billing day: {tenant?.billing_day}th of every month.</p>
      <RecordPaymentSheet open={pay} onOpenChange={setPay} />
    </div>
  );
}
