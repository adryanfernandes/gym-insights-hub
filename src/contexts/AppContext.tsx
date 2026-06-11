import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Filters = {
  periodo: string;
  unidade: string;
  tipoContrato: string;
  sexo: string;
  faixaEtaria: string;
};

type Ctx = {
  theme: "light" | "dark";
  toggleTheme: () => void;
  filters: Filters;
  setFilters: (f: Partial<Filters>) => void;
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

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  return (
    <AppCtx.Provider
      value={{
        theme,
        toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
        filters,
        setFilters: (f) => setFiltersState((prev) => ({ ...prev, ...f })),
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
