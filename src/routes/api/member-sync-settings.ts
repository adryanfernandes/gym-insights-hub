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
          const settings = (await settingsResponse.json()) as unknown[];
          return Response.json({ settings: settings[0], history: await historyResponse.json() });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Failed to load sync settings" },
            { status: 500 },
          );
        }
      },
      PATCH: async ({ request }) => {
        try {
          const input = (await request.json()) as { enabled?: boolean; intervalHours?: number };
          const intervalHours = Math.max(1, Math.min(720, Math.round(input.intervalHours ?? 24)));
          const { url, headers } = config();
          const response = await fetch(`${url}/rest/v1/member_sync_settings?id=eq.true`, {
            method: "PATCH",
            headers: { ...headers, prefer: "return=representation" },
            body: JSON.stringify({
              enabled: input.enabled !== false,
              interval_hours: intervalHours,
              updated_at: new Date().toISOString(),
            }),
          });
          if (!response.ok) throw new Error(await response.text());
          return Response.json({ settings: (await response.json())[0] });
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
