import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
  Legend,
} from "recharts";
import {
  Users,
  UserX,
  DollarSign,
  TrendingDown,
  ShoppingCart,
  RefreshCw,
  CalendarCheck,
  TriangleAlert,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
} from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Geral — be.move BI" },
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

const ACTIVE_PAGE_SIZE = 25;

function periodKpiLabel(metric: string, period: string) {
  if (period.includes("Hoje")) return `${metric} hoje`;
  if (period.includes("7")) return `${metric} 7d`;
  if (period.includes("90")) return `${metric} 90d`;
  if (period.toLowerCase().includes("ano")) return `${metric} no ano`;
  return `${metric} 30d`;
}

function displayDate(value: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleDateString("pt-BR");
}

function GeralPage() {
  const { filters } = useApp();
  const { data } = useDashboardData(filters);
  const k = data.overviewKpis;
  const [activeStudentsOpen, setActiveStudentsOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);
  const [cancellationsOpen, setCancellationsOpen] = useState(false);
  const [riskStudentsOpen, setRiskStudentsOpen] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const renewalDeactivation = Number(k.taxaDesativacaoRenovacao).toFixed(2).replace(".", ",");
  const activePages = Math.max(1, Math.ceil(data.alunosAtivosLista.length / ACTIVE_PAGE_SIZE));
  const activeRows = data.alunosAtivosLista.slice(
    (activePage - 1) * ACTIVE_PAGE_SIZE,
    activePage * ACTIVE_PAGE_SIZE,
  );

  const exportActiveStudents = () =>
    exportToExcel("alunos-ativos", {
      "Alunos ativos": data.alunosAtivosLista.map((student) => ({
        Número: student.id,
        Aluno: student.nome,
        Contrato: student.contrato,
        Bairro: student.bairro,
        Início: student.inicio ?? "-",
        Vencimento: student.vencimento ?? "-",
        "Última frequência": student.ultimaFrequencia ?? "-",
      })),
    });

  const onExportExcel = () =>
    exportToExcel("geral", {
      KPIs: [
        { metrica: "Alunos ativos", valor: k.alunosAtivos },
        { metrica: "Alunos não ativos", valor: k.alunosNaoAtivos },
        { metrica: "Ticket médio", valor: k.ticketMedio },
        { metrica: "Cancelamentos 30d (qtd)", valor: k.cancelamentos30d.qtd },
        { metrica: "Cancelamentos 30d (R$)", valor: k.cancelamentos30d.valor },
        { metrica: "Vendas 30d (qtd)", valor: k.vendas30d.qtd },
        { metrica: "Vendas 30d (R$)", valor: k.vendas30d.valor },
        { metrica: "Taxa desativação renovação (%)", valor: k.taxaDesativacaoRenovacao },
        { metrica: "Taxa ocupação agenda (%)", valor: k.taxaOcupacaoAgenda },
        { metrica: "Alunos em risco", valor: k.alunosRisco },
      ],
      EvolucaoAlunos: data.evolucaoAlunos,
      OcupacaoAgenda: data.ocupacaoAgenda,
      TaxaRenovacao: data.taxaRenovacao,
      RenovacoesMensais: data.renovacoesMensais,
    });

  const onExportPdf = () =>
    exportToPdf("Geral - KPIs", [
      { Métrica: "Alunos ativos", Valor: formatNum(k.alunosAtivos) },
      { Métrica: "Alunos não ativos", Valor: formatNum(k.alunosNaoAtivos) },
      { Métrica: "Ticket médio", Valor: formatBRL(k.ticketMedio) },
      { Métrica: "Vendas 30d", Valor: `${k.vendas30d.qtd} (${formatBRL(k.vendas30d.valor)})` },
      {
        Métrica: "Cancelamentos 30d",
        Valor: `${k.cancelamentos30d.qtd} (${formatBRL(k.cancelamentos30d.valor)})`,
      },
      { Métrica: "Desativação renovação", Valor: `${k.taxaDesativacaoRenovacao}%` },
      { Métrica: "Ocupação agenda", Valor: `${k.taxaOcupacaoAgenda}%` },
      { Métrica: "Alunos em risco", Valor: formatNum(k.alunosRisco) },
    ]);

  return (
    <DashboardLayout
      title="Geral"
      subtitle="Visão executiva da operação"
      onExportPdf={onExportPdf}
      onExportExcel={onExportExcel}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Alunos ativos"
          value={formatNum(k.alunosAtivos)}
          delta={4.2}
          icon={<Users className="h-5 w-5" />}
          hint="Clique para ver a lista completa"
          onClick={() => setActiveStudentsOpen(true)}
        />
        <KpiCard
          label="Alunos não ativos"
          value={formatNum(k.alunosNaoAtivos)}
          hint="Contratos vencidos"
          delta={-1.6}
          accent="warning"
          icon={<UserX className="h-5 w-5" />}
        />
        <KpiCard
          label="Ticket médio"
          value={formatBRL(k.ticketMedio)}
          accent="success"
          icon={<DollarSign className="h-5 w-5" />}
        />
        <KpiCard
          label={periodKpiLabel("Vendas", filters.periodo)}
          value={formatNum(k.vendas30d.qtd)}
          hint={formatBRL(k.vendas30d.valor)}
          accent="success"
          icon={<ShoppingCart className="h-5 w-5" />}
          onClick={() => setSalesOpen(true)}
        />
        <KpiCard
          label={periodKpiLabel("Cancelamentos", filters.periodo)}
          value={formatNum(k.cancelamentos30d.qtd)}
          hint={formatBRL(k.cancelamentos30d.valor)}
          accent="destructive"
          icon={<TrendingDown className="h-5 w-5" />}
          onClick={() => setCancellationsOpen(true)}
        />
        <KpiCard
          label="Desat. renovação"
          value={`${renewalDeactivation}%`}
          accent="warning"
          icon={<RefreshCw className="h-5 w-5" />}
        />
        <KpiCard
          label="Ocupação agenda"
          value={`${k.taxaOcupacaoAgenda}%`}
          icon={<CalendarCheck className="h-5 w-5" />}
        />
        <KpiCard
          label="Alunos em risco"
          value={formatNum(k.alunosRisco)}
          hint="Clique para ver a lista completa"
          accent="warning"
          icon={<TriangleAlert className="h-5 w-5" />}
          onClick={() => setRiskStudentsOpen(true)}
        />
      </div>

      <Dialog
        open={activeStudentsOpen}
        onOpenChange={(open) => {
          setActiveStudentsOpen(open);
          if (open) setActivePage(1);
        }}
      >
        <DialogContent className="flex max-h-[85vh] max-w-6xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-6 py-5 pr-14">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <DialogTitle>Alunos ativos</DialogTitle>
                <DialogDescription>
                  {formatNum(data.alunosAtivosLista.length)} alunos conforme os filtros
                  selecionados.
                </DialogDescription>
              </div>
              <button
                type="button"
                onClick={exportActiveStudents}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-medium transition hover:bg-accent"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Baixar XLSX
              </button>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Número</th>
                  <th className="px-5 py-3">Aluno</th>
                  <th className="px-5 py-3">Contrato</th>
                  <th className="px-5 py-3">Bairro</th>
                  <th className="px-5 py-3">Início</th>
                  <th className="px-5 py-3">Vencimento</th>
                  <th className="px-5 py-3">Última frequência</th>
                </tr>
              </thead>
              <tbody>
                {activeRows.map((student) => (
                  <tr key={student.id} className="border-t border-border hover:bg-accent/40">
                    <td className="px-5 py-3 font-medium">{student.id}</td>
                    <td className="px-5 py-3 font-medium">{student.nome}</td>
                    <td className="px-5 py-3">{student.contrato}</td>
                    <td className="px-5 py-3">{student.bairro}</td>
                    <td className="px-5 py-3">{student.inicio ?? "-"}</td>
                    <td className="px-5 py-3">{student.vencimento ?? "-"}</td>
                    <td className="px-5 py-3">{student.ultimaFrequencia ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <span>
              Página {activePage} de {activePages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={activePage === 1}
                onClick={() => setActivePage((page) => Math.max(1, page - 1))}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-3 font-medium text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </button>
              <button
                type="button"
                disabled={activePage === activePages}
                onClick={() => setActivePage((page) => Math.min(activePages, page + 1))}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-3 font-medium text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                Próxima <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={salesOpen} onOpenChange={setSalesOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-6 py-5">
            <DialogTitle>{periodKpiLabel("Vendas", filters.periodo)}</DialogTitle>
            <DialogDescription>
              {formatNum(data.vendasLista.length)} vendas, totalizando{" "}
              {formatBRL(k.vendas30d.valor)}.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[850px] text-sm">
              <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Venda</th>
                  <th className="px-5 py-3">Aluno</th>
                  <th className="px-5 py-3">Contrato</th>
                  <th className="px-5 py-3">Data</th>
                  <th className="px-5 py-3">Vencimento</th>
                  <th className="px-5 py-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.vendasLista.map((sale) => (
                  <tr
                    key={`${sale.idVenda}-${sale.idAluno}`}
                    className="border-t border-border hover:bg-accent/40"
                  >
                    <td className="px-5 py-3 font-medium">{sale.idVenda}</td>
                    <td className="px-5 py-3">{sale.aluno}</td>
                    <td className="px-5 py-3">{sale.contrato}</td>
                    <td className="px-5 py-3">{displayDate(sale.dataVenda)}</td>
                    <td className="px-5 py-3">{displayDate(sale.vencimento)}</td>
                    <td className="px-5 py-3 text-right font-medium">{formatBRL(sale.valor)}</td>
                  </tr>
                ))}
                {!data.vendasLista.length && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                      Nenhuma venda encontrada no período selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={cancellationsOpen} onOpenChange={setCancellationsOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-6xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-6 py-5">
            <DialogTitle>{periodKpiLabel("Cancelamentos", filters.periodo)}</DialogTitle>
            <DialogDescription>
              {formatNum(data.cancelamentosLista.length)} cancelamentos, totalizando{" "}
              {formatBRL(k.cancelamentos30d.valor)}.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[1050px] text-sm">
              <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Contrato Nº</th>
                  <th className="px-5 py-3">Aluno</th>
                  <th className="px-5 py-3">Contrato</th>
                  <th className="px-5 py-3">Data</th>
                  <th className="px-5 py-3">Motivo</th>
                  <th className="px-5 py-3 text-right">Venda</th>
                  <th className="px-5 py-3 text-right">Multa</th>
                  <th className="px-5 py-3 text-right">Restante</th>
                </tr>
              </thead>
              <tbody>
                {data.cancelamentosLista.map((cancellation) => (
                  <tr
                    key={`${cancellation.idContrato}-${cancellation.idAluno}`}
                    className="border-t border-border hover:bg-accent/40"
                  >
                    <td className="px-5 py-3 font-medium">{cancellation.idContrato}</td>
                    <td className="px-5 py-3">{cancellation.aluno}</td>
                    <td className="px-5 py-3">{cancellation.contrato}</td>
                    <td className="px-5 py-3">{displayDate(cancellation.dataCancelamento)}</td>
                    <td className="max-w-[260px] truncate px-5 py-3" title={cancellation.motivo}>
                      {cancellation.motivo}
                    </td>
                    <td className="px-5 py-3 text-right">{formatBRL(cancellation.valorVenda)}</td>
                    <td className="px-5 py-3 text-right">{formatBRL(cancellation.multa)}</td>
                    <td className="px-5 py-3 text-right font-medium">
                      {formatBRL(cancellation.valorRestante)}
                    </td>
                  </tr>
                ))}
                {!data.cancelamentosLista.length && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">
                      Nenhum cancelamento encontrado no período selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={riskStudentsOpen} onOpenChange={setRiskStudentsOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-6xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-6 py-5">
            <DialogTitle>Alunos em risco</DialogTitle>
            <DialogDescription>
              {formatNum(data.alunosRiscoLista.length)} alunos ativos com sinais de risco conforme
              os filtros selecionados.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Número</th>
                  <th className="px-5 py-3">Aluno</th>
                  <th className="px-5 py-3">Contrato</th>
                  <th className="px-5 py-3">Bairro</th>
                  <th className="px-5 py-3">Última frequência</th>
                  <th className="px-5 py-3 text-right">Dias sem atividade</th>
                  <th className="px-5 py-3">Vencimento</th>
                  <th className="px-5 py-3">Risco</th>
                </tr>
              </thead>
              <tbody>
                {data.alunosRiscoLista.map((student) => (
                  <tr key={student.id} className="border-t border-border hover:bg-accent/40">
                    <td className="px-5 py-3 font-medium">{student.id}</td>
                    <td className="px-5 py-3 font-medium">{student.nome}</td>
                    <td className="px-5 py-3">{student.contrato}</td>
                    <td className="px-5 py-3">{student.bairro}</td>
                    <td className="px-5 py-3">{student.ultimaFrequencia ?? "-"}</td>
                    <td className="px-5 py-3 text-right font-medium">
                      {formatNum(student.diasSemAtividade)}
                    </td>
                    <td className="px-5 py-3">{student.vencimento ?? "-"}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${
                          student.nivelRisco === "alto"
                            ? "bg-destructive/15 text-destructive"
                            : student.nivelRisco === "medio"
                              ? "bg-warning/15 text-warning"
                              : "bg-success/15 text-success"
                        }`}
                      >
                        {student.nivelRisco}
                      </span>
                    </td>
                  </tr>
                ))}
                {!data.alunosRiscoLista.length && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">
                      Nenhum aluno ativo em risco foi encontrado com os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Evolução de alunos ativos"
          description="Saldo diário de alunos com contrato ativo no período"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.evolucaoAlunos}>
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

        <ChartCard
          title="Ocupação da agenda por horário"
          description="Inscritos em relação à capacidade média do período"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.ocupacaoAgenda}>
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
          title="Renovações e vencimentos por mês"
          description="Comparativo dos últimos 12 meses"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.renovacoesMensais}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <YAxis
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                allowDecimals={false}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Bar
                dataKey="renovacoes"
                name="Renovações"
                fill="var(--chart-3)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="vencimentos"
                name="Vencimentos"
                fill="var(--chart-4)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
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
              <span className="font-semibold text-success">{formatBRL(k.vendas30d.valor)}</span>
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
