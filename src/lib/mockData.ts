// Mock data generator for gym BI dashboard
import { subDays, format } from "date-fns";

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
