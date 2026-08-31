import { createFileRoute } from "@tanstack/react-router";

const ENDPOINT = "https://evo-integracao-api.w12app.com.br/api/v3/membermembership";
const MEMBER_BATCH_SIZE = 10;
const MEMBER_LOOKUP_PAGE_SIZE = 25;
const MAX_RUN_MS = 75000;
const ADMINISTRATIVE_MEMBERSHIPS = new Set([
  "professor exclusivo movip max",
  "aula exclusiva movip max",
  "massagem movida movip max",
  "adicional multi unidade movip max",
]);
const MEMBER_REGISTRATION_ORDER_COLUMNS = [
  "registerDate",
  "registrationDate",
  "created_at",
  "joined_at",
  "conversionDate",
];

type RawRecord = Record<string, unknown> & {
  idMemberMemberShip: number;
  idMember: number;
  receivables?: Array<Record<string, unknown>>;
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

async function settings(base: string, key: string) {
  const response = await fetch(
    `${base}/rest/v1/membership_sync_settings?select=next_skip,next_member_offset&id=eq.true&limit=1`,
    { headers: { apikey: key }, cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Falha ao carregar cursor: ${await response.text()}`);
  const row = (await response.json())[0] as
    | { next_skip?: number; next_member_offset?: number }
    | undefined;
  return {
    nextSkip: row?.next_skip ?? 0,
    nextMemberOffset: row?.next_member_offset ?? 0,
  };
}

async function page(auth: string, skip: number, options?: { idMember?: number; take?: number }) {
  const url = new URL(ENDPOINT);
  url.searchParams.set("idBranch", process.env.EVO_BRANCH_ID || "1");
  url.searchParams.set("take", String(options?.take ?? MEMBER_LOOKUP_PAGE_SIZE));
  url.searchParams.set("skip", String(skip));
  if (options?.idMember) url.searchParams.set("idMember", String(options.idMember));
  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await timedFetch(url.toString(), {
        headers: { Authorization: auth, Accept: "application/json" },
        cache: "no-store",
      });
      const body = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.slice(0, 300)}`);
      const parsed = JSON.parse(body) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (row): row is RawRecord =>
          Boolean(row) &&
          typeof row === "object" &&
          typeof (row as RawRecord).idMemberMemberShip === "number" &&
          typeof (row as RawRecord).idMember === "number",
      );
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Falha desconhecida";
    }
  }
  const target = options?.idMember ? `cliente ${options.idMember}` : `cursor ${skip}`;
  throw new Error(`EVO não respondeu no ${target}: ${lastError}`);
}

function value(record: Record<string, unknown>, key: string) {
  return record[key] ?? null;
}

function normalizedText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isNonRecurringMembershipName(value: unknown) {
  const name = normalizedText(value);
  return name.includes("avulso") || ADMINISTRATIVE_MEMBERSHIPS.has(name);
}

function isRecurringRecord(record: RawRecord) {
  return !isNonRecurringMembershipName(value(record, "nameMembership"));
}

