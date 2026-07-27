import { createFileRoute } from "@tanstack/react-router";

const ENDPOINT = "https://evo-integracao-api.w12app.com.br/api/v3/membermembership";
const MEMBER_LOOKUP_PAGE_SIZE = 25;
const DEFAULT_MEMBERS_PER_RUN = 10;
const MAX_MEMBERS_PER_RUN = 50;
const MAX_PAGES_PER_MEMBER = 4;
const MAX_RUN_MS = 75000;

type MemberRecord = Record<string, unknown>;

type RawRecord = Record<string, unknown> & {
  idMemberMemberShip: number;
  idMember: number;
  receivables?: Array<Record<string, unknown>>;
};

type MembershipLookupMember = {
  id: number;
  nome: string;
};

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function timedFetch(url: string, init: RequestInit, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function authorization(base: string, key: string) {
  if (process.env.EVO_API_AUTHORIZATION) return process.env.EVO_API_AUTHORIZATION;
  for (const table of [
    "membership_sync_settings",
    "activity_sync_settings",
    "member_sync_settings",
  ]) {
    const response = await fetch(
      `${base}/rest/v1/${table}?select=evo_api_authorization&id=eq.true&limit=1`,
      { headers: { apikey: key }, cache: "no-store" },
    );
    if (!response.ok) continue;
    const value = ((await response.json())[0] as { evo_api_authorization?: string } | undefined)
      ?.evo_api_authorization;
    if (value?.trim()) return value.trim();
  }
  throw new Error("Configure a chave da API EVO em Configurações > API de contratos");
}

function memberId(row: MemberRecord) {
  const raw = row.idMember ?? row.id ?? row.member_id;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

function memberName(row: MemberRecord) {
  const firstName = String(row.firstName ?? row.registerName ?? "").trim();
  const lastName = String(row.lastName ?? row.registerLastName ?? "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  return fullName || String(row.name ?? row.nome ?? row.full_name ?? "Aluno sem nome").trim();
}

async function allMembers(base: string, key: string) {
  const rows: MemberRecord[] = [];
  for (let offset = 0; offset < 20000; offset += 1000) {
    const response = await fetch(
      `${base}/rest/v1/members?select=*&order=idMember.asc&offset=${offset}&limit=1000`,
      { headers: { apikey: key }, cache: "no-store" },
    );
    if (!response.ok) throw new Error(`Falha ao consultar clientes: ${await response.text()}`);
    const page = (await response.json()) as MemberRecord[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

async function memberIdsWithMemberships(base: string, key: string) {
  const ids = new Set<number>();
  for (let offset = 0; offset < 20000; offset += 1000) {
    const response = await fetch(
      `${base}/rest/v1/member_memberships?select=id_member&order=id_member.asc&offset=${offset}&limit=1000`,
      { headers: { apikey: key }, cache: "no-store" },
    );
    if (!response.ok)
      throw new Error(`Falha ao consultar clientes com contratos: ${await response.text()}`);
    const rows = (await response.json()) as Array<{ id_member?: number | string }>;
    rows.forEach((row) => {
      const id = Number(row.id_member);
      if (Number.isFinite(id)) ids.add(id);
    });
    if (rows.length < 1000) break;
  }
  return ids;
}

async function missingMembers(base: string, key: string) {
  const [members, withMemberships] = await Promise.all([
    allMembers(base, key),
    memberIdsWithMemberships(base, key),
  ]);
  return members
    .map((row) => ({ id: memberId(row), nome: memberName(row) }))
    .filter((row): row is { id: number; nome: string } => row.id !== null)
    .filter((row) => !withMemberships.has(row.id))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
}

function parseMemberIds(value: unknown) {
  const source = Array.isArray(value) ? value.join("\n") : String(value ?? "");
  return Array.from(
    new Set(
      source
        .split(/[\s,;]+/)
        .map((item) => Number(item.trim()))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  );
}

async function membersByIds(base: string, key: string, ids: number[]): Promise<MembershipLookupMember[]> {
  if (!ids.length) return [];
  const response = await fetch(
    `${base}/rest/v1/members?select=*&idMember=in.(${ids.join(",")})&order=idMember.asc`,
    { headers: { apikey: key }, cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Falha ao consultar clientes informados: ${await response.text()}`);
  const rows = (await response.json()) as MemberRecord[];
  const names = new Map<number, string>();
  rows.forEach((row) => {
    const id = memberId(row);
    if (id !== null) names.set(id, memberName(row));
  });
  return ids.map((id) => ({ id, nome: names.get(id) ?? `Cliente ${id}` }));
}

async function page(auth: string, skip: number, idMember: number) {
  const url = new URL(ENDPOINT);
  url.searchParams.set("idBranch", process.env.EVO_BRANCH_ID || "1");
  url.searchParams.set("take", String(MEMBER_LOOKUP_PAGE_SIZE));
  url.searchParams.set("skip", String(skip));
  url.searchParams.set("idMember", String(idMember));
  const response = await timedFetch(url.toString(), {
    headers: { Authorization: auth, Accept: "application/json" },
    cache: "no-store",
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`EVO cliente ${idMember}: HTTP ${response.status}: ${body.slice(0, 300)}`);
  const parsed = JSON.parse(body) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (row): row is RawRecord =>
      Boolean(row) &&
      typeof row === "object" &&
      typeof (row as RawRecord).idMemberMemberShip === "number" &&
      typeof (row as RawRecord).idMember === "number",
  );
}

function value(record: Record<string, unknown>, key: string) {
  return record[key] ?? null;
}

function membershipRow(record: RawRecord, syncedAt: string) {
  const transfer = record.membershipTrasnferData as Record<string, unknown> | undefined;
  const swap = record.membershipSwapData as Record<string, unknown> | undefined;
  return {
    id_member_membership: record.idMemberMemberShip,
    id_member: record.idMember,
    id_membership: value(record, "idMembership"),
    id_branch: value(record, "idBranch"),
    id_sale: value(record, "idSale"),
    sale_value: value(record, "saleValue") ?? 0,
    membership_name: value(record, "nameMembership"),
    membership_start: value(record, "membershipStart"),
    membership_end: value(record, "membershipEnd"),
    register_cancel_date: value(record, "registerCancelDate"),
    cancel_date: value(record, "cancelDate"),
    cancellation_reason: value(record, "reasonCancellation"),
    cancellation_fine: value(record, "cancellationFine") ?? 0,
    remaining_value: value(record, "remainingValue") ?? 0,
    sale_date: value(record, "saleDate"),
    minimum_stay_period: value(record, "minPeriodStayMembership"),
    transferred: transfer?.flTransfer === true,
    membership_swapped: swap?.flMembershipSwapped === true,
    status: value(record, "statusMemberMembership"),
    last_synced_at: syncedAt,
  };
}

function receivableRows(records: RawRecord[], syncedAt: string) {
  return records.flatMap((record) =>
    (Array.isArray(record.receivables) ? record.receivables : [])
      .filter((item) => typeof item.idReceivable === "number")
      .map((item) => {
        const payment = item.paymentType as Record<string, unknown> | undefined;
        return {
          id_receivable: item.idReceivable,
          id_member_membership: record.idMemberMemberShip,
          description: value(item, "description"),
          amount: value(item, "ammount") ?? 0,
          amount_paid: value(item, "ammountPaid") ?? 0,
          current_installment: value(item, "currentInstallment"),
          total_installments: value(item, "totalInstallments"),
          canceled: item.canceled === true,
          cancellation_date: value(item, "cancellationDate"),
          cancellation_description: value(item, "cancellationDescription"),
          registration_date: value(item, "registrationDate"),
          due_date: value(item, "dueDate"),
          receiving_date: value(item, "receivingDate"),
          payment_type_id: payment?.id ?? null,
          payment_type_name: payment?.name ?? null,
          last_synced_at: syncedAt,
        };
      }),
  );
}

async function existingIds(base: string, key: string, ids: number[]) {
  if (!ids.length) return new Set<number>();
  const response = await fetch(
    `${base}/rest/v1/member_memberships?select=id_member_membership&id_member_membership=in.(${ids.join(",")})`,
    { headers: { apikey: key }, cache: "no-store" },
  );
  if (!response.ok)
    throw new Error(`Falha ao consultar contratos existentes: ${await response.text()}`);
  return new Set(
    ((await response.json()) as Array<{ id_member_membership: number }>).map(
      (row) => row.id_member_membership,
    ),
  );
}

async function upsert(base: string, key: string, table: string, conflict: string, rows: unknown[]) {
  if (!rows.length) return;
  const response = await timedFetch(`${base}/rest/v1/${table}?on_conflict=${conflict}`, {
    method: "POST",
    headers: {
      apikey: key,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(`${table}: ${await response.text()}`);
}

export const Route = createFileRoute("/api/missing-memberships")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const base = env("SUPABASE_URL").replace(/\/$/, "");
          const key = env("SUPABASE_SECRET_KEY");
          const missing = await missingMembers(base, key);
          return Response.json({
            count: missing.length,
            sample: missing.slice(0, 50),
          });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Falha ao verificar alunos" },
            { status: 500 },
          );
        }
      },
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        if (origin && new URL(origin).host !== new URL(request.url).host) {
          return Response.json({ error: "Origin not allowed" }, { status: 403 });
        }
        try {
          const started = Date.now();
          const body = (await request.json().catch(() => ({}))) as {
            limit?: number;
            memberIds?: unknown;
          };
          const manualIds = parseMemberIds(body.memberIds);
          const limit = Math.max(
            1,
            Math.min(MAX_MEMBERS_PER_RUN, Number(body.limit) || DEFAULT_MEMBERS_PER_RUN),
          );
          const base = env("SUPABASE_URL").replace(/\/$/, "");
          const key = env("SUPABASE_SECRET_KEY");
          const auth = await authorization(base, key);
          const missingBefore = manualIds.length ? [] : await missingMembers(base, key);
          const targetMembers = manualIds.length
            ? await membersByIds(base, key, manualIds.slice(0, MAX_MEMBERS_PER_RUN))
            : missingBefore.slice(0, limit);
          let synchronized = 0;
          let newMemberships = 0;
          let receivablesSynced = 0;

          for (const member of targetMembers) {
            if (Date.now() - started > MAX_RUN_MS) break;
            let skip = 0;
            for (let index = 0; index < MAX_PAGES_PER_MEMBER; index += 1) {
              if (Date.now() - started > MAX_RUN_MS) break;
              const records = await page(auth, skip, member.id);
              if (!records.length) break;
              const syncedAt = new Date().toISOString();
              const ids = records.map((record) => record.idMemberMemberShip);
              const existing = await existingIds(base, key, ids);
              newMemberships += ids.filter((id) => !existing.has(id)).length;
              const memberships = records.map((record) => membershipRow(record, syncedAt));
              const receivables = Array.from(
                new Map(
                  receivableRows(records, syncedAt).map((row) => [row.id_receivable, row]),
                ).values(),
              );
              await upsert(base, key, "member_memberships", "id_member_membership", memberships);
              await upsert(base, key, "membership_receivables", "id_receivable", receivables);
              synchronized += records.length;
              receivablesSynced += receivables.length;
              skip += records.length;
              if (records.length < MEMBER_LOOKUP_PAGE_SIZE) break;
            }
          }

          const missingAfter = manualIds.length ? [] : await missingMembers(base, key);
          return Response.json({
            ok: true,
            mode: manualIds.length ? "manual" : "missing",
            requestedMembers: manualIds.length ? manualIds.length : undefined,
            checkedMembers: targetMembers.length,
            missingBefore: missingBefore.length,
            missingAfter: missingAfter.length,
            synchronized,
            newMemberships,
            receivablesSynced,
            checkedSample: targetMembers.slice(0, 50),
            sample: missingAfter.slice(0, 50),
            durationMs: Date.now() - started,
          });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Falha ao buscar contratos ausentes" },
            { status: 502 },
          );
        }
      },
    },
  },
});
