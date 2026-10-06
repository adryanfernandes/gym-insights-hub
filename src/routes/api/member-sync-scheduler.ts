import { createFileRoute } from "@tanstack/react-router";
import { acquireEvoSync, releaseEvoSync } from "@/lib/evo-sync-guard";

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
            | {
                enabled: boolean;
                interval_hours: number;
                interval_minutes?: number;
                sync_mode?: "full" | "recent";
                schedule_updated_at?: string;
                updated_at: string;
              }
            | undefined;
          if (!settings?.enabled) return Response.json({ ok: true, action: "disabled" });

          const historyResponse = await fetch(
            `${baseUrl}/rest/v1/member_sync_history?select=finished_at&status=eq.success&order=finished_at.desc&limit=1`,
            { headers, cache: "no-store" },
          );
          const last = historyResponse.ok
            ? ((await historyResponse.json())[0] as { finished_at?: string } | undefined)
            : undefined;
          const lastSuccessAt = last?.finished_at ? new Date(last.finished_at).getTime() : 0;
          const scheduleUpdatedAt = new Date(
            settings.schedule_updated_at || settings.updated_at,
          ).getTime();
          const elapsed = Date.now() - Math.max(lastSuccessAt, scheduleUpdatedAt);
          const intervalMinutes = Math.max(
            1,
            Number(settings.interval_minutes ?? settings.interval_hours * 60) || 1440,
          );
          if (elapsed < intervalMinutes * 60 * 1000) {
            return Response.json({ ok: true, action: "not-due" });
          }

          const guard = await acquireEvoSync(baseUrl, requiredEnv("SUPABASE_SECRET_KEY"), "members", 3);
          if (!guard.acquired) return Response.json({ ok: true, action: "evo-busy", ...guard });
          const syncUrl = new URL("/api/sync-members?trigger=scheduled", request.url);
          const fortalezaHour = Number(
            new Intl.DateTimeFormat("en-US", { timeZone: "America/Fortaleza", hour: "2-digit", hourCycle: "h23" }).format(new Date()),
          );
          const requestedFull = settings.sync_mode !== "recent";
          syncUrl.searchParams.set("mode", requestedFull && fortalezaHour < 5 ? "full" : "recent");
          const response = await fetch(syncUrl, {
            method: "POST",
            headers: { origin: new URL(request.url).origin },
          });
          await releaseEvoSync(baseUrl, requiredEnv("SUPABASE_SECRET_KEY"), "members");
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
