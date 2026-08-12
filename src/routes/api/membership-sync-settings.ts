import { createFileRoute } from "@tanstack/react-router";

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing Supabase configuration");
  return { url, headers: { apikey: key, "content-type": "application/json" } };
}

type MembershipProgress = {
  phase: "recurring" | "members";
  total: number;
  checked: number;
  remaining: number;
  recurring_total: number;
  recurring_checked: number;
  recurring_remaining: number;
  member_total: number;
};

function safe(
  settings?: Record<string, unknown>,
  inheritedCredential = false,
  progress?: MembershipProgress,
) {
  const intervalMinutes =
    typeof settings?.interval_minutes === "number"
      ? settings.interval_minutes
      : Math.max(1, Number(settings?.interval_hours ?? 24) * 60);
  return settings
    ? {
        id: settings.id,
        enabled: settings.enabled,
        interval_hours: settings.interval_hours,
        interval_minutes: intervalMinutes,
        updated_at: settings.updated_at,
        schedule_updated_at: settings.schedule_updated_at,
        next_skip: settings.next_skip,
        next_member_offset: settings.next_member_offset ?? 0,
        progress,
        has_api_credential: Boolean(settings.evo_api_authorization) || inheritedCredential,
      }
    : null;
}

function countFromContentRange(contentRange: string | null) {
  const total = Number(contentRange?.split("/")?.[1]);
  return Number.isFinite(total) ? total : 0;
}

async function countRows(url: string, headers: Record<string, string>, path: string) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { ...headers, prefer: "count=exact" },
    cache: "no-store",
  });
  if (!response.ok) return 0;
  return countFromContentRange(response.headers.get("content-range"));
}

async function membershipProgress(
  url: string,
  headers: Record<string, string>,
  settings?: Record<string, unknown>,
) {
  const [memberTotal, recurringTotal, recurringRemaining] = await Promise.all([
    countRows(url, headers, "members?select=idMember&limit=0"),
    countRows(url, headers, "membership_recurring_members?select=id_member&limit=0"),
    countRows(
      url,
      headers,
      "membership_recurring_members?select=id_member&priority_sync_count=lt.2&limit=0",
    ),
  ]);
  const recurringChecked = Math.max(0, recurringTotal - recurringRemaining);
  const memberOffset = Math.max(0, Number(settings?.next_member_offset ?? 0));

  if (recurringRemaining > 0) {
    return {
      phase: "recurring" as const,
      total: recurringTotal,
      checked: recurringChecked,
      remaining: recurringRemaining,
      recurring_total: recurringTotal,
      recurring_checked: recurringChecked,
      recurring_remaining: recurringRemaining,
      member_total: memberTotal,
    };
  }

  const memberQueueTotal = Math.max(0, memberTotal - recurringTotal);
  const checked = Math.min(memberOffset, memberQueueTotal || memberTotal);
  const total = memberQueueTotal || memberTotal;
  return {
    phase: "members" as const,
    total,
    checked,
    remaining: Math.max(0, total - checked),
    recurring_total: recurringTotal,
    recurring_checked: recurringChecked,
    recurring_remaining: recurringRemaining,
    member_total: memberTotal,
  };
}

export const Route = createFileRoute("/api/membership-sync-settings")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { url, headers } = config();
          const [
            settingsResponse,
            historyResponse,
            activitySettingsResponse,
            memberSettingsResponse,
          ] = await Promise.all([
            fetch(`${url}/rest/v1/membership_sync_settings?select=*&id=eq.true&limit=1`, {
              headers,
              cache: "no-store",
            }),
            fetch(
              `${url}/rest/v1/membership_sync_history?select=*&order=finished_at.desc&limit=30`,
              {
                headers,
                cache: "no-store",
              },
            ),
            fetch(
              `${url}/rest/v1/activity_sync_settings?select=evo_api_authorization&id=eq.true&limit=1`,
              {
                headers,
                cache: "no-store",
              },
            ),
            fetch(
              `${url}/rest/v1/member_sync_settings?select=evo_api_authorization&id=eq.true&limit=1`,
              {
                headers,
                cache: "no-store",
              },
            ),
          ]);
          if (!settingsResponse.ok || !historyResponse.ok) {
            throw new Error("Tabelas de contratos indisponíveis; aplique a migration do Supabase");
          }
          const settings = (await settingsResponse.json()) as Array<Record<string, unknown>>;
          const inherited = activitySettingsResponse.ok
            ? ((await activitySettingsResponse.json()) as Array<Record<string, unknown>>)
            : [];
          const memberSettings = memberSettingsResponse.ok
            ? ((await memberSettingsResponse.json()) as Array<Record<string, unknown>>)
            : [];
          const currentSettings = settings[0];
          const progress = await membershipProgress(url, headers, currentSettings);
          return Response.json({
            settings: safe(
              currentSettings,
              Boolean(
                inherited[0]?.evo_api_authorization || memberSettings[0]?.evo_api_authorization,
              ),
              progress,
            ),
            history: await historyResponse.json(),
          });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Falha ao carregar configurações" },
            { status: 500 },
          );
        }
      },
      PATCH: async ({ request }) => {
        try {
          const origin = request.headers.get("origin");
          if (origin && new URL(origin).host !== new URL(request.url).host) {
            return Response.json({ error: "Origin not allowed" }, { status: 403 });
          }
          const input = (await request.json()) as {
            enabled?: boolean;
            intervalHours?: number;
            intervalMinutes?: number;
            apiCredential?: string;
            restartCycle?: boolean;
          };
          const { url, headers } = config();
          const changedAt = new Date().toISOString();
          const updates: Record<string, unknown> = { updated_at: changedAt };
          let scheduleChanged = false;
          if (typeof input.enabled === "boolean") {
            updates.enabled = input.enabled;
            scheduleChanged = true;
          }
          if (typeof input.intervalHours === "number") {
            updates.interval_hours = Math.max(1, Math.min(720, Math.round(input.intervalHours)));
            scheduleChanged = true;
          }
          if (typeof input.intervalMinutes === "number") {
            const minutes = Math.max(1, Math.min(43200, Math.round(input.intervalMinutes)));
            updates.interval_minutes = minutes;
            updates.interval_hours = Math.max(1, Math.ceil(minutes / 60));
            scheduleChanged = true;
          }
          if (scheduleChanged) updates.schedule_updated_at = changedAt;
          if (input.restartCycle) {
            updates.next_skip = 0;
            updates.next_member_offset = 0;
          }
          if (typeof input.apiCredential === "string" && input.apiCredential.trim()) {
            const credential = input.apiCredential.trim();
            updates.evo_api_authorization = credential.startsWith("Basic ")
              ? credential
              : `Basic ${credential}`;
          }
          const response = await fetch(`${url}/rest/v1/membership_sync_settings?id=eq.true`, {
            method: "PATCH",
            headers: { ...headers, prefer: "return=representation" },
            body: JSON.stringify(updates),
          });
          if (!response.ok) throw new Error(await response.text());
          return Response.json({ settings: safe((await response.json())[0]) });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Falha ao salvar configurações" },
            { status: 500 },
          );
        }
      },
    },
  },
});
