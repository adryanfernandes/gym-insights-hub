import { addMonths, format, startOfMonth, startOfYear, subDays } from "date-fns";
import type { Filters } from "@/contexts/AppContext";

export type MembershipRow = {
  id_member_membership: number;
  id_member: number;
  id_branch: number | null;
  sale_value: number | string;
  membership_name: string | null;
  membership_start: string | null;
  membership_end: string | null;
  cancel_date: string | null;
  cancellation_fine: number | string;
  remaining_value: number | string;
  sale_date: string | null;
  status: number | null;
};

export type ReceivableRow = {
  id_receivable: number;
  id_member_membership: number;
  amount: number | string;
  amount_paid: number | string;
  canceled: boolean;
  registration_date: string | null;
  due_date: string | null;
  receiving_date: string | null;
  payment_type_name: string | null;
};

function num(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function date(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function periodStart(period: string, now: Date) {
  const normalized = period
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (normalized.includes("hoje"))
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (normalized.includes("7 dias")) return subDays(now, 6);
  if (normalized.includes("90 dias")) return subDays(now, 89);
  if (normalized.includes("ano")) return startOfYear(now);
  return subDays(now, 29);
}

function monthKey(value: Date) {
  return format(value, "yyyy-MM");
}

function label(key: string) {
  return format(new Date(`${key}-01T12:00:00`), "MMM/yy");
}

function activeInterval(row: MembershipRow) {
  const start = date(row.membership_start || row.sale_date);
  const possibleEnds = [date(row.cancel_date), date(row.membership_end)].filter(
    (value): value is Date => Boolean(value),
  );
  const end = possibleEnds.length
    ? new Date(Math.min(...possibleEnds.map((value) => value.getTime())))
    : null;

  return { start, end };
}

function activeMemberIds(rows: MembershipRow[], reference: Date) {
  const referenceStart = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate(),
  );
  const referenceEnd = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate(),
    23,
    59,
    59,
    999,
  );
  const result = new Set<number>();

  rows.forEach((row) => {
    const { start, end } = activeInterval(row);
    if (start && start <= referenceEnd && (!end || end >= referenceStart)) {
      result.add(row.id_member);
    }
  });

  return result;
}

