import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
  Clock,
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

function todayInputDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

type SortDirection = "asc" | "desc";
type SortState = { key: string; direction: SortDirection } | null;

function parseSortableDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  if (raw === "-") return null;
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (br) {
    const [, day, month, year, hour = "0", minute = "0"] = br;
    const fullYear = year.length === 2 ? `20${year}` : year;
    const parsed = new Date(
      Number(fullYear),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  }
  if (!/^\d{4}-\d{2}-\d{2}(?:T|\s|$)/.test(raw)) return null;
  const iso = new Date(raw);
  return Number.isNaN(iso.getTime()) ? null : iso.getTime();
}

function parseSortableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw || raw === "-") return null;
  const numeric = raw.replace(/[^\d,.-]/g, "");
  if (!numeric || numeric === "-" || numeric === "," || numeric === ".") return null;
  const hasComma = numeric.includes(",");
  const hasDot = numeric.includes(".");
  const normalized =
    hasComma && hasDot
      ? numeric.replace(/\./g, "").replace(",", ".")
      : hasComma
        ? numeric.replace(",", ".")
        : numeric;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function compareSortableValues(a: unknown, b: unknown) {
  const aDate = parseSortableDate(a);
  const bDate = parseSortableDate(b);
  if (aDate !== null && bDate !== null) return aDate - bDate;
  if (aDate !== null) return -1;
  if (bDate !== null) return 1;

  const aNumber = parseSortableNumber(a);
  const bNumber = parseSortableNumber(b);
  if (aNumber !== null && bNumber !== null) return aNumber - bNumber;
  if (aNumber !== null) return -1;
  if (bNumber !== null) return 1;

  return String(a ?? "").localeCompare(String(b ?? ""), "pt-BR", {
    numeric: true,
    sensitivity: "base",
  });
}

function sortedRows<T>(
  rows: T[],
  sort: SortState,
  accessors: Record<string, (row: T) => unknown>,
) {
  if (!sort) return rows;
  const accessor = accessors[sort.key];
  if (!accessor) return rows;
  const multiplier = sort.direction === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const compared = compareSortableValues(accessor(a.row), accessor(b.row));
      return compared === 0 ? a.index - b.index : compared * multiplier;
    })
    .map(({ row }) => row);
}

function nextSort(current: SortState, key: string): SortState {
  if (current?.key !== key) return { key, direction: "asc" };
  return { key, direction: current.direction === "asc" ? "desc" : "asc" };
}

