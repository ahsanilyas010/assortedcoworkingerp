import { STATUS_LABELS, STATUS_STYLES } from "@/lib/format";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold", STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700", className)}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
