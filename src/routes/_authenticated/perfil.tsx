import { createFileRoute } from "@tanstack/react-router";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Cake, Users, FileText } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { KpiCard, ChartCard } from "@/components/KpiCard";
import { useApp } from "@/contexts/AppContext";
import { formatNum } from "@/lib/mockData";
import { useDashboardData } from "@/lib/membersDashboardData";
import { exportToPdf, exportToExcel } from "@/lib/exporters";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil dos Clientes - be.move BI" },
      { name: "description", content: "Visao demografica dos alunos." },
    ],
  }),
  component: PerfilPage,
});

const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--foreground)",
};

const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function PerfilPage() {
  const { filters } = useApp();
  const { data } = useDashboardData(filters);
  const k = data.overviewKpis;
  const totalSexo = data.sexoData.reduce((s, d) => s + d.qtd, 0);
  const masc = data.sexoData.find((s) => s.sexo === "Masculino")?.qtd ?? 0;
  const fem = data.sexoData.find((s) => s.sexo === "Feminino")?.qtd ?? 0;
  const mascPct = totalSexo ? (masc / totalSexo) * 100 : 0;
  const femPct = totalSexo ? (fem / totalSexo) * 100 : 0;
  const contratoDominante = data.tipoContratoData
    .slice()
    .sort((a, b) => b.qtd - a.qtd)[0];
  const contratoTotal = data.tipoContratoData.reduce((s, d) => s + d.qtd, 0);
  const contratoPct =
    contratoDominante && contratoTotal
      ? Math.round((contratoDominante.qtd / contratoTotal) * 100)
      : 0;

  const onExportExcel = () =>
    exportToExcel("perfil-clientes", {
      KPIs: [
        { metrica: "Idade media", valor: k.idadeMedia },
        { metrica: "% Masculino", valor: mascPct.toFixed(1) },
        { metrica: "% Feminino", valor: femPct.toFixed(1) },
      ],
      FaixaEtaria: data.faixaEtariaData,
      Sexo: data.sexoData,
      TipoContrato: data.tipoContratoData,
      Permanencia: data.permanenciaPerfil,
    });

  const onExportPdf = () =>
    exportToPdf("Perfil dos Clientes", [
      { Metrica: "Idade media", Valor: `${k.idadeMedia} anos` },
      { Metrica: "Masculino", Valor: `${formatNum(masc)} (${mascPct.toFixed(1)}%)` },
      { Metrica: "Feminino", Valor: `${formatNum(fem)} (${femPct.toFixed(1)}%)` },
    ]);

  return (
    <DashboardLayout
      title="Perfil dos Clientes"
      subtitle="Visao demografica e contratual"
      onExportPdf={onExportPdf}
      onExportExcel={onExportExcel}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Idade media"
          value={`${k.idadeMedia} anos`}
          icon={<Cake className="h-5 w-5" />}
        />
        <KpiCard
          label="Distribuicao por sexo"
          value={`${mascPct.toFixed(0)}% M / ${femPct.toFixed(0)}% F`}
          hint={`${formatNum(totalSexo)} alunos analisados`}
          icon={<Users className="h-5 w-5" />}
          accent="success"
        />
        <KpiCard
          label="Tipo de contrato dominante"
          value={`${contratoDominante?.tipo ?? "-"} (${contratoPct}%)`}
          hint={`${formatNum(contratoDominante?.qtd ?? 0)} alunos no recorte`}
          icon={<FileText className="h-5 w-5" />}
          accent="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Distribuicao por faixa etaria" description="Total da base ativa">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.faixaEtariaData}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="faixa" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="qtd" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribuicao por sexo">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.sexoData}
                dataKey="qtd"
                nameKey="sexo"
                innerRadius={55}
                outerRadius={95}
                paddingAngle={3}
              >
                {data.sexoData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Tipo de contrato" description="Alunos por modalidade">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.tipoContratoData} layout="vertical">
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="tipo"
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                width={90}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="qtd" fill="var(--chart-3)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Tempo medio de permanencia por perfil"
          description="Em meses, por faixa etaria"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.permanenciaPerfil}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="perfil" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} unit="m" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="meses" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </DashboardLayout>
  );
}