function SortHeader({
  id,
  label,
  sort,
  onSort,
  align = "left",
}: {
  id: string;
  label: string;
  sort: SortState;
  onSort: (key: string) => void;
  align?: "left" | "right";
}) {
  const active = sort?.key === id;
  return (
    <th className={`px-5 py-3 ${align === "right" ? "text-right" : ""}`}>
      <button
        type="button"
        onClick={() => onSort(id)}
        className={`inline-flex items-center gap-1 font-semibold uppercase transition hover:text-foreground ${
          align === "right" ? "justify-end" : ""
        }`}
      >
        {label}
        <span className="text-[10px]">{active ? (sort.direction === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}

function GeralPage() {
  const { filters } = useApp();
  const { data } = useDashboardData(filters);
  const navigate = useNavigate();
  const k = data.overviewKpis;
  const [activeStudentsOpen, setActiveStudentsOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);
  const [cancellationsOpen, setCancellationsOpen] = useState(false);
  const [riskStudentsOpen, setRiskStudentsOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<
    (typeof data.agendaHoje)[number] | null
  >(null);
  const [selectedAgendaDate, setSelectedAgendaDate] = useState(todayInputDate);
  const currentActivityRef = useRef<HTMLTableRowElement | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [activeSort, setActiveSort] = useState<SortState>(null);
  const [salesSort, setSalesSort] = useState<SortState>(null);
  const [cancellationsSort, setCancellationsSort] = useState<SortState>(null);
  const [riskSort, setRiskSort] = useState<SortState>(null);
  const [participantsSort, setParticipantsSort] = useState<SortState>(null);
  const openClientPage = (clientId: number | string | null | undefined) => {
    const parsed = Number(clientId);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setActiveStudentsOpen(false);
    setSalesOpen(false);
    setCancellationsOpen(false);
    setRiskStudentsOpen(false);
    setSelectedActivity(null);
    navigate({ to: "/clientes/$id", params: { id: String(parsed) } });
  };
  const renewalDeactivation = Number(k.taxaDesativacaoRenovacao).toFixed(2).replace(".", ",");
  const movimentacaoPeriodo = k.movimentacaoPeriodo ?? {
    entradas: 0,
    saidas: 0,
    saldo: 0,
    renovacoes: 0,
  };
  const sortedActiveStudents = useMemo(
    () =>
      sortedRows(data.alunosAtivosLista, activeSort, {
        id: (row) => row.id,
        nome: (row) => row.nome,
        contrato: (row) => row.contrato,
        bairro: (row) => row.bairro,
        inicio: (row) => row.inicio,
        vencimento: (row) => row.vencimento,
        ultimaFrequencia: (row) => row.ultimaFrequencia,
      }),
    [activeSort, data.alunosAtivosLista],
  );
  const activePages = Math.max(1, Math.ceil(sortedActiveStudents.length / ACTIVE_PAGE_SIZE));
  const activeRows = sortedActiveStudents.slice(
    (activePage - 1) * ACTIVE_PAGE_SIZE,
    activePage * ACTIVE_PAGE_SIZE,
  );
  const sortedSales = useMemo(
    () =>
      sortedRows(data.vendasLista, salesSort, {
        idVenda: (row) => row.idVenda,
        aluno: (row) => row.aluno,
        contrato: (row) => row.contrato,
        dataVenda: (row) => row.dataVenda,
        vencimento: (row) => row.vencimento,
        valor: (row) => row.valor,
      }),
    [data.vendasLista, salesSort],
  );
  const sortedCancellations = useMemo(
    () =>
      sortedRows(data.cancelamentosLista, cancellationsSort, {
        idContrato: (row) => row.idContrato,
        aluno: (row) => row.aluno,
        contrato: (row) => row.contrato,
        dataCancelamento: (row) => row.dataCancelamento,
        motivo: (row) => row.motivo,
        valorVenda: (row) => row.valorVenda,
        multa: (row) => row.multa,
        valorRestante: (row) => row.valorRestante,
      }),
    [cancellationsSort, data.cancelamentosLista],
  );
  const sortedRiskStudents = useMemo(
    () =>
      sortedRows(data.alunosRiscoLista, riskSort, {
        id: (row) => row.id,
        nome: (row) => row.nome,
        contrato: (row) => row.contrato,
        bairro: (row) => row.bairro,
        ultimaFrequencia: (row) => row.ultimaFrequencia,
        diasSemAtividade: (row) => row.diasSemAtividade,
        vencimento: (row) => row.vencimento,
        nivelRisco: (row) => row.nivelRisco,
      }),
    [data.alunosRiscoLista, riskSort],
  );
  const agendaSelecionada = data.agendaEventos.filter(
    (activity) => activity.data === selectedAgendaDate,
  );
  const sortedParticipants = useMemo(
    () =>
      sortedRows(selectedActivity?.participantesLista ?? [], participantsSort, {
        id: (row) => row.id,
        name: (row) => row.name,
        contrato: (row) => row.contrato,
        vigencia: (row) => row.vigencia,
        status: (row) => row.status,
      }),
    [participantsSort, selectedActivity],
  );
  useEffect(() => {
    currentActivityRef.current?.scrollIntoView({ block: "center" });
  }, [selectedAgendaDate, data.agendaEventos.length]);

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
      Agenda: agendaSelecionada.map((activity) => ({
        Data: displayDate(activity.data),
        Horário: `${activity.horario} - ${activity.fim}`,
        Atividade: activity.atividade,
        Professor: activity.professor,
        Unidade: activity.unidade,
        Participantes: activity.participantes,
        Capacidade: activity.capacidade,
        "Em andamento": activity.acontecendoAgora ? "Sim" : "Não",
      })),
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
          icon={<Users className="h-5 w-5" />}
          hint={`Entraram ${formatNum(movimentacaoPeriodo.entradas)} • Saíram ${formatNum(
            movimentacaoPeriodo.saidas,
          )} • Saldo ${movimentacaoPeriodo.saldo >= 0 ? "+" : ""}${formatNum(
            movimentacaoPeriodo.saldo,
          )} • Renovações ${formatNum(movimentacaoPeriodo.renovacoes)}`}
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
                  <SortHeader id="id" label="Número" sort={activeSort} onSort={(key) => setActiveSort((sort) => nextSort(sort, key))} />
                  <SortHeader id="nome" label="Aluno" sort={activeSort} onSort={(key) => setActiveSort((sort) => nextSort(sort, key))} />
                  <SortHeader id="contrato" label="Contrato" sort={activeSort} onSort={(key) => setActiveSort((sort) => nextSort(sort, key))} />
                  <SortHeader id="bairro" label="Bairro" sort={activeSort} onSort={(key) => setActiveSort((sort) => nextSort(sort, key))} />
                  <SortHeader id="inicio" label="Início" sort={activeSort} onSort={(key) => setActiveSort((sort) => nextSort(sort, key))} />
                  <SortHeader id="vencimento" label="Vencimento" sort={activeSort} onSort={(key) => setActiveSort((sort) => nextSort(sort, key))} />
                  <SortHeader id="ultimaFrequencia" label="Última frequência" sort={activeSort} onSort={(key) => setActiveSort((sort) => nextSort(sort, key))} />
                </tr>
              </thead>
              <tbody>
                {activeRows.map((student) => (
                  <tr
                    key={student.id}
                    onClick={() => openClientPage(student.id)}
                    className="cursor-pointer border-t border-border hover:bg-accent/40"
                    title="Abrir página do cliente"
                  >
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
                  <SortHeader id="idVenda" label="Venda" sort={salesSort} onSort={(key) => setSalesSort((sort) => nextSort(sort, key))} />
                  <SortHeader id="aluno" label="Aluno" sort={salesSort} onSort={(key) => setSalesSort((sort) => nextSort(sort, key))} />
                  <SortHeader id="contrato" label="Contrato" sort={salesSort} onSort={(key) => setSalesSort((sort) => nextSort(sort, key))} />
                  <SortHeader id="dataVenda" label="Data" sort={salesSort} onSort={(key) => setSalesSort((sort) => nextSort(sort, key))} />
                  <SortHeader id="vencimento" label="Vencimento" sort={salesSort} onSort={(key) => setSalesSort((sort) => nextSort(sort, key))} />
                  <SortHeader id="valor" label="Valor" sort={salesSort} onSort={(key) => setSalesSort((sort) => nextSort(sort, key))} align="right" />
                </tr>
              </thead>
              <tbody>
                {sortedSales.map((sale) => (
                  <tr
                    key={`${sale.idVenda}-${sale.idAluno}`}
                    onClick={() => openClientPage(sale.idAluno)}
                    className="cursor-pointer border-t border-border hover:bg-accent/40"
                    title="Abrir página do cliente"
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
                  <SortHeader id="idContrato" label="Contrato Nº" sort={cancellationsSort} onSort={(key) => setCancellationsSort((sort) => nextSort(sort, key))} />
                  <SortHeader id="aluno" label="Aluno" sort={cancellationsSort} onSort={(key) => setCancellationsSort((sort) => nextSort(sort, key))} />
                  <SortHeader id="contrato" label="Contrato" sort={cancellationsSort} onSort={(key) => setCancellationsSort((sort) => nextSort(sort, key))} />
                  <SortHeader id="dataCancelamento" label="Data" sort={cancellationsSort} onSort={(key) => setCancellationsSort((sort) => nextSort(sort, key))} />
                  <SortHeader id="motivo" label="Motivo" sort={cancellationsSort} onSort={(key) => setCancellationsSort((sort) => nextSort(sort, key))} />
                  <SortHeader id="valorVenda" label="Venda" sort={cancellationsSort} onSort={(key) => setCancellationsSort((sort) => nextSort(sort, key))} align="right" />
                  <SortHeader id="multa" label="Multa" sort={cancellationsSort} onSort={(key) => setCancellationsSort((sort) => nextSort(sort, key))} align="right" />
                  <SortHeader id="valorRestante" label="Restante" sort={cancellationsSort} onSort={(key) => setCancellationsSort((sort) => nextSort(sort, key))} align="right" />
                </tr>
              </thead>
              <tbody>
                {sortedCancellations.map((cancellation) => (
                  <tr
                    key={`${cancellation.idContrato}-${cancellation.idAluno}`}
                    onClick={() => openClientPage(cancellation.idAluno)}
                    className="cursor-pointer border-t border-border hover:bg-accent/40"
                    title="Abrir página do cliente"
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
                  <SortHeader id="id" label="Número" sort={riskSort} onSort={(key) => setRiskSort((sort) => nextSort(sort, key))} />
                  <SortHeader id="nome" label="Aluno" sort={riskSort} onSort={(key) => setRiskSort((sort) => nextSort(sort, key))} />
                  <SortHeader id="contrato" label="Contrato" sort={riskSort} onSort={(key) => setRiskSort((sort) => nextSort(sort, key))} />
                  <SortHeader id="bairro" label="Bairro" sort={riskSort} onSort={(key) => setRiskSort((sort) => nextSort(sort, key))} />
                  <SortHeader id="ultimaFrequencia" label="Última frequência" sort={riskSort} onSort={(key) => setRiskSort((sort) => nextSort(sort, key))} />
                  <SortHeader id="diasSemAtividade" label="Dias sem atividade" sort={riskSort} onSort={(key) => setRiskSort((sort) => nextSort(sort, key))} align="right" />
                  <SortHeader id="vencimento" label="Vencimento" sort={riskSort} onSort={(key) => setRiskSort((sort) => nextSort(sort, key))} />
                  <SortHeader id="nivelRisco" label="Risco" sort={riskSort} onSort={(key) => setRiskSort((sort) => nextSort(sort, key))} />
                </tr>
              </thead>
              <tbody>
                {sortedRiskStudents.map((student) => (
                  <tr
                    key={student.id}
                    onClick={() => openClientPage(student.id)}
                    className="cursor-pointer border-t border-border hover:bg-accent/40"
                    title="Abrir página do cliente"
                  >
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

      <Dialog open={Boolean(selectedActivity)} onOpenChange={(open) => !open && setSelectedActivity(null)}>
        <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-6 py-5">
            <DialogTitle>Participantes da atividade</DialogTitle>
            <DialogDescription>
              {selectedActivity
                ? `${selectedActivity.atividade} • ${selectedActivity.professor} • ${selectedActivity.horario} - ${selectedActivity.fim}`
                : "Lista de participantes"}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <SortHeader id="id" label="Nº" sort={participantsSort} onSort={(key) => setParticipantsSort((sort) => nextSort(sort, key))} />
                  <SortHeader id="name" label="Aluno" sort={participantsSort} onSort={(key) => setParticipantsSort((sort) => nextSort(sort, key))} />
                  <SortHeader id="contrato" label="Contrato" sort={participantsSort} onSort={(key) => setParticipantsSort((sort) => nextSort(sort, key))} />
                  <SortHeader id="vigencia" label="Vigência" sort={participantsSort} onSort={(key) => setParticipantsSort((sort) => nextSort(sort, key))} />
                  <SortHeader id="status" label="Status" sort={participantsSort} onSort={(key) => setParticipantsSort((sort) => nextSort(sort, key))} />
                </tr>
              </thead>
              <tbody>
                {sortedParticipants.map((participant) => (
                  <tr
                    key={`${participant.id}-${participant.name}`}
                    onClick={() => openClientPage(participant.id)}
                    className="cursor-pointer border-t border-border hover:bg-accent/40"
                    title="Abrir página do cliente"
                  >
                    <td className="px-5 py-3 font-medium">{participant.id}</td>
                    <td className="px-5 py-3">{participant.name}</td>
                    <td className="px-5 py-3">{participant.contrato ?? "-"}</td>
                    <td className="px-5 py-3">{participant.vigencia ?? "-"}</td>
                    <td className="px-5 py-3">{participant.status}</td>
                  </tr>
                ))}
                {selectedActivity && selectedActivity.participantesLista.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                      Esta atividade ainda não possui lista nominal salva. A próxima sincronização
                      da API de atividades passará a guardar os participantes sem dados sensíveis.
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
      <section className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Agenda por dia</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Escolha uma data para verificar eventos passados ou futuros com professor e lotação.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-medium text-muted-foreground">
              Dia
              <input
                type="date"
                value={selectedAgendaDate}
                onChange={(event) => setSelectedAgendaDate(event.target.value)}
                className="ml-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {formatNum(agendaSelecionada.length)} atividades
            </span>
          </div>
        </div>

        <div className="max-h-[390px] overflow-auto rounded-lg border border-border">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="sticky top-0 z-10 bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Horário</th>
                <th className="px-4 py-3">Atividade</th>
                <th className="px-4 py-3">Professor</th>
                <th className="px-4 py-3">Unidade</th>
                <th className="px-4 py-3 text-right">Participantes</th>
                <th className="px-4 py-3 text-right">Capacidade</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {agendaSelecionada.map((activity) => (
                <tr
                  ref={activity.acontecendoAgora ? currentActivityRef : null}
                  key={`${activity.horario}-${activity.atividade}-${activity.professor}`}
                  className={`border-t border-border transition hover:bg-accent/40 ${
                    activity.acontecendoAgora ? "bg-primary/5" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-mono font-medium">
                    {activity.horario} - {activity.fim}
                  </td>
                  <td className="px-4 py-3 font-medium">{activity.atividade}</td>
                  <td className="px-4 py-3">{activity.professor}</td>
                  <td className="px-4 py-3">{activity.unidade}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedActivity(activity)}
                      className="rounded-md px-2 py-1 font-semibold text-primary transition hover:bg-primary/10"
                      title="Clique para ver os participantes"
                    >
                      {formatNum(activity.participantes)}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">{formatNum(activity.capacidade)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${
                        activity.acontecendoAgora
                          ? "bg-success/15 text-success"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {activity.acontecendoAgora ? "Acontecendo agora" : "Programada"}
                    </span>
                  </td>
                </tr>
              ))}
              {!agendaSelecionada.length && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                    Nenhuma atividade encontrada para o dia selecionado com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>


      </div>
    </DashboardLayout>
  );
}
