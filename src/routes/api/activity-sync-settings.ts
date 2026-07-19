import { createFileRoute } from "@tanstack/react-router";

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing Supabase configuration");
  return { url, headers: { apikey: key, "content-type": "application/json" } };
}

function publicSettings(settings?: Record<string, unknown>) {
  if (!settings) return null;
  return {
    id: settings.id,
    enabled: settings.enabled,
    interval_hours: settings.interval_hours,
    updated_at: settings.updated_at,
    schedule_updated_at: settings.schedule_updated_at,
    has_api_credential: Boolean(settings.evo_api_authorization),
  };
}

export const Route = createFileRoute("/api/activity-sync-settings")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { url, headers } = config();
          const [settingsResponse, historyResponse, memberSettingsResponse] = await Promise.all([
            fetch(`${url}/rest/v1/activity_sync_settings?select=*&id=eq.true&limit=1`, {
              headers,
              cache: "no-store",
            }),
            fetch(`${url}/rest/v1/activity_sync_history?select=*&order=finished_at.desc&limit=30`, {
              headers,
              cache: "no-store",
            }),
            fetch(
              `${url}/rest/v1/member_sync_settings?select=evo_api_authorization&id=eq.true&limit=1`,
              {
                headers,
                cache: "no-store",
              },
            ),
          ]);
          if (!settingsResponse.ok || !historyResponse.ok) {
            throw new Error("Tabelas de atividades indisponíveis; aplique a migration do Supabase");
          }
          const settings = (await settingsResponse.json()) as Array<Record<string, unknown>>;
          const memberSettings = memberSettingsResponse.ok
            ? ((await memberSettingsResponse.json()) as Array<Record<string, unknown>>)
            : [];
          const safeSettings = publicSettings(settings[0]);
          return Response.json({
            settings: safeSettings
              ? {
                  ...safeSettings,
                  has_api_credential:
                    safeSettings.has_api_credential ||
                    Boolean(memberSettings[0]?.evo_api_authorization),
                }
              : null,
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
            apiCredential?: string;
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
          if (scheduleChanged) updates.schedule_updated_at = changedAt;
          if (typeof input.apiCredential === "string" && input.apiCredential.trim()) {
            const credential = input.apiCredential.trim();
            updates.evo_api_authorization = credential.startsWith("Basic ")
              ? credential
              : `Basic ${credential}`;
          }
          const response = await fetch(`${url}/rest/v1/activity_sync_settings?id=eq.true`, {
            method: "PATCH",
            headers: { ...headers, prefer: "return=representation" },
            body: JSON.stringify(updates),
          });
          if (!response.ok) throw new Error(await response.text());
          const settings = (await response.json())[0] as Record<string, unknown>;
          return Response.json({ settings: publicSettings(settings) });
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
