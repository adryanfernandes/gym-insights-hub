import { createFileRoute } from "@tanstack/react-router";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function supabaseHeaders() {
  return { apikey: requiredEnv("SUPABASE_SECRET_KEY"), accept: "application/json" };
}

export const Route = createFileRoute("/api/status-history")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const baseUrl = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
          const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          const url = new URL(`${baseUrl}/rest/v1/system_status_history`);
          url.searchParams.set("select", "*");
          url.searchParams.set("checked_at", `gte.${cutoff}`);
          url.searchParams.set("order", "checked_at.desc");
          url.searchParams.set("limit", "1000");
          const response = await fetch(url, { headers: supabaseHeaders(), cache: "no-store" });
          const body = await response.text();
          if (!response.ok) return Response.json({ error: body }, { status: response.status });
          return new Response(body, {
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Failed to load status history" },
            { status: 500 },
          );
        }
      },
    },
  },
});
