import { createFileRoute } from "@tanstack/react-router";

const ACTIVITIES_URL = "https://evo-integracao-api.w12app.com.br/api/v1/activities/schedule";
const ACTIVITY_DETAIL_URL = `${ACTIVITIES_URL}/detail`;
const UPSERT_BATCH_SIZE = 100;
const DETAIL_CONCURRENCY = 8;
type Activity = Record<string, unknown>;
type ActivityQueueSettings = {
  next_query_date?: string | null;
  cycle_month?: string | null;
  last_attempt_at?: string | null;
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

function extractActivities(payload: unknown): Activity[] {
  if (Array.isArray(payload)) return payload.filter(isObject);
  if (!isObject(payload)) return [];
  for (const key of ["data", "items", "activities", "results"]) {
    const value = payload[key];
    if (Array.isArray(value)) return value.filter(isObject);
  }
  return [];
}

function isObject(value: unknown): value is Activity {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

async function sourceKey(date: string, activity: Activity) {
  const id = ["idSchedule", "idActivitySchedule", "idClass"].find(
    (key) => activity[key] !== undefined && activity[key] !== null,
  );
  const identity = id
    ? `${id}:${String(activity[id])}`
    : stableStringify({
        activity: activity.activity ?? activity.name ?? activity.title,
        activityId: activity.idActivity ?? activity.id,
        start: activity.startTime ?? activity.startDate ?? activity.date,
        end: activity.endTime ?? activity.endDate,
        room: activity.idStudio ?? activity.idRoom ?? activity.studio,
        instructor: activity.idEmployee ?? activity.idInstructor ?? activity.instructor,
      });
  const bytes = new TextEncoder().encode(`${date}:${identity}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function currentMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { year, month, days };
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function fortalezaToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

function addIsoDays(date: string, days: number) {
  const parsed = new Date(`${date}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function priorityActivityDates() {
  const today = fortalezaToday();
  return Array.from({ length: 6 }, (_, index) => addIsoDays(today, index));
}

function fortalezaDateFromIso(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

function nextActivityQueueDate(queryDate: string, priorityDates: string[], monthStart: string) {
  const priorityIndex = priorityDates.indexOf(queryDate);
  if (priorityIndex >= 0) {
    return priorityDates[priorityIndex + 1] ?? monthStart;
  }
  return null;
}

async function getAuthorization() {
  if (process.env.EVO_API_AUTHORIZATION) return process.env.EVO_API_AUTHORIZATION;
  const url = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const headers = { apikey: requiredEnv("SUPABASE_SECRET_KEY") };
  const activityResponse = await fetch(
    `${url}/rest/v1/activity_sync_settings?select=evo_api_authorization&id=eq.true&limit=1`,
    { headers, cache: "no-store" },
  );
  if (!activityResponse.ok) throw new Error("Falha ao carregar a chave da API de atividades");
  const activitySettings = (await activityResponse.json()) as Array<{
    evo_api_authorization?: string;
  }>;
  if (activitySettings[0]?.evo_api_authorization?.trim()) {
    return activitySettings[0].evo_api_authorization.trim();
  }

  const memberResponse = await fetch(
    `${url}/rest/v1/member_sync_settings?select=evo_api_authorization&id=eq.true&limit=1`,
    { headers, cache: "no-store" },
  );
  const memberSettings = memberResponse.ok
    ? ((await memberResponse.json()) as Array<{ evo_api_authorization?: string }>)
    : [];
  if (memberSettings[0]?.evo_api_authorization?.trim()) {
    return memberSettings[0].evo_api_authorization.trim();
  }
  throw new Error("Configure a chave de acesso na aba API de atividades");
}

async function fetchDay(date: string, authorization: string, branchId: number) {
  const url = new URL(process.env.EVO_ACTIVITIES_URL || ACTIVITIES_URL);
  url.searchParams.set("idBranch", String(branchId));
  url.searchParams.set("take", "1000");
  url.searchParams.set("date", `${date}T00:00:00`);
  url.searchParams.set("showFullWeek", "false");
  url.searchParams.set("onlyAvailables", "false");

  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url.toString(), {
        headers: { Authorization: authorization, Accept: "application/json" },
        cache: "no-store",
      });
      const body = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.slice(0, 300)}`);
      return extractActivities(JSON.parse(body));
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Falha desconhecida";
    }
  }
  throw new Error(`Falha ao consultar ${date} após 3 tentativas: ${lastError}`);
}

function enrollmentSummary(detail: Activity) {
  const enrollments = Array.isArray(detail.enrollments)
    ? detail.enrollments.filter(isObject).filter((row) => row.removed !== true)
    : [];
  return {
    total: enrollments.length,
    present: enrollments.filter((row) => Number(row.status) === 0).length,
    absent: enrollments.filter((row) => Number(row.status) === 1).length,
    justified_absence: enrollments.filter(
      (row) => Number(row.status) === 2 || row.justifiedAbsence === true,
    ).length,
  };
}

function enrollmentParticipants(detail: Activity) {
  const enrollments = Array.isArray(detail.enrollments)
    ? detail.enrollments.filter(isObject).filter((row) => row.removed !== true)
    : [];
  return enrollments.map((row, index) => {
    const firstName =
      typeof (row.firstName ?? row.registerName) === "string"
        ? String(row.firstName ?? row.registerName).trim()
        : "";
    const lastName =
      typeof (row.lastName ?? row.registerLastName) === "string"
        ? String(row.lastName ?? row.registerLastName).trim()
        : "";
    const name =
      [firstName, lastName].filter(Boolean).join(" ") ||
      String(row.name ?? row.memberName ?? row.studentName ?? row.personName ?? "Aluno sem nome");
    return {
      id: String(row.idMember ?? row.memberId ?? row.idPerson ?? row.id ?? index + 1),
      name,
      status: row.status ?? null,
    };
  });
}

async function fetchDetail(activity: Activity, activityDate: string, authorization: string) {
  const idConfiguration = activity.idConfiguration;
  const idActivitySession = activity.idActivitySession;
  if (idConfiguration === undefined && idActivitySession === undefined) return activity;

  const url = new URL(process.env.EVO_ACTIVITY_DETAIL_URL || ACTIVITY_DETAIL_URL);
  if (
    idActivitySession !== undefined &&
    idActivitySession !== null &&
    Number(idActivitySession) > 0
  ) {
    url.searchParams.set("idActivitySession", String(idActivitySession));
  } else {
    url.searchParams.set("idConfiguration", String(idConfiguration));
    url.searchParams.set("activityDate", `${activityDate}T00:00:00`);
  }

  try {
    const response = await fetchWithTimeout(
      url.toString(),
      {
        headers: { Authorization: authorization, Accept: "application/json" },
        cache: "no-store",
      },
      30000,
    );
    if (!response.ok) return activity;
    const detail = (await response.json()) as unknown;
    if (!isObject(detail)) return activity;
    return {
      ...activity,
      idActivitySession: detail.idActivitySession ?? activity.idActivitySession,
      enrollmentSummary: enrollmentSummary(detail),
      enrollments: enrollmentParticipants(detail),
    };
  } catch {
    return activity;
  }
}

async function enrichActivities(
  activities: Activity[],
  activityDate: string,
  authorization: string,
) {
  const enriched: Activity[] = [];
  for (let start = 0; start < activities.length; start += DETAIL_CONCURRENCY) {
    enriched.push(
      ...(await Promise.all(
        activities
          .slice(start, start + DETAIL_CONCURRENCY)
          .map((activity) => fetchDetail(activity, activityDate, authorization)),
      )),
    );
  }
  return enriched;
}

async function existingKeys(keys: string[]) {
  if (!keys.length) return new Set<string>();
  const url = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const headers = { apikey: requiredEnv("SUPABASE_SECRET_KEY") };
  const existing = new Set<string>();
  for (let start = 0; start < keys.length; start += 100) {
    const values = keys
      .slice(start, start + 100)
      .map(encodeURIComponent)
      .join(",");
    const response = await fetch(
      `${url}/rest/v1/activities?select=source_key&source_key=in.(${values})`,
      {
        headers,
        cache: "no-store",
      },
    );
    if (!response.ok)
      throw new Error(`Falha ao consultar atividades existentes: ${await response.text()}`);
    const rows = (await response.json()) as Array<{ source_key: string }>;
    rows.forEach((row) => existing.add(row.source_key));
  }
  return existing;
}

async function upsertActivities(rows: Record<string, unknown>[]) {
  const url = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const key = requiredEnv("SUPABASE_SECRET_KEY");
  for (let start = 0; start < rows.length; start += UPSERT_BATCH_SIZE) {
    const response = await fetchWithTimeout(`${url}/rest/v1/activities?on_conflict=source_key`, {
      method: "POST",
      headers: {
        apikey: key,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows.slice(start, start + UPSERT_BATCH_SIZE)),
    });
    if (!response.ok)
      throw new Error(
        `Supabase returned HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`,
      );
  }
}

async function hasSavedParticipantsForDate(date: string) {
  const url = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const response = await fetch(
    `${url}/rest/v1/activities?select=payload&query_date=eq.${date}&limit=1000`,
    {
      headers: { apikey: requiredEnv("SUPABASE_SECRET_KEY") },
      cache: "no-store",
    },
  );
  if (!response.ok) return false;
  const rows = (await response.json()) as Array<{ payload?: unknown }>;
  return rows.some((row) => {
    if (!isObject(row.payload)) return false;
    return Array.isArray(row.payload.enrollments) && row.payload.enrollments.length > 0;
  });
}

async function recordHistory(entry: Record<string, unknown>) {
  const url = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const response = await fetch(`${url}/rest/v1/activity_sync_history`, {
    method: "POST",
    headers: {
      apikey: requiredEnv("SUPABASE_SECRET_KEY"),
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: JSON.stringify(entry),
  });
  if (!response.ok) throw new Error(`Falha ao registrar histórico: ${await response.text()}`);
}

async function loadQueueSettings() {
  const url = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const response = await fetch(
    `${url}/rest/v1/activity_sync_settings?select=next_query_date,cycle_month,last_attempt_at&id=eq.true&limit=1`,
    {
      headers: { apikey: requiredEnv("SUPABASE_SECRET_KEY") },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`Falha ao carregar a fila de atividades: ${await response.text()}`);
  }
  return ((await response.json())[0] ?? {}) as ActivityQueueSettings;
}

async function updateQueueSettings(updates: Record<string, unknown>) {
  const url = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const response = await fetch(`${url}/rest/v1/activity_sync_settings?id=eq.true`, {
    method: "PATCH",
    headers: {
      apikey: requiredEnv("SUPABASE_SECRET_KEY"),
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    throw new Error(`Falha ao atualizar a fila de atividades: ${await response.text()}`);
  }
}

export const Route = createFileRoute("/api/sync-activities")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        if (origin && new URL(origin).host !== new URL(request.url).host) {
          return Response.json({ error: "Origin not allowed" }, { status: 403 });
        }
        const startedAt = Date.now();
        const startedAtIso = new Date(startedAt).toISOString();
        const trigger =
          new URL(request.url).searchParams.get("trigger") === "scheduled" ? "scheduled" : "manual";
        const { year, month, days } = currentMonth();
        const monthStart = isoDate(year, month, 1);
        const monthEnd = isoDate(year, month, days);
        const priorityDates = priorityActivityDates();
        const today = priorityDates[0] ?? monthStart;
        let queryDate = priorityDates[0] ?? monthStart;
        let daysQueried = 0;
        try {
          const queue = await loadQueueSettings();
          await updateQueueSettings({ last_attempt_at: startedAtIso });
          const queuedDate = queue.next_query_date?.slice(0, 10);
          const queuedMonth = queue.cycle_month?.slice(0, 10);
          const lastAttemptDate = fortalezaDateFromIso(queue.last_attempt_at);
          const todayHasParticipants = await hasSavedParticipantsForDate(today);
          if (queuedDate && priorityDates.includes(queuedDate)) {
            queryDate = queuedDate;
          } else if (!todayHasParticipants) {
            queryDate = today;
          } else if (lastAttemptDate !== today) {
            queryDate = today;
          } else if (
            queuedMonth === monthStart &&
            queuedDate &&
            queuedDate >= monthStart &&
            queuedDate <= monthEnd
          ) {
            queryDate = queuedDate;
          }
          const authorization = await getAuthorization();
          const branchId = Number(process.env.EVO_BRANCH_ID || "1");
          const rows: Record<string, unknown>[] = [];
          const schedule = await fetchDay(queryDate, authorization, branchId);
          const activities = await enrichActivities(schedule, queryDate, authorization);
          daysQueried = 1;
          for (const activity of activities) {
            rows.push({
              source_key: await sourceKey(queryDate, activity),
              query_date: queryDate,
              branch_id: branchId,
              payload: activity,
              last_synced_at: new Date().toISOString(),
            });
          }
          const uniqueRows = Array.from(
            new Map(rows.map((row) => [String(row.source_key), row])).values(),
          );
          const currentKeys = await existingKeys(uniqueRows.map((row) => String(row.source_key)));
          const newActivities = uniqueRows.filter(
            (row) => !currentKeys.has(String(row.source_key)),
          ).length;
          await upsertActivities(uniqueRows);
          const finishedAt = new Date().toISOString();
          const currentDay = Number(queryDate.slice(8, 10));
          const priorityNextDate = nextActivityQueueDate(queryDate, priorityDates, monthStart);
          const isMonthlyQuery = queryDate >= monthStart && queryDate <= monthEnd;
          const cycleCompleted = isMonthlyQuery && currentDay >= days;
          const nextQueryDate =
            priorityNextDate ??
            (cycleCompleted ? monthStart : isoDate(year, month, currentDay + 1));
          await updateQueueSettings({
            next_query_date: nextQueryDate,
            cycle_month: monthStart,
            updated_at: finishedAt,
          });
          await recordHistory({
            started_at: startedAtIso,
            finished_at: finishedAt,
            trigger_type: trigger,
            status: "success",
            month_start: monthStart,
            month_end: monthEnd,
            query_date: queryDate,
            cycle_completed: cycleCompleted,
            days_queried: daysQueried,
            total_fetched: uniqueRows.length,
            new_activities: newActivities,
            duration_ms: Date.now() - startedAt,
          });
          return Response.json({
            ok: true,
            synchronized: uniqueRows.length,
            newActivities,
            daysQueried,
            queryDate,
            nextQueryDate,
            cycleCompleted,
            trigger,
            finishedAt,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Falha ao sincronizar atividades";
          try {
            await recordHistory({
              started_at: startedAtIso,
              finished_at: new Date().toISOString(),
              trigger_type: trigger,
              status: "error",
              month_start: monthStart,
              month_end: monthEnd,
              query_date: queryDate,
              days_queried: daysQueried,
              duration_ms: Date.now() - startedAt,
              error_message: message.slice(0, 1000),
            });
          } catch {
            /* Preserve the original error. */
          }
          return Response.json({ error: message }, { status: 502 });
        }
      },
    },
  },
});