function recordDate(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function recurringRow(record: RawRecord, syncedAt: string) {
  const end = recordDate(value(record, "membershipEnd"));
  const cancel = recordDate(value(record, "cancelDate"));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return {
    id_member: record.idMember,
    last_contract_id: record.idMemberMemberShip,
    membership_name: value(record, "nameMembership"),
    membership_start: value(record, "membershipStart"),
    membership_end: value(record, "membershipEnd"),
    active:
      Boolean(end && end >= today) &&
      (!cancel || cancel > today),
    last_seen_at: syncedAt,
  };
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

async function memberIdsOrderedByRegistration(base: string, key: string) {
  const tryColumn = async (column: string | null) => {
    const ids: number[] = [];
    const seen = new Set<number>();
    const select = column ? `idMember,${column}` : "idMember";
    const order = column ? `${column}.desc.nullslast,idMember.desc` : "idMember.desc";
    for (let offset = 0; offset < 10000; offset += 1000) {
      const response = await fetch(
        `${base}/rest/v1/members?select=${encodeURIComponent(select)}&order=${encodeURIComponent(order)}&offset=${offset}&limit=1000`,
        { headers: { apikey: key }, cache: "no-store" },
      );
      if (!response.ok) {
        if (column) return null;
        throw new Error(`Falha ao consultar clientes: ${await response.text()}`);
      }
      const rows = (await response.json()) as Array<{ idMember?: number | string }>;
      rows.forEach((row) => {
        const id = Number(row.idMember);
        if (Number.isFinite(id) && !seen.has(id)) {
          seen.add(id);
          ids.push(id);
        }
      });
      if (rows.length < 1000) break;
    }
    return ids;
  };

  for (const column of MEMBER_REGISTRATION_ORDER_COLUMNS) {
    const ids = await tryColumn(column);
    if (ids?.length) return ids;
  }

  return (await tryColumn(null)) ?? [];
}

async function memberIds(base: string, key: string) {
  return new Set(await memberIdsOrderedByRegistration(base, key));
}

async function activeMemberIds(base: string, key: string) {
  const ids = new Set<number>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();
  for (let offset = 0; offset < 10000; offset += 1000) {
    const response = await fetch(
      `${base}/rest/v1/member_memberships?select=id_member&membership_end=gte.${todayIso}&or=(cancel_date.is.null,cancel_date.gt.${todayIso})&order=id_member.asc&offset=${offset}&limit=1000`,
      { headers: { apikey: key }, cache: "no-store" },
    );
    if (!response.ok)
      throw new Error(`Falha ao consultar clientes ativos com contratos: ${await response.text()}`);
    const rows = (await response.json()) as Array<{ id_member?: number | string }>;
    rows.forEach((row) => {
      const id = Number(row.id_member);
      if (Number.isFinite(id)) ids.add(id);
    });
    if (rows.length < 1000) break;
  }
  return ids;
}

async function recurringPriorityMemberIdSet(base: string, key: string) {
  const ids = new Set<number>();
  for (let offset = 0; offset < 10000; offset += 1000) {
    const response = await fetch(
      `${base}/rest/v1/membership_recurring_members?select=id_member&priority_sync_count=lt.2&offset=${offset}&limit=1000`,
      { headers: { apikey: key }, cache: "no-store" },
    );
    if (!response.ok)
      throw new Error(`Falha ao consultar fila de contratos recorrentes: ${await response.text()}`);
    const rows = (await response.json()) as Array<{ id_member?: number | string }>;
    rows.forEach((row) => {
      const id = Number(row.id_member);
      if (Number.isFinite(id)) ids.add(id);
    });
    if (rows.length < 1000) break;
  }
  return ids;
}

async function recurringPriorityMemberIds(base: string, key: string) {
  const [orderedMembers, recurring] = await Promise.all([
    memberIdsOrderedByRegistration(base, key),
    recurringPriorityMemberIdSet(base, key),
  ]);
  return orderedMembers.filter((id) => recurring.has(id)).slice(0, MEMBER_BATCH_SIZE);
}

async function recurringMemberIds(base: string, key: string) {
  const ids = new Set<number>();
  for (let offset = 0; offset < 10000; offset += 1000) {
    const response = await fetch(
      `${base}/rest/v1/membership_recurring_members?select=id_member&offset=${offset}&limit=1000`,
      { headers: { apikey: key }, cache: "no-store" },
    );
    if (!response.ok)
      throw new Error(`Falha ao consultar clientes recorrentes: ${await response.text()}`);
    const rows = (await response.json()) as Array<{ id_member?: number | string }>;
    rows.forEach((row) => {
      const id = Number(row.id_member);
      if (Number.isFinite(id)) ids.add(id);
    });
    if (rows.length < 1000) break;
  }
  return ids;
}

async function inactiveMemberIds(base: string, key: string, offset: number) {
  const [members, recurring] = await Promise.all([
    memberIdsOrderedByRegistration(base, key),
    recurringMemberIds(base, key),
  ]);
  return members
    .filter((id) => !recurring.has(id))
    .slice(offset, offset + MEMBER_BATCH_SIZE);
}

async function prioritizedMemberIds(base: string, key: string, offset: number) {
  const recurring = await recurringPriorityMemberIds(base, key);
  if (recurring.length) return { ids: recurring, phase: "recurring" as const };
  return { ids: await inactiveMemberIds(base, key, offset), phase: "inactive" as const };
}

async function bumpRecurringPriorityCounts(base: string, key: string, ids: number[]) {
  const uniqueIds = Array.from(new Set(ids));
  if (!uniqueIds.length) return;
  const response = await fetch(
    `${base}/rest/v1/membership_recurring_members?select=id_member,priority_sync_count&id_member=in.(${uniqueIds.join(",")})`,
    { headers: { apikey: key }, cache: "no-store" },
  );
  if (!response.ok)
    throw new Error(`Falha ao atualizar prioridade de recorrentes: ${await response.text()}`);
  const rows = (await response.json()) as Array<{
    id_member: number | string;
    priority_sync_count?: number | string;
  }>;
  await upsert(
    base,
    key,
    "membership_recurring_members",
    "id_member",
    rows.map((row) => ({
      id_member: Number(row.id_member),
      priority_sync_count: Math.min(Number(row.priority_sync_count ?? 0) + 1, 2),
      last_seen_at: new Date().toISOString(),
    })),
  );
}

async function resetRecurringPriorityCounts(base: string, key: string) {
  const response = await fetch(
    `${base}/rest/v1/membership_recurring_members?priority_sync_count=gte.2`,
    {
      method: "PATCH",
      headers: { apikey: key, "content-type": "application/json", prefer: "return=minimal" },
      body: JSON.stringify({ priority_sync_count: 0 }),
    },
  );
  if (!response.ok)
    throw new Error(`Falha ao reiniciar prioridade de recorrentes: ${await response.text()}`);
}

async function updateCursor(base: string, key: string, nextSkip: number, nextMemberOffset: number) {
  const response = await fetch(`${base}/rest/v1/membership_sync_settings?id=eq.true`, {
    method: "PATCH",
    headers: { apikey: key, "content-type": "application/json", prefer: "return=minimal" },
    body: JSON.stringify({
      next_skip: nextSkip,
      next_member_offset: nextMemberOffset,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) throw new Error(`Falha ao salvar cursor: ${await response.text()}`);
}

async function history(base: string, key: string, row: Record<string, unknown>) {
  const response = await fetch(`${base}/rest/v1/membership_sync_history`, {
    method: "POST",
    headers: { apikey: key, "content-type": "application/json", prefer: "return=minimal" },
    body: JSON.stringify(row),
  });
  if (!response.ok) throw new Error(`Falha ao salvar histórico: ${await response.text()}`);
}

async function targetMemberIds(request: Request) {
  const queryIds = new URL(request.url).searchParams.get("ids");
  if (queryIds) {
    return Array.from(
      new Set(
        queryIds
          .split(",")
          .map((id) => Number(id.trim()))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    );
  }

  try {
    const body = (await request.json()) as { ids?: unknown };
    if (!Array.isArray(body.ids)) return [];
    return Array.from(
      new Set(
        body.ids
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    );
  } catch {
    return [];
  }
}

export const Route = createFileRoute("/api/sync-memberships")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        if (origin && new URL(origin).host !== new URL(request.url).host) {
          return Response.json({ error: "Origin not allowed" }, { status: 403 });
        }
        const started = Date.now();
        const startedAt = new Date(started).toISOString();
        const trigger =
          new URL(request.url).searchParams.get("trigger") === "scheduled" ? "scheduled" : "manual";
        const base = env("SUPABASE_URL").replace(/\/$/, "");
        const key = env("SUPABASE_SECRET_KEY");
        let cursor = 0;
        let memberOffset = 0;
        let fetched = 0;
        let newMemberships = 0;
        let receivablesSynced = 0;
        let membersChecked = 0;
        let completed = false;
        try {
          const targetIds = await targetMemberIds(request);
          const targeted = targetIds.length > 0;
          if (!targeted) {
            const savedSettings = await settings(base, key);
            cursor = savedSettings.nextSkip;
            memberOffset = savedSettings.nextMemberOffset;
          }
          const auth = await authorization(base, key);
          const saveRecords = async (records: RawRecord[]) => {
            if (!records.length) return;
            const syncedAt = new Date().toISOString();
            const ids = records.map((record) => record.idMemberMemberShip);
            const existing = await existingIds(base, key, ids);
            newMemberships += ids.filter((id) => !existing.has(id)).length;
            const memberships = records.map((record) => membershipRow(record, syncedAt));
            const recurringMembers = Array.from(
              new Map(
                records
                  .filter(isRecurringRecord)
                  .map((record) => recurringRow(record, syncedAt))
                  .sort((a, b) => {
                    const aDate = recordDate(a.membership_end)?.getTime() ?? 0;
                    const bDate = recordDate(b.membership_end)?.getTime() ?? 0;
                    return aDate - bDate;
                  })
                  .map((row) => [row.id_member, row]),
              ).values(),
            );
            const receivables = Array.from(
              new Map(
                receivableRows(records, syncedAt).map((row) => [row.id_receivable, row]),
              ).values(),
            );
            await upsert(base, key, "member_memberships", "id_member_membership", memberships);
            await upsert(base, key, "membership_receivables", "id_receivable", receivables);
            await upsert(base, key, "membership_recurring_members", "id_member", recurringMembers);
            fetched += records.length;
            receivablesSynced += receivables.length;
          };
          let phase: "targeted" | "recurring" | "inactive" = "targeted";
          let selection = targeted
            ? { ids: targetIds, phase }
            : await prioritizedMemberIds(base, key, memberOffset);
          let ids = selection.ids;
          phase = selection.phase;
          if (!targeted && !ids.length && memberOffset > 0) {
            memberOffset = 0;
            await resetRecurringPriorityCounts(base, key);
            selection = await prioritizedMemberIds(base, key, memberOffset);
            ids = selection.ids;
            phase = selection.phase;
            completed = true;
          }
          const recurringMembersChecked: number[] = [];

          for (const idMember of ids) {
            if (Date.now() - started > MAX_RUN_MS) break;
            let memberFinished = false;
            while (!memberFinished && Date.now() - started <= MAX_RUN_MS) {
              const records = await page(auth, cursor, {
                idMember,
                take: MEMBER_LOOKUP_PAGE_SIZE,
              });
              if (!records.length) {
                memberFinished = true;
                break;
              }
              await saveRecords(records);
              cursor += records.length;
              if (records.length < MEMBER_LOOKUP_PAGE_SIZE) {
                memberFinished = true;
              }
            }
            if (!memberFinished) break;
            cursor = 0;
            if (!targeted && phase === "inactive") memberOffset += 1;
            if (!targeted && phase === "recurring") recurringMembersChecked.push(idMember);
            membersChecked += 1;
          }

          if (targeted) {
            completed = membersChecked === ids.length;
          } else if (phase === "recurring") {
            await bumpRecurringPriorityCounts(base, key, recurringMembersChecked);
          } else if (ids.length < MEMBER_BATCH_SIZE && cursor === 0) {
            memberOffset = 0;
            completed = true;
            await resetRecurringPriorityCounts(base, key);
          }
          if (!targeted) await updateCursor(base, key, cursor, memberOffset);
          const finishedAt = new Date().toISOString();
          await history(base, key, {
            started_at: startedAt,
            finished_at: finishedAt,
            trigger_type: trigger,
            status: "success",
            total_fetched: fetched,
            new_memberships: newMemberships,
            receivables_synced: receivablesSynced,
            next_skip: cursor,
            members_checked: membersChecked,
            cycle_completed: completed,
            duration_ms: Date.now() - started,
          });
          return Response.json({
            ok: true,
            synchronized: fetched,
            newMemberships,
            receivablesSynced,
            nextSkip: cursor,
            nextMemberOffset: memberOffset,
            cycleCompleted: completed,
            membersChecked,
            targeted,
            requestedMembers: targetIds,
            trigger,
            finishedAt,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha ao sincronizar contratos";
          try {
            await history(base, key, {
              started_at: startedAt,
              finished_at: new Date().toISOString(),
              trigger_type: trigger,
              status: "error",
              total_fetched: fetched,
              new_memberships: newMemberships,
              receivables_synced: receivablesSynced,
              next_skip: cursor,
              members_checked: membersChecked,
              cycle_completed: false,
              duration_ms: Date.now() - started,
              error_message: message.slice(0, 1000),
            });
          } catch {
            /* Preserve original error. */
          }
          return Response.json({ error: message }, { status: 502 });
        }
      },
    },
  },
});
