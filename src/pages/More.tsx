import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronRight, MessageSquare, Settings, Play, ExternalLink, LogOut } from "lucide-react";
import { callFn } from "@/lib/functions";
import { useAuth } from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function More() {
  const { user, signOut } = useAuth();
  const { tenant, role } = useTenant();

  const run = useMutation({
    mutationFn: (dry_run: boolean) =>
      callFn<{ created?: number; would_create?: number; members?: number; period?: string }>("cw-monthly-billing", { tenant_id: tenant?.id, dry_run }),
    onSuccess: (d, dry) =>
      toast.success(
        dry
          ? `${d.would_create ?? 0} new invoices would be drafted for ${d.period}`
          : `${d.created ?? 0} draft invoices created. Open Invoices > To approve.`,
      ),
    onError: (e: Error) => toast.error(e.message),
  });

  const Row = ({ to, icon: Icon, label, sub }: { to: string; icon: typeof MessageSquare; label: string; sub: string }) => (
    <Link to={to}>
      <Card className="p-4 rounded-2xl flex items-center gap-3">
        <Icon className="h-5 w-5 text-primary" />
        <div className="flex-1"><div className="font-semibold">{label}</div><div className="text-xs text-muted-foreground">{sub}</div></div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Card>
    </Link>
  );

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-black">More</h1>
      <Row to="/more/messages" icon={MessageSquare} label="Message log" sub="WhatsApp and email sends" />
      <Row to="/more/settings" icon={Settings} label="Settings" sub="Pricing, bank details, billing day" />
      <Card className="p-4 rounded-2xl space-y-2">
        <div className="font-semibold flex items-center gap-2"><Play className="h-4 w-4 text-primary" /> Monthly invoices</div>
        <p className="text-xs text-muted-foreground">On the {tenant?.billing_day}th at 9:00 AM next month\u2019s invoices are drafted automatically and you get an email. Nothing is sent to members until you approve each invoice.</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="rounded-xl" disabled={run.isPending} onClick={() => run.mutate(true)}>Preview</Button>
          <Button size="sm" className="rounded-xl" disabled={run.isPending || role !== "owner"} onClick={() => run.mutate(false)}>Create drafts now</Button>
        </div>
      </Card>
      <Card className="p-4 rounded-2xl space-y-1">
        <div className="font-semibold flex items-center gap-2"><ExternalLink className="h-4 w-4 text-primary" /> Induction form</div>
        <a className="text-sm text-primary break-all" href="https://coworking.assorted.group/join" target="_blank" rel="noreferrer">coworking.assorted.group/join</a>
        <p className="text-xs text-muted-foreground">Send this to every new member. Submissions appear on the Home screen under “Awaiting payment”.</p>
      </Card>
      <Card className="p-4 rounded-2xl text-sm">
        <div className="text-muted-foreground text-xs">Signed in as</div>
        <div className="font-semibold break-all">{user?.email}</div>
        <div className="text-xs text-muted-foreground">{tenant?.name} · {role}</div>
        <Button variant="ghost" size="sm" className="mt-2 rounded-xl px-0 text-red-700" onClick={signOut}><LogOut className="h-4 w-4 mr-1" /> Sign out</Button>
      </Card>
    </div>
  );
}
