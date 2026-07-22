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
  parcelas: number;
  cancelamento: string;
};

export function toDateLabel(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("pt-BR");
}

export function toCurrencyNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeClientStatus(client: ClientRow) {
  return client.ativo ? "Ativo" : "Inativo";
}

export function contractStatus(contract: MembershipRow) {
  if (contract.cancel_date) return "Cancelado";
  const end = contract.membership_end ? new Date(contract.membership_end) : null;
  if (end && !Number.isNaN(end.getTime()) && end < new Date()) return "Vencido";
  if (contract.status !== null && contract.status !== undefined) return String(contract.status);
  return "Ativo";
}

export function contractsForClient(
  clientId: number,
  memberships: MembershipRow[],
  receivables: ReceivableRow[],
) {
  const paymentsByContract = new Map<number, { paid: number; count: number }>();
  receivables.forEach((receivable) => {
    const current = paymentsByContract.get(receivable.id_member_membership) ?? {
      paid: 0,
      count: 0,
    };
    current.paid += toCurrencyNumber(receivable.amount_paid);
    current.count += 1;
    paymentsByContract.set(receivable.id_member_membership, current);
  });

  return memberships
    .filter((contract) => contract.id_member === clientId)
    .map<ClientContractDetail>((contract) => {
      const payment = paymentsByContract.get(contract.id_member_membership);
      return {
        idContrato: contract.id_member_membership,
        contrato: contract.membership_name?.trim() || "Contrato não informado",
        inicio: toDateLabel(contract.membership_start || contract.sale_date),
        vencimento: toDateLabel(contract.membership_end),
        status: contractStatus(contract),
        valorVenda: toCurrencyNumber(contract.sale_value),
        valorPago: payment?.paid ?? 0,
        parcelas: payment?.count ?? 0,
        cancelamento: toDateLabel(contract.cancel_date),
      };
    })
    .sort((a, b) => {
      const aDate = a.inicio === "-" ? 0 : Number(a.inicio.split("/").reverse().join(""));
      const bDate = b.inicio === "-" ? 0 : Number(b.inicio.split("/").reverse().join(""));
      return bDate - aDate;
    });
}
