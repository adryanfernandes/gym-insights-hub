import { createFileRoute } from "@tanstack/react-router";

type SettingsRow = {
  enabled: boolean;
  interval_minutes?: number;
  interval_hours?: number;
  schedule_updated_at?: string | null;
  updated_at?: string | null;
};

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function timedFetch(url: string, init: RequestInit, timeoutMs = 120000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function minutes(settings: SettingsRow) {
  const value = Number(settings.interval_minutes ?? (settings.interval_hours ?? 24) * 60);
  if (!Number.isFinite(value)) return 1440;
  return Math.max(1, Math.min(43200, Math.round(value)));
}

export const Route = createFileRoute("/api/sales-sync-scheduler")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret) {
          const auth = request.headers.get("authorization");
          if (auth !== `Bearer ${cronSecret}`) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }
        }
        try {
          const base = env("SUPABASE_URL").replace(/\/$/, "");
          const key = env("SUPABASE_SECRET_KEY");
          const settingsResponse = await fetch(
            `${base}/rest/v1/sales_sync_settings?select=*&id=eq.true&limit=1`,
            { headers: { apikey: key }, cache: "no-store" },
          );
          if (!settingsResponse.ok) {
            throw new Error(`Falha ao carregar agendamento: ${await settingsResponse.text()}`);
          }
          const settings = ((await settingsResponse.json())[0] as SettingsRow | undefined) ?? {
            enabled: true,
            interval_minutes: 1440,
          };
          if (settings.enabled === false) return Response.json({ ok: true, skipped: "disabled" });

          const historyResponse = await fetch(
            `${base}/rest/v1/sales_sync_history?select=finished_at,status&status=eq.success&order=finished_at.desc&limit=1`,
            { headers: { apikey: key }, cache: "no-store" },
          );
          if (!historyResponse.ok) {
            throw new Error(`Falha ao carregar histórico: ${await historyResponse.text()}`);
          }
          const lastSuccess = (await historyResponse.json())[0] as
            | { finished_at?: string }
            | undefined;
          const anchor = Math.max(
            lastSuccess?.finished_at ? new Date(lastSuccess.finished_at).getTime() : 0,
            settings.schedule_updated_at ? new Date(settings.schedule_updated_at).getTime() : 0,
            settings.updated_at ? new Date(settings.updated_at).getTime() : 0,
          );
          const dueAt = anchor + minutes(settings) * 60000;
          if (Date.now() < dueAt) {
            return Response.json({ ok: true, skipped: "not_due", dueAt: new Date(dueAt).toISOString() });
          }

          const origin = new URL(request.url).origin;
          const response = await timedFetch(`${origin}/api/sync-sales?trigger=scheduled`, {
            method: "POST",
            headers: { Accept: "application/json" },
            cache: "no-store",
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(result?.error || `HTTP ${response.status}`);
          }
          return Response.json({ ok: true, result });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha no agendamento de vendas.";
          return Response.json({ error: message }, { status: 502 });
        }
      },
    },
  },
});
