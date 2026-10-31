import { useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/Field";
import { useAuth } from "@/context/AuthContext";

export default function Login() {
  const { session, signInWithPassword, signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  if (session) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const err = await signInWithPassword(email.trim(), password);
    setBusy(false);
    if (err) toast.error(err);
  };
  const magic = async () => {
    if (!email.trim()) return toast.error("Enter your email first");
    setBusy(true);
    const err = await signInWithMagicLink(email.trim());
    setBusy(false);
    if (err) toast.error(err);
    else toast.success("Check your email for the sign-in link");
  };

  return (
    <div className="min-h-screen bg-[#0f1c3c] flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm bg-card rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="" className="h-10 w-10 rounded-xl bg-[#0f1c3c] p-1" />
          <div>
            <div className="font-black text-lg leading-tight">Assorted Coworking</div>
            <div className="text-xs text-muted-foreground">Owner ERP</div>
          </div>
        </div>
        <Field label="Email"><Input type="email" autoComplete="email" className="h-12 rounded-xl" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password"><Input type="password" autoComplete="current-password" className="h-12 rounded-xl" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Button type="submit" className="w-full h-12 rounded-xl font-bold" disabled={busy}>Sign in</Button>
        <Button type="button" variant="outline" className="w-full h-12 rounded-xl" disabled={busy} onClick={magic}>Email me a sign-in link</Button>
      </form>
    </div>
  );
}
