import { differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import {
  createContext,
  createElement,
  useDeferredValue,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Filters } from "@/contexts/AppContext";
import {
  getActivityDashboardDataFromNormalized,
  normalizeActivities,
  type StoredActivity,
} from "@/lib/activityDashboardData";
import {
  getMembershipDashboardData,
  isSingleUseMembership,
  type MembershipRow,
  type ReceivableRow,
} from "@/lib/membershipDashboardData";
import {
  getDashboardFilterOptions,
  getFilteredDashboardDataFromRows,
  type ClientRow,
} from "@/lib/mockData";

type MemberRecord = Record<string, unknown>;
export type SalesRecord = {
  source_key: string;
  id_sale?: number | string | null;
  id_member?: number | string | null;
  id_branch?: number | string | null;
  sale_date?: string | null;
  sale_value?: number | string | null;
  payload?: Record<string, unknown> | null;
};

const NAME_FIELDS = [
  "nome",
  "name",
  "full_name",
  "nome_completo",
  "display_name",
  "member_name",
  "registerName",
];
const GENDER_FIELDS = ["genero", "sexo", "gender", "sex"];
const AGE_FIELDS = ["idade", "age"];
const BIRTH_DATE_FIELDS = ["data_nascimento", "birthDate", "birth_date", "birthday", "nascimento"];
const DISTRICT_FIELDS = ["neighborhood", "bairro", "district", "neighborhood_name", "unidade"];
const CITY_FIELDS = ["cidade", "city"];
const CONTRACT_FIELDS = [
  "contrato",
  "plano",
  "plan",
  "membership",
  "membership_type",
  "tipo_contrato",
];
const START_FIELDS = [
  "registerDate",
  "conversionDate",
  "inicio",
  "data_inicio",
  "data_matricula",
  "created_at",
  "joined_at",
  "start_date",
];
const DUE_FIELDS = ["vencimento", "data_vencimento", "expires_at", "end_date", "membership_end"];
const LAST_FREQUENCY_FIELDS = [
  "lastAccessDate",
  "ultima_frequencia",
  "last_attendance",
  "last_checkin",
  "last_visit",
  "ultimo_acesso",
  "updateDate",
  "updated_at",
];
const VALUE_FIELDS = ["valor", "mensalidade", "monthly_fee", "amount", "price", "valor_contrato"];
const STATUS_FIELDS = [
  "status",
  "membershipStatus",
  "situacao",
  "active",
  "ativo",
  "is_active",
  "membership_status",
];
const ID_FIELDS = ["idMember", "id", "member_id", "codigo", "code", "uuid"];
const IMAGE_FIELDS = [
  "photoUrl",
  "photo_url",
  "foto",
  "fotoUrl",
  "foto_url",
  "image",
  "imageUrl",
  "image_url",
  "avatar",
  "avatarUrl",
  "avatar_url",
  "picture",
  "pictureUrl",
  "picture_url",
  "profileImage",
  "profileImageUrl",
  "profile_image_url",
  "urlPhoto",
  "urlImage",
  "memberPhoto",
  "member_photo",
];

let membersRequest: Promise<MemberRecord[]> | null = null;
let activitiesRequest: Promise<StoredActivity[]> | null = null;
let membershipsRequest: Promise<{
  memberships: MembershipRow[];
  receivables: ReceivableRow[];
}> | null = null;
let salesRequest: Promise<SalesRecord[]> | null = null;

function pick(record: MemberRecord, fields: string[]) {
  for (const field of fields) {
    const value = record[field];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function toStringValue(value: unknown, fallback = "") {
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return fallback;
}

function toImageUrl(value: unknown) {
  const raw = toStringValue(value, "");
  if (!raw) return null;

  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("www.")) return `https://${raw}`;
  if (/^https?:\/\//i.test(raw) || /^data:image\//i.test(raw)) return raw;

  return null;
}

function toNumberValue(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== "string" || !value.trim()) return null;

  const raw = value.trim();
  const iso = parseISO(raw);
  if (!Number.isNaN(iso.getTime())) return iso;

  const brMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    const fullYear = year.length === 2 ? `20${year}` : year;
    const parsed = new Date(Number(fullYear), Number(month) - 1, Number(day));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

function toBRDate(value: unknown) {
  const date = toDate(value);
  return date ? format(date, "dd/MM/yyyy") : null;
}

function normalizeSearchText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }
  if (Array.isArray(value)) return value.map(normalizeSearchText).join(" ");
  if (typeof value === "object") return Object.values(value).map(normalizeSearchText).join(" ");
  return "";
}

function saleText(sale: SalesRecord) {
  return normalizeSearchText({
    id_sale: sale.id_sale,
    id_member: sale.id_member,
    sale_value: sale.sale_value,
    payload: sale.payload,
  });
}

function isExperimentalSale(sale: SalesRecord) {
  const text = saleText(sale);
  return (
    text.includes("aula experimental") ||
    text.includes("experimental") ||
    text.includes("experiment") ||
    text.includes("trial")
  );
}

function isProposalSale(sale: SalesRecord) {
  const text = saleText(sale);
  return (
    text.includes("proposta") ||
    text.includes("orcamento") ||
    text.includes("cotacao") ||
    text.includes("proposal")
  );
}

function isMembershipSale(sale: SalesRecord) {
  const text = saleText(sale);
  return !isExperimentalSale(sale) && !isProposalSale(sale) && !text.includes("avulso");
}

function salesDate(sale: SalesRecord) {
  const payload = sale.payload ?? {};
  return (
    toDate(sale.sale_date) ??
    toDate(payload.saleDate) ??
    toDate(payload.date) ??
    toDate(payload.registerDate) ??
    toDate(payload.registrationDate) ??
    toDate(payload.createdAt)
  );
}

function salesFunnelFromRows(sales: SalesRecord[], filters: Filters, fallbackMatriculas: number) {
  if (!sales.length) return null;
  const range = dashboardDateRange(filters, new Date());
  const scoped = sales.filter((sale) => {
    const saleAt = salesDate(sale);
    return saleAt && saleAt >= range.start && saleAt <= range.end;
  });
  if (!scoped.length) return null;

  const aulasExperimentais = scoped.filter(isExperimentalSale).length;
  const propostas = scoped.filter(isProposalSale).length;
  const matriculas = fallbackMatriculas;
  const visitantes = Math.max(scoped.length, aulasExperimentais + propostas + matriculas);

  return [
    { etapa: "Visitantes", valor: visitantes },
    { etapa: "Aulas Experimentais", valor: aulasExperimentais },
    { etapa: "Propostas", valor: propostas },
    { etapa: "Matriculas", valor: matriculas },
  ];
}

type IndexedContract = {
  contract: MembershipRow;
  start: Date | null;
  end: Date | null;
};

function isContractActiveToday(contract: MembershipRow, today = new Date()) {
  if (isSingleUseMembership(contract)) return false;
  const start = toDate(contract.membership_start || contract.sale_date);
  const end = toDate(contract.membership_end);
  const cancel = toDate(contract.cancel_date);
  const reference = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  return (
    Number(contract.status) === 1 &&
    (!start || start <= reference) &&
    Boolean(end && end >= reference) &&
    (!cancel || cancel > reference)
  );
}

function isSingleUseActiveToday(contract: MembershipRow, today = new Date()) {
  if (!isSingleUseMembership(contract)) return false;
  const start = toDate(contract.membership_start || contract.sale_date);
  const end = toDate(contract.membership_end);
  const cancel = toDate(contract.cancel_date);
  const reference = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  const startsToday =
    start &&
    start.getFullYear() === reference.getFullYear() &&
    start.getMonth() === reference.getMonth() &&
    start.getDate() === reference.getDate();

  return (
    Number(contract.status) === 1 &&
    (!cancel || cancel > reference) &&
    ((Boolean(start && end && start <= reference && end >= reference)) || Boolean(startsToday))
  );
}

function inputFilterDate(value: string | null | undefined, endOfDay = false) {
  if (!value) return null;
  const parsed = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dashboardPeriodStart(period: string, referenceDate: Date) {
  const normalized = period
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (normalized.includes("hoje")) {
    return new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  }
  if (normalized.includes("7")) return subDays(referenceDate, 6);
  if (normalized.includes("90")) return subDays(referenceDate, 89);
  if (normalized.includes("ano")) return new Date(referenceDate.getFullYear(), 0, 1);
  return subDays(referenceDate, 29);
}

function dashboardDateRange(filters: Filters, referenceDate: Date) {
  const fallbackStart = dashboardPeriodStart(filters.periodo, referenceDate);
  const fallbackEnd = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    23,
    59,
    59,
    999,
  );
  const start = inputFilterDate(filters.dataInicio) ?? fallbackStart;
  const end = inputFilterDate(filters.dataFim, true) ?? fallbackEnd;
  return start <= end ? { start, end } : { start: end, end: start };
}

function selectedFilterValues(selected: string[] | string, allOptions: string[]) {
  const list = Array.isArray(selected) ? selected : [selected];
  return list.filter((item) => !allOptions.includes(item));
}

function clientAgeRange(idade: number) {
  if (idade <= 0) return "Nao informada";
  if (idade <= 25) return "18-25";
  if (idade <= 35) return "26-35";
  if (idade <= 45) return "36-45";
  if (idade <= 55) return "46-55";
  return "55+";
}

function matchesFilterList(value: string, selected: string[] | string, allOptions: string[]) {
  const active = selectedFilterValues(selected, allOptions);
  return active.length === 0 || active.includes(value);
}

function isContractActiveAt(contract: MembershipRow, day: Date) {
  if (isSingleUseMembership(contract)) return false;
  const reference = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12);
  const start = toDate(contract.membership_start || contract.sale_date);
  const end = toDate(contract.membership_end);
  const cancel = toDate(contract.cancel_date);
  return (
    Number(contract.status) === 1 &&
    (!start || start <= reference) &&
    Boolean(end && end >= reference) &&
    (!cancel || cancel > reference)
  );
}

