import {
  addMonths,
  differenceInCalendarDays,
  format,
  isWithinInterval,
  parse,
  subDays,
} from "date-fns";
import type { Filters } from "@/contexts/AppContext";

export type ClientRow = {
  id: number;
  nome: string;
  genero: string;
  idade: number;
  bairro: string;
  cidade: string;
  contrato: string;
  contratoNome: string;
  inicio: string | null;
  vencimento: string | null;
  ultimaFrequencia: string | null;
  valor: number;
  valorTotal: number;
  diasAtivo: number;
  ativo: boolean;
};

const parsedDateCache = new Map<string, Date | null>();
const parseBRDate = (value: string | null) => {
  if (!value) return null;
  if (parsedDateCache.has(value)) return parsedDateCache.get(value) ?? null;
  const parsed = parse(value, "dd/MM/yyyy", new Date());
  const date = Number.isNaN(parsed.getTime()) ? null : parsed;
  parsedDateCache.set(value, date);
  return date;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, digits = 0) => Number(value.toFixed(digits));
const sum = <T>(rows: T[], pick: (row: T) => number) =>
  rows.reduce((total, row) => total + pick(row), 0);
const avg = <T>(rows: T[], pick: (row: T) => number) =>
  rows.length ? sum(rows, pick) / rows.length : 0;

function getReferenceDate(clients: ClientRow[]) {
  const allDates = clients
    .flatMap((client) => [
      parseBRDate(client.inicio),
      parseBRDate(client.vencimento),
      parseBRDate(client.ultimaFrequencia),
    ])
    .filter((date): date is Date => Boolean(date));

  return allDates.reduce(
    (latest, date) => (date > latest ? date : latest),
    allDates[0] ?? new Date(),
  );
}

function periodRange(periodo: string, referenceDate: Date) {
  if (periodo.includes("Hoje")) {
    return { start: referenceDate, end: referenceDate, label: "Hoje", days: 1 };
  }
  if (periodo.includes("7")) {
    return {
      start: subDays(referenceDate, 6),
      end: referenceDate,
      label: "Ultimos 7 dias",
      days: 7,
    };
  }
  if (periodo.includes("90")) {
    return {
      start: subDays(referenceDate, 89),
      end: referenceDate,
      label: "Ultimos 90 dias",
      days: 90,
    };
  }
  if (periodo.includes("ano")) {
    return {
      start: new Date(referenceDate.getFullYear(), 0, 1),
      end: referenceDate,
      label: "Este ano",
      days:
        differenceInCalendarDays(referenceDate, new Date(referenceDate.getFullYear(), 0, 1)) + 1,
    };
  }
  return {
    start: subDays(referenceDate, 29),
    end: referenceDate,
    label: "Ultimos 30 dias",
    days: 30,
  };
}

const isInRange = (date: Date | null, range: { start: Date; end: Date }) =>
  Boolean(date && isWithinInterval(date, { start: range.start, end: range.end }));

function ageRange(idade: number) {
  if (idade <= 0) return "Nao informada";
  if (idade <= 25) return "18-25";
  if (idade <= 35) return "26-35";
  if (idade <= 45) return "36-45";
  if (idade <= 55) return "46-55";
  return "55+";
}

function daysSinceLastFrequency(client: ClientRow, referenceDate: Date) {
  const last = parseBRDate(client.ultimaFrequencia);
  return last ? differenceInCalendarDays(referenceDate, last) : 999;
}

function riskLevel(client: ClientRow, referenceDate: Date): "baixo" | "medio" | "alto" {
  const days = daysSinceLastFrequency(client, referenceDate);
  if (days > 15) return "alto";
  if (days > 10) return "medio";
  return "baixo";
}

function matchesBaseFilters(client: ClientRow, filters: Filters) {
  return (
    (filters.unidade === "Todas" || client.bairro === filters.unidade) &&
    (filters.tipoContrato === "Todos" || client.contrato === filters.tipoContrato) &&
    (filters.sexo === "Todos" || client.genero === filters.sexo) &&
    (filters.faixaEtaria === "Todas" || ageRange(client.idade) === filters.faixaEtaria)
  );
}

