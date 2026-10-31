import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "warn" | "bad" }) {
  return (
    <Card className="p-4 rounded-2xl">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-2xl font-black mt-1", tone === "good" && "text-green-700", tone === "warn" && "text-amber-700", tone === "bad" && "text-red-700")}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}
