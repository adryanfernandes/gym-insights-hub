import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import {
  LayoutDashboard,
  Wallet,
  Target,
  Users,
  UserRoundCheck,
  Moon,
  Sun,
  Dumbbell,
  FileDown,
  FileSpreadsheet,
  Menu,
  X,
  ShieldCheck,
  LogOut,
  UserCog,
  Settings,
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { FiltersBar } from "./FiltersBar";

const NAV = [
  { to: "/", label: "Geral", icon: LayoutDashboard },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/comercial", label: "Comercial", icon: Target },
  { to: "/professores", label: "Professores", icon: UserRoundCheck },
  { to: "/perfil", label: "Perfil dos Clientes", icon: Users },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

const ADMIN_NAV = [{ to: "/admin/usuarios", label: "Usuários", icon: UserCog }] as const;

export function DashboardLayout({
  title,
  subtitle,
  onExportPdf,
  onExportExcel,
  showFilters = true,
  children,
}: {
  title: string;
  subtitle?: string;
  onExportPdf?: () => void;
  onExportExcel?: () => void;
  showFilters?: boolean;
  children: ReactNode;
}) {
  const { theme, toggleTheme, user, role, isAdmin, signOut } = useApp();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-sidebar-border bg-sidebar transition-transform md:relative md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Dumbbell className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-sidebar-foreground">be.move BI</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Analytics</p>
          </div>
        </div>
        <nav className="space-y-1 p-3">
          <p className="px-3 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Visões
          </p>
          {NAV.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                preload="intent"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm shadow-primary/20"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
          {isAdmin && (
            <>
              <p className="px-3 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Administração
              </p>
              {ADMIN_NAV.map((item) => {
                const active = pathname === item.to;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    preload="intent"
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm shadow-primary/20"
                        : "text-sidebar-foreground hover:bg-sidebar-accent"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </>
          )}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-sidebar-border p-3 space-y-2">
          {user && (
            <div className="rounded-lg bg-sidebar-accent/50 p-3 text-xs">
              <div className="flex items-center gap-1.5">
                <ShieldCheck
                  className={`h-3 w-3 ${isAdmin ? "text-primary" : "text-muted-foreground"}`}
                />
                <span className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
                  {role ?? "sem papel"}
                </span>
              </div>
              <p className="mt-1 truncate text-sidebar-foreground">{user.email}</p>
              <button
                onClick={handleSignOut}
                className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-sidebar-foreground"
              >
                <LogOut className="h-3 w-3" /> Sair
              </button>
            </div>
          )}
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="grid h-9 w-9 place-items-center rounded-md border border-border md:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold sm:text-lg">{title}</h1>
              {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onExportExcel && (
              <button
                onClick={onExportExcel}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-accent transition"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Excel</span>
              </button>
            )}
            {onExportPdf && (
              <button
                onClick={onExportPdf}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-accent transition"
              >
                <FileDown className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">PDF</span>
              </button>
            )}
            <button
              onClick={toggleTheme}
              className="grid h-9 w-9 place-items-center rounded-md border border-border bg-card hover:bg-accent transition"
              aria-label="Tema"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>
        <main className="flex-1 space-y-5 p-4 md:p-6">
          {showFilters && <FiltersBar />}
          {children}
        </main>
      </div>
    </div>
  );
}
