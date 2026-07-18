import { createFileRoute } from "@tanstack/react-router";

const STATUS_URL = "https://status.abcevo.app/v3/summary.json";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function captureStatus() {
  const startedAt = Date.now();
  const statusResponse = await fetch(STATUS_URL, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!statusResponse.ok) throw new Error(`Status API returned HTTP ${statusResponse.status}`);
  const summary = (await statusResponse.json()) as Record<string, unknown>;
  const incidents = Array.isArray(summary.activeIncidents) ? summary.activeIncidents.length : 0;
  const maintenances = Array.isArray(summary.activeMaintenances)
    ? summary.activeMaintenances.length
    : 0;
  const row = {
    checked_at: new Date().toISOString(),
    status: incidents || maintenances ? "warning" : "ok",
    incidents,
    maintenances,
    response_time_ms: Date.now() - startedAt,
    summary,
  };

  const baseUrl = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const headers = {
    apikey: requiredEnv("SUPABASE_SECRET_KEY"),
    "content-type": "application/json",
    prefer: "return=minimal",
  };
  const insert = await fetch(`${baseUrl}/rest/v1/system_status_history`, {
    method: "POST",
    headers,
    body: JSON.stringify(row),
  });
  if (!insert.ok)
    throw new Error(`Supabase insert returned HTTP ${insert.status}: ${await insert.text()}`);

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const cleanupUrl = new URL(`${baseUrl}/rest/v1/system_status_history`);
  cleanupUrl.searchParams.set("checked_at", `lt.${cutoff}`);
  const cleanup = await fetch(cleanupUrl, { method: "DELETE", headers });
  if (!cleanup.ok) throw new Error(`Supabase cleanup returned HTTP ${cleanup.status}`);
  return row;
}

export const Route = createFileRoute("/api/status-snapshot")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        try {
          return Response.json({ ok: true, snapshot: await captureStatus() });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Failed to capture system status" },
            { status: 502 },
          );
        }
      },
    },
  },
});
