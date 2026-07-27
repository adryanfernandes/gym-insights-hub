import { createFileRoute } from "@tanstack/react-router";

type SettingsRow = {
  id: boolean;
  enabled: boolean;
  interval_hours: number;
  interval_minutes?: number;
  evo_api_authorization?: string | null;
  next_skip?: number;
  updated_at?: string;
  schedule_updated_at?: string;
};

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function normalizeCredential(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.toLowerCase().startsWith("basic ") ? trimmed : `Basic ${trimmed}`;
}

function normalizeIntervalHours(value: unknown) {
  const hours = Number(value);
  if (!Number.isFinite(hours)) return null;
  return Math.max(1, Math.min(720, Math.round(hours)));
}

function normalizeIntervalMinutes(value: unknown) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return null;
  return Math.max(1, Math.min(43200, Math.round(minutes)));
}

async function inheritedCredential(base: string, key: string) {
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
  return "";
}

function safe(settings: SettingsRow | undefined, credential: string) {
  return {
    id: settings?.id ?? true,
    enabled: settings?.enabled ?? true,
    interval_hours: settings?.interval_hours ?? 24,
    interval_minutes: settings?.interval_minutes ?? (settings?.interval_hours ?? 24) * 60,
    updated_at: settings?.updated_at ?? null,
    schedule_updated_at: settings?.schedule_updated_at ?? settings?.updated_at ?? null,
    next_skip: settings?.next_skip ?? 0,
    has_api_credential: Boolean(settings?.evo_api_authorization?.trim() || credential),
  };
}

async function loadSettings(base: string, key: string) {
  const response = await fetch(
    `${base}/rest/v1/sales_sync_settings?select=*&id=eq.true&limit=1`,
    { headers: { apikey: key }, cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Falha ao carregar configurações: ${await response.text()}`);
  return (await response.json())[0] as SettingsRow | undefined;
}

async function loadHistory(base: string, key: string) {
  const response = await fetch(
    `${base}/rest/v1/sales_sync_history?select=*&order=finished_at.desc&limit=30`,
    { headers: { apikey: key }, cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Falha ao carregar histórico: ${await response.text()}`);
  return response.json();
}

export const Route = createFileRoute("/api/sales-sync-settings")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const base = env("SUPABASE_URL").replace(/\/$/, "");
          const key = env("SUPABASE_SECRET_KEY");
          const [settings, credential, history] = await Promise.all([
            loadSettings(base, key),
            inheritedCredential(base, key),
            loadHistory(base, key),
          ]);
          return Response.json({ settings: safe(settings, credential), history });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha ao carregar vendas.";
          return Response.json({ error: message }, { status: 500 });
        }
      },
      PATCH: async ({ request }) => {
        try {
          const base = env("SUPABASE_URL").replace(/\/$/, "");
          const key = env("SUPABASE_SECRET_KEY");
          const body = (await request.json().catch(() => ({}))) as {
            enabled?: boolean;
            intervalHours?: number;
            intervalMinutes?: number;
            apiCredential?: string;
            restartCycle?: boolean;
          };
          const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (typeof body.enabled === "boolean") update.enabled = body.enabled;
          const minutes = normalizeIntervalMinutes(body.intervalMinutes);
          const hours = normalizeIntervalHours(body.intervalHours);
          if (minutes) {
            update.interval_minutes = minutes;
            update.interval_hours = Math.max(1, Math.ceil(minutes / 60));
            update.schedule_updated_at = new Date().toISOString();
          } else if (hours) {
            update.interval_hours = hours;
            update.interval_minutes = hours * 60;
            update.schedule_updated_at = new Date().toISOString();
          }
          const credential = normalizeCredential(body.apiCredential);
          if (credential) update.evo_api_authorization = credential;
          if (body.restartCycle === true) update.next_skip = 0;

          const response = await fetch(`${base}/rest/v1/sales_sync_settings?id=eq.true`, {
            method: "PATCH",
            headers: {
              apikey: key,
              "content-type": "application/json",
              prefer: "return=representation",
            },
            body: JSON.stringify(update),
          });
          const text = await response.text();
          if (!response.ok) throw new Error(text);
          const row = JSON.parse(text)[0] as SettingsRow;
          const inherited = await inheritedCredential(base, key);
          return Response.json({ settings: safe(row, inherited) });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha ao salvar vendas.";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