function activeStudentsEvolutionFromContracts(
  memberships: MembershipRow[],
  clients: ClientRow[],
  filters: Filters,
) {
  const range = dashboardDateRange(filters, new Date());
  const days = Math.min(
    90,
    Math.max(1, differenceInCalendarDays(range.end, range.start) + 1),
  );
  const eligibleMembers = new Set(
    clients
      .filter(
        (client) =>
          matchesFilterList(client.bairro, filters.unidade, ["Todas", "Todos"]) &&
          matchesFilterList(client.genero, filters.sexo, ["Todos"]) &&
          matchesFilterList(clientAgeRange(client.idade), filters.faixaEtaria, ["Todas"]) &&
          (matchesFilterList("Todos", filters.statusAluno, ["Todos"]) ||
            (client.ativo
              ? matchesFilterList("Ativos", filters.statusAluno, [])
              : matchesFilterList("Inativos", filters.statusAluno, []))),
      )
      .map((client) => client.id),
  );
  const filteredContracts = memberships.filter(
    (contract) =>
      eligibleMembers.has(contract.id_member) &&
      matchesFilterList(contract.membership_name?.trim() || "Nao informado", filters.tipoContrato, [
        "Todos",
      ]),
  );

  return Array.from({ length: days }, (_, index) => {
    const current = subDays(range.end, days - 1 - index);
    const activeMemberIds = new Set<number>();
    filteredContracts.forEach((contract) => {
      if (isContractActiveAt(contract, current)) activeMemberIds.add(contract.id_member);
    });
    return {
      data: format(current, "dd/MM"),
      ativos: activeMemberIds.size,
    };
  });
}

