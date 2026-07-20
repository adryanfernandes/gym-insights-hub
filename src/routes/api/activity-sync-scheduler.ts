import { createFileRoute } from "@tanstack/react-router";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export const Route = createFileRoute("/api/activity-sync-scheduler")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        try {
          const baseUrl = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
          const headers = { apikey: requiredEnv("SUPABASE_SECRET_KEY") };
          const settingsResponse = await fetch(
            `${baseUrl}/rest/v1/activity_sync_settings?select=*&id=eq.true&limit=1`,
            { headers, cache: "no-store" },
          );
          if (!settingsResponse.ok) throw new Error("Activity sync settings table is unavailable");
          const settings = (await settingsResponse.json())[0] as
            | {
                enabled: boolean;
                interval_hours: number;
                schedule_updated_at?: string;
                updated_at: string;
              }
            | undefined;
          if (!settings?.enabled) return Response.json({ ok: true, action: "disabled" });

          const historyResponse = await fetch(
            `${baseUrl}/rest/v1/activity_sync_history?select=finished_at&status=eq.success&order=finished_at.desc&limit=1`,
            { headers, cache: "no-store" },
          );
          const last = historyResponse.ok
            ? ((await historyResponse.json())[0] as { finished_at?: string } | undefined)
            : undefined;
          const lastSuccessAt = last?.finished_at ? new Date(last.finished_at).getTime() : 0;
          const scheduleUpdatedAt = new Date(
            settings.schedule_updated_at || settings.updated_at,
          ).getTime();
          if (
            Date.now() - Math.max(lastSuccessAt, scheduleUpdatedAt) <
            settings.interval_hours * 3600000
          ) {
            return Response.json({ ok: true, action: "not-due" });
          }

          const syncUrl = new URL("/api/sync-activities?trigger=scheduled", request.url);
          const response = await fetch(syncUrl, {
            method: "POST",
            headers: { origin: new URL(request.url).origin },
          });
          return new Response(await response.text(), {
            status: response.status,
            headers: { "content-type": "application/json" },
          });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Scheduled activity sync failed" },
            { status: 502 },
          );
        }
      },
    },
  },
});
