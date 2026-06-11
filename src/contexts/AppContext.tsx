import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Filters = {
  periodo: string;
  unidade: string;
  tipoContrato: string;
  sexo: string;
  faixaEtaria: string;
};

export type AppRole = "admin" | "gestor";

type Ctx = {
  theme: "light" | "dark";
  toggleTheme: () => void;
  filters: Filters;
  setFilters: (f: Partial<Filters>) => void;
  user: User | null;
  role: AppRole | null;
  isAdmin: boolean;
  loadingAuth: boolean;
  signOut: () => Promise<void>;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [filters, setFiltersState] = useState<Filters>({
    periodo: "Últimos 30 dias",
    unidade: "Todas",
    tipoContrato: "Todos",
    sexo: "Todos",
    faixaEtaria: "Todas",
  });
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  useEffect(() => {
    let active = true;

    async function loadRole(userId: string) {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .order("role", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      setRole((data?.role as AppRole) ?? null);
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) loadRole(u.id);
      setLoadingAuth(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) loadRole(u.id);
      else setRole(null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <AppCtx.Provider
      value={{
        theme,
        toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
        filters,
        setFilters: (f) => setFiltersState((prev) => ({ ...prev, ...f })),
        user,
        role,
        isAdmin: role === "admin",
        loadingAuth,
        signOut: async () => {
          await supabase.auth.signOut();
          setUser(null);
          setRole(null);
        },
      }}
    >
      {children}
    </AppCtx.Provider>
  );
}

export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
};
