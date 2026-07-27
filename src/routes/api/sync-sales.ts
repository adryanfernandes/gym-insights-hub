import { createFileRoute } from "@tanstack/react-router";

const ENDPOINT = "https://evo-integracao-api.w12app.com.br/api/v2/sales";
const MEMBER_BATCH_SIZE = 20;
const SALES_PAGE_SIZE = 1000;
const MAX_RUN_MS = 75000;

type RawSale = Record<string, unknown>;

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function timedFetch(url: string, init: RequestInit, timeoutMs = 25000) {
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
    "sales_sync_settings",
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
  throw new Error("Configure a chave da API EVO em Configurações > API vendas");
}

async function settings(base: string, key: string) {
  const response = await fetch(
    `${base}/rest/v1/sales_sync_settings?select=next_skip,next_member_offset&id=eq.true&limit=1`,
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

async function page(auth: string, idMember: number, skip: number) {
  const url = new URL(ENDPOINT);
  url.searchParams.set("search", "");
  url.searchParams.set("idMember", String(idMember));
  url.searchParams.set("idBranch", process.env.EVO_BRANCH_ID || "1");
  url.searchParams.set("take", String(SALES_PAGE_SIZE));
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
      return parsed.filter((row): row is RawSale => Boolean(row) && typeof row === "object");
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Falha desconhecida";
    }
  }
  throw new Error(`EVO vendas não respondeu para o cliente ${idMember} no cursor ${skip}: ${lastError}`);
}

function value(record: RawSale, keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return null;
}

function numberValue(input: unknown) {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input === "string") {
    const normalized = input.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function dateValue(input: unknown) {
  if (typeof input !== "string" || !input.trim()) return null;
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function stableHash(record: RawSale) {
  const source = JSON.stringify(record);
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function sourceKey(record: RawSale, index: number) {
  const id = value(record, ["idSale", "id_sale", "saleId", "idVenda", "id"]);
  const normalized = typeof id === "string" ? id.trim() : numberValue(id);
  if (normalized) return `sale:${normalized}`;
  return `hash:${stableHash(record)}:${index}`;
}

function salesRow(record: RawSale, index: number, syncedAt: string, fallbackMemberId?: number) {
  const idSale = numberValue(value(record, ["idSale", "id_sale", "saleId", "idVenda", "id"]));
  const idMember = numberValue(
    value(record, ["idMember", "id_member", "memberId", "idCliente", "idClient"]),
  ) ?? fallbackMemberId;
  const idBranch = numberValue(value(record, ["idBranch", "id_branch", "branchId"]));
  const saleDate = dateValue(
    value(record, ["saleDate", "date", "registerDate", "registrationDate", "createdAt"]),
  );
  const saleValue =
    numberValue(value(record, ["saleValue", "value", "amount", "total", "totalValue", "price"])) ??
    0;
  return {
    source_key: sourceKey(record, index),
    id_sale: idSale,
    id_member: idMember,
    id_branch: idBranch,
    sale_date: saleDate,
    sale_value: saleValue,
    payload: record,
    last_synced_at: syncedAt,
  };
}

async function existingKeys(base: string, key: string, keys: string[]) {
  if (!keys.length) return new Set<string>();
  const quoted = keys.map((item) => `"${item.replace(/"/g, '""')}"`).join(",");
  const response = await fetch(
    `${base}/rest/v1/sales?select=source_key&source_key=in.(${quoted})`,
    { headers: { apikey: key }, cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Falha ao consultar vendas existentes: ${await response.text()}`);
  return new Set(((await response.json()) as Array<{ source_key: string }>).map((row) => row.source_key));
}

async function upsertSales(base: string, key: string, rows: ReturnType<typeof salesRow>[]) {
  if (!rows.length) return;
  const response = await timedFetch(`${base}/rest/v1/sales?on_conflict=source_key`, {
    method: "POST",
    headers: {
      apikey: key,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(`sales: ${await response.text()}`);
}

async function memberIds(base: string, key: string, offset: number) {
  const response = await fetch(
    `${base}/rest/v1/members?select=idMember&order=idMember.asc&offset=${offset}&limit=${MEMBER_BATCH_SIZE}`,
    { headers: { apikey: key }, cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Falha ao carregar alunos para vendas: ${await response.text()}`);
  return ((await response.json()) as Array<{ idMember?: number | string }>)
    .map((row) => Number(row.idMember))
    .filter((id) => Number.isFinite(id));
}

async function updateCursor(base: string, key: string, nextSkip: number, nextMemberOffset: number) {
  const response = await fetch(`${base}/rest/v1/sales_sync_settings?id=eq.true`, {
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
  const response = await fetch(`${base}/rest/v1/sales_sync_history`, {
    method: "POST",
    headers: { apikey: key, "content-type": "application/json", prefer: "return=minimal" },
    body: JSON.stringify(row),
  });
  if (!response.ok) throw new Error(`Falha ao salvar histórico: ${await response.text()}`);
}

export const Route = createFileRoute("/api/sync-sales")({
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
        let newSales = 0;
        let membersChecked = 0;
        let completed = false;
        try {
          const savedSettings = await settings(base, key);
          cursor = savedSettings.nextSkip;
          memberOffset = savedSettings.nextMemberOffset;
          const auth = await authorization(base, key);

          let ids = await memberIds(base, key, memberOffset);
          if (!ids.length && memberOffset > 0) {
            memberOffset = 0;
            ids = await memberIds(base, key, memberOffset);
            completed = true;
          }

          for (const idMember of ids) {
            if (Date.now() - started > MAX_RUN_MS) break;
            let memberFinished = false;
            while (!memberFinished && Date.now() - started <= MAX_RUN_MS) {
              const records = await page(auth, idMember, cursor);
              if (!records.length) {
                memberFinished = true;
                break;
              }
              const syncedAt = new Date().toISOString();
              const rows = records.map((record, rowIndex) =>
                salesRow(record, cursor + rowIndex, syncedAt, idMember),
              );
              const existing = await existingKeys(base, key, rows.map((row) => row.source_key));
              newSales += rows.filter((row) => !existing.has(row.source_key)).length;
              await upsertSales(base, key, rows);
              fetched += records.length;
              cursor += records.length;
              if (records.length < SALES_PAGE_SIZE) {
                memberFinished = true;
              }
            }
            if (!memberFinished) break;
            cursor = 0;
            memberOffset += 1;
            membersChecked += 1;
          }

          if (ids.length < MEMBER_BATCH_SIZE && cursor === 0) {
            memberOffset = 0;
            completed = true;
          }
          await updateCursor(base, key, cursor, memberOffset);
          const finishedAt = new Date().toISOString();
          await history(base, key, {
            started_at: startedAt,
            finished_at: finishedAt,
            trigger_type: trigger,
            status: "success",
            total_fetched: fetched,
            new_sales: newSales,
            next_skip: cursor,
            members_checked: membersChecked,
            cycle_completed: completed,
            duration_ms: Date.now() - started,
          });
          return Response.json({
            ok: true,
            synchronized: fetched,
            newSales,
            nextSkip: cursor,
            nextMemberOffset: memberOffset,
            membersChecked,
            cycleCompleted: completed,
            trigger,
            finishedAt,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha ao sincronizar vendas";
          try {
            await history(base, key, {
              started_at: startedAt,
              finished_at: new Date().toISOString(),
              trigger_type: trigger,
              status: "error",
              total_fetched: fetched,
              new_sales: newSales,
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
