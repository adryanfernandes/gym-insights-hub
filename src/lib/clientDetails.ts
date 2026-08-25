import type { ClientRow } from "@/lib/mockData";
import type { MembershipRow, ReceivableRow } from "@/lib/membershipDashboardData";

export type ClientContractDetail = {
  idContrato: number;
  contrato: string;
  inicio: string;
  vencimento: string;
  status: string;
  valorVenda: number;
  valorPago: number;
  desconto: number;
  valorAPagar: number;
  parcelas: number;
  cancelamento: string;
  renovacaoAtiva: string;
};

export type ClientSyncUpdate = {
  origem: string;
  registros: number;
  primeiroRegistro: string;
  ultimaAtualizacao: string;
  atualizadoHa: string;
  status: "Atualizado" | "Atenção" | "Antigo" | "Sem data";
};

export function toDateLabel(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("pt-BR");
}

export function toDateTimeLabel(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function toCurrencyNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function endOfDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 23, 59, 59, 999);
}

function effectiveCancelDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function isCancellationEffective(contract: MembershipRow, referenceDate = new Date()) {
  const cancel = effectiveCancelDate(contract.cancel_date);
  if (cancel) return cancel < referenceDate;
  return isMembershipStatusExplicitlyCancelled(contract.status);
}

function isMembershipStatusExplicitlyCancelled(status: MembershipRow["status"]) {
  const normalized = String(status ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return Number(status) === 2 || normalized.includes("cancel");
}

export function normalizeClientStatus(client: ClientRow) {
  return client.ativo ? "Ativo" : "Inativo";
}

export function contractStatus(contract: MembershipRow) {
  const cancel = effectiveCancelDate(contract.cancel_date);
  if (cancel && cancel > new Date()) return "Cancelamento agendado";
  if (isCancellationEffective(contract)) return "Cancelado";
  const end = endOfDate(contract.membership_end);
  if (end && end < new Date()) return "Vencido";
  if (end && end >= new Date()) return "Ativo";
  if (contract.status !== null && contract.status !== undefined) return `Status ${contract.status}`;
  return "Ativo";
}

function isActiveContract(contract: MembershipRow) {
  if (isCancellationEffective(contract)) return false;
  const end = endOfDate(contract.membership_end);
  const isCurrentByPeriod = Boolean(end && end >= new Date());
  return isCurrentByPeriod;
}

function dateSortValue(label: string) {
  if (label === "-") return 0;
  const [day, month, year] = label.split("/").map(Number);
  return Number.isFinite(day) && Number.isFinite(month) && Number.isFinite(year)
    ? new Date(year, month - 1, day).getTime()
    : 0;
}

export function contractsForClient(
  clientId: number,
  memberships: MembershipRow[],
  receivables: ReceivableRow[],
) {
  const paymentsByContract = new Map<number, { paid: number; count: number }>();
  const receivablesByContract = new Map<
    number,
    { charged: number; open: number; count: number }
  >();

  receivables.forEach((receivable) => {
    const current = paymentsByContract.get(receivable.id_member_membership) ?? {
      paid: 0,
      count: 0,
    };
    current.paid += toCurrencyNumber(receivable.amount_paid);
    current.count += 1;
    paymentsByContract.set(receivable.id_member_membership, current);

    const financial = receivablesByContract.get(receivable.id_member_membership) ?? {
      charged: 0,
      open: 0,
      count: 0,
    };
    const amount = toCurrencyNumber(receivable.amount);
    const paid = toCurrencyNumber(receivable.amount_paid);
    financial.charged += receivable.canceled ? 0 : amount;
    financial.open += receivable.canceled ? 0 : Math.max(0, amount - paid);
    financial.count += 1;
    receivablesByContract.set(receivable.id_member_membership, financial);
  });

  const clientContracts = memberships.filter((contract) => contract.id_member === clientId);
  const hasActiveRenewal = clientContracts.some(isActiveContract) && clientContracts.length > 1;

  return clientContracts
    .map<ClientContractDetail>((contract) => {
      const payment = paymentsByContract.get(contract.id_member_membership);
      const financial = receivablesByContract.get(contract.id_member_membership);
      const saleValue = toCurrencyNumber(contract.sale_value);
      const chargedValue = financial?.charged ?? saleValue;

      return {
        idContrato: contract.id_member_membership,
        contrato: contract.membership_name?.trim() || "Contrato não informado",
        inicio: toDateLabel(contract.membership_start || contract.sale_date),
        vencimento: toDateLabel(contract.membership_end),
        status: contractStatus(contract),
        valorVenda: saleValue,
        valorPago: payment?.paid ?? 0,
        desconto: Math.max(0, saleValue - chargedValue),
        valorAPagar:
          financial && financial.count > 0
            ? financial.open
            : Math.max(0, toCurrencyNumber(contract.remaining_value)),
        parcelas: payment?.count ?? 0,
        cancelamento: toDateLabel(contract.cancel_date),
        renovacaoAtiva: hasActiveRenewal && isActiveContract(contract) ? "Sim" : "Não",
      };
    })
    .sort((a, b) => dateSortValue(b.inicio) - dateSortValue(a.inicio));
}

function parseSyncDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function syncFreshness(lastSync: Date | null): ClientSyncUpdate["status"] {
  if (!lastSync) return "Sem data";
  const diffMs = Date.now() - lastSync.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays <= 2) return "Atualizado";
  if (diffDays <= 7) return "Atenção";
  return "Antigo";
}