function mostRelevantContract(contracts: MembershipRow[]) {
  const now = new Date();
  const recurringContracts = contracts.filter((contract) => !isSingleUseMembership(contract));
  const active = recurringContracts
    .filter((contract) => isContractActiveToday(contract, now))
    .sort((a, b) => {
      const aEnd = toDate(a.membership_end)?.getTime() ?? 0;
      const bEnd = toDate(b.membership_end)?.getTime() ?? 0;
      return bEnd - aEnd;
    })[0];
  if (active) return active;

  const activeSingleUse = contracts
    .filter((contract) => isSingleUseActiveToday(contract, now))
    .sort((a, b) => {
      const aDate = toDate(a.membership_start || a.sale_date)?.getTime() ?? 0;
      const bDate = toDate(b.membership_start || b.sale_date)?.getTime() ?? 0;
      return bDate - aDate;
    })[0];
  if (activeSingleUse) return activeSingleUse;

  return [...recurringContracts].sort((a, b) => {
    const aDate = toDate(a.membership_start || a.sale_date || a.membership_end)?.getTime() ?? 0;
    const bDate = toDate(b.membership_start || b.sale_date || b.membership_end)?.getTime() ?? 0;
    return bDate - aDate;
  })[0];
}

function contractForMemberAt(
  contractsByMember: Map<number, IndexedContract[]>,
  memberId: number,
  referenceDate: string,
) {
  const activityDate = new Date(`${referenceDate}T12:00:00`);
  const ordered = contractsByMember.get(memberId) ?? [];
  const selected =
    ordered.find(
      (row) =>
        (!row.start || row.start <= activityDate) &&
        (!row.end || row.end >= activityDate) &&
        !row.contract.cancel_date,
    ) ?? ordered[0];
  if (!selected) return null;
  return {
    contrato: selected.contract.membership_name || "Contrato não informado",
    vigencia: `${toBRDate(selected.contract.membership_start || selected.contract.sale_date) ?? "-"} a ${
      toBRDate(selected.contract.membership_end) ?? "-"
    }`,
  };
}

