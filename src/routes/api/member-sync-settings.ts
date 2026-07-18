import { createFileRoute } from "@tanstack/react-router";

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing Supabase configuration");
  return { url, headers: { apikey: key, "content-type": "application/json" } };
}

export const Route = createFileRoute("/api/member-sync-settings")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { url, headers } = config();
          const [settingsResponse, historyResponse] = await Promise.all([
            fetch(`${url}/rest/v1/member_sync_settings?select=*&id=eq.true&limit=1`, {
              headers,
              cache: "no-store",
            }),
            fetch(`${url}/rest/v1/member_sync_history?select=*&order=finished_at.desc&limit=30`, {
              headers,
              cache: "no-store",
            }),
          ]);
          if (!settingsResponse.ok || !historyResponse.ok) {
            throw new Error("Member sync tables are not available; apply the Supabase migration");
          }
          const settings = (await settingsResponse.json()) as Array<Record<string, unknown>>;
          const current = settings[0];
          return Response.json({
            settings: current
              ? {
                  id: current.id,
                  enabled: current.enabled,
                  interval_hours: current.interval_hours,
                  updated_at: current.updated_at,
                  schedule_updated_at: current.schedule_updated_at,
                  has_api_credential: Boolean(current.evo_api_authorization),
                }
              : null,
            history: await historyResponse.json(),
          });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Failed to load sync settings" },
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
          const response = await fetch(`${url}/rest/v1/member_sync_settings?id=eq.true`, {
            method: "PATCH",
            headers: { ...headers, prefer: "return=representation" },
            body: JSON.stringify(updates),
          });
          if (!response.ok) throw new Error(await response.text());
          const settings = (await response.json())[0] as Record<string, unknown>;
          return Response.json({
            settings: {
              id: settings.id,
              enabled: settings.enabled,
              interval_hours: settings.interval_hours,
              updated_at: settings.updated_at,
              schedule_updated_at: settings.schedule_updated_at,
              has_api_credential: Boolean(settings.evo_api_authorization),
            },
          });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Failed to save sync settings" },
            { status: 500 },
          );
        }
      },
    },
  },
});