function elapsedSyncLabel(lastSync: Date | null) {
  if (!lastSync) return "-";
  const diffMs = Math.max(0, Date.now() - lastSync.getTime());
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 60) return diffMinutes <= 1 ? "há 1 minuto" : `há ${diffMinutes} minutos`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return diffHours === 1 ? "há 1 hora" : `há ${diffHours} horas`;
  const diffDays = Math.floor(diffHours / 24);
  return diffDays === 1 ? "há 1 dia" : `há ${diffDays} dias`;
}

function syncUpdateRow(
  origem: string,
  registros: number,
  firstValues: Array<string | null | undefined>,
  lastValues: Array<string | null | undefined>,
): ClientSyncUpdate {
  const firstDates = firstValues.map(parseSyncDate).filter((value): value is Date => Boolean(value));
  const lastDates = lastValues.map(parseSyncDate).filter((value): value is Date => Boolean(value));
  const first = firstDates.length
    ? firstDates.reduce((lowest, value) => (value < lowest ? value : lowest), firstDates[0])
    : null;
  const last = lastDates.length
    ? lastDates.reduce((highest, value) => (value > highest ? value : highest), lastDates[0])
    : null;

  return {
    origem,
    registros,
    primeiroRegistro: toDateTimeLabel(first?.toISOString()),
    ultimaAtualizacao: toDateTimeLabel(last?.toISOString()),
    atualizadoHa: elapsedSyncLabel(last),
    status: syncFreshness(last),
  };
}

export function syncUpdatesForClient(
  client: ClientRow,
  memberships: MembershipRow[],
  receivables: ReceivableRow[],
  sales: Array<{
    id_member?: number | string | null;
    first_synced_at?: string | null;
    last_synced_at?: string | null;
  }>,
) {
  const clientMemberships = memberships.filter((row) => row.id_member === client.id);
  const membershipIds = new Set(clientMemberships.map((row) => row.id_member_membership));
  const clientReceivables = receivables.filter((row) => membershipIds.has(row.id_member_membership));
  const clientSales = sales.filter((row) => Number(row.id_member) === client.id);

  return [
    syncUpdateRow(
      "API de clientes",
      1,
      [client.firstSyncedAt, client.lastSyncedAt],
      [client.lastSyncedAt, client.firstSyncedAt],
    ),
    syncUpdateRow(
      "API de contratos",
      clientMemberships.length,
      clientMemberships.map((row) => row.first_synced_at ?? row.last_synced_at),
      clientMemberships.map((row) => row.last_synced_at ?? row.first_synced_at),
    ),
    syncUpdateRow(
      "Recebíveis dos contratos",
      clientReceivables.length,
      clientReceivables.map((row) => row.last_synced_at),
      clientReceivables.map((row) => row.last_synced_at),
    ),
    syncUpdateRow(
      "API de vendas",
      clientSales.length,
      clientSales.map((row) => row.first_synced_at ?? row.last_synced_at),
      clientSales.map((row) => row.last_synced_at ?? row.first_synced_at),
    ),
  ];
}