function normalizeGender(value: unknown) {
  const raw = toStringValue(value).toLowerCase();
  if (["m", "masc", "masculino", "male", "homem"].includes(raw)) return "Masculino";
  if (["f", "fem", "feminino", "female", "mulher"].includes(raw)) return "Feminino";
  return raw ? "Outro" : "Outro";
}

function inferAge(record: MemberRecord) {
  const explicitAge = toNumberValue(pick(record, AGE_FIELDS), 0);
  if (explicitAge > 0) return Math.round(explicitAge);

  const birthDate = toDate(pick(record, BIRTH_DATE_FIELDS));
  if (!birthDate) return 0;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hadBirthday =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
  if (!hadBirthday) age -= 1;
  return Math.max(age, 0);
}

function isInactive(record: MemberRecord) {
  const value = pick(record, STATUS_FIELDS);
  if (typeof value === "boolean") return !value;

  const raw = toStringValue(value).toLowerCase();
  return [
    "inactive",
    "inativo",
    "inativa",
    "cancelado",
    "cancelada",
    "canceled",
    "cancelled",
    "expired",
    "vencido",
    "vencida",
    "suspended",
    "suspenso",
  ].includes(raw);
}

function memberToClient(member: MemberRecord, index: number): ClientRow {
  const today = new Date();
  const startDate = toDate(pick(member, START_FIELDS));
  const dueDate = toDate(pick(member, DUE_FIELDS));
  const inactive = isInactive(member);
  const inferredDue = dueDate ?? (inactive ? subDays(today, 1) : null);
  const value = toNumberValue(pick(member, VALUE_FIELDS), 0);
  const contrato = toStringValue(pick(member, CONTRACT_FIELDS), "Nao informado");
  const rawId = toNumberValue(pick(member, ID_FIELDS), index + 1);
  const firstName = toStringValue(member.firstName ?? member.registerName);
  const lastName = toStringValue(member.lastName ?? member.registerLastName);
  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  return {
    id: rawId || index + 1,
    nome: fullName || toStringValue(pick(member, NAME_FIELDS), `Aluno ${index + 1}`),
    genero: normalizeGender(pick(member, GENDER_FIELDS)),
    idade: inferAge(member),
    bairro: toStringValue(pick(member, DISTRICT_FIELDS), "Nao informado"),
    cidade: toStringValue(pick(member, CITY_FIELDS), "Nao informada"),
    contrato,
    contratoNome: contrato,
    inicio: startDate ? format(startDate, "dd/MM/yyyy") : null,
    vencimento: inferredDue ? format(inferredDue, "dd/MM/yyyy") : null,
    ultimaFrequencia: toBRDate(pick(member, LAST_FREQUENCY_FIELDS)),
    fotoUrl: toImageUrl(pick(member, IMAGE_FIELDS)),
    valor: value,
    valorTotal: value,
    diasAtivo: startDate
      ? Math.max(differenceInCalendarDays(inferredDue ?? today, startDate), 0)
      : 0,
    ativo: !inactive,
  };
}

