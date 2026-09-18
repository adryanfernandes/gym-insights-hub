import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  FunnelChart,
  Funnel,
  LabelList,
} from "recharts";
import { ShoppingCart, TrendingDown, AlertTriangle, CalendarDays } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { KpiCard, ChartCard } from "@/components/KpiCard";
import { useApp } from "@/contexts/AppContext";
import { formatBRL, formatNum } from "@/lib/mockData";
import { useDashboardData } from "@/lib/membersDashboardData";
import { exportToPdf, exportToExcel } from "@/lib/exporters";
import {
  commercialMonthlyMovement,
  type CommercialMonthlyMovement,
} from "@/lib/membershipDashboardData";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/comercial")({
  head: () => ({
    meta: [
      { title: "Comercial — be.move BI" },
      { name: "description", content: "Aquisição e retenção de alunos." },
    ],
  }),
  component: ComercialPage,
});

const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--foreground)",
};

const RISK_BADGE: Record<string, string> = {
  alto: "bg-destructive/15 text-destructive border-destructive/30",
  medio: "bg-warning/20 text-warning border-warning/30",
  baixo: "bg-success/15 text-success border-success/30",
};

const RISK_LABEL: Record<string, string> = { alto: "Alto", medio: "Médio", baixo: "Baixo" };

function monthInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthInputDate(value: string, endOfMonth = false) {
  const [year, month] = value.split("-").map(Number);
  return endOfMonth
    ? new Date(year, month, 0, 23, 59, 59, 999)
    : new Date(year, month - 1, 1);
}

type MovementListMetric =
  | "novos"
  | "renovacoes"
  | "mudancasPlano"
  | "resgates"
  | "cancelamentos"
  | "vencimentos"
  | "desistencias"
  | "suspensoes"
  | "totalPositivos"
  | "totalNegativos"
  | "saldoFim";

const MOVEMENT_LABELS: Record<MovementListMetric, string> = {
  novos: "Clientes novos",
  renovacoes: "Renovações",
  mudancasPlano: "Mudanças de plano",
  resgates: "Resgates",
  cancelamentos: "Cancelamentos",
  vencimentos: "Vencimentos",
  desistencias: "Desistências",
  suspensoes: "Suspensões",
  totalPositivos: "Total positivo",
  totalNegativos: "Total negativo",
  saldoFim: "Saldo no fim do mês",
};

function displayMovementDate(value: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleDateString("pt-BR");
}

