import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import { Loader2, Shield, ShieldCheck, UserCog, UserPlus } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useApp, type AppRole } from "@/contexts/AppContext";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  head: () => ({ meta: [{ title: "Usuários - be.move BI" }] }),
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const { isAdmin, loadingAuth, user, users, addUser, updateUserRole } = useApp();
  const navigate = useNavigate();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    login: "",
    email: "",
    password: "",
    role: "gestor" as AppRole,
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loadingAuth && !isAdmin) navigate({ to: "/", replace: true });
  }, [isAdmin, loadingAuth, navigate]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setMessage("");
    setError("");

    const result = await addUser(form);
    setCreating(false);

    if (!result.ok) {
      setError(result.error ?? "Não foi possível criar o usuário.");
      return;
    }

    setForm({ displayName: "", login: "", email: "", password: "", role: "gestor" });
    setMessage("Usuário criado com sucesso.");
  }

  async function setRole(userId: string, newRole: AppRole) {
    setSavingId(userId);
    await updateUserRole(userId, newRole);
    setSavingId(null);
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
      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <UserPlus className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Adicionar usuário</h2>
        </div>

        <form onSubmit={handleCreate} className="grid gap-4 p-5 md:grid-cols-5">
          <label className="md:col-span-1">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Nome
            </span>
            <input
              value={form.displayName}
              onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="md:col-span-1">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Login
            </span>
            <input
              value={form.login}
              onChange={(event) => setForm((prev) => ({ ...prev, login: event.target.value }))}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="md:col-span-1">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              E-mail
            </span>
            <input
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              type="email"
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="md:col-span-1">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Senha
            </span>
            <input
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              type="password"
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <div className="grid grid-cols-[1fr_auto] gap-3 md:col-span-1">
            <label>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Papel
              </span>
              <select
                value={form.role}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, role: event.target.value as AppRole }))
                }
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="gestor">gestor</option>
                <option value="admin">admin</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={creating}
              className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Criar
            </button>
          </div>
        </form>

        {(error || message) && (
          <p
            className={`border-t border-border px-5 py-3 text-xs ${
              error ? "text-destructive" : "text-success"
            }`}
          >
            {error || message}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <UserCog className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Usuários cadastrados</h2>
          <span className="ml-auto text-xs text-muted-foreground">
            {users.length} {users.length === 1 ? "usuário" : "usuários"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Nome</th>
                <th className="px-5 py-3 text-left font-medium">Login</th>
                <th className="px-5 py-3 text-left font-medium">E-mail</th>
                <th className="px-5 py-3 text-left font-medium">Papel</th>
                <th className="px-5 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((row) => {
                const isSelf = row.id === user?.id;
                return (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-5 py-3">
                      {row.displayName}
                      {isSelf && (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                          você
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{row.login}</td>
                    <td className="px-5 py-3 text-muted-foreground">{row.email}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.role === "admin"
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {row.role === "admin" ? (
                          <ShieldCheck className="h-3 w-3" />
                        ) : (
                          <Shield className="h-3 w-3" />
                        )}
                        {row.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          disabled={savingId === row.id || row.role === "gestor" || isSelf}
                          onClick={() => setRole(row.id, "gestor")}
                          className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent disabled:opacity-40"
                        >
                          Tornar gestor
                        </button>
                        <button
                          disabled={savingId === row.id || row.role === "admin"}
                          onClick={() => setRole(row.id, "admin")}
                          className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                        >
                          Tornar admin
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          Apenas administradores podem acessar esta aba e criar novos usuários. Você não pode
          rebaixar sua própria conta para evitar bloquear o acesso de admin.
        </p>
      </section>
    </DashboardLayout>
  );
}
