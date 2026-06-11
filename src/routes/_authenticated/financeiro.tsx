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
import { Wallet, TrendingUp, Repeat, AlertOctagon } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { KpiCard, ChartCard } from "@/components/KpiCard";
import {
  overviewKpis,
  faturamentoMensal,
  receitaPorPlano,
  projecaoFaturamento,
  formatBRL,
} from "@/lib/mockData";
import { exportToPdf, exportToExcel } from "@/lib/exporters";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — GymPulse BI" },
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

function FinanceiroPage() {
  const k = overviewKpis;

  const onExportExcel = () =>
    exportToExcel("financeiro", {
      KPIs: [
        { metrica: "Faturamento mês", valor: k.faturamentoMes },
        { metrica: "Estimativa próx. mês", valor: k.faturamentoEstimadoProx },
        { metrica: "LTV médio", valor: k.ltvMedio },
        { metrica: "Cancelamentos financeiros", valor: k.cancelamentosFinanceiros },
      ],
      FaturamentoMensal: faturamentoMensal,
      ReceitaPorPlano: receitaPorPlano,
      Projecao: projecaoFaturamento,
    });

  const onExportPdf = () =>
    exportToPdf("Financeiro", [
      { Métrica: "Faturamento mês", Valor: formatBRL(k.faturamentoMes) },
      { Métrica: "Estimativa próx. mês", Valor: formatBRL(k.faturamentoEstimadoProx) },
      { Métrica: "LTV médio", Valor: formatBRL(k.ltvMedio) },
      { Métrica: "Cancelamentos financeiros", Valor: formatBRL(k.cancelamentosFinanceiros) },
    ]);

  return (
    <DashboardLayout
      title="Financeiro"
      subtitle="Receita, projeções e cancelamentos"
      onExportPdf={onExportPdf}
      onExportExcel={onExportExcel}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Faturamento mês"
          value={formatBRL(k.faturamentoMes)}
          delta={5.4}
          accent="success"
          icon={<Wallet className="h-5 w-5" />}
        />
        <KpiCard
          label="Estimativa próx. mês"
          value={formatBRL(k.faturamentoEstimadoProx)}
          delta={6.5}
          accent="success"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <KpiCard
          label="LTV médio"
          value={formatBRL(k.ltvMedio)}
          delta={2.1}
          icon={<Repeat className="h-5 w-5" />}
        />
        <KpiCard
          label="Canc. financeiros"
          value={formatBRL(k.cancelamentosFinanceiros)}
          delta={-3.2}
          accent="destructive"
          icon={<AlertOctagon className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Evolução do faturamento mensal" description="Últimos 12 meses">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={faturamentoMensal}>
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
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => formatBRL(Number(v))} />
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
                data={receitaPorPlano}
                dataKey="valor"
                nameKey="plano"
                innerRadius={55}
                outerRadius={95}
                paddingAngle={3}
              >
                {receitaPorPlano.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => formatBRL(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Faturamento x Cancelamentos"
          description="Comparativo mensal"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={faturamentoMensal}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <YAxis
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => formatBRL(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="faturamento" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cancelamentos" fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Projeção de faturamento" description="Próximos 6 meses">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={projecaoFaturamento}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <YAxis
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => (v ? formatBRL(Number(v)) : "-")} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="real" fill="var(--chart-1)" radius={[4, 4, 0, 0]} name="Real" />
              <Line
                type="monotone"
                dataKey="projecao"
                stroke="var(--chart-4)"
                strokeWidth={3}
                strokeDasharray="5 5"
                name="Projeção"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </DashboardLayout>
  );
}
