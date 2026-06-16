import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Shield, ShieldCheck, Loader2, UserCog } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  head: () => ({ meta: [{ title: "Usuários — be.move BI" }] }),
  component: AdminUsersPage,
});

type Row = {
  id: string;
  display_name: string | null;
  unidade: string | null;
  role: "admin" | "gestor" | null;
};

function AdminUsersPage() {
  const { isAdmin, loadingAuth, user } = useApp();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loadingAuth && !isAdmin) navigate({ to: "/" });
  }, [isAdmin, loadingAuth, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, unidade")
      .order("created_at", { ascending: true });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role");
    const map = new Map((roles ?? []).map((r) => [r.user_id, r.role as Row["role"]]));
    setRows(
      (profiles ?? []).map((p) => ({
        id: p.id,
        display_name: p.display_name,
        unidade: p.unidade,
        role: map.get(p.id) ?? null,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  async function setRole(userId: string, newRole: "admin" | "gestor") {
    setSavingId(userId);
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    setSavingId(null);
    load();
  }

  if (loadingAuth || !isAdmin) {
    return (
      <DashboardLayout title="Usuários" subtitle="Gerenciar permissões">
        <div className="grid h-40 place-items-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Usuários" subtitle="Gerencie quem acessa o dashboard">
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <UserCog className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Usuários cadastrados</h2>
          <span className="ml-auto text-xs text-muted-foreground">
            {rows.length} {rows.length === 1 ? "usuário" : "usuários"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Nome</th>
                <th className="px-5 py-3 text-left font-medium">Unidade</th>
                <th className="px-5 py-3 text-left font-medium">Papel</th>
                <th className="px-5 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const isSelf = r.id === user?.id;
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-5 py-3">
                        {r.display_name || "—"}{" "}
                        {isSelf && (
                          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                            você
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {r.unidade || "—"}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.role === "admin"
                              ? "bg-primary/15 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {r.role === "admin" ? (
                            <ShieldCheck className="h-3 w-3" />
                          ) : (
                            <Shield className="h-3 w-3" />
                          )}
                          {r.role ?? "sem papel"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex gap-2">
                          <button
                            disabled={savingId === r.id || r.role === "gestor" || isSelf}
                            onClick={() => setRole(r.id, "gestor")}
                            className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent disabled:opacity-40"
                          >
                            Tornar gestor
                          </button>
                          <button
                            disabled={savingId === r.id || r.role === "admin"}
                            onClick={() => setRole(r.id, "admin")}
                            className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                          >
                            Tornar admin
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          Você não pode rebaixar sua própria conta para evitar bloquear o acesso de admin.
        </p>
      </div>
    </DashboardLayout>
  );
}