function matchesPeriod(client: ClientRow, range: { start: Date; end: Date }) {
  return (
    isInRange(parseBRDate(client.inicio), range) ||
    isInRange(parseBRDate(client.vencimento), range) ||
    isInRange(parseBRDate(client.ultimaFrequencia), range)
  );
}

function countBy<T extends string>(rows: ClientRow[], pick: (client: ClientRow) => T) {
  const totals = new Map<T, number>();
  rows.forEach((row) => totals.set(pick(row), (totals.get(pick(row)) ?? 0) + 1));
  return [...totals.entries()].map(([key, qtd]) => ({ key, qtd }));
}

function revenueBy<T extends string>(rows: ClientRow[], pick: (client: ClientRow) => T) {
  const totals = new Map<T, number>();
  rows.forEach((row) => totals.set(pick(row), (totals.get(pick(row)) ?? 0) + row.valor));
  return [...totals.entries()].map(([key, valor]) => ({ key, valor: Math.round(valor) }));
}

function monthKey(date: Date) {
  return format(date, "yyyy-MM");
}

function monthLabel(key: string) {
  return format(parse(`01/${key.slice(5)}/${key.slice(0, 4)}`, "dd/MM/yyyy", new Date()), "MMM/yy");
}

function makeMonthKeys(range: { start: Date; end: Date }) {
  const keys: string[] = [];
  let cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
  const end = new Date(range.end.getFullYear(), range.end.getMonth(), 1);
  while (cursor <= end) {
    keys.push(monthKey(cursor));
    cursor = addMonths(cursor, 1);
  }
  return keys;
}

function latestTopBairros(clients: ClientRow[]) {
  return countBy(clients, (client) => client.bairro)
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 12)
    .map((row) => row.key);
}

export const SEXOS = ["Todos", "Masculino", "Feminino", "Outro"];
export const FAIXAS_ETARIAS = ["Todas", "18-25", "26-35", "36-45", "46-55", "55+"];

export function getDashboardFilterOptions(clients: ClientRow[]) {
  return {
    unidades: ["Todas", ...latestTopBairros(clients)],
    tiposContrato: [
      "Todos",
      ...countBy(clients, (client) => client.contrato)
        .sort((a, b) => b.qtd - a.qtd)
        .map((row) => row.key),
    ],
    sexos: SEXOS,
    faixasEtarias: FAIXAS_ETARIAS,
  };
}

export const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const formatNum = (v: number) => v.toLocaleString("pt-BR");

export function getFilteredDashboardDataFromRows(filters: Filters, clients: ClientRow[]) {
  return buildFilteredDashboardData(filters, clients);
}

