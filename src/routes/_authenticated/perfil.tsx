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
import {
  overviewKpis,
  faixaEtariaData,
  sexoData,
  tipoContratoData,
  permanenciaPerfil,
  formatNum,
} from "@/lib/mockData";
import { exportToPdf, exportToExcel } from "@/lib/exporters";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil dos Clientes — GymPulse BI" },
      { name: "description", content: "Visão demográfica dos alunos." },
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

const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function PerfilPage() {
  const k = overviewKpis;
  const totalSexo = sexoData.reduce((s, d) => s + d.qtd, 0);
  const masc = sexoData.find((s) => s.sexo === "Masculino")!.qtd;
  const fem = sexoData.find((s) => s.sexo === "Feminino")!.qtd;

  const onExportExcel = () =>
    exportToExcel("perfil-clientes", {
      KPIs: [
        { metrica: "Idade média", valor: k.idadeMedia },
        { metrica: "% Masculino", valor: ((masc / totalSexo) * 100).toFixed(1) },
        { metrica: "% Feminino", valor: ((fem / totalSexo) * 100).toFixed(1) },
      ],
      FaixaEtaria: faixaEtariaData,
      Sexo: sexoData,
      TipoContrato: tipoContratoData,
      Permanencia: permanenciaPerfil,
    });

  const onExportPdf = () =>
    exportToPdf("Perfil dos Clientes", [
      { Métrica: "Idade média", Valor: `${k.idadeMedia} anos` },
      { Métrica: "Masculino", Valor: `${formatNum(masc)} (${((masc / totalSexo) * 100).toFixed(1)}%)` },
      { Métrica: "Feminino", Valor: `${formatNum(fem)} (${((fem / totalSexo) * 100).toFixed(1)}%)` },
    ]);

  return (
    <DashboardLayout
      title="Perfil dos Clientes"
      subtitle="Visão demográfica e contratual"
      onExportPdf={onExportPdf}
      onExportExcel={onExportExcel}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Idade média"
          value={`${k.idadeMedia} anos`}
          icon={<Cake className="h-5 w-5" />}
        />
        <KpiCard
          label="Distribuição por sexo"
          value={`${((masc / totalSexo) * 100).toFixed(0)}% M / ${((fem / totalSexo) * 100).toFixed(0)}% F`}
          hint={`${formatNum(totalSexo)} alunos analisados`}
          icon={<Users className="h-5 w-5" />}
          accent="success"
        />
        <KpiCard
          label="Tipo de contrato dominante"
          value="Mensal (35%)"
          hint="Seguido por trimestral (26%)"
          icon={<FileText className="h-5 w-5" />}
          accent="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Distribuição por faixa etária" description="Total da base ativa">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={faixaEtariaData}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="faixa" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="qtd" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribuição por sexo">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sexoData}
                dataKey="qtd"
                nameKey="sexo"
                innerRadius={55}
                outerRadius={95}
                paddingAngle={3}
              >
                {sexoData.map((_, i) => (
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
            <BarChart data={tipoContratoData} layout="vertical">
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
          title="Tempo médio de permanência por perfil"
          description="Em meses, por faixa etária"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={permanenciaPerfil}>
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
