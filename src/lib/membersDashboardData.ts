import { differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import type { Filters } from "@/contexts/AppContext";
import {
  CLIENTS,
  getDashboardFilterOptions,
  getFilteredDashboardDataFromRows,
  type ClientRow,
} from "@/lib/mockData";

type MemberRecord = Record<string, unknown>;

const NAME_FIELDS = ["nome", "name", "full_name", "nome_completo", "display_name", "member_name", "registerName"];
const GENDER_FIELDS = ["genero", "sexo", "gender", "sex"];
const AGE_FIELDS = ["idade", "age"];
const BIRTH_DATE_FIELDS = ["data_nascimento", "birthDate", "birth_date", "birthday", "nascimento"];
const DISTRICT_FIELDS = ["branchName", "bairro", "unidade", "branch", "location", "unit", "neighborhood"];
const CITY_FIELDS = ["cidade", "city"];
const CONTRACT_FIELDS = ["contrato", "plano", "plan", "membership", "membership_type", "tipo_contrato"];
const START_FIELDS = ["registerDate", "conversionDate", "inicio", "data_inicio", "data_matricula", "created_at", "joined_at", "start_date"];
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
const STATUS_FIELDS = ["status", "membershipStatus", "situacao", "active", "ativo", "is_active", "membership_status"];
const ID_FIELDS = ["idMember", "id", "member_id", "codigo", "code", "uuid"];

let membersRequest: Promise<MemberRecord[]> | null = null;

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

function toNumberValue(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
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
    valor: value,
    valorTotal: value,
    diasAtivo: startDate ? Math.max(differenceInCalendarDays(inferredDue ?? today, startDate), 0) : 0,
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
  return Array.isArray(data) ? data as MemberRecord[] : [];
}

export function useDashboardData(filters: Filters) {
  const [members, setMembers] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const sourceRows = members.length ? members : CLIENTS;
  const data = useMemo(
    () => getFilteredDashboardDataFromRows(filters, sourceRows),
    [filters, sourceRows],
  );
  const filterOptions = useMemo(() => getDashboardFilterOptions(sourceRows), [sourceRows]);

  return {
    data,
    filterOptions,
    loadingMembers: loading,
    membersError: error,
    usingSupabaseMembers: members.length > 0,
    membersCount: members.length,
  };
}
