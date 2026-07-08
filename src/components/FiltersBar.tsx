import { useApp, type Filters } from "@/contexts/AppContext";
import { useDashboardData } from "@/lib/membersDashboardData";

const PERIODOS = ["Hoje", "Últimos 7 dias", "Últimos 30 dias", "Últimos 90 dias", "Este ano"];

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-input bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FiltersBar({ extra }: { extra?: React.ReactNode }) {
  const { filters, setFilters } = useApp();
  const { filterOptions } = useDashboardData(filters);
  const upd = (k: keyof Filters) => (v: string) => setFilters({ [k]: v });
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card/50 p-3 backdrop-blur">
      <Select label="Período" value={filters.periodo} options={PERIODOS} onChange={upd("periodo")} />
      <Select label="Bairro" value={filters.unidade} options={filterOptions.unidades} onChange={upd("unidade")} />
      <Select
        label="Contrato"
        value={filters.tipoContrato}
        options={filterOptions.tiposContrato}
        onChange={upd("tipoContrato")}
      />
      <Select label="Sexo" value={filters.sexo} options={filterOptions.sexos} onChange={upd("sexo")} />
      <Select
        label="Faixa etária"
        value={filters.faixaEtaria}
        options={filterOptions.faixasEtarias}
        onChange={upd("faixaEtaria")}
      />
      {extra}
    </div>
  );
}
