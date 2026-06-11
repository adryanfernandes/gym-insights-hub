import { type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export function KpiCard({
  label,
  value,
  hint,
  delta,
  icon,
  accent = "primary",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  delta?: number;
  icon?: ReactNode;
  accent?: "primary" | "success" | "warning" | "destructive";
}) {
  const accentBg = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  }[accent];

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {icon && (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accentBg}`}>
            {icon}
          </div>
        )}
      </div>
      {typeof delta === "number" && (
        <div className="mt-3 flex items-center gap-1 text-xs font-medium">
          {delta >= 0 ? (
            <span className="inline-flex items-center gap-1 text-success">
              <ArrowUpRight className="h-3.5 w-3.5" />
              {Math.abs(delta).toFixed(1)}%
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-destructive">
              <ArrowDownRight className="h-3.5 w-3.5" />
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
          <span className="text-muted-foreground">vs período anterior</span>
        </div>
      )}
    </div>
  );
}

export function ChartCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <div className="h-[280px] w-full">{children}</div>
    </div>
  );
}
