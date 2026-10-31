import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { TenantProvider, useTenant } from "@/context/TenantContext";
import AppShell from "@/components/layout/AppShell";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Members from "@/pages/Members";
import MemberDetail from "@/pages/MemberDetail";
import Invoices from "@/pages/Invoices";
import Money from "@/pages/Money";
import More from "@/pages/More";
import Messages from "@/pages/Messages";
import Settings from "@/pages/Settings";
import { Button } from "@/components/ui/button";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

function Splash({ text }: { text: string }) {
  return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">{text}</div>;
}

function Gate() {
  const { session, loading, signOut } = useAuth();
  const { tenant, loading: tLoading, error } = useTenant();
  if (loading) return <Splash text="Loading…" />;
  if (!session) return <Navigate to="/login" replace />;
  if (tLoading) return <Splash text="Loading workspace…" />;
  if (!tenant)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-semibold">This account is not linked to a coworking workspace.</p>
        <p className="text-sm text-muted-foreground">{error ?? "Ask the owner to add you under Settings, or sign in with the owner account."}</p>
        <Button variant="outline" className="rounded-xl" onClick={signOut}>Sign out</Button>
      </div>
    );
  return <Outlet />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TenantProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<Gate />}>
                <Route element={<AppShell />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/members" element={<Members />} />
                  <Route path="/members/:id" element={<MemberDetail />} />
                  <Route path="/invoices" element={<Invoices />} />
                  <Route path="/money" element={<Money />} />
                  <Route path="/more" element={<More />} />
                  <Route path="/more/messages" element={<Messages />} />
                  <Route path="/more/settings" element={<Settings />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster position="top-center" richColors />
        </TenantProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
