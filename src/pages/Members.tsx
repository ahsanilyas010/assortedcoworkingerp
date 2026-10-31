import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useTenantId } from "@/context/TenantContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { MemberSheet } from "@/components/MemberSheet";
import { pkr, prettyPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Member } from "@/lib/types";

const FILTERS = [
  { v: "", l: "All" },
  { v: "active", l: "Active" },
  { v: "pending_payment", l: "Pending" },
  { v: "suspended", l: "Suspended" },
  { v: "inactive", l: "Inactive" },
];

export default function Members() {
  const tenantId = useTenantId();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const [q, setQ] = useState("");
  const [add, setAdd] = useState(false);

  const members = useQuery({
    queryKey: ["members", tenantId, "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cw_members").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Member[];
    },
  });

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (members.data ?? []).filter((m) => (!status || m.status === status) && (!s || [m.full_name, m.member_no, m.phone, m.email, m.company].some((x) => x?.toLowerCase().includes(s))));
  }, [members.data, status, q]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Members</h1>
        <Button size="sm" className="rounded-xl" onClick={() => setAdd(true)}><Plus className="h-4 w-4 mr-1" /> Add</Button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
        <Input className="h-12 rounded-xl pl-9" placeholder="Search name, number, company" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button key={f.v} onClick={() => setParams(f.v ? { status: f.v } : {})} className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-semibold", status === f.v ? "bg-primary text-white border-primary" : "bg-card")}>{f.l}</button>
        ))}
      </div>
      {members.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!members.isLoading && list.length === 0 && <Card className="p-4 rounded-2xl text-sm text-muted-foreground">No members here yet.</Card>}
      {list.map((m) => (
        <Link key={m.id} to={`/members/${m.id}`} className="block">
          <Card className="p-4 rounded-2xl flex items-center justify-between">
            <div className="min-w-0">
              <div className="font-semibold truncate">{m.full_name}{m.company ? <span className="text-muted-foreground font-normal"> · {m.company}</span> : null}</div>
              <div className="text-xs text-muted-foreground">{m.member_no} · {prettyPhone(m.phone)} · {m.plan_name} × {m.seats}</div>
            </div>
            <div className="text-right shrink-0 ml-3">
              <div className="font-bold text-sm">{pkr(m.monthly_fee)}</div>
              <StatusBadge status={m.status} />
            </div>
          </Card>
        </Link>
      ))}
      <MemberSheet open={add} onOpenChange={setAdd} />
    </div>
  );
}
