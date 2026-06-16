// Mock data generator for gym BI dashboard
import { subDays, format } from "date-fns";
import type { Filters } from "@/contexts/AppContext";

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const seed = (n: number) => { let s = n; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };

const r = seed(42);
const ri = (min: number, max: number) => Math.floor(r() * (max - min + 1)) + min;

export const UNIDADES = ["Todas", "Unidade Centro", "Unidade Sul", "Unidade Norte", "Unidade Oeste"];
export const TIPOS_CONTRATO = ["Todos", "Mensal", "Trimestral", "Semestral", "Anual"];
export const SEXOS = ["Todos", "Masculino", "Feminino", "Outro"];
export const FAIXAS_ETARIAS = ["Todas", "18-25", "26-35", "36-45", "46-55", "55+"];

export const overviewKpis = {
  alunosAtivos: 1847,
  ticketMedio: 189.5,
  cancelamentos30d: { qtd: 47, valor: 8906.5 },
  vendas30d: { qtd: 213, valor: 40362.5 },
  taxaDesativacaoRenovacao: 12.4,
  taxaOcupacaoAgenda: 73.6,
  faturamentoMes: 349912,
  faturamentoEstimadoProx: 372480,
  ltvMedio: 2274,
  cancelamentosFinanceiros: 16823,
  alunosRisco: 84,
  idadeMedia: 32,
};

export const evolucaoAlunos = Array.from({ length: 30 }, (_, i) => ({
  data: format(subDays(new Date(), 29 - i), "dd/MM"),
  ativos: 1700 + ri(0, 200) + i * 3,
}));

export const ocupacaoAgenda = [
  "06:00","07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00",
  "15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00",
].map((h) => ({ horario: h, ocupacao: ri(20, 95) }));

export const taxaRenovacao = Array.from({ length: 12 }, (_, i) => ({
  mes: format(subDays(new Date(), (11 - i) * 30), "MMM"),
  taxa: 70 + ri(0, 25),
}));

export const faturamentoMensal = Array.from({ length: 12 }, (_, i) => ({
  mes: format(subDays(new Date(), (11 - i) * 30), "MMM/yy"),
  faturamento: 280000 + ri(-30000, 80000),
  cancelamentos: 10000 + ri(0, 15000),
}));

export const receitaPorPlano = [
  { plano: "Mensal", valor: 124300 },
  { plano: "Trimestral", valor: 89500 },
  { plano: "Semestral", valor: 76200 },
  { plano: "Anual", valor: 59912 },
];

export const projecaoFaturamento = Array.from({ length: 6 }, (_, i) => ({
  mes: format(subDays(new Date(), -i * 30), "MMM/yy"),
  real: i < 2 ? 340000 + ri(0, 30000) : null,
  projecao: 350000 + i * 12000 + ri(-10000, 10000),
}));

export const evolucaoVendas = Array.from({ length: 30 }, (_, i) => ({
  data: format(subDays(new Date(), 29 - i), "dd/MM"),
  vendas: ri(3, 14),
  cancelamentos: ri(0, 6),
}));

export const funilComercial = [
  { etapa: "Visitantes", valor: 1240 },
  { etapa: "Aulas Experimentais", valor: 487 },
  { etapa: "Propostas", valor: 312 },
  { etapa: "Matrículas", valor: 213 },
];

export const rankingRetencao = [
  { unidade: "Unidade Centro", retencao: 92 },
  { unidade: "Unidade Sul", retencao: 88 },
  { unidade: "Unidade Norte", retencao: 84 },
  { unidade: "Unidade Oeste", retencao: 79 },
];

const nomes = ["Ana Silva","Bruno Costa","Carla Mendes","Diego Souza","Elena Rocha","Felipe Lima","Gabriela Alves","Henrique Dias","Isabela Pinto","João Martins","Karina Reis","Lucas Almeida","Mariana Castro","Nicolas Gomes","Olivia Ferreira","Pedro Nogueira","Quintino Sá","Rafaela Tavares","Sérgio Borges","Tatiane Vieira"];

export const alunosRisco = nomes.slice(0, 12).map((nome, i) => {
  const dias = ri(7, 28);
  const nivel = dias > 15 ? "alto" : dias > 10 ? "medio" : "baixo";
  return {
    id: i + 1,
    nome,
    ultimoAgendamento: format(subDays(new Date(), dias), "dd/MM/yyyy"),
    diasSemAtividade: dias,
    valorContrato: [99.9, 149.9, 189.9, 249.9, 299.9][ri(0, 4)],
    nivelRisco: nivel as "baixo" | "medio" | "alto",
  };
});

