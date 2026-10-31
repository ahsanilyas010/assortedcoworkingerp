import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Home, Users, FileText, Wallet, MoreHorizontal, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/members", label: "Members", icon: Users },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/money", label: "Money", icon: Wallet },
  { to: "/more", label: "More", icon: MoreHorizontal },
];

export default function AppShell() {
  const { signOut } = useAuth();
  const { tenant } = useTenant();
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 bg-[#0f1c3c] text-white" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex items-center justify-between px-4 h-14">
          <button onClick={() => nav("/")} className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="h-7 w-7 rounded-md bg-white/10 p-0.5" />
            <span className="font-bold text-sm">{tenant?.name ?? "ERP"}</span>
          </button>
          <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <main className="flex-1 px-4 pt-4 pb-24 max-w-3xl w-full mx-auto">
        <Outlet />
      </main>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5 max-w-3xl mx-auto">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", isActive ? "text-primary" : "text-muted-foreground")
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