async function fetchMembers() {
  if (membersRequest) return membersRequest;

  membersRequest = fetchMembersRequest().catch((error) => {
    membersRequest = null;
    throw error;
  });

  return membersRequest;
}

async function fetchMembersRequest() {
  const response = await fetch("/api/members", {
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `HTTP ${response.status}`);
  }

  const data = (await response.json()) as unknown;
  return Array.isArray(data) ? (data as MemberRecord[]) : [];
}

async function fetchActivities() {
  if (!activitiesRequest) {
    activitiesRequest = fetch("/api/activities", {
      headers: { accept: "application/json" },
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.text()) || `HTTP ${response.status}`);
        const data = (await response.json()) as unknown;
        return Array.isArray(data) ? (data as StoredActivity[]) : [];
      })
      .catch((error) => {
        activitiesRequest = null;
        throw error;
      });
  }
  return activitiesRequest;
}

async function fetchMemberships() {
  if (!membershipsRequest) {
    membershipsRequest = fetch("/api/memberships", {
      headers: { accept: "application/json" },
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.text()) || `HTTP ${response.status}`);
        return (await response.json()) as {
          memberships: MembershipRow[];
          receivables: ReceivableRow[];
        };
      })
      .catch((error) => {
        membershipsRequest = null;
        throw error;
      });
  }
  return membershipsRequest;
}

async function fetchSales() {
  if (!salesRequest) {
    salesRequest = fetch("/api/sales", {
      headers: { accept: "application/json" },
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.text()) || `HTTP ${response.status}`);
        const data = (await response.json()) as unknown;
        return Array.isArray(data) ? (data as SalesRecord[]) : [];
      })
      .catch((error) => {
        salesRequest = null;
        throw error;
      });
  }
  return salesRequest;
}