export const faixaEtariaData = [
  { faixa: "18-25", qtd: 412 },
  { faixa: "26-35", qtd: 678 },
  { faixa: "36-45", qtd: 432 },
  { faixa: "46-55", qtd: 218 },
  { faixa: "55+", qtd: 107 },
];

export const sexoData = [
  { sexo: "Masculino", qtd: 921 },
  { sexo: "Feminino", qtd: 874 },
  { sexo: "Outro", qtd: 52 },
];

export const tipoContratoData = [
  { tipo: "Mensal", qtd: 642 },
  { tipo: "Trimestral", qtd: 481 },
  { tipo: "Semestral", qtd: 412 },
  { tipo: "Anual", qtd: 312 },
];

export const permanenciaPerfil = [
  { perfil: "18-25", meses: 8 },
  { perfil: "26-35", meses: 14 },
  { perfil: "36-45", meses: 19 },
  { perfil: "46-55", meses: 22 },
  { perfil: "55+", meses: 26 },
];

export const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const formatNum = (v: number) => v.toLocaleString("pt-BR");

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, digits = 0) => Number(value.toFixed(digits));

const FILTER_FACTORS = {
  unidade: {
    Todas: 1,
    "Unidade Centro": 0.36,
    "Unidade Sul": 0.27,
    "Unidade Norte": 0.21,
    "Unidade Oeste": 0.16,
  },
  tipoContrato: {
    Todos: 1,
    Mensal: 0.35,
    Trimestral: 0.26,
    Semestral: 0.22,
    Anual: 0.17,
  },
  sexo: {
    Todos: 1,
    Masculino: 0.5,
    Feminino: 0.47,
    Outro: 0.03,
  },
  faixaEtaria: {
    Todas: 1,
    "18-25": 0.22,
    "26-35": 0.37,
    "36-45": 0.23,
    "46-55": 0.12,
    "55+": 0.06,
  },
} as const;

function periodConfig(periodo: string) {
  if (periodo.includes("Hoje")) return { days: 1, factor: 1 / 30, label: "Hoje" };
  if (periodo.includes("7")) return { days: 7, factor: 7 / 30, label: "Últimos 7 dias" };
  if (periodo.includes("90")) return { days: 90, factor: 3, label: "Últimos 90 dias" };
  if (periodo.includes("ano")) return { days: 365, factor: 12, label: "Este ano" };
  return { days: 30, factor: 1, label: "Últimos 30 dias" };
}

function filterFactor(filters: Filters) {
  return (
    (FILTER_FACTORS.unidade[filters.unidade as keyof typeof FILTER_FACTORS.unidade] ?? 1) *
    (FILTER_FACTORS.tipoContrato[
      filters.tipoContrato as keyof typeof FILTER_FACTORS.tipoContrato
    ] ?? 1) *
    (FILTER_FACTORS.sexo[filters.sexo as keyof typeof FILTER_FACTORS.sexo] ?? 1) *
    (FILTER_FACTORS.faixaEtaria[
      filters.faixaEtaria as keyof typeof FILTER_FACTORS.faixaEtaria
    ] ?? 1)
  );
}

function scaleRows<T extends Record<string, string | number | null>>(
  rows: T[],
  fields: (keyof T)[],
  factor: number,
) {
  return rows.map((row) => {
    const next = { ...row };
    fields.forEach((field) => {
      const value = next[field];
      if (typeof value === "number") {
        next[field] = Math.max(0, Math.round(value * factor)) as T[keyof T];
      }
    });
    return next;
  });
}

