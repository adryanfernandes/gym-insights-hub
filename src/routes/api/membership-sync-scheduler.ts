import { createFileRoute } from "@tanstack/react-router";

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export const Route = createFileRoute("/api/membership-sync-scheduler")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        try {
          const base = env("SUPABASE_URL").replace(/\/$/, "");
          const headers = { apikey: env("SUPABASE_SECRET_KEY") };
          const settingsResponse = await fetch(
            `${base}/rest/v1/membership_sync_settings?select=*&id=eq.true&limit=1`,
            { headers, cache: "no-store" },
          );
          if (!settingsResponse.ok) throw new Error("Membership settings unavailable");
          const settings = (await settingsResponse.json())[0] as
            | {
                enabled: boolean;
                interval_hours: number;
                interval_minutes?: number;
                schedule_updated_at: string;
                updated_at: string;
              }
            | undefined;
          if (!settings?.enabled) return Response.json({ ok: true, action: "disabled" });
          const historyResponse = await fetch(
            `${base}/rest/v1/membership_sync_history?select=finished_at&status=eq.success&order=finished_at.desc&limit=1`,
            { headers, cache: "no-store" },
          );
          const last = historyResponse.ok
            ? ((await historyResponse.json())[0] as { finished_at?: string } | undefined)
            : undefined;
          const anchor = Math.max(
            last?.finished_at ? new Date(last.finished_at).getTime() : 0,
            new Date(settings.schedule_updated_at || settings.updated_at).getTime(),
          );
          const intervalMinutes =
            typeof settings.interval_minutes === "number"
              ? settings.interval_minutes
              : Math.max(1, Number(settings.interval_hours ?? 24) * 60);
          if (Date.now() - anchor < intervalMinutes * 60000) {
            return Response.json({ ok: true, action: "not-due" });
          }
          const response = await fetch(
            new URL("/api/sync-memberships?trigger=scheduled", request.url),
            {
              method: "POST",
              headers: { origin: new URL(request.url).origin },
            },
          );
          return new Response(await response.text(), {
            status: response.status,
            headers: { "content-type": "application/json" },
          });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Scheduled membership sync failed" },
            { status: 502 },
          );
        }
      },
    },
  },
});
