import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthContext";
import type { Tenant } from "@/lib/types";

interface TenantValue {
  tenant: Tenant | null;
  role: "owner" | "staff" | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const TenantContext = createContext<TenantValue | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["tenant", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cw_tenant_users")
        .select("role, cw_tenants(*)")
        .eq("user_id", user!.id)
        .order("created_at")
        .limit(1);
      if (error) throw error;
      const row = data?.[0] as unknown as { role: "owner" | "staff"; cw_tenants: Tenant } | undefined;
      return row ? { tenant: row.cw_tenants, role: row.role } : { tenant: null, role: null };
    },
  });

  return (
    <TenantContext.Provider
      value={{
        tenant: q.data?.tenant ?? null,
        role: q.data?.role ?? null,
        loading: !!user && q.isLoading,
        error: q.error ? (q.error as Error).message : null,
        refresh: () => qc.invalidateQueries({ queryKey: ["tenant"] }),
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant outside TenantProvider");
  return ctx;
}

/** Non-null tenant for pages that render only inside the app shell. */
export function useTenantId() {
  const { tenant } = useTenant();
  if (!tenant) throw new Error("tenant not loaded");
  return tenant.id;
}
