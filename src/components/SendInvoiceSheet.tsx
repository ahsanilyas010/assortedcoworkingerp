import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Download, Send } from "lucide-react";
import { useTenant } from "@/context/TenantContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Field } from "@/components/Field";
import { describeSend, downloadInvoicePdf, parseEmails, sendInvoice } from "@/lib/functions";
import { pkr } from "@/lib/format";

export interface SendTarget {
  id: string;
  invoice_no: string;
  amount: number;
  member_name: string;
  approve: boolean;
}

/** Asks for optional CC addresses, then approves (draft) or resends an invoice. The email carries the PDF. */
export function SendInvoiceSheet({ target, onClose }: { target: SendTarget | null; onClose: () => void }) {
  const { tenant } = useTenant();
  const qc = useQueryClient();
  const [cc, setCc] = useState("");
  useEffect(() => { if (target) setCc(""); }, [target]);
  const parsed = parseEmails(cc);
  const defaults = tenant?.invoice_cc ?? [];

  const send = useMutation({
    mutationFn: async () => {
      if (!target) return null;
      if (parsed.invalid.length) throw new Error(`Not a valid email: ${parsed.invalid.join(", ")}`);
      return sendInvoice(target.id, target.approve, parsed.valid);
    },
    onSuccess: (d) => {
      if (d) toast.success(`${target?.approve ? "Approved. " : ""}${describeSend(d)}`);
      qc.invalidateQueries();
      onClose();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      qc.invalidateQueries();
    },
  });
  const pdf = useMutation({
    mutationFn: () => downloadInvoicePdf(target!.id),
    onError: (e: Error) => toast.error(`Could not make the PDF: ${e.message}`),
  });

  return (
    <Sheet open={!!target} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader><SheetTitle>{target?.approve ? "Approve & send" : "Resend"} {target?.invoice_no}</SheetTitle></SheetHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">{target?.member_name} · {target ? pkr(target.amount) : ""}. WhatsApp and email go out now; the email has the full PDF invoice attached.</p>
          <Field label="CC (optional)" hint={defaults.length ? `Always copied: ${defaults.join(", ")}` : "Separate several addresses with commas. Set an address that is copied on every invoice in Settings."}>
            <Input type="email" multiple inputMode="email" className="h-12 rounded-xl" placeholder="accounts@example.com" value={cc} onChange={(e) => setCc(e.target.value)} />
          </Field>
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <Button variant="outline" className="h-12 rounded-xl" disabled={pdf.isPending} onClick={() => pdf.mutate()}><Download className="h-4 w-4 mr-1" /> PDF</Button>
            <Button className="h-12 rounded-xl font-bold" disabled={send.isPending} onClick={() => send.mutate()}>
              {target?.approve ? <CheckCircle2 className="h-4 w-4 mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              {send.isPending ? "Sending…" : target?.approve ? "Approve & send" : "Send"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
