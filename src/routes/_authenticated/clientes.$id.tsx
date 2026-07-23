import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, FileText, UserRound } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useApp } from "@/contexts/AppContext";
import {
  contractsForClient,
  normalizeClientStatus,
} from "@/lib/clientDetails";
import { useDashboardData } from "@/lib/membersDashboardData";
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
  const { clients, memberships, receivables, loadingMembers, loadingMemberships } =
    useDashboardData(filters);
  const client = clients.find((row) => row.id === clientId);
  const contracts = contractsForClient(clientId, memberships, receivables);
  const totalPago = contracts.reduce((total, contract) => total + contract.valorPago, 0);
  const totalVendido = contracts.reduce((total, contract) => total + contract.valorVenda, 0);

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
                <div className="flex items-start gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                    <UserRound className="h-6 w-6" />
                  </div>
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
              </div>
              <InfoCard label="Status" value={normalizeClientStatus(client)} />
              <InfoCard label="Contrato atual" value={client.contrato || "-"} />
              <InfoCard label="Início" value={client.inicio ?? "-"} />
              <InfoCard label="Vencimento" value={client.vencimento ?? "-"} />
              <InfoCard label="Última frequência" value={client.ultimaFrequencia ?? "-"} />
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

            <section className="rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-center gap-3 border-b border-border p-5">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Histórico de contratos</h2>
                  <p className="text-sm text-muted-foreground">
                    Número do contrato, período, status e valores pagos.
                  </p>
                </div>
              </div>
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
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
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
