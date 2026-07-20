import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ComposedChart,
} from "recharts";
import { CalendarCheck, Percent, UserRoundCheck, Users } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ChartCard, KpiCard } from "@/components/KpiCard";
import { useApp } from "@/contexts/AppContext";
import { formatNum } from "@/lib/mockData";
import { useDashboardData } from "@/lib/membersDashboardData";
import { exportToExcel, exportToPdf } from "@/lib/exporters";

export const Route = createFileRoute("/_authenticated/professores")({
  head: () => ({
    meta: [
      { title: "Professores - be.move BI" },
      {
        name: "description",
        content: "Desempenho dos professores em relacao a ocupacao das aulas ministradas.",
      },
    ],
  }),
  component: ProfessoresPage,
});

const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--foreground)",
};

function ProfessoresPage() {
  const { filters } = useApp();
  const { data, loadingActivities, activitiesError } = useDashboardData(filters);
  const professores = data.professores;
  const k = professores.kpis;
  const [showAllTeachers, setShowAllTeachers] = useState(false);
  const rankingData = showAllTeachers ? professores.ranking : professores.ranking.slice(0, 10);

  const onExportExcel = () =>
    exportToExcel("professores", {
      KPIs: [
        { metrica: "Professores ativos", valor: k.totalProfessores },
        { metrica: "Aulas na agenda", valor: k.aulasMinistradas },
        { metrica: "Ocupacao media (%)", valor: k.ocupacaoMedia },
        { metrica: "Alunos inscritos", valor: k.alunosInscritos },
        { metrica: "Alunos presentes", valor: k.alunosPresentes },
        { metrica: "Faltas", valor: k.faltas },
        { metrica: "Faltas justificadas", valor: k.faltasJustificadas },
        { metrica: "Capacidade ofertada", valor: k.capacidadeTotal },
        { metrica: "Media de alunos por aula", valor: k.mediaAlunos },
      ],
      RankingProfessores: professores.ranking,
      Modalidades: professores.porModalidade,
      Horarios: professores.porHorario,
      Evolucao: professores.evolucao,
    });

  const onExportPdf = () =>
    exportToPdf(
      "Desempenho dos professores",
      professores.ranking.map((row) => ({
        Professor: row.professor,
        Modalidade: row.modalidade,
        Unidade: row.unidade,
        Aulas: row.aulas,
        Ocupacao: `${row.ocupacao}%`,
        "Media alunos": row.mediaAlunos,
        "Alunos inscritos": row.inscritos,
        "Alunos presentes": row.presentes,
        Faltas: row.faltas,
        "Faltas justificadas": row.faltasJustificadas,
        "No-show": `${row.noShow}%`,
        Capacidade: row.capacidade,
      })),
    );

  return (
    <DashboardLayout
      title="Professores"
      subtitle="Ocupação real da agenda e eficiência da grade"
      onExportPdf={onExportPdf}
      onExportExcel={onExportExcel}
    >
      {(loadingActivities || activitiesError) && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
          {loadingActivities
            ? "Carregando os dados reais da agenda EVO..."
            : `Não foi possível carregar a agenda EVO: ${activitiesError}`}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Ocupacao media"
          value={`${k.ocupacaoMedia}%`}
          hint={`${formatNum(k.alunosInscritos)} inscritos de ${formatNum(k.capacidadeTotal)} vagas`}
          icon={<Percent className="h-5 w-5" />}
        />
        <KpiCard
          label="Aulas na agenda"
          value={formatNum(k.aulasMinistradas)}
          hint={`${k.totalProfessores} professores ativos`}
          accent="success"
          icon={<CalendarCheck className="h-5 w-5" />}
        />
        <KpiCard
          label="Professores acima de 80%"
          value={formatNum(k.professoresAltaOcupacao)}
          hint="Alta demanda no periodo"
          accent="success"
          icon={<UserRoundCheck className="h-5 w-5" />}
        />
        <KpiCard
          label="Média de alunos"
          value={formatNum(k.mediaAlunos)}
          hint="Inscritos por aula"
          accent="success"
          icon={<Users className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Ranking de ocupacao por professor" description="% de vagas preenchidas">
          <div className="flex h-full min-h-0 flex-col">
            {professores.ranking.length > 10 && (
              <div className="flex justify-end pb-2">
                <button
                  type="button"
                  onClick={() => setShowAllTeachers((value) => !value)}
                  className="rounded-md border border-border px-3 py-1 text-xs font-medium hover:bg-accent"
                >
                  {showAllTeachers ? "Mostrar somente 10" : "Mostrar mais"}
                </button>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div style={{ height: Math.max(230, rankingData.length * 30) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rankingData} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid
                      stroke="var(--border)"
                      strokeDasharray="3 3"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                      unit="%"
                    />
                    <YAxis
                      type="category"
                      dataKey="professor"
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                      width={170}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="ocupacao" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Modalidades" description="Ocupacao e media de alunos por aula">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={professores.porModalidade}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="modalidade"
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                interval={0}
              />
              <YAxis
                yAxisId="left"
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                unit="%"
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                yAxisId="left"
                dataKey="ocupacao"
                name="Ocupacao"
                fill="var(--chart-2)"
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="mediaAlunos"
                name="Media alunos"
                stroke="var(--chart-4)"
                strokeWidth={2.5}
                dot={{ fill: "var(--chart-4)", r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Evolução diária" description="Ocupação e volume de aulas dia a dia">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={professores.evolucao}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="semana" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <YAxis
                yAxisId="left"
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                unit="%"
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="ocupacao"
                name="Ocupacao"
                stroke="var(--chart-3)"
                strokeWidth={3}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="aulas"
                name="Aulas"
                stroke="var(--chart-5)"
                strokeWidth={2.5}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Ocupação por horário" description="Ocupação e média de inscritos">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={professores.porHorario}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="horario" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <YAxis
                yAxisId="left"
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                unit="%"
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                yAxisId="left"
                dataKey="ocupacao"
                name="Ocupação (%)"
                fill="var(--chart-4)"
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="right"
                dataKey="mediaAlunos"
                name="Média de inscritos"
                stroke="var(--chart-2)"
                strokeWidth={2.5}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border p-5">
            <h3 className="text-sm font-semibold">Detalhamento por professor</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Leitura operacional para ajustar grade, capacidade e chamada ativa.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] text-sm">
              <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Professor</th>
                  <th className="px-5 py-3 font-medium">Modalidade</th>
                  <th className="px-5 py-3 font-medium">Unidade</th>
                  <th className="px-5 py-3 font-medium">Aulas</th>
                  <th className="px-5 py-3 font-medium">Ocupacao</th>
                  <th className="px-5 py-3 font-medium">Inscritos</th>
                  <th className="px-5 py-3 font-medium">Presentes</th>
                  <th className="px-5 py-3 font-medium">Faltas</th>
                  <th className="px-5 py-3 font-medium">Justificadas</th>
                  <th className="px-5 py-3 font-medium">No-show</th>
                  <th className="px-5 py-3 font-medium">Média/aula</th>
                  <th className="px-5 py-3 font-medium">Capacidade</th>
                </tr>
              </thead>
              <tbody>
                {professores.ranking.map((row) => (
                  <tr
                    key={row.professor}
                    className="border-t border-border hover:bg-accent/40 transition"
                  >
                    <td className="px-5 py-3 font-medium">{row.professor}</td>
                    <td className="px-5 py-3 text-muted-foreground">{row.modalidade}</td>
                    <td className="px-5 py-3 text-muted-foreground">{row.unidade}</td>
                    <td className="px-5 py-3">{formatNum(row.aulas)}</td>
                    <td className="px-5 py-3 font-semibold">{row.ocupacao}%</td>
                    <td className="px-5 py-3">{formatNum(row.inscritos)}</td>
                    <td className="px-5 py-3">{formatNum(row.presentes)}</td>
                    <td className="px-5 py-3">{formatNum(row.faltas)}</td>
                    <td className="px-5 py-3">{formatNum(row.faltasJustificadas)}</td>
                    <td className="px-5 py-3 font-semibold">{row.noShow}%</td>
                    <td className="px-5 py-3">{row.mediaAlunos}</td>
                    <td className="px-5 py-3">{formatNum(row.capacidade)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="min-w-0 self-start rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold">Pontos de atencao</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Sugestões geradas a partir da ocupação real registrada na agenda EVO.
          </p>
          <div className="mt-5 space-y-3">
            {professores.oportunidades.map((item) => (
              <div
                key={`${item.professor}-${item.foco}`}
                className="rounded-lg border border-border p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{item.professor}</span>
                  <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-warning">
                    {item.foco}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{item.indicador}</p>
              </div>
            ))}
            {!professores.oportunidades.length && (
              <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
                Nenhum professor abaixo dos limites definidos no periodo.
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
