import { createFileRoute } from "@tanstack/react-router";

const DEFAULT_EVO_URL = "https://evo-integracao-api.w12app.com.br/api/v2/members";
const PAGE_SIZE = 100;
const UPSERT_BATCH_SIZE = 250;

type Member = Record<string, unknown> & { idMember: string | number };
type MemberSyncMode = "full" | "recent";
type MemberSyncSettings = {
  authorization: string;
  syncMode: MemberSyncMode;
  recentDays: number;
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function extractMembers(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const object = payload as Record<string, unknown>;
  for (const key of ["data", "items", "members", "results"]) {
    if (Array.isArray(object[key])) return object[key] as unknown[];
  }
  return [];
}

function isoDateTime(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

async function collectMembers(mode: MemberSyncMode, recentDays: number, authorization: string) {
  const endpoint = process.env.EVO_MEMBERS_URL || DEFAULT_EVO_URL;
  const branchId = process.env.EVO_BRANCH_ID || "1";
  const members: Member[] = [];
  const now = new Date();
  const registerDateStart = new Date(now);
  registerDateStart.setDate(registerDateStart.getDate() - Math.max(1, Math.min(30, recentDays)));
  registerDateStart.setHours(0, 0, 0, 0);

  for (let skip = 0, page = 0; page < 1000; skip += PAGE_SIZE, page += 1) {
    const url = new URL(endpoint);
    url.searchParams.set("idBranch", branchId);
    url.searchParams.set("take", String(PAGE_SIZE));
    url.searchParams.set("skip", String(skip));
    if (mode === "recent") {
      url.searchParams.set("registerDateStart", isoDateTime(registerDateStart));
      url.searchParams.set("registerDateEnd", isoDateTime(now));
    }

    const response = await fetchWithTimeout(url.toString(), {
      headers: { Authorization: authorization, Accept: "application/json" },
      cache: "no-store",
    });
    const body = await response.text();
    if (!response.ok)
      throw new Error(`EVO API returned HTTP ${response.status}: ${body.slice(0, 300)}`);

    const rows = extractMembers(JSON.parse(body)).filter(
      (row): row is Member =>
        Boolean(row) && typeof row === "object" && "idMember" in (row as Record<string, unknown>),
    );
    members.push(...rows);
    if (rows.length < PAGE_SIZE) return members;
  }

  throw new Error("EVO API pagination exceeded the safety limit");
}

async function getMemberSyncSettings(): Promise<MemberSyncSettings> {
  if (process.env.EVO_API_AUTHORIZATION) {
    return {
      authorization: process.env.EVO_API_AUTHORIZATION,
      syncMode: "full",
      recentDays: 7,
    };
  }

  const supabaseUrl = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const response = await fetchWithTimeout(
    `${supabaseUrl}/rest/v1/member_sync_settings?select=evo_api_authorization,sync_mode,recent_days&id=eq.true&limit=1`,
    { headers: { apikey: requiredEnv("SUPABASE_SECRET_KEY") }, cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Failed to load EVO API credential: HTTP ${response.status}`);
  const settings = (await response.json()) as Array<{
    evo_api_authorization?: string | null;
    sync_mode?: MemberSyncMode | null;
    recent_days?: number | null;
  }>;
  const authorization = settings[0]?.evo_api_authorization?.trim();
  if (!authorization) {
    throw new Error("Configure a chave de acesso da API EVO em Configurações > API de clientes");
  }
  return {
    authorization,
    syncMode: settings[0]?.sync_mode === "recent" ? "recent" : "full",
    recentDays: Math.max(1, Math.min(30, Number(settings[0]?.recent_days ?? 7) || 7)),
  };
}

async function upsertMembers(members: Member[]) {
  const supabaseUrl = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const secretKey = requiredEnv("SUPABASE_SECRET_KEY");
  const ignoredColumns = new Set<string>();

  for (let start = 0; start < members.length; start += UPSERT_BATCH_SIZE) {
    let batch = members.slice(start, start + UPSERT_BATCH_SIZE).map((member) => {
      const sanitized = { ...member };
      ignoredColumns.forEach((column) => {
        delete sanitized[column];
      });
      return sanitized;
    });

    let saved = false;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await fetchWithTimeout(`${supabaseUrl}/rest/v1/members?on_conflict=idMember`, {
        method: "POST",
        headers: {
          apikey: secretKey,
          "content-type": "application/json",
          prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(batch),
      });
      if (response.ok) {
        saved = true;
        break;
      }

      const body = await response.text();
      const missingColumn = body.match(/Could not find the '([^']+)' column/)?.[1];
      if (response.status === 400 && missingColumn) {
        ignoredColumns.add(missingColumn);
        batch = batch.map((member) => {
          const sanitized = { ...member };
          delete sanitized[missingColumn];
          return sanitized;
        });
        continue;
      }

      throw new Error(`Supabase returned HTTP ${response.status}: ${body.slice(0, 300)}`);
    }
    if (!saved) {
      throw new Error("Supabase returned too many unknown member columns in the same batch");
    }
  }
}

async function getExistingMemberIds() {
  const supabaseUrl = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const secretKey = requiredEnv("SUPABASE_SECRET_KEY");
  const ids = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const response = await fetchWithTimeout(
      `${supabaseUrl}/rest/v1/members?select=idMember&offset=${from}&limit=1000`,
      { headers: { apikey: secretKey }, cache: "no-store" },
    );
    if (!response.ok) throw new Error(`Failed to read existing members: HTTP ${response.status}`);
    const rows = (await response.json()) as Array<{ idMember: string | number }>;
    rows.forEach((row) => ids.add(String(row.idMember)));
    if (rows.length < 1000) return ids;
  }
}

async function recordHistory(entry: Record<string, unknown>) {
  const supabaseUrl = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const response = await fetch(`${supabaseUrl}/rest/v1/member_sync_history`, {
    method: "POST",
    headers: {
      apikey: requiredEnv("SUPABASE_SECRET_KEY"),
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: JSON.stringify(entry),
  });
  if (!response.ok) throw new Error(`Failed to record sync history: HTTP ${response.status}`);
}

export const Route = createFileRoute("/api/sync-members")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        if (origin && new URL(origin).host !== new URL(request.url).host) {
          return Response.json({ error: "Origin not allowed" }, { status: 403 });
        }

        const startedAt = Date.now();
        const startedAtIso = new Date(startedAt).toISOString();
        const url = new URL(request.url);
        const trigger =
          url.searchParams.get("trigger") === "scheduled" ? "scheduled" : "manual";
        const requestedMode = url.searchParams.get("mode");
        try {
          const settings = await getMemberSyncSettings();
          const mode: MemberSyncMode =
            requestedMode === "recent" ? "recent" : requestedMode === "full" ? "full" : settings.syncMode;
          const [members, existingIds] = await Promise.all([
            collectMembers(mode, settings.recentDays, settings.authorization),
            getExistingMemberIds(),
          ]);
          if (!members.length && mode === "full")
            throw new Error("EVO API returned no members; Supabase was not changed");
          const newMembers = members.filter(
            (member) => !existingIds.has(String(member.idMember)),
          ).length;
          if (members.length) await upsertMembers(members);
          await recordHistory({
            started_at: startedAtIso,
            finished_at: new Date().toISOString(),
            trigger_type: trigger,
            status: "success",
            total_fetched: members.length,
            new_members: newMembers,
            duration_ms: Date.now() - startedAt,
          });
          return Response.json({
            ok: true,
            synchronized: members.length,
            newMembers,
            mode,
            trigger,
            durationMs: Date.now() - startedAt,
            finishedAt: new Date().toISOString(),
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to synchronize members";
          try {
            await recordHistory({
              started_at: startedAtIso,
              finished_at: new Date().toISOString(),
              trigger_type: trigger,
              status: "error",
              duration_ms: Date.now() - startedAt,
              error_message: message.slice(0, 1000),
            });
          } catch {
            // The original synchronization error is more useful to the caller.
          }
          return Response.json({ error: message }, { status: 502 });
        }
      },
    },
  },
});