function ComercialPage() {
  const { filters } = useApp();
  const navigate = useNavigate();
  const { data, clients, memberships, loadingMemberships, membershipsError } = useDashboardData(filters);
  const k = data.overviewKpis;
  const currentMonth = monthInputValue(new Date());
  const defaultStart = new Date();
  defaultStart.setMonth(defaultStart.getMonth() - 11, 1);
  const [movementStartMonth, setMovementStartMonth] = useState(monthInputValue(defaultStart));
  const [movementEndMonth, setMovementEndMonth] = useState(currentMonth);
  const [selectedMovement, setSelectedMovement] = useState<{
    month: CommercialMonthlyMovement;
    metric: MovementListMetric;
  } | null>(null);
  const monthlyMovement = useMemo(
    () =>
      commercialMonthlyMovement(
        memberships,
        monthInputDate(movementStartMonth),
        monthInputDate(movementEndMonth, true),
      ),
    [memberships, movementEndMonth, movementStartMonth],
  );
  const clientNames = useMemo(
    () => new Map(clients.map((client) => [Number(client.id), client.nome])),
    [clients],
  );
  const selectedMovementRows = useMemo(() => {
    if (!selectedMovement) return [];
    return selectedMovement.month.detalhes[selectedMovement.metric].slice().sort((a, b) =>
      (clientNames.get(a.idAluno) ?? "").localeCompare(clientNames.get(b.idAluno) ?? "", "pt-BR"),
    );
  }, [clientNames, selectedMovement]);

  const openClientPage = (clientId: number | string | null | undefined) => {
    const parsed = Number(clientId);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    navigate({ to: "/clientes/$id", params: { id: String(parsed) } });
  };

  const movementCell = (
    month: CommercialMonthlyMovement,
    metric: MovementListMetric,
    className: string,
  ) => (
    <td className={className}>
      <button
        type="button"
        onClick={() => setSelectedMovement({ month, metric })}
        className="w-full rounded px-2 py-1 font-semibold underline-offset-2 transition hover:bg-accent hover:underline"
        title={`Ver ${MOVEMENT_LABELS[metric].toLowerCase()} de ${month.mes}`}
      >
        {formatNum(month[metric])}
      </button>
    </td>
  );

  const onExportExcel = () =>
    exportToExcel("comercial", {
      KPIs: [
        { metrica: "Vendas 30d", valor: k.vendas30d.qtd },
        { metrica: "Cancelamentos próx. 30d", valor: k.cancelamentos30d.qtd },
        { metrica: "Alunos em risco", valor: k.alunosRisco },
      ],
      EvolucaoVendas: data.evolucaoVendas,
      Funil: data.funilComercial,
      RenovacoesVencimentos: data.renovacoesMensais,
      MovimentacaoMensal: monthlyMovement.map(({ detalhes: _detalhes, ...month }) => month),
      AlunosRisco: data.alunosRisco,
    });

  const onExportPdf = () =>
    exportToPdf(
      "Alunos em risco",
      data.alunosRisco.map((a) => ({
        "Nº cliente": a.id,
        Nome: a.nome,
        "Último agend.": a.ultimoAgendamento,
        "Dias sem atividade": a.diasSemAtividade,
        Contrato: formatBRL(a.valorContrato),
        Risco: RISK_LABEL[a.nivelRisco],
      })),
    );

  return (
    <DashboardLayout
      title="Comercial"
      subtitle="Aquisição, cancelamentos e risco"
      onExportPdf={onExportPdf}
      onExportExcel={onExportExcel}
    >
      {(loadingMemberships || membershipsError) && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
          {loadingMemberships
            ? "Carregando contratos reais da EVO..."
            : `Não foi possível carregar os contratos da EVO: ${membershipsError}`}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Vendas (30d)"
          value={formatNum(k.vendas30d.qtd)}
          hint={formatBRL(k.vendas30d.valor)}
          accent="success"
          icon={<ShoppingCart className="h-5 w-5" />}
        />
        <KpiCard
          label="Cancelamentos no período"
          value={formatNum(k.cancelamentos30d.qtd)}
          hint={formatBRL(k.cancelamentos30d.valor)}
          accent="destructive"
          icon={<TrendingDown className="h-5 w-5" />}
        />
        <KpiCard
          label="Alunos em risco"
          value={formatNum(k.alunosRisco)}
          hint="Sem atividade recente"
          delta={3.6}
          accent="warning"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Vendas x Cancelamentos" description="Últimos 30 dias">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.evolucaoVendas}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="data" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
              <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="vendas"
                stroke="var(--chart-3)"
                strokeWidth={2.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="cancelamentos"
                stroke="var(--chart-5)"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Funil comercial" description="Conversão do mês">
          <ResponsiveContainer width="100%" height="100%">
            <FunnelChart>
              <Tooltip contentStyle={tooltipStyle} />
              <Funnel
                dataKey="valor"
                data={data.funilComercial}
                isAnimationActive
                fill="var(--chart-1)"
              >
                <LabelList
                  position="right"
                  fill="var(--foreground)"
                  stroke="none"
                  dataKey="etapa"
                  fontSize={12}
                />
                <LabelList
                  position="center"
                  fill="white"
                  stroke="none"
                  dataKey="valor"
                  fontSize={13}
                />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Renovações e vencimentos por mês" description="Retenção real dos contratos">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.renovacoesMensais}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="renovacoes"
                name="Renovações"
                fill="var(--chart-2)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="vencimentos"
                name="Vencimentos sem renovação"
                fill="var(--chart-5)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold">Distribuição por nível de risco</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Critérios: 7+, 10+ e 15+ dias sem agendar
          </p>
          <div className="mt-5 space-y-4">
            {["alto", "medio", "baixo"].map((nivel) => {
              const count = data.alunosRisco.filter((a) => a.nivelRisco === nivel).length;
              const pct = data.alunosRisco.length ? (count / data.alunosRisco.length) * 100 : 0;
              return (
                <div key={nivel}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${RISK_BADGE[nivel]}`}
                    >
                      Risco {RISK_LABEL[nivel]}
                    </span>
                    <span className="font-semibold text-foreground">{count} alunos</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full ${
                        nivel === "alto"
                          ? "bg-destructive"
                          : nivel === "medio"
                            ? "bg-warning"
                            : "bg-success"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <h3 className="text-sm font-semibold">Alunos em risco de cancelamento</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tabela inteligente — priorize contato com risco alto
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Nº cliente</th>
                <th className="px-5 py-3 font-medium">Aluno</th>
                <th className="px-5 py-3 font-medium">Último agend.</th>
                <th className="px-5 py-3 font-medium">Dias sem ativ.</th>
                <th className="px-5 py-3 font-medium">Contrato</th>
                <th className="px-5 py-3 font-medium">Risco</th>
              </tr>
            </thead>
            <tbody>
              {data.alunosRisco
                .slice()
                .sort((a, b) => b.diasSemAtividade - a.diasSemAtividade)
                .map((a) => (
                  <tr
                    key={a.id}
                    className="cursor-pointer border-t border-border transition hover:bg-accent/40"
                    onClick={() => openClientPage(a.id)}
                    title="Abrir perfil do cliente"
                  >
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{a.id}</td>
                    <td className="px-5 py-3 font-medium">{a.nome}</td>
                    <td className="px-5 py-3 text-muted-foreground">{a.ultimoAgendamento}</td>
                    <td className="px-5 py-3 font-semibold">{a.diasSemAtividade}d</td>
                    <td className="px-5 py-3">{formatBRL(a.valorContrato)}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${RISK_BADGE[a.nivelRisco]}`}
                      >
                        {RISK_LABEL[a.nivelRisco]}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-4 border-b border-border p-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold">Movimentação mensal de clientes</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Entradas, permanência e saídas consolidadas por mês.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <CalendarDays className="mb-2 h-4 w-4 text-muted-foreground" />
            <label className="grid gap-1 text-xs text-muted-foreground">
              Mês inicial
              <input
                type="month"
                value={movementStartMonth}
                max={movementEndMonth}
                onChange={(event) => setMovementStartMonth(event.target.value)}
                className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
              />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Mês final
              <input
                type="month"
                value={movementEndMonth}
                min={movementStartMonth}
                max={currentMonth}
                onChange={(event) => setMovementEndMonth(event.target.value)}
                className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
              />
            </label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-muted/40 text-center text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Mês/ano</th>
                <th className="px-4 py-3 font-medium">Clientes novos</th>
                <th className="px-4 py-3 font-medium">Renovações</th>
                <th className="px-4 py-3 font-medium">Mudanças de plano</th>
                <th className="px-4 py-3 font-medium">Resgates</th>
                <th className="px-4 py-3 font-medium">Cancelamentos</th>
                <th className="px-4 py-3 font-medium">Vencimentos</th>
                <th className="px-4 py-3 font-medium">Desistências</th>
                <th className="px-4 py-3 font-medium">Suspensões</th>
                <th className="bg-success/10 px-4 py-3 font-medium text-success">Total positivo</th>
                <th className="bg-destructive/10 px-4 py-3 font-medium text-destructive">Total negativo</th>
                <th className="px-4 py-3 font-medium">Saldo no fim</th>
                <th className="px-4 py-3 font-medium">Crescimento</th>
              </tr>
            </thead>
            <tbody>
              {monthlyMovement.map((month) => (
                <tr key={month.mesKey} className="border-t border-border text-center">
                  <td className="px-4 py-3 text-left font-semibold">{month.mes}</td>
                  {movementCell(month, "novos", "bg-success/5 px-2 py-2 text-success")}
                  {movementCell(month, "renovacoes", "bg-success/5 px-2 py-2 text-success")}
                  {movementCell(month, "mudancasPlano", "bg-warning/10 px-2 py-2 text-warning")}
                  {movementCell(month, "resgates", "bg-success/5 px-2 py-2 text-success")}
                  {movementCell(month, "cancelamentos", "bg-destructive/5 px-2 py-2 text-destructive")}
                  {movementCell(month, "vencimentos", "bg-destructive/5 px-2 py-2 text-destructive")}
                  {movementCell(month, "desistencias", "bg-destructive/5 px-2 py-2 text-destructive")}
                  {movementCell(month, "suspensoes", "bg-destructive/5 px-2 py-2 text-destructive")}
                  {movementCell(month, "totalPositivos", "bg-success/10 px-2 py-2 text-success")}
                  {movementCell(month, "totalNegativos", "bg-destructive/10 px-2 py-2 text-destructive")}
                  {movementCell(month, "saldoFim", "bg-muted/30 px-2 py-2 text-foreground")}
                  <td
                    className={`px-4 py-3 font-semibold ${
                      month.crescimentoPercentual > 0
                        ? "text-success"
                        : month.crescimentoPercentual < 0
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
                    {month.crescimentoPercentual > 0 ? "+" : ""}
                    {month.crescimentoPercentual.toFixed(1).replace(".", ",")}%
                  </td>
                </tr>
              ))}
              {!monthlyMovement.length && (
                <tr>
                  <td colSpan={13} className="px-5 py-10 text-center text-muted-foreground">
                    Nenhuma movimentação encontrada no período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
          Resgate considera o retorno após mais de 30 dias sem vínculo. Desistências e suspensões
          são classificadas pelo motivo registrado no cancelamento; quando a API não informa esses
          termos, o evento permanece em cancelamentos. Mudanças de plano ficam separadas e não
          compõem entradas, saídas ou cancelamentos.
        </p>
      </div>

      <Dialog open={Boolean(selectedMovement)} onOpenChange={(open) => !open && setSelectedMovement(null)}>
        <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-6 py-5 pr-14">
            <DialogTitle>
              {selectedMovement ? MOVEMENT_LABELS[selectedMovement.metric] : "Movimentação mensal"}
            </DialogTitle>
            <DialogDescription>
              {selectedMovement?.month.mes} — {formatNum(selectedMovementRows.length)} clientes
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="sticky top-0 bg-muted text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Nº cliente</th>
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-5 py-3 font-medium">Contrato</th>
                  <th className="px-5 py-3 font-medium">Data</th>
                  <th className="px-5 py-3 font-medium">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {selectedMovementRows.map((row, index) => (
                  <tr
                    key={`${row.idAluno}-${row.idContrato}-${index}`}
                    className="cursor-pointer border-t border-border transition hover:bg-accent/40"
                    onClick={() => openClientPage(row.idAluno)}
                    title="Abrir perfil do cliente"
                  >
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{row.idAluno}</td>
                    <td className="px-5 py-3 font-medium">
                      {clientNames.get(row.idAluno) ?? `Aluno ${row.idAluno}`}
                    </td>
                    <td className="px-5 py-3">{row.contrato}</td>
                    <td className="px-5 py-3">{displayMovementDate(row.data)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{row.motivo ?? "-"}</td>
                  </tr>
                ))}
                {!selectedMovementRows.length && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                      Nenhum cliente encontrado para este indicador.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