function useDashboardDataState(filters: Filters) {
  const deferredFilters = useDeferredValue(filters);
  const [members, setMembers] = useState<ClientRow[]>([]);
  const [activities, setActivities] = useState<StoredActivity[]>([]);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [receivables, setReceivables] = useState<ReceivableRow[]>([]);
  const [sales, setSales] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [loadingMemberships, setLoadingMemberships] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);
  const [membershipsError, setMembershipsError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadMembers() {
      try {
        setLoading(true);
        const rows = await fetchMembers();
        if (!mounted) return;
        setMembers(rows.map(memberToClient));
        setError(null);
      } catch (loadError) {
        if (!mounted) return;
        setMembers([]);
        setError(loadError instanceof Error ? loadError.message : "Falha ao carregar members");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadMembers();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchSales()
      .then((rows) => {
        if (!mounted) return;
        setSales(rows);
      })
      .catch(() => {
        if (!mounted) return;
        setSales([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchMemberships()
      .then((result) => {
        if (!mounted) return;
        setMemberships(result.memberships);
        setReceivables(result.receivables);
        setMembershipsError(null);
      })
      .catch((loadError) => {
        if (!mounted) return;
        setMemberships([]);
        setReceivables([]);
        setMembershipsError(
          loadError instanceof Error ? loadError.message : "Falha ao carregar contratos",
        );
      })
      .finally(() => {
        if (mounted) setLoadingMemberships(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchActivities()
      .then((rows) => {
        if (!mounted) return;
        setActivities(rows);
        setActivitiesError(null);
      })
      .catch((loadError) => {
        if (!mounted) return;
        setActivities([]);
        setActivitiesError(
          loadError instanceof Error ? loadError.message : "Falha ao carregar atividades",
        );
      })
      .finally(() => {
        if (mounted) setLoadingActivities(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const sourceRows = useMemo(() => {
    const contracts = new Map<number, MembershipRow[]>();
    memberships.forEach((membership) => {
      const list = contracts.get(membership.id_member) ?? [];
      list.push(membership);
      contracts.set(membership.id_member, list);
    });
    return members.map((member) => {
      const memberContracts = contracts.get(member.id) ?? [];
      const selectedContract = mostRelevantContract(memberContracts);
      const contractName = selectedContract?.membership_name?.trim();
      const activeByContract = memberContracts.some(
        (contract) => isContractActiveToday(contract) || isSingleUseActiveToday(contract),
      );

      return {
        ...member,
        ativo: activeByContract,
        contrato: contractName || member.contrato,
        contratoNome: contractName || member.contratoNome,
        inicio:
          toBRDate(selectedContract?.membership_start || selectedContract?.sale_date) ??
          member.inicio,
        vencimento: toBRDate(selectedContract?.membership_end) ?? member.vencimento,
        valor:
          selectedContract?.sale_value !== undefined
            ? toNumberValue(selectedContract.sale_value, member.valor)
            : member.valor,
        valorTotal:
          selectedContract?.sale_value !== undefined
            ? toNumberValue(selectedContract.sale_value, member.valorTotal)
            : member.valorTotal,
      };
    });
  }, [members, memberships]);
  const normalizedActivities = useMemo(() => normalizeActivities(activities), [activities]);
  const memberData = useMemo(
    () => getFilteredDashboardDataFromRows(deferredFilters, sourceRows),
    [deferredFilters, sourceRows],
  );
  const activityData = useMemo(
    () => getActivityDashboardDataFromNormalized(normalizedActivities, deferredFilters),
    [normalizedActivities, deferredFilters],
  );
  const membershipData = useMemo(() => {
    const activeMemberIds = sourceRows.length
      ? new Set(sourceRows.filter((member) => member.ativo).map((member) => member.id))
      : undefined;
    const selectedUnidades = Array.isArray(deferredFilters.unidade)
      ? deferredFilters.unidade
      : [deferredFilters.unidade];
    const filteredUnidades = selectedUnidades.filter(
      (unidade) => !["Todas", "Todos"].includes(unidade),
    );
    const filteredMemberIds = filteredUnidades.length
      ? new Set(
          sourceRows
            .filter((member) => filteredUnidades.includes(member.bairro))
            .map((member) => member.id),
        )
      : undefined;
    return getMembershipDashboardData(
      memberships,
      receivables,
      deferredFilters,
      activeMemberIds,
      filteredMemberIds,
    );
  }, [deferredFilters, memberships, receivables, sourceRows]);
  const data = useMemo(() => {
    const membersById = new Map(sourceRows.map((member) => [member.id, member]));
    const evolucaoAlunosPorContrato = activeStudentsEvolutionFromContracts(
      memberships,
      sourceRows,
      deferredFilters,
    );
    const contractsByMember = new Map<number, IndexedContract[]>();
    memberships.forEach((contract) => {
      if (isSingleUseMembership(contract)) return;
      const list = contractsByMember.get(contract.id_member) ?? [];
      list.push({
        contract,
        start: toDate(contract.membership_start || contract.sale_date),
        end: toDate(contract.membership_end),
      });
      contractsByMember.set(contract.id_member, list);
    });
    contractsByMember.forEach((list) => {
      list.sort((a, b) => (b.start?.getTime() ?? 0) - (a.start?.getTime() ?? 0));
    });
    const enrichAgenda = (agenda: typeof activityData.agendaHoje) =>
      agenda.map((activity) => ({
        ...activity,
        participantesLista: activity.participantesLista.map((participant) => {
          const memberId = Number(participant.id);
          const contract = Number.isFinite(memberId)
            ? contractForMemberAt(contractsByMember, memberId, activity.data)
            : null;
          return contract ? { ...participant, ...contract } : participant;
        }),
      }));
    return {
      ...memberData,
      overviewKpis: {
        ...memberData.overviewKpis,
        ...membershipData.kpis,
        taxaOcupacaoAgenda: activityData.overviewOccupancy,
      },
      funilComercial:
        salesFunnelFromRows(
          sales,
          deferredFilters,
          membershipData.kpis.movimentacaoPeriodo?.entradas ?? 0,
        ) ?? memberData.funilComercial,
      evolucaoAlunos: memberships.length ? evolucaoAlunosPorContrato : memberData.evolucaoAlunos,
      ocupacaoAgenda: activityData.ocupacaoAgenda,
      agendaEventos: enrichAgenda(activityData.agendaEventos),
      agendaHoje: enrichAgenda(activityData.agendaHoje),
      professores: activityData.professores,
      activityFilterOptions: activityData.filterOptions,
      faturamentoMensal: membershipData.faturamentoMensal,
      receitaPorPlano: membershipData.receitaPorPlano,
      projecaoFaturamento: membershipData.projecaoFaturamento,
      evolucaoVendas: membershipData.evolucaoVendas,
      renovacoesMensais: membershipData.renovacoesMensais.map((month) => ({
        ...month,
        renovacoesLista: month.renovacoesLista.map((row) => ({
          ...row,
          aluno: membersById.get(row.idAluno)?.nome ?? `Aluno ${row.idAluno}`,
        })),
        vencimentosLista: month.vencimentosLista.map((row) => ({
          ...row,
          aluno: membersById.get(row.idAluno)?.nome ?? `Aluno ${row.idAluno}`,
        })),
      })),
      vendasLista: membershipData.vendasLista.map((sale) => ({
        ...sale,
        aluno: membersById.get(sale.idAluno)?.nome ?? `Aluno ${sale.idAluno}`,
      })),
      cancelamentosLista: membershipData.cancelamentosLista.map((cancellation) => ({
        ...cancellation,
        aluno: membersById.get(cancellation.idAluno)?.nome ?? `Aluno ${cancellation.idAluno}`,
      })),
      renovacaoAtivaLista: membershipData.renovacaoAtivaLista.map((row) => ({
        ...row,
        aluno: membersById.get(row.idAluno)?.nome ?? `Aluno ${row.idAluno}`,
      })),
      renovacaoDesativadaLista: membershipData.renovacaoDesativadaLista.map((row) => ({
        ...row,
        aluno: membersById.get(row.idAluno)?.nome ?? `Aluno ${row.idAluno}`,
      })),
    };
  }, [activityData, deferredFilters, memberData, membershipData, memberships, sales, sourceRows]);
  const filterOptions = useMemo(() => getDashboardFilterOptions(sourceRows), [sourceRows]);

  return {
    data,
    filterOptions,
    clients: sourceRows,
    sales,
    memberships,
    receivables,
    loadingMembers: loading,
    membersError: error,
    usingSupabaseMembers: !loading && !error,
    membersCount: members.length,
    loadingActivities,
    activitiesError,
    usingSupabaseActivities: !loadingActivities && !activitiesError,
    activitiesCount: activities.length,
    loadingMemberships,
    membershipsError,
    usingSupabaseMemberships: !loadingMemberships && !membershipsError,
    membershipsCount: memberships.length,
  };
}

type DashboardData = ReturnType<typeof useDashboardDataState>;

const DashboardDataContext = createContext<DashboardData | null>(null);

export function DashboardDataProvider({
  filters,
  children,
}: {
  filters: Filters;
  children: ReactNode;
}) {
  const value = useDashboardDataState(filters);

  return createElement(DashboardDataContext.Provider, { value }, children);
}

export function useDashboardData(_filters: Filters) {
  const value = useContext(DashboardDataContext);

  if (!value) {
    throw new Error("useDashboardData deve ser usado dentro de DashboardDataProvider");
  }

  return value;
}
