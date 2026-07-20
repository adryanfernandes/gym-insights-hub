import { createFileRoute } from "@tanstack/react-router";

const ENDPOINT = "https://evo-integracao-api.w12app.com.br/api/v3/membermembership";
const PAGE_SIZE = 2;
const MAX_PAGES_PER_RUN = 20;
const MAX_RUN_MS = 75000;

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
    `${base}/rest/v1/membership_sync_settings?select=next_skip&id=eq.true&limit=1`,
    { headers: { apikey: key }, cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Falha ao carregar cursor: ${await response.text()}`);
  return ((await response.json())[0] as { next_skip?: number } | undefined)?.next_skip ?? 0;
}

async function page(auth: string, skip: number) {
  const url = new URL(ENDPOINT);
  url.searchParams.set("idBranch", process.env.EVO_BRANCH_ID || "1");
  url.searchParams.set("take", String(PAGE_SIZE));
  url.searchParams.set("skip", String(skip));
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
  throw new Error(`EVO não respondeu no cursor ${skip}: ${lastError}`);
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

async function updateCursor(base: string, key: string, nextSkip: number) {
  const response = await fetch(`${base}/rest/v1/membership_sync_settings?id=eq.true`, {
    method: "PATCH",
    headers: { apikey: key, "content-type": "application/json", prefer: "return=minimal" },
    body: JSON.stringify({ next_skip: nextSkip, updated_at: new Date().toISOString() }),
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
        let fetched = 0;
        let newMemberships = 0;
        let receivablesSynced = 0;
        let completed = false;
        try {
          cursor = await settings(base, key);
          const auth = await authorization(base, key);
          for (let index = 0; index < MAX_PAGES_PER_RUN; index += 1) {
            if (Date.now() - started > MAX_RUN_MS) break;
            const records = await page(auth, cursor);
            if (!records.length) {
              cursor = 0;
              completed = true;
              break;
            }
            const syncedAt = new Date().toISOString();
            const ids = records.map((record) => record.idMemberMemberShip);
            const existing = await existingIds(base, key, ids);
            newMemberships += ids.filter((id) => !existing.has(id)).length;
            const memberships = records.map((record) => membershipRow(record, syncedAt));
            const receivables = receivableRows(records, syncedAt);
            await upsert(base, key, "member_memberships", "id_member_membership", memberships);
            await upsert(base, key, "membership_receivables", "id_receivable", receivables);
            fetched += records.length;
            receivablesSynced += receivables.length;
            cursor += records.length;
            if (records.length < PAGE_SIZE) {
              cursor = 0;
              completed = true;
              break;
            }
          }
          await updateCursor(base, key, cursor);
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
            cycle_completed: completed,
            duration_ms: Date.now() - started,
          });
          return Response.json({
            ok: true,
            synchronized: fetched,
            newMemberships,
            receivablesSynced,
            nextSkip: cursor,
            cycleCompleted: completed,
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
