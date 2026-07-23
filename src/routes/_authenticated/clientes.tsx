import {
  Link,
  Outlet,
  createFileRoute,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useApp } from "@/contexts/AppContext";
import { normalizeClientStatus } from "@/lib/clientDetails";
import { useDashboardData } from "@/lib/membersDashboardData";
import { formatBRL, formatNum, type ClientRow } from "@/lib/mockData";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — be.move BI" },
      { name: "description", content: "Lista completa de clientes cadastrados." },
    ],
  }),
  component: ClientesPage,
});

const PAGE_SIZE = 30;
type ClientSortKey =
  | "id"
  | "nome"
  | "status"
  | "contrato"
  | "bairro"
  | "vencimento"
  | "valor"
  | "contratos";
type SortState = { key: ClientSortKey; direction: "asc" | "desc" };

function parseClientDate(value: string | null | undefined) {
  if (!value) return 0;
  const [day, month, year] = value.split("/").map(Number);
  if (Number.isFinite(day) && Number.isFinite(month) && Number.isFinite(year)) {
    return new Date(year, month - 1, day).getTime();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function ClientesPage() {
  const { filters } = useApp();
  const { clients, memberships, loadingMembers, membersError, loadingMemberships } =
    useDashboardData(filters);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ key: "nome", direction: "asc" });

  const contractsByClient = useMemo(() => {
    const map = new Map<number, { total: number; latest: string }>();
    memberships.forEach((contract) => {
      const current = map.get(contract.id_member) ?? { total: 0, latest: "" };
      current.total += 1;
      const name = contract.membership_name?.trim();
      if (name && (!current.latest || contract.membership_start || contract.sale_date)) {
        current.latest = name;
      }
      map.set(contract.id_member, current);
    });
    return map;
  }, [memberships]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = term
      ? clients.filter((client) =>
          [
            client.id,
            client.nome,
            client.bairro,
            client.cidade,
            client.contrato,
            normalizeClientStatus(client),
          ]
            .join(" ")
            .toLowerCase()
            .includes(term),
        )
      : clients;

    const valueForSort = (client: ClientRow) => {
      const contracts = contractsByClient.get(client.id);
      switch (sort.key) {
        case "id":
          return client.id;
        case "nome":
          return client.nome;
        case "status":
          return normalizeClientStatus(client);
        case "contrato":
          return contracts?.latest || client.contrato || "";
        case "bairro":
          return client.bairro || "";
        case "vencimento":
          return parseClientDate(client.vencimento);
        case "valor":
          return client.valor;
        case "contratos":
          return contracts?.total ?? 0;
      }
    };

    return [...rows].sort((a, b) => {
      const left = valueForSort(a);
      const right = valueForSort(b);
      const result =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right), "pt-BR", {
              sensitivity: "base",
              numeric: true,
            });
      return sort.direction === "asc" ? result : -result;
    });
  }, [clients, contractsByClient, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const updateSort = (key: ClientSortKey) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
    setPage(1);
  };

  if (pathname !== "/clientes") return <Outlet />;

  return (
    <DashboardLayout
      title="Clientes"
      subtitle="Lista completa de clientes cadastrados e acesso ao histórico de contratos"
      showFilters={false}
    >
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Clientes cadastrados</p>
                <p className="text-2xl font-bold">{formatNum(clients.length)}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="text-xs text-muted-foreground">Clientes ativos</p>
            <p className="text-2xl font-bold">
              {formatNum(clients.filter((client) => client.ativo).length)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="text-xs text-muted-foreground">Contratos carregados</p>
            <p className="text-2xl font-bold">{formatNum(memberships.length)}</p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Todos os clientes</h2>
              <p className="text-sm text-muted-foreground">
                {loadingMembers || loadingMemberships
                  ? "Carregando dados..."
                  : `${formatNum(filtered.length)} clientes encontrados`}
              </p>
            </div>
            <label className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Buscar por nome, número, bairro ou contrato"
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>

          {membersError ? (
            <div className="p-5 text-sm text-destructive">
              Não foi possível carregar os clientes: {membersError}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <SortableClientHeader id="id" label="Número" sort={sort} onSort={updateSort} />
                    <SortableClientHeader id="nome" label="Cliente" sort={sort} onSort={updateSort} />
                    <SortableClientHeader id="status" label="Status" sort={sort} onSort={updateSort} />
                    <SortableClientHeader id="contrato" label="Contrato atual" sort={sort} onSort={updateSort} />
                    <SortableClientHeader id="bairro" label="Bairro" sort={sort} onSort={updateSort} />
                    <SortableClientHeader id="vencimento" label="Vencimento" sort={sort} onSort={updateSort} />
                    <SortableClientHeader id="valor" label="Valor" sort={sort} onSort={updateSort} align="right" />
                    <SortableClientHeader id="contratos" label="Contratos" sort={sort} onSort={updateSort} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((client) => {
                    const contracts = contractsByClient.get(client.id);
                    return (
                      <tr
                        key={client.id}
                        onClick={() =>
                          navigate({ to: "/clientes/$id", params: { id: String(client.id) } })
                        }
                        className="cursor-pointer border-t border-border hover:bg-muted/30"
                      >
                        <td className="px-5 py-3 font-mono text-xs">{client.id}</td>
                        <td className="px-5 py-3">
                          <Link
                            to="/clientes/$id"
                            params={{ id: String(client.id) }}
                            onClick={(event) => event.stopPropagation()}
                            className="font-semibold text-primary hover:underline"
                          >
                            {client.nome}
                          </Link>
                          <p className="text-xs text-muted-foreground">{client.cidade || "-"}</p>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              client.ativo
                                ? "bg-emerald-500/10 text-emerald-600"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {normalizeClientStatus(client)}
                          </span>
                        </td>
                        <td className="px-5 py-3">{contracts?.latest || client.contrato || "-"}</td>
                        <td className="px-5 py-3">{client.bairro || "-"}</td>
                        <td className="px-5 py-3">{client.vencimento ?? "-"}</td>
                        <td className="px-5 py-3 text-right">{formatBRL(client.valor)}</td>
                        <td className="px-5 py-3 text-right">{formatNum(contracts?.total ?? 0)}</td>
                      </tr>
                    );
                  })}
                  {!pageRows.length && (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-muted-foreground">
                        Nenhum cliente encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border p-4 text-sm">
            <span className="text-muted-foreground">
              Página {safePage} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={safePage <= 1}
                className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={safePage >= totalPages}
                className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

function SortableClientHeader(props: any) {
  const { id, label, sort, onSort, align = "left" } = props;
  const active = sort.key === id;
  const indicator = active ? (sort.direction === "asc" ? " asc" : " desc") : "";
  const alignClass = align === "right" ? "text-right" : "";
  const buttonAlignClass = align === "right" ? "justify-end" : "justify-start";
  return (
    <th className={["px-5 py-3", alignClass].filter(Boolean).join(" ")}>
      <button type="button" onClick={function () { onSort(id); }} className={["inline-flex items-center gap-1 hover:text-primary", buttonAlignClass].join(" ")}>
        <span>{label}</span>
        <span aria-hidden="true" className="text-[10px] text-muted-foreground">{indicator}</span>
      </button>
    </th>
  );
}

