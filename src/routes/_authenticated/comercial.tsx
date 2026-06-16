import { createFileRoute } from "@tanstack/react-router";
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
import { ShoppingCart, TrendingDown, AlertTriangle } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { KpiCard, ChartCard } from "@/components/KpiCard";
import {
  overviewKpis,
  evolucaoVendas,
  funilComercial,
  rankingRetencao,
  alunosRisco,
  formatBRL,
  formatNum,
} from "@/lib/mockData";
import { exportToPdf, exportToExcel } from "@/lib/exporters";

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

function ComercialPage() {
  const k = overviewKpis;

  const onExportExcel = () =>
    exportToExcel("comercial", {
      KPIs: [
        { metrica: "Vendas 30d", valor: k.vendas30d.qtd },
        { metrica: "Cancelamentos próx. 30d", valor: k.cancelamentos30d.qtd },
        { metrica: "Alunos em risco", valor: k.alunosRisco },
      ],
      EvolucaoVendas: evolucaoVendas,
      Funil: funilComercial,
      Ranking: rankingRetencao,
      AlunosRisco: alunosRisco,
    });

  const onExportPdf = () =>
    exportToPdf(
      "Alunos em risco",
      alunosRisco.map((a) => ({
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Vendas (30d)"
          value={formatNum(k.vendas30d.qtd)}
          hint={formatBRL(k.vendas30d.valor)}
          delta={6.1}
          accent="success"
          icon={<ShoppingCart className="h-5 w-5" />}
        />
        <KpiCard
          label="Cancelamentos previstos (30d)"
          value={formatNum(k.cancelamentos30d.qtd)}
          hint={formatBRL(k.cancelamentos30d.valor)}
          delta={-2.4}
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
            <LineChart data={evolucaoVendas}>
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
              <Funnel dataKey="valor" data={funilComercial} isAnimationActive fill="var(--chart-1)">
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

        <ChartCard
          title="Ranking de retenção por unidade"
          description="% de alunos retidos"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rankingRetencao} layout="vertical">
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} unit="%" />
              <YAxis
                type="category"
                dataKey="unidade"
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                width={110}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="retencao" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
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
              const count = alunosRisco.filter((a) => a.nivelRisco === nivel).length;
              const pct = (count / alunosRisco.length) * 100;
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
                <th className="px-5 py-3 font-medium">Aluno</th>
                <th className="px-5 py-3 font-medium">Último agend.</th>
                <th className="px-5 py-3 font-medium">Dias sem ativ.</th>
                <th className="px-5 py-3 font-medium">Contrato</th>
                <th className="px-5 py-3 font-medium">Risco</th>
              </tr>
            </thead>
            <tbody>
              {alunosRisco
                .slice()
                .sort((a, b) => b.diasSemAtividade - a.diasSemAtividade)
                .map((a) => (
                  <tr key={a.id} className="border-t border-border hover:bg-accent/40 transition">
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
    </DashboardLayout>
  );
}