export function getFilteredDashboardData(filters: Filters) {
  const period = periodConfig(filters.periodo);
  const segmentFactor = filterFactor(filters);
  const baseFactor = clamp(segmentFactor, 0.015, 1);
  const eventFactor = clamp(segmentFactor * period.factor, 0.01, 12);
  const trendLength = clamp(period.days, 1, 90);
  const monthlyLength = period.days <= 30 ? 3 : period.days <= 90 ? 6 : 12;

  const filteredOverviewKpis = {
    ...overviewKpis,
    alunosAtivos: Math.max(1, Math.round(overviewKpis.alunosAtivos * baseFactor)),
    ticketMedio: round(overviewKpis.ticketMedio * (1 + (1 - baseFactor) * 0.08), 1),
    cancelamentos30d: {
      qtd: Math.max(0, Math.round(overviewKpis.cancelamentos30d.qtd * eventFactor)),
      valor: round(overviewKpis.cancelamentos30d.valor * eventFactor, 1),
    },
    vendas30d: {
      qtd: Math.max(0, Math.round(overviewKpis.vendas30d.qtd * eventFactor)),
      valor: round(overviewKpis.vendas30d.valor * eventFactor, 1),
    },
    taxaDesativacaoRenovacao: round(
      clamp(overviewKpis.taxaDesativacaoRenovacao * (1 + (1 - baseFactor) * 0.2), 3, 28),
      1,
    ),
    taxaOcupacaoAgenda: round(
      clamp(overviewKpis.taxaOcupacaoAgenda * (0.86 + baseFactor * 0.14), 20, 96),
      1,
    ),
    faturamentoMes: Math.round(overviewKpis.faturamentoMes * eventFactor),
    faturamentoEstimadoProx: Math.round(overviewKpis.faturamentoEstimadoProx * eventFactor),
    ltvMedio: Math.round(overviewKpis.ltvMedio * (1 + (1 - baseFactor) * 0.05)),
    cancelamentosFinanceiros: Math.round(overviewKpis.cancelamentosFinanceiros * eventFactor),
    alunosRisco: Math.max(0, Math.round(overviewKpis.alunosRisco * baseFactor)),
    idadeMedia: Math.round(
      overviewKpis.idadeMedia +
        (filters.faixaEtaria === "18-25"
          ? -8
          : filters.faixaEtaria === "36-45"
            ? 8
            : filters.faixaEtaria === "46-55"
              ? 17
              : filters.faixaEtaria === "55+"
                ? 28
                : 0),
    ),
  };

  const filteredEvolucaoAlunos = evolucaoAlunos.slice(-trendLength).map((row) => ({
    ...row,
    ativos: Math.max(1, Math.round(row.ativos * baseFactor)),
  }));
  const filteredEvolucaoVendas = evolucaoVendas.slice(-trendLength).map((row) => ({
    ...row,
    vendas: Math.max(0, Math.round(row.vendas * eventFactor)),
    cancelamentos: Math.max(0, Math.round(row.cancelamentos * eventFactor)),
  }));
  const filteredAlunosRisco = alunosRisco
    .slice(0, Math.max(1, Math.ceil(alunosRisco.length * baseFactor)))
    .map((aluno) => ({
      ...aluno,
      valorContrato: round(aluno.valorContrato * (1 + (1 - baseFactor) * 0.06), 1),
    }));

  return {
    periodLabel: period.label,
    overviewKpis: filteredOverviewKpis,
    evolucaoAlunos: filteredEvolucaoAlunos,
    ocupacaoAgenda: scaleRows(ocupacaoAgenda, ["ocupacao"], 0.86 + baseFactor * 0.14),
    taxaRenovacao: scaleRows(taxaRenovacao.slice(-monthlyLength), ["taxa"], 0.9 + baseFactor * 0.1),
    faturamentoMensal: scaleRows(
      faturamentoMensal.slice(-monthlyLength),
      ["faturamento", "cancelamentos"],
      eventFactor,
    ),
    receitaPorPlano: scaleRows(receitaPorPlano, ["valor"], eventFactor),
    projecaoFaturamento: scaleRows(projecaoFaturamento, ["real", "projecao"], eventFactor),
    evolucaoVendas: filteredEvolucaoVendas,
    funilComercial: scaleRows(funilComercial, ["valor"], eventFactor),
    rankingRetencao:
      filters.unidade === "Todas"
        ? scaleRows(rankingRetencao, ["retencao"], 0.92 + baseFactor * 0.08)
        : scaleRows(
            rankingRetencao.filter((row) => row.unidade === filters.unidade),
            ["retencao"],
            0.92 + baseFactor * 0.08,
          ),
    alunosRisco: filteredAlunosRisco,
    faixaEtariaData:
      filters.faixaEtaria === "Todas"
        ? scaleRows(faixaEtariaData, ["qtd"], baseFactor)
        : scaleRows(
            faixaEtariaData.filter((row) => row.faixa === filters.faixaEtaria),
            ["qtd"],
            baseFactor,
          ),
    sexoData:
      filters.sexo === "Todos"
        ? scaleRows(sexoData, ["qtd"], baseFactor)
        : scaleRows(
            sexoData.filter((row) => row.sexo === filters.sexo),
            ["qtd"],
            baseFactor,
          ),
    tipoContratoData:
      filters.tipoContrato === "Todos"
        ? scaleRows(tipoContratoData, ["qtd"], baseFactor)
        : scaleRows(
            tipoContratoData.filter((row) => row.tipo === filters.tipoContrato),
            ["qtd"],
            baseFactor,
          ),
    permanenciaPerfil:
      filters.faixaEtaria === "Todas"
        ? permanenciaPerfil
        : permanenciaPerfil.filter((row) => row.perfil === filters.faixaEtaria),
  };
}
