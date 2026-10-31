import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useTenantId } from "@/context/TenantContext";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import type { MessageLog } from "@/lib/types";

const CH = [
  { v: "", l: "All" },
  { v: "whatsapp", l: "WhatsApp" },
  { v: "email", l: "Email" },
];

export default function Messages() {
  const tenantId = useTenantId();
  const [ch, setCh] = useState("");
  const logs = useQuery({
    queryKey: ["messages", tenantId, ch],
    queryFn: async () => {
      let q = supabase.from("cw_message_log").select("*, cw_members(full_name, member_no)").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(200);
      if (ch) q = q.eq("channel", ch);
      const { data, error } = await q;
      if (error) throw error;
      return data as MessageLog[];
    },
  });
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-black">Message log</h1>
      <div className="flex gap-2">
        {CH.map((c) => (
          <button key={c.v} onClick={() => setCh(c.v)} className={cn("rounded-full border px-3 py-1 text-xs font-semibold", ch === c.v ? "bg-primary text-white border-primary" : "bg-card")}>{c.l}</button>
        ))}
      </div>
      {logs.data?.length === 0 && <Card className="p-4 rounded-2xl text-sm text-muted-foreground">Nothing sent yet.</Card>}
      {logs.data?.map((l) => (
        <Card key={l.id} className="p-3 rounded-2xl text-sm">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{l.cw_members?.full_name ?? l.recipient}</div>
            <StatusBadge status={l.status} />
          </div>
          <div className="text-xs text-muted-foreground">{format(parseISO(l.created_at), "d MMM, HH:mm")} · {l.channel} · {l.template ?? "—"} · {l.recipient}</div>
          {l.error && <div className="text-xs text-red-700 mt-1">{l.error}</div>}
        </Card>
      ))}
    </div>
  );
}
