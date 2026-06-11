import { createFileRoute } from "@tanstack/react-router";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  LineChart,
  Line,
} from "recharts";
import { Users, DollarSign, TrendingDown, ShoppingCart, RefreshCw, CalendarCheck } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { KpiCard, ChartCard } from "@/components/KpiCard";
import {
  overviewKpis,
  evolucaoAlunos,
  ocupacaoAgenda,
  taxaRenovacao,
  formatBRL,
  formatNum,
} from "@/lib/mockData";
import { exportToPdf, exportToExcel } from "@/lib/exporters";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Geral — GymPulse BI" },
      { name: "description", content: "Visão executiva da operação da academia." },
    ],
  }),
  component: GeralPage,
});

const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--foreground)",
};

function GeralPage() {
  const k = overviewKpis;

  const onExportExcel = () =>
    exportToExcel("geral", {
      KPIs: [
        { metrica: "Alunos ativos", valor: k.alunosAtivos },
        { metrica: "Ticket médio", valor: k.ticketMedio },
        { metrica: "Cancelamentos 30d (qtd)", valor: k.cancelamentos30d.qtd },
        { metrica: "Cancelamentos 30d (R$)", valor: k.cancelamentos30d.valor },
        { metrica: "Vendas 30d (qtd)", valor: k.vendas30d.qtd },
        { metrica: "Vendas 30d (R$)", valor: k.vendas30d.valor },
        { metrica: "Taxa desativação renovação (%)", valor: k.taxaDesativacaoRenovacao },
        { metrica: "Taxa ocupação agenda (%)", valor: k.taxaOcupacaoAgenda },
      ],
      EvolucaoAlunos: evolucaoAlunos,
      OcupacaoAgenda: ocupacaoAgenda,
      TaxaRenovacao: taxaRenovacao,
    });

  const onExportPdf = () =>
    exportToPdf("Geral - KPIs", [
      { Métrica: "Alunos ativos", Valor: formatNum(k.alunosAtivos) },
      { Métrica: "Ticket médio", Valor: formatBRL(k.ticketMedio) },
      { Métrica: "Vendas 30d", Valor: `${k.vendas30d.qtd} (${formatBRL(k.vendas30d.valor)})` },
      {
        Métrica: "Cancelamentos 30d",
        Valor: `${k.cancelamentos30d.qtd} (${formatBRL(k.cancelamentos30d.valor)})`,
      },
      { Métrica: "Desativação renovação", Valor: `${k.taxaDesativacaoRenovacao}%` },
      { Métrica: "Ocupação agenda", Valor: `${k.taxaOcupacaoAgenda}%` },
    ]);

  return (
    <DashboardLayout
      title="Geral"
      subtitle="Visão executiva da operação"
      onExportPdf={onExportPdf}
      onExportExcel={onExportExcel}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Alunos ativos"
          value={formatNum(k.alunosAtivos)}
          delta={4.2}
          icon={<Users className="h-5 w-5" />}
        />
        <KpiCard
          label="Ticket médio"
          value={formatBRL(k.ticketMedio)}
          delta={1.8}
          accent="success"
          icon={<DollarSign className="h-5 w-5" />}
        />
        <KpiCard
          label="Vendas 30d"
          value={formatNum(k.vendas30d.qtd)}
          hint={formatBRL(k.vendas30d.valor)}
          delta={6.1}
          accent="success"
          icon={<ShoppingCart className="h-5 w-5" />}
        />
        <KpiCard
          label="Cancelamentos 30d"
          value={formatNum(k.cancelamentos30d.qtd)}
          hint={formatBRL(k.cancelamentos30d.valor)}
          delta={-2.4}
          accent="destructive"
          icon={<TrendingDown className="h-5 w-5" />}
        />
        <KpiCard
          label="Desat. renovação"
          value={`${k.taxaDesativacaoRenovacao}%`}
          delta={-0.6}
          accent="warning"
          icon={<RefreshCw className="h-5 w-5" />}
        />
        <KpiCard
          label="Ocupação agenda"
          value={`${k.taxaOcupacaoAgenda}%`}
          delta={3.1}
          icon={<CalendarCheck className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Evolução de alunos ativos"
          description="Últimos 30 dias"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={evolucaoAlunos}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="data" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="ativos"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#g1)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Ocupação da agenda por horário" description="Média do período">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ocupacaoAgenda}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="horario"
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                interval={1}
              />
              <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} unit="%" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="ocupacao" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Evolução da taxa de renovação automática"
          description="Últimos 12 meses"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={taxaRenovacao}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} unit="%" />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="taxa"
                stroke="var(--chart-3)"
                strokeWidth={3}
                dot={{ fill: "var(--chart-3)", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="rounded-xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5">
          <h3 className="text-sm font-semibold">Resumo executivo</h3>
          <p className="mt-2 text-xs text-muted-foreground">
            A base ativa cresceu <span className="text-success font-semibold">+4.2%</span> no
            período, com ticket médio em alta e ocupação saudável.
          </p>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-muted-foreground">Novas matrículas</span>
              <span className="font-semibold">{formatNum(k.vendas30d.qtd)}</span>
            </li>
            <li className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-muted-foreground">Receita gerada</span>
              <span className="font-semibold text-success">
                {formatBRL(k.vendas30d.valor)}
              </span>
            </li>
            <li className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-muted-foreground">Perda projetada</span>
              <span className="font-semibold text-destructive">
                {formatBRL(k.cancelamentos30d.valor)}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Saldo líquido</span>
              <span className="font-bold">
                {formatBRL(k.vendas30d.valor - k.cancelamentos30d.valor)}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}
