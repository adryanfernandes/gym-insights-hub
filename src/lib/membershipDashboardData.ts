import {
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  startOfMonth,
  startOfYear,
  subDays,
} from "date-fns";
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

function monthlyRenewals(rows: MembershipRow[], monthKeys: string[]) {
  const byMember = new Map<number, MembershipRow[]>();
  rows.forEach((row) => {
    const group = byMember.get(row.id_member) ?? [];
    group.push(row);
    byMember.set(row.id_member, group);
  });

  const totals = new Map(monthKeys.map((key) => [key, 0]));
  const expirationEvents = new Set<string>();
  byMember.forEach((memberRows, memberId) => {
    const periodsByStart = new Map<string, { start: Date; end: Date | null; performedAt: Date }>();

    memberRows.forEach((row) => {
      const start = date(row.membership_start || row.sale_date);
      if (!start) return;
      const key = format(start, "yyyy-MM-dd");
      const end = date(row.membership_end);
      const performedAt = date(row.sale_date) ?? start;
      const current = periodsByStart.get(key);
      periodsByStart.set(key, {
        start,
        end: end && (!current?.end || end > current.end) ? end : (current?.end ?? null),
        performedAt:
          current && current.performedAt < performedAt ? current.performedAt : performedAt,
      });
    });

    const periods = Array.from(periodsByStart.values()).sort(
      (a, b) => a.start.getTime() - b.start.getTime(),
    );
    periods.forEach((period) => {
      if (period.end) {
        expirationEvents.add(`${memberId}:${format(period.end, "yyyy-MM-dd")}`);
      }
    });
    let previousEnd = periods[0]?.end ?? null;

    periods.slice(1).forEach((period) => {
      const gap = previousEnd
        ? differenceInCalendarDays(period.start, previousEnd)
        : Number.POSITIVE_INFINITY;
      if (gap >= -30 && gap <= 30) {
        const key = monthKey(period.performedAt);
        if (totals.has(key)) totals.set(key, (totals.get(key) ?? 0) + 1);
      }
      previousEnd = period.end;
    });
  });

  const expirations = new Map(monthKeys.map((key) => [key, 0]));
  expirationEvents.forEach((event) => {
    const key = event.split(":")[1]?.slice(0, 7) ?? "";
    if (expirations.has(key)) expirations.set(key, (expirations.get(key) ?? 0) + 1);
  });

  return monthKeys.map((key) => ({
    mes: label(key),
    renovacoes: totals.get(key) ?? 0,
    vencimentos: expirations.get(key) ?? 0,
  }));
}

export function getMembershipDashboardData(
  memberships: MembershipRow[],
  receivables: ReceivableRow[],
  filters: Filters,
  activeMemberIds?: Set<number>,
  filteredMemberIds?: Set<number>,
) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = periodStart(filters.periodo, now);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const branch = filters.unidade.match(/^\d+$/) ? Number(filters.unidade) : null;
  const memberScoped = filteredMemberIds
    ? memberships.filter((row) => filteredMemberIds.has(row.id_member))
    : branch
      ? memberships.filter((row) => row.id_branch === branch)
      : memberships;
  const scoped = memberScoped.filter(
    (row) => filters.tipoContrato === "Todos" || row.membership_name === filters.tipoContrato,
  );
  const byId = new Map(scoped.map((row) => [row.id_member_membership, row]));
  const scopedReceivables = receivables.filter((row) => byId.has(row.id_member_membership));
  const contractMembers = new Map<string, Set<number>>();
  scoped.forEach((row) => {
    if (activeMemberIds && !activeMemberIds.has(row.id_member)) return;
    const contractStart = date(row.membership_start || row.sale_date);
    const contractEnd = date(row.membership_end);
    if ((contractStart && contractStart > end) || (contractEnd && contractEnd < todayStart)) {
      return;
    }
    const name = row.membership_name?.trim() || "Não informado";
    const memberIds = contractMembers.get(name) ?? new Set<number>();
    memberIds.add(row.id_member);
    contractMembers.set(name, memberIds);
  });
  const tipoContratoData = Array.from(contractMembers, ([tipo, memberIds]) => ({
    tipo,
    qtd: memberIds.size,
  }))
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 12);
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
  const renovacoesMensais = monthlyRenewals(scoped, last12);
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

  const projectionDates = Array.from({ length: 6 }, (_, index) =>
    addMonths(startOfMonth(now), index),
  );
  const projecaoFaturamento = projectionDates.map((projectionDate, index) => {
    const key = monthKey(projectionDate);
    const monthStart = startOfMonth(projectionDate);
    const monthEnd = endOfMonth(projectionDate);
    let contratosAtivos = 0;
    let contratosCancelados = 0;

    scopedReceivables.forEach((row) => {
      const due = date(row.due_date);
      if (!due || monthKey(due) !== key) return;
      const contract = byId.get(row.id_member_membership);
      if (!contract) return;
      const contractStart = date(contract.membership_start || contract.sale_date);
      const contractEnd = date(contract.membership_end);
      const canceledAt = date(contract.cancel_date);
      const outstanding = Math.max(num(row.amount) - num(row.amount_paid), 0);
      const canceled = row.canceled || Boolean(canceledAt && canceledAt <= monthEnd);
      const activeInMonth =
        (!contractStart || contractStart <= monthEnd) &&
        (!contractEnd || contractEnd >= monthStart) &&
        !canceled;

      if (canceled) contratosCancelados += outstanding;
      else if (activeInMonth) contratosAtivos += outstanding;
    });

    return {
      mes: label(key),
      real: index === 0 ? Math.round(paidCurrentMonth) : null,
      contratosAtivos: Math.round(contratosAtivos),
      contratosCancelados: Math.round(contratosCancelados),
    };
  });
  const nextMonthProjection = projecaoFaturamento[1]?.contratosAtivos ?? 0;

  return {
    kpis: {
      ticketMedio: totalSales / Math.max(sales.length, 1),
      vendas30d: { qtd: sales.length, valor: totalSales },
      cancelamentos30d: {
        qtd: cancellations.length,
        valor: cancellations.reduce((sum, row) => sum + num(row.sale_value), 0),
      },
      taxaDesativacaoRenovacao: (cancellations.length / Math.max(sales.length, 1)) * 100,
      faturamentoMes: paidCurrentMonth,
      faturamentoEstimadoProx: nextMonthProjection,
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
    renovacoesMensais,
    tipoContratoData,
    vendasLista: sales
      .slice()
      .sort((a, b) => (date(b.sale_date)?.getTime() ?? 0) - (date(a.sale_date)?.getTime() ?? 0))
      .map((row) => ({
        idVenda: row.id_sale ?? row.id_member_membership,
        idAluno: row.id_member,
        contrato: row.membership_name?.trim() || "Não informado",
        dataVenda: row.sale_date,
        inicio: row.membership_start,
        vencimento: row.membership_end,
        valor: num(row.sale_value),
      })),
    cancelamentosLista: cancellations
      .slice()
      .sort((a, b) => (date(b.cancel_date)?.getTime() ?? 0) - (date(a.cancel_date)?.getTime() ?? 0))
      .map((row) => ({
        idContrato: row.id_member_membership,
        idAluno: row.id_member,
        contrato: row.membership_name?.trim() || "Não informado",
        dataCancelamento: row.cancel_date,
        motivo: row.cancellation_reason?.trim() || "Não informado",
        valorVenda: num(row.sale_value),
        multa: num(row.cancellation_fine),
        valorRestante: num(row.remaining_value),
      })),
  };
}
