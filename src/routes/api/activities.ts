import { createFileRoute } from "@tanstack/react-router";

const PAGE_SIZE = 1000;

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export const Route = createFileRoute("/api/activities")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 45000);
        try {
          const supabaseUrl = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
          const key = requiredEnv("SUPABASE_SECRET_KEY");
          const limitParam = new URL(request.url).searchParams.get("limit");
          const requestedLimit = limitParam === null ? Number.NaN : Number(limitParam);
          const maxRows = Number.isFinite(requestedLimit)
            ? Math.max(1, Math.min(10000, Math.round(requestedLimit)))
            : 10000;
          const rows: unknown[] = [];

          for (let offset = 0; rows.length < maxRows; offset += PAGE_SIZE) {
            const limit = Math.min(PAGE_SIZE, maxRows - rows.length);
            const response = await fetch(
              `${supabaseUrl}/rest/v1/activities?select=query_date,branch_id,payload&order=query_date.desc&offset=${offset}&limit=${limit}`,
              {
                signal: controller.signal,
                headers: { apikey: key, accept: "application/json" },
                cache: "no-store",
              },
            );
            const body = await response.text();
            if (!response.ok) {
              return Response.json({ error: body }, { status: response.status });
            }
            const page = JSON.parse(body) as unknown[];
            rows.push(...page);
            if (page.length < limit) break;
          }

          return Response.json(rows, { headers: { "cache-control": "no-store" } });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Failed to load activities" },
            { status: 500 },
          );
        } finally {
          clearTimeout(timeout);
        }
      },
    },
  },
});
