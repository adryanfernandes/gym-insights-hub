import { createFileRoute } from "@tanstack/react-router";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export const Route = createFileRoute("/api/member-sync-scheduler")({
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
            `${baseUrl}/rest/v1/member_sync_settings?select=*&id=eq.true&limit=1`,
            { headers, cache: "no-store" },
          );
          if (!settingsResponse.ok) throw new Error("Member sync settings table is unavailable");
          const settings = (await settingsResponse.json())[0] as
            | { enabled: boolean; interval_hours: number }
            | undefined;
          if (!settings?.enabled) return Response.json({ ok: true, action: "disabled" });

          const historyResponse = await fetch(
            `${baseUrl}/rest/v1/member_sync_history?select=finished_at&status=eq.success&order=finished_at.desc&limit=1`,
            { headers, cache: "no-store" },
          );
          const last = historyResponse.ok
            ? ((await historyResponse.json())[0] as { finished_at?: string } | undefined)
            : undefined;
          const elapsed = last?.finished_at
            ? Date.now() - new Date(last.finished_at).getTime()
            : Infinity;
          if (elapsed < settings.interval_hours * 60 * 60 * 1000) {
            return Response.json({ ok: true, action: "not-due" });
          }

          const syncUrl = new URL("/api/sync-members?trigger=scheduled", request.url);
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
            { error: error instanceof Error ? error.message : "Scheduled sync failed" },
            { status: 502 },
          );
        }
      },
    },
  },
});