export function getMembershipDashboardData(
  memberships: MembershipRow[],
  receivables: ReceivableRow[],
  filters: Filters,
) {
  const now = new Date();
  const start = periodStart(filters.periodo, now);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const branch = filters.unidade.match(/^\d+$/) ? Number(filters.unidade) : null;
  const scoped = branch ? memberships.filter((row) => row.id_branch === branch) : memberships;
  const byId = new Map(scoped.map((row) => [row.id_member_membership, row]));
  const scopedReceivables = receivables.filter((row) => byId.has(row.id_member_membership));
  const sales = scoped.filter((row) => {
    const value = date(row.sale_date);
    return value && value >= start && value <= end;
  });
  const cancellations = scoped.filter((row) => {
    const value = date(row.cancel_date);
    return value && value >= start && value <= end;
  });
  const totalSales = sales.reduce((sum, row) => sum + num(row.sale_value), 0);
  const currentMonth = monthKey(now);
  const paidCurrentMonth = scopedReceivables.reduce((sum, row) => {
    const reference = date(row.receiving_date || row.registration_date);
    return !row.canceled && reference && monthKey(reference) === currentMonth
      ? sum + num(row.amount_paid)
      : sum;
  }, 0);
  const nextMonth = monthKey(addMonths(now, 1));
  const nextMonthReceivables = scopedReceivables.reduce((sum, row) => {
    const due = date(row.due_date);
    return !row.canceled && due && monthKey(due) === nextMonth
      ? sum + Math.max(num(row.amount) - num(row.amount_paid), 0)
      : sum;
  }, 0);
  const memberTotals = new Map<number, number>();
  scoped.forEach((row) =>
    memberTotals.set(row.id_member, (memberTotals.get(row.id_member) ?? 0) + num(row.sale_value)),
  );
  const ltv =
    Array.from(memberTotals.values()).reduce((sum, value) => sum + value, 0) /
    Math.max(memberTotals.size, 1);

  const last12 = Array.from({ length: 12 }, (_, index) =>
    monthKey(addMonths(startOfMonth(now), index - 11)),
  );
  const faturamentoMensal = last12.map((key) => ({
    mes: label(key),
    faturamento: Math.round(
      scoped
        .filter((row) => {
          const value = date(row.sale_date);
          return value && monthKey(value) === key;
        })
        .reduce((sum, row) => sum + num(row.sale_value), 0),
    ),
    cancelamentos: Math.round(
      scoped
        .filter((row) => {
          const value = date(row.cancel_date);
          return value && monthKey(value) === key;
        })
        .reduce((sum, row) => sum + num(row.remaining_value) + num(row.cancellation_fine), 0),
    ),
  }));

  const plans = new Map<string, number>();
  sales.forEach((row) => {
    const key = row.membership_name?.trim() || "Não informado";
    plans.set(key, (plans.get(key) ?? 0) + num(row.sale_value));
  });
  const receitaPorPlano = Array.from(plans, ([plano, valor]) => ({
    plano,
    valor: Math.round(valor),
  }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 10);

  const days = Math.min(
    90,
    Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1),
  );
  const evolucaoVendas = Array.from({ length: days }, (_, index) => {
    const current = subDays(end, days - 1 - index);
    const key = format(current, "yyyy-MM-dd");
    return {
      data: format(current, "dd/MM"),
      vendas: scoped.filter((row) => {
        const value = date(row.sale_date);
        return value && format(value, "yyyy-MM-dd") === key;
      }).length,
      cancelamentos: scoped.filter((row) => {
        const value = date(row.cancel_date);
        return value && format(value, "yyyy-MM-dd") === key;
      }).length,
    };
  });

  const evolucaoAlunos = Array.from({ length: days }, (_, index) => {
    const current = subDays(end, days - 1 - index);
    return {
      data: format(current, "dd/MM"),
      ativos: activeMemberIds(scoped, current).size,
    };
  });
  const allMemberIds = new Set(scoped.map((row) => row.id_member));
  const currentActiveMemberIds = activeMemberIds(scoped, end);

  const projectionMonths = Array.from({ length: 6 }, (_, index) => monthKey(addMonths(now, index)));
  const projecaoFaturamento = projectionMonths.map((key, index) => ({
    mes: label(key),
    real: index === 0 ? Math.round(paidCurrentMonth) : null,
    projecao: Math.round(
      scopedReceivables.reduce((sum, row) => {
        const due = date(row.due_date);
        return !row.canceled && due && monthKey(due) === key
          ? sum + Math.max(num(row.amount) - num(row.amount_paid), 0)
          : sum;
      }, 0),
    ),
  }));

  return {
    kpis: {
      alunosAtivos: currentActiveMemberIds.size,
      alunosNaoAtivos: Math.max(allMemberIds.size - currentActiveMemberIds.size, 0),
      ticketMedio: totalSales / Math.max(sales.length, 1),
      vendas30d: { qtd: sales.length, valor: totalSales },
      cancelamentos30d: {
        qtd: cancellations.length,
        valor: cancellations.reduce((sum, row) => sum + num(row.sale_value), 0),
      },
      taxaDesativacaoRenovacao: (cancellations.length / Math.max(sales.length, 1)) * 100,
      faturamentoMes: paidCurrentMonth,
      faturamentoEstimadoProx: nextMonthReceivables,
      ltvMedio: ltv,
      cancelamentosFinanceiros: cancellations.reduce(
        (sum, row) => sum + num(row.remaining_value) + num(row.cancellation_fine),
        0,
      ),
    },
    faturamentoMensal,
    receitaPorPlano,
    projecaoFaturamento,
    evolucaoVendas,
    evolucaoAlunos,
  };
}
