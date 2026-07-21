import { useApp, type Filters } from "@/contexts/AppContext";
import { useDashboardData } from "@/lib/membersDashboardData";
import { useRouterState } from "@tanstack/react-router";

const PERIODOS = ["Hoje", "Últimos 7 dias", "Últimos 30 dias", "Últimos 90 dias", "Este ano"];
const ALL_OPTIONS: Partial<Record<keyof Filters, string>> = {
  unidade: "Todos",
  tipoContrato: "Todos",
  sexo: "Todos",
  faixaEtaria: "Todas",
  statusAluno: "Todos",
};

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

function MultiSelect({
  label,
  value,
  options,
  allOption,
  onChange,
}: {
  label: string;
  value: string[];
  options: string[];
  allOption: string;
  onChange: (value: string[]) => void;
}) {
  const selected = value.length ? value : [allOption];
  const activeOptions = selected.includes(allOption) ? [] : selected;
  const summary = activeOptions.length
    ? activeOptions.length === 1
      ? activeOptions[0]
      : `${activeOptions.length} selecionados`
    : allOption;

  function toggle(option: string) {
    if (option === allOption) {
      onChange([allOption]);
      return;
    }

    const withoutAll = selected.filter((item) => item !== allOption);
    const next = withoutAll.includes(option)
      ? withoutAll.filter((item) => item !== option)
      : [...withoutAll, option];
    onChange(next.length ? next : [allOption]);
  }

  return (
    <div className="relative flex min-w-40 flex-col gap-1">
      <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <details className="group">
        <summary className="flex h-9 cursor-pointer list-none items-center justify-between gap-2 rounded-md border border-input bg-card px-2 text-sm text-foreground transition hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring">
          <span className="truncate">{summary}</span>
          <span className="text-[10px] text-muted-foreground">▼</span>
        </summary>
        <div className="absolute z-50 mt-1 max-h-72 min-w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg">
          {options.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-popover-foreground hover:bg-accent"
            >
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => toggle(option)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              <span className="whitespace-nowrap">{option}</span>
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}

export function FiltersBar({ extra }: { extra?: React.ReactNode }) {
  const { filters, setFilters } = useApp();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { filterOptions } = useDashboardData(filters);
  const updMulti =
    (k: "unidade" | "tipoContrato" | "sexo" | "faixaEtaria" | "statusAluno") => (value: string[]) =>
      setFilters({ [k]: value });
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card/50 p-3 backdrop-blur">
      <Select
        label="Período"
        value={filters.periodo}
        options={PERIODOS}
        onChange={(periodo) => setFilters({ periodo })}
      />
      <MultiSelect
        label="Bairro"
        value={filters.unidade}
        options={filterOptions.unidades}
        allOption={ALL_OPTIONS.unidade ?? "Todos"}
        onChange={updMulti("unidade")}
      />
      <MultiSelect
        label="Contrato"
        value={filters.tipoContrato}
        options={filterOptions.tiposContrato}
        allOption={ALL_OPTIONS.tipoContrato ?? "Todos"}
        onChange={updMulti("tipoContrato")}
      />
      <MultiSelect
        label="Sexo"
        value={filters.sexo}
        options={filterOptions.sexos}
        allOption={ALL_OPTIONS.sexo ?? "Todos"}
        onChange={updMulti("sexo")}
      />
      <MultiSelect
        label="Faixa etária"
        value={filters.faixaEtaria}
        options={filterOptions.faixasEtarias}
        allOption={ALL_OPTIONS.faixaEtaria ?? "Todas"}
        onChange={updMulti("faixaEtaria")}
      />
      {pathname === "/perfil" && (
        <MultiSelect
          label="Status do aluno"
          value={filters.statusAluno}
          options={["Todos", "Ativos", "Inativos"]}
          allOption={ALL_OPTIONS.statusAluno ?? "Todos"}
          onChange={updMulti("statusAluno")}
        />
      )}
      {extra}
    </div>
  );
}
