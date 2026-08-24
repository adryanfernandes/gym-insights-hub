import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, CircleCheck, CircleX, FileText, UserRound } from "lucide-react";
import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useApp } from "@/contexts/AppContext";
import { contractsForClient, normalizeClientStatus, syncUpdatesForClient } from "@/lib/clientDetails";
import { useDashboardData, type SalesRecord } from "@/lib/membersDashboardData";
import { formatBRL, formatNum } from "@/lib/mockData";

export const Route = createFileRoute("/_authenticated/clientes/$id")({
  head: () => ({
    meta: [
      { title: "Cliente — be.move BI" },
      { name: "description", content: "Detalhe do cliente e histórico de contratos." },
    ],
  }),
  component: ClienteDetalhePage,
});

function ClienteDetalhePage() {
  const { id } = Route.useParams();
  const clientId = Number(id);
  const { filters } = useApp();
  const { clients, memberships, receivables, sales, loadingMembers, loadingMemberships } =
    useDashboardData(filters);
  const client = clients.find((row) => row.id === clientId);
  const contracts = contractsForClient(clientId, memberships, receivables);
  const clientSales = salesForClient(clientId, sales);
  const syncUpdates = client ? syncUpdatesForClient(client, memberships, receivables, sales) : [];
  const totalPago = contracts.reduce((total, contract) => total + contract.valorPago, 0);
  const totalVendido = contracts.reduce((total, contract) => total + contract.valorVenda, 0);
  const totalVendasApi = clientSales.reduce((total, sale) => total + sale.valor, 0);
  const [historyTab, setHistoryTab] = useState<"contratos" | "vendas" | "atualizacoes">("contratos");
  const clientStatus = client ? normalizeClientStatus(client) : "Inativo";
  const isClientActive = clientStatus === "Ativo";

  return (
    <DashboardLayout
      title={client ? client.nome : "Cliente"}
      subtitle="Informações principais e histórico de contratos"
      showFilters={false}
    >
      <div className="space-y-6">
        <Link
          to="/clientes"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para clientes
        </Link>

        {loadingMembers || loadingMemberships ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Carregando dados do cliente...
          </div>
        ) : !client ? (
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">Cliente não encontrado</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Não localizei um cliente cadastrado com o número {id}.
            </p>
          </div>
        ) : (
          <>
            <section className="grid gap-4 lg:grid-cols-4">
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                  <ClientProfilePhoto name={client.nome} photoUrl={client.fotoUrl} />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Cliente nº {client.id}
                    </p>
                    <h2 className="text-2xl font-bold">{client.nome}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {client.bairro || "-"} {client.cidade ? `• ${client.cidade}` : ""}
                    </p>
                  </div>
                </div>
                  <div
                    title={clientStatus}
                    aria-label={`Status do cliente: ${clientStatus}`}
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                      isClientActive
                        ? "bg-emerald-500/15 text-emerald-500"
                        : "bg-red-500/15 text-red-500"
                    }`}
                  >
                    {isClientActive ? (
                      <CircleCheck className="h-5 w-5" />
                    ) : (
                      <CircleX className="h-5 w-5" />
                    )}
                  </div>
                </div>
              </div>
              <InfoCard label="Contrato atual" value={client.contrato || "-"} />
              <InfoCard label="Início" value={client.inicio ?? "-"} />
              <InfoCard label="Vencimento" value={client.vencimento ?? "-"} />
              <InfoCard label="Último acesso ao app" value={client.ultimaFrequencia ?? "-"} />
              <InfoCard label="Valor atual" value={formatBRL(client.valor)} />
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <p className="text-xs text-muted-foreground">Contratos realizados</p>
                <p className="mt-1 text-2xl font-bold">{formatNum(contracts.length)}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <p className="text-xs text-muted-foreground">Valor vendido</p>
                <p className="mt-1 text-2xl font-bold">{formatBRL(totalVendido)}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <p className="text-xs text-muted-foreground">Valor pago</p>
                <p className="mt-1 text-2xl font-bold">{formatBRL(totalPago)}</p>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <p className="text-xs text-muted-foreground">Vendas</p>
                <p className="mt-1 text-2xl font-bold">{formatNum(clientSales.length)}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm md:col-span-2">
                <p className="text-xs text-muted-foreground">Total vendido na API de vendas</p>
                <p className="mt-1 text-2xl font-bold">{formatBRL(totalVendasApi)}</p>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Históricos</h2>
                    <p className="text-sm text-muted-foreground">
                      Contratos e vendas vinculados a este cliente.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setHistoryTab("contratos")}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      historyTab === "contratos"
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-card text-foreground hover:bg-accent"
                    }`}
                  >
                    Contratos ({formatNum(contracts.length)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryTab("vendas")}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      historyTab === "vendas"
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-card text-foreground hover:bg-accent"
                    }`}
                  >
                    Vendas ({formatNum(clientSales.length)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryTab("atualizacoes")}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      historyTab === "atualizacoes"
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-card text-foreground hover:bg-accent"
                    }`}
                  >
                    Atualizações
                  </button>
                </div>
              </div>

              {historyTab === "contratos" ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3">Contrato nº</th>
                        <th className="px-5 py-3">Tipo</th>
                        <th className="px-5 py-3">Período</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Renovação ativa</th>
                        <th className="px-5 py-3">Cancelamento</th>
                        <th className="px-5 py-3 text-right">Valor venda</th>
                        <th className="px-5 py-3 text-right">Desconto</th>
                        <th className="px-5 py-3 text-right">Valor pago</th>
                        <th className="px-5 py-3 text-right">Valor a pagar</th>
                        <th className="px-5 py-3 text-right">Parcelas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contracts.map((contract) => (
                        <tr key={contract.idContrato} className="border-t border-border">
                          <td className="px-5 py-3 font-mono text-xs">{contract.idContrato}</td>
                          <td className="px-5 py-3 font-medium">{contract.contrato}</td>
                          <td className="px-5 py-3">
                            {contract.inicio} a {contract.vencimento}
                          </td>
                          <td className="px-5 py-3">{contract.status}</td>
                          <td className="px-5 py-3">{contract.renovacaoAtiva}</td>
                          <td className="px-5 py-3">{contract.cancelamento}</td>
                          <td className="px-5 py-3 text-right">{formatBRL(contract.valorVenda)}</td>
                          <td className="px-5 py-3 text-right">{formatBRL(contract.desconto)}</td>
                          <td className="px-5 py-3 text-right font-semibold">
                            {formatBRL(contract.valorPago)}
                          </td>
                          <td className="px-5 py-3 text-right">{formatBRL(contract.valorAPagar)}</td>
                          <td className="px-5 py-3 text-right">{formatNum(contract.parcelas)}</td>
                        </tr>
                      ))}
                      {!contracts.length && (
                        <tr>
                          <td colSpan={11} className="px-5 py-8 text-center text-muted-foreground">
                            Nenhum contrato foi encontrado para este cliente.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : historyTab === "vendas" ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3">Venda</th>
                        <th className="px-5 py-3">Data</th>
                        <th className="px-5 py-3">Descrição</th>
                        <th className="px-5 py-3">Origem</th>
                        <th className="px-5 py-3 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientSales.map((sale) => (
                        <tr key={sale.sourceKey} className="border-t border-border">
                          <td className="px-5 py-3 font-mono text-xs">{sale.idVenda}</td>
                          <td className="px-5 py-3">{sale.data}</td>
                          <td className="px-5 py-3 font-medium">{sale.descricao}</td>
                          <td className="px-5 py-3">{sale.origem}</td>
                          <td className="px-5 py-3 text-right">{formatBRL(sale.valor)}</td>
                        </tr>
                      ))}
                      {!clientSales.length && (
                        <tr>
                          <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                            Nenhuma venda foi encontrada para este cliente. A próxima sincronização da
                            API de vendas passará a consultar por ID do aluno.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3">Origem</th>
                        <th className="px-5 py-3 text-right">Registros</th>
                        <th className="px-5 py-3">Primeira sincronização</th>
                        <th className="px-5 py-3">Última atualização</th>
                        <th className="px-5 py-3">Atualizado</th>
                        <th className="px-5 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncUpdates.map((update) => (
                        <tr key={update.origem} className="border-t border-border">
                          <td className="px-5 py-3 font-medium">{update.origem}</td>
                          <td className="px-5 py-3 text-right">{formatNum(update.registros)}</td>
                          <td className="px-5 py-3">{update.primeiroRegistro}</td>
                          <td className="px-5 py-3">{update.ultimaAtualizacao}</td>
                          <td className="px-5 py-3">{update.atualizadoHa}</td>
                          <td className="px-5 py-3">
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                update.status === "Atualizado"
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : update.status === "Atenção"
                                    ? "bg-amber-500/10 text-amber-600"
                                    : update.status === "Antigo"
                                      ? "bg-red-500/10 text-red-600"
                                      : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {update.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function dateLabel(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("pt-BR");
}

function payloadValue(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function findTextInPayload(value: unknown, keys: string[]): string | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findTextInPayload(item, keys);
      if (found) return found;
    }
    return null;
  }
  const record = value as Record<string, unknown>;
  const direct = payloadValue(record, keys);
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  if (typeof direct === "number") return String(direct);
  for (const item of Object.values(record)) {
    const found = findTextInPayload(item, keys);
    if (found) return found;
  }
  return null;
}

function salesForClient(clientId: number, sales: SalesRecord[]) {
  return sales
    .filter((sale) => Number(sale.id_member) === clientId)
    .map((sale) => {
      const payload = sale.payload ?? {};
      const descricao =
        findTextInPayload(payload, [
          "description",
          "descricao",
          "itemDescription",
          "productDescription",
          "serviceDescription",
          "saleDescription",
          "nameProduct",
          "name",
          "item",
          "product",
          "productName",
          "membershipName",
          "nameMembership",
          "service",
          "saleItem",
        ]) ?? "Descrição não informada";
      const origin =
        findTextInPayload(payload, ["type", "saleType", "category", "status", "paymentType"]) ??
        "Venda";
      const date =
        sale.sale_date ??
        (payloadValue(payload, ["saleDate", "date", "registerDate", "registrationDate"]) as
          | string
          | null);
      const value =
        numberValue(sale.sale_value) ||
        numberValue(payloadValue(payload, ["saleValue", "value", "amount", "total", "totalValue"]));
      return {
        sourceKey: sale.source_key,
        idVenda: sale.id_sale ?? sale.source_key,
        data: dateLabel(date),
        descricao,
        origem: origin,
        valor: value,
        timestamp: typeof date === "string" ? new Date(date).getTime() : 0,
      };
    })
    .sort(
      (a, b) =>
        (Number.isFinite(b.timestamp) ? b.timestamp : 0) -
        (Number.isFinite(a.timestamp) ? a.timestamp : 0),
    );
}

function clientInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function ClientProfilePhoto({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (photoUrl && !imageFailed) {
    return (
      <img
        src={photoUrl}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setImageFailed(true)}
        className="h-14 w-14 shrink-0 rounded-xl border border-border object-cover"
      />
    );
  }

  return (
    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
      {clientInitials(name) ? (
        <span className="text-base font-bold">{clientInitials(name)}</span>
      ) : (
        <UserRound className="h-6 w-6" />
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-lg font-bold">{value}</p>
    </div>
  );
}
