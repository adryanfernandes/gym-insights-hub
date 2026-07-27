import { createFileRoute } from "@tanstack/react-router";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { useState } from "react";
import { Wallet, TrendingUp, Repeat, AlertOctagon } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { KpiCard, ChartCard } from "@/components/KpiCard";
import { useApp } from "@/contexts/AppContext";
import { formatBRL, formatNum } from "@/lib/mockData";
import { useDashboardData } from "@/lib/membersDashboardData";
import { exportToPdf, exportToExcel } from "@/lib/exporters";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — be.move BI" },
      { name: "description", content: "Visão financeira da academia." },
    ],
  }),
  component: FinanceiroPage,
});

const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--foreground)",
};

const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

function displayDate(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleDateString("pt-BR");
}

function FinanceiroPage() {
  const { filters } = useApp();
  const { data, loadingMemberships, membershipsError } = useDashboardData(filters);
  const k = data.overviewKpis;
  const [financialCancellationsOpen, setFinancialCancellationsOpen] = useState(false);
  const financialCancellationsCount = data.cancelamentosLista.length;

  const onExportExcel = () =>
    exportToExcel("financeiro", {
      KPIs: [
        { metrica: "Faturamento mês", valor: k.faturamentoMes },
        { metrica: "Estimativa próx. mês", valor: k.faturamentoEstimadoProx },
        { metrica: "LTV médio", valor: k.ltvMedio },
        { metrica: "Cancelamentos financeiros", valor: k.cancelamentosFinanceiros },
        { metrica: "Qtd. cancelamentos financeiros", valor: financialCancellationsCount },
      ],
      CancelamentosFinanceiros: data.cancelamentosLista.map((row) => ({
        Contrato: row.idContrato,
        Aluno: row.aluno,
        Plano: row.contrato,
        "Data cancelamento": displayDate(row.dataCancelamento),
        Motivo: row.motivo,
        "Valor venda": row.valorVenda,
        Multa: row.multa,
        "Valor restante": row.valorRestante,
        "Impacto financeiro": row.multa + row.valorRestante,
      })),
      FaturamentoMensal: data.faturamentoMensal,
      ReceitaPorPlano: data.receitaPorPlano,
      Projecao: data.projecaoFaturamento,
    });

  const onExportPdf = () =>
    exportToPdf("Financeiro", [
      { Métrica: "Faturamento mês", Valor: formatBRL(k.faturamentoMes) },
      { Métrica: "Estimativa próx. mês", Valor: formatBRL(k.faturamentoEstimadoProx) },
      { Métrica: "LTV médio", Valor: formatBRL(k.ltvMedio) },
      { Métrica: "Cancelamentos financeiros", Valor: formatBRL(k.cancelamentosFinanceiros) },
      { Métrica: "Qtd. cancelamentos financeiros", Valor: formatNum(financialCancellationsCount) },
    ]);

  return (
    <DashboardLayout
      title="Financeiro"
      subtitle="Receita, projeções e cancelamentos"
      onExportPdf={onExportPdf}
      onExportExcel={onExportExcel}
    >
      {(loadingMemberships || membershipsError) && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
          {loadingMemberships
            ? "Carregando contratos e recebíveis reais da EVO..."
            : `Não foi possível carregar os dados financeiros da EVO: ${membershipsError}`}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Faturamento mês"
          value={formatBRL(k.faturamentoMes)}
          accent="success"
          icon={<Wallet className="h-5 w-5" />}
        />
        <KpiCard
          label="Estimativa próx. mês"
          value={formatBRL(k.faturamentoEstimadoProx)}
          accent="success"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <KpiCard
          label="LTV médio"
          value={formatBRL(k.ltvMedio)}
          icon={<Repeat className="h-5 w-5" />}
        />
        <KpiCard
          label="Canc. financeiros"
          value={
            <span className="flex flex-col gap-1">
              <span>{formatBRL(k.cancelamentosFinanceiros)}</span>
              <span className="text-sm font-semibold text-destructive">
                {formatNum(financialCancellationsCount)} cancelamentos
              </span>
            </span>
          }
          hint="Clique para ver a listagem"
          accent="destructive"
          icon={<AlertOctagon className="h-5 w-5" />}
          onClick={() => setFinancialCancellationsOpen(true)}
        />
      </div>

      <Dialog open={financialCancellationsOpen} onOpenChange={setFinancialCancellationsOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-6xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-6 py-5">
            <DialogTitle>Cancelamentos financeiros</DialogTitle>
            <DialogDescription>
              {formatNum(financialCancellationsCount)} cancelamentos no período, somando{" "}
              {formatBRL(k.cancelamentosFinanceiros)} de impacto financeiro.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Contrato</th>
                  <th className="px-5 py-3">Aluno</th>
                  <th className="px-5 py-3">Plano</th>
                  <th className="px-5 py-3">Cancelamento</th>
                  <th className="px-5 py-3">Motivo</th>
                  <th className="px-5 py-3 text-right">Venda</th>
                  <th className="px-5 py-3 text-right">Multa</th>
                  <th className="px-5 py-3 text-right">Restante</th>
                  <th className="px-5 py-3 text-right">Impacto</th>
                </tr>
              </thead>
              <tbody>
                {data.cancelamentosLista.map((row) => (
                  <tr key={row.idContrato} className="border-t border-border hover:bg-accent/40">
                    <td className="px-5 py-3 font-mono text-xs">{row.idContrato}</td>
                    <td className="px-5 py-3 font-medium">{row.aluno}</td>
                    <td className="px-5 py-3">{row.contrato}</td>
                    <td className="px-5 py-3">{displayDate(row.dataCancelamento)}</td>
                    <td className="px-5 py-3">{row.motivo}</td>
                    <td className="px-5 py-3 text-right">{formatBRL(row.valorVenda)}</td>
                    <td className="px-5 py-3 text-right">{formatBRL(row.multa)}</td>
                    <td className="px-5 py-3 text-right">{formatBRL(row.valorRestante)}</td>
                    <td className="px-5 py-3 text-right font-semibold">
                      {formatBRL(row.multa + row.valorRestante)}
                    </td>
                  </tr>
                ))}
                {!data.cancelamentosLista.length && (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-muted-foreground">
                      Nenhum cancelamento financeiro encontrado para os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Evolução do faturamento mensal" description="Últimos 12 meses">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.faturamentoMensal}>
              <defs>
                <linearGradient id="gf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <YAxis
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number | string) => formatBRL(Number(v))}
              />
              <Area
                type="monotone"
                dataKey="faturamento"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#gf)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Receita por tipo de plano" description="Distribuição do mês">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.receitaPorPlano}
                dataKey="valor"
                nameKey="plano"
                innerRadius={55}
                outerRadius={95}
                paddingAngle={3}
              >
                {data.receitaPorPlano.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number | string) => formatBRL(Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Faturamento x Cancelamentos" description="Comparativo mensal">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.faturamentoMensal}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <YAxis
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number | string) => formatBRL(Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="faturamento" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cancelamentos" fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Projeção de faturamento"
          description="Recebíveis de contratos ativos e perdas por cancelamento"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.projecaoFaturamento}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <YAxis
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number | string) => (v ? formatBRL(Number(v)) : "-")}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="contratosAtivos"
                fill="var(--chart-1)"
                radius={[4, 4, 0, 0]}
                name="Contratos ativos"
              />
              <Bar
                dataKey="contratosCancelados"
                fill="var(--chart-5)"
                radius={[4, 4, 0, 0]}
                name="Contratos cancelados"
              />
              <Line
                type="monotone"
                dataKey="real"
                stroke="var(--chart-4)"
                strokeWidth={3}
                name="Recebido no mês"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </DashboardLayout>
  );
}