function buildFilteredDashboardData(filters: Filters, clients: ClientRow[]) {
  const referenceDate = getReferenceDate(clients);
  const range = periodRange(filters.periodo, referenceDate);
  const baseRows = clients.filter((client) => matchesBaseFilters(client, filters));
  const rows = baseRows.filter((client) => matchesPeriod(client, range));
  const periodRows = rows.length ? rows : baseRows;

  const starts = periodRows.filter((client) => isInRange(parseBRDate(client.inicio), range));
  const vencimentos = periodRows.filter((client) =>
    isInRange(parseBRDate(client.vencimento), range),
  );
  const riskRows = periodRows.filter(
    (client) => daysSinceLastFrequency(client, referenceDate) > 10,
  );
  const highRiskRows = riskRows.filter((client) => riskLevel(client, referenceDate) === "alto");
  const activeRows = baseRows.filter((client) => client.ativo);
  const inactiveRows = baseRows.filter((client) => !client.ativo);
  const positiveValueRows = periodRows.filter((client) => client.valor > 0);
  const ticketMedio = avg(positiveValueRows, (client) => client.valor);
  const faturamento = sum(periodRows, (client) => client.valor);
  const cancelamentosValor = sum(highRiskRows, (client) => client.valor);
  const ocupacao = clamp(
    35 +
      (periodRows.filter((client) => daysSinceLastFrequency(client, referenceDate) <= 7).length /
        Math.max(periodRows.length, 1)) *
        60,
    0,
    98,
  );

  const monthKeys = makeMonthKeys(range).slice(-12);
  const faturamentoMensal = monthKeys.map((key) => {
    const monthStarts = periodRows.filter((client) => {
      const start = parseBRDate(client.inicio);
      return start && monthKey(start) === key;
    });
    const monthDueRisk = periodRows.filter((client) => {
      const due = parseBRDate(client.vencimento);
      return due && monthKey(due) === key && riskLevel(client, referenceDate) === "alto";
    });
    return {
      mes: monthLabel(key),
      faturamento: Math.round(sum(monthStarts, (client) => client.valor)),
      cancelamentos: Math.round(sum(monthDueRisk, (client) => client.valor)),
    };
  });

  const chartDays = Math.min(range.days, 90);
  const evolucaoAlunos = Array.from({ length: chartDays }, (_, index) => {
    const date = subDays(range.end, chartDays - 1 - index);
    const ativos = activeRows.filter((client) => {
      const start = parseBRDate(client.inicio);
      return !start || start <= date;
    }).length;
    return { data: format(date, "dd/MM"), ativos };
  });
  const evolucaoVendas = Array.from({ length: chartDays }, (_, index) => {
    const date = subDays(range.end, chartDays - 1 - index);
    const vendas = baseRows.filter((client) => {
      const start = parseBRDate(client.inicio);
      return start && format(start, "yyyy-MM-dd") === format(date, "yyyy-MM-dd");
    }).length;
    const cancelamentos = baseRows.filter((client) => {
      const due = parseBRDate(client.vencimento);
      return (
        due &&
        format(due, "yyyy-MM-dd") === format(date, "yyyy-MM-dd") &&
        riskLevel(client, referenceDate) === "alto"
      );
    }).length;
    return { data: format(date, "dd/MM"), vendas, cancelamentos };
  });

  const receitaPorPlano = revenueBy(periodRows, (client) => client.contrato)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 8)
    .map((row) => ({ plano: row.key, valor: row.valor }));
  const tipoContratoData = countBy(periodRows, (client) => client.contrato)
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 8)
    .map((row) => ({ tipo: row.key, qtd: row.qtd }));
  const sexoData = countBy(periodRows, (client) => client.genero)
    .sort((a, b) => b.qtd - a.qtd)
    .map((row) => ({ sexo: row.key, qtd: row.qtd }));
  const faixaEtariaData = countBy(periodRows, (client) => ageRange(client.idade))
    .filter((row) => row.key !== "Nao informada")
    .sort((a, b) => FAIXAS_ETARIAS.indexOf(a.key) - FAIXAS_ETARIAS.indexOf(b.key))
    .map((row) => ({ faixa: row.key, qtd: row.qtd }));
  const permanenciaPerfil = faixaEtariaData.map((row) => {
    const group = periodRows.filter((client) => ageRange(client.idade) === row.faixa);
    return { perfil: row.faixa, meses: Math.round(avg(group, (client) => client.diasAtivo) / 30) };
  });
  const rankingRetencao = countBy(periodRows, (client) => client.bairro)
    .map((row) => {
      const group = periodRows.filter((client) => client.bairro === row.key);
      const retained = group.filter(
        (client) => daysSinceLastFrequency(client, referenceDate) <= 15,
      ).length;
      return {
        unidade: row.key,
        retencao: Math.round((retained / Math.max(group.length, 1)) * 100),
      };
    })
    .sort((a, b) => b.retencao - a.retencao)
    .slice(0, 8);
  const alunosRisco = riskRows
    .slice()
    .sort(
      (a, b) => daysSinceLastFrequency(b, referenceDate) - daysSinceLastFrequency(a, referenceDate),
    )
    .slice(0, 12)
    .map((client) => ({
      id: client.id,
      nome: client.nome,
      ultimoAgendamento: client.ultimaFrequencia ?? "-",
      diasSemAtividade: daysSinceLastFrequency(client, referenceDate),
      valorContrato: client.valor,
      nivelRisco: riskLevel(client, referenceDate),
    }));

  const unidadesPeriodo = countBy(periodRows, (client) => client.bairro)
    .sort((a, b) => b.qtd - a.qtd)
    .map((row) => row.key);
  const teacherSeed = [
    { professor: "Ana Ribeiro", modalidade: "Musculacao" },
    { professor: "Bruno Castro", modalidade: "Funcional" },
    { professor: "Carla Mendes", modalidade: "Pilates" },
    { professor: "Diego Nunes", modalidade: "Spinning" },
    { professor: "Fernanda Lima", modalidade: "Yoga" },
    { professor: "Gustavo Rocha", modalidade: "Lutas" },
    { professor: "Helena Prado", modalidade: "Danca" },
    { professor: "Igor Martins", modalidade: "Cross Training" },
    { professor: "Juliana Alves", modalidade: "Alongamento" },
    { professor: "Marcos Vieira", modalidade: "HIIT" },
  ];
  const teacherBase =
    filters.unidade === "Todas"
      ? teacherSeed
      : teacherSeed.filter((_, index) => index % 3 !== 1).slice(0, 6);
  const ocupacaoBase = ocupacao;
  const professoresRanking = teacherBase
    .map((teacher, index) => {
      const unidade =
        filters.unidade === "Todas"
          ? (unidadesPeriodo[index % Math.max(unidadesPeriodo.length, 1)] ?? "Centro")
          : filters.unidade;
      const aulas = Math.max(
        12,
        Math.round((range.days / 30) * (18 + (index % 4) * 4 + starts.length / 18)),
      );
      const capacidade = aulas * (12 + (index % 5) * 2);
      const ocupacaoProfessor = round(
        clamp(ocupacaoBase + Math.sin(index + 0.75) * 13 + (index % 3) * 3, 42, 96),
        1,
      );
      const presentes = Math.round((capacidade * ocupacaoProfessor) / 100);
      const noShow = round(clamp(100 - ocupacaoProfessor + (index % 4) * 1.7, 3, 28), 1);

      return {
        ...teacher,
        unidade,
        aulas,
        capacidade,
        presentes,
        ocupacao: ocupacaoProfessor,
        noShow,
        mediaAlunos: round(presentes / Math.max(aulas, 1), 1),
      };
    })
    .sort((a, b) => b.ocupacao - a.ocupacao);
  const professoresKpis = {
    totalProfessores: professoresRanking.length,
    aulasMinistradas: sum(professoresRanking, (row) => row.aulas),
    capacidadeTotal: sum(professoresRanking, (row) => row.capacidade),
    alunosPresentes: sum(professoresRanking, (row) => row.presentes),
    ocupacaoMedia: round(
      (sum(professoresRanking, (row) => row.presentes) /
        Math.max(
          sum(professoresRanking, (row) => row.capacidade),
          1,
        )) *
        100,
      1,
    ),
    taxaNoShowMedia: round(
      avg(professoresRanking, (row) => row.noShow),
      1,
    ),
    professoresAltaOcupacao: professoresRanking.filter((row) => row.ocupacao >= 80).length,
  };
  const professoresPorModalidade = teacherSeed.slice(0, 8).map((teacher, index) => {
    const group = professoresRanking.filter((row) => row.modalidade === teacher.modalidade);
    const fallbackAulas = Math.round((range.days / 30) * (14 + index * 2));
    const aulas = group.length ? sum(group, (row) => row.aulas) : fallbackAulas;
    const capacidade = group.length
      ? sum(group, (row) => row.capacidade)
      : fallbackAulas * (12 + index);
    const presentes = group.length
      ? sum(group, (row) => row.presentes)
      : Math.round(capacidade * clamp((ocupacaoBase + Math.cos(index) * 10) / 100, 0.45, 0.92));

    return {
      modalidade: teacher.modalidade,
      aulas,
      ocupacao: round((presentes / Math.max(capacidade, 1)) * 100, 1),
      mediaAlunos: round(presentes / Math.max(aulas, 1), 1),
    };
  });
  const professoresPorHorario = [
    "06:00",
    "07:00",
    "08:00",
    "12:00",
    "17:00",
    "18:00",
    "19:00",
    "20:00",
  ].map((horario, index) => ({
    horario,
    ocupacao: Math.round(
      clamp(
        professoresKpis.ocupacaoMedia + Math.sin(index * 1.3) * 15 + (index >= 4 ? 7 : -3),
        38,
        98,
      ),
    ),
    aulas: Math.round((range.days / 30) * (18 + index * 3)),
  }));
  const totalSemanasProfessores = Math.min(8, Math.max(4, Math.ceil(range.days / 7)));
  const professoresEvolucao = Array.from({ length: totalSemanasProfessores }, (_, index) => {
    const semana = `S${index + 1}`;
    const variacao = Math.sin(index * 0.95) * 5 + index * 0.8 - totalSemanasProfessores / 3;
    return {
      semana,
      ocupacao: round(clamp(professoresKpis.ocupacaoMedia + variacao, 45, 96), 1),
      aulas: Math.round(
        (professoresKpis.aulasMinistradas / totalSemanasProfessores) * (0.88 + index * 0.035),
      ),
    };
  });
  const professoresOportunidades = professoresRanking
    .filter((row) => row.ocupacao < 72 || row.noShow > 18)
    .slice(-4)
    .map((row) => ({
      professor: row.professor,
      foco: row.ocupacao < 72 ? "Rever grade/oferta" : "Reduzir faltas",
      indicador: row.ocupacao < 72 ? `${row.ocupacao}% ocupacao` : `${row.noShow}% no-show`,
    }));

  const visitantes = Math.round(starts.length * 5.8);
  const aulas = Math.round(starts.length * 2.1);
  const propostas = Math.round(starts.length * 1.35);
  const taxaRenovacaoBase = periodRows.length
    ? ((periodRows.length - highRiskRows.length) / periodRows.length) * 100
    : 0;

  return {
    periodLabel: range.label,
    overviewKpis: {
      alunosAtivos: activeRows.length,
      alunosNaoAtivos: inactiveRows.length,
      ticketMedio: round(ticketMedio, 1),
      cancelamentos30d: { qtd: highRiskRows.length, valor: round(cancelamentosValor, 1) },
      vendas30d: {
        qtd: starts.length,
        valor: round(
          sum(starts, (client) => client.valor),
          1,
        ),
      },
      taxaDesativacaoRenovacao: round(100 - taxaRenovacaoBase, 1),
      taxaOcupacaoAgenda: round(ocupacao, 1),
      faturamentoMes: Math.round(faturamento),
      faturamentoEstimadoProx: Math.round(sum(activeRows, (client) => client.valor) * 1.04),
      ltvMedio: Math.round(
        ticketMedio * Math.max(avg(periodRows, (client) => client.diasAtivo) / 30, 1),
      ),
      cancelamentosFinanceiros: Math.round(cancelamentosValor),
      alunosRisco: riskRows.length,
      idadeMedia: Math.round(
        avg(
          periodRows.filter((client) => client.idade > 0),
          (client) => client.idade,
        ),
      ),
    },
    evolucaoAlunos,
    ocupacaoAgenda: [
      "06:00",
      "07:00",
      "08:00",
      "09:00",
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
      "18:00",
      "19:00",
      "20:00",
      "21:00",
      "22:00",
    ].map((horario, index) => ({
      horario,
      ocupacao: Math.round(
        clamp(ocupacao + Math.sin(index / 2) * 18 - (index < 2 ? 15 : 0), 8, 98),
      ),
    })),
    taxaRenovacao: monthKeys.map((key) => {
      const monthRows = periodRows.filter((client) => {
        const due = parseBRDate(client.vencimento);
        return due && monthKey(due) === key;
      });
      const retained = monthRows.filter(
        (client) => riskLevel(client, referenceDate) !== "alto",
      ).length;
      return {
        mes: monthLabel(key),
        taxa: Math.round((retained / Math.max(monthRows.length, 1)) * 100),
      };
    }),
    faturamentoMensal,
    receitaPorPlano,
    projecaoFaturamento: Array.from({ length: 6 }, (_, index) => ({
      mes: format(addMonths(range.end, index), "MMM/yy"),
      real: index === 0 ? Math.round(faturamento) : null,
      projecao: Math.round(sum(activeRows, (client) => client.valor) * (1 + index * 0.035)),
    })),
    evolucaoVendas,
    funilComercial: [
      { etapa: "Visitantes", valor: visitantes },
      { etapa: "Aulas Experimentais", valor: aulas },
      { etapa: "Propostas", valor: propostas },
      { etapa: "Matriculas", valor: starts.length },
    ],
    rankingRetencao,
    alunosRisco,
    professores: {
      kpis: professoresKpis,
      ranking: professoresRanking,
      porModalidade: professoresPorModalidade,
      porHorario: professoresPorHorario,
      evolucao: professoresEvolucao,
      oportunidades: professoresOportunidades,
    },
    faixaEtariaData,
    sexoData,
    tipoContratoData,
    permanenciaPerfil,
  };
}
