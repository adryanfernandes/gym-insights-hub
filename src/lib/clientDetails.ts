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
  if (Number(contract.status) === 1) return "Ativo";
  if (contract.cancel_date) return "Cancelado";
  const end = contract.membership_end ? new Date(contract.membership_end) : null;
  if (end && !Number.isNaN(end.getTime()) && end < new Date()) return "Vencido";
  if (contract.status !== null && contract.status !== undefined) return `Status ${contract.status}`;
  return "Ativo";
}

function isActiveContract(contract: MembershipRow) {
  if (Number(contract.status) === 1) return true;
  if (contract.cancel_date) return false;
  const end = contract.membership_end ? new Date(contract.membership_end) : null;
  return !end || Number.isNaN(end.getTime()) || end >= new Date();
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
