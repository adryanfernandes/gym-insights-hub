import { createFileRoute } from "@tanstack/react-router";

const MEMBERS_TABLE = "members";
const PAGE_SIZE = 1000;

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export const Route = createFileRoute("/api/members")({
  server: {
    handlers: {
      GET: async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000);

        try {
          const supabaseUrl = getRequiredEnv("SUPABASE_URL").replace(/\/$/, "");
          const apiKey =
            process.env.SUPABASE_SECRET_KEY ??
            process.env.SUPABASE_SERVICE_ROLE_KEY ??
            getRequiredEnv("SUPABASE_PUBLISHABLE_KEY");

          const headers = {
            apikey: apiKey,
            authorization: `Bearer ${apiKey}`,
            accept: "application/json",
            prefer: "count=exact",
          };
          const members: unknown[] = [];
          let from = 0;
          let total: number | null = null;

          while (total === null || from < total) {
            const to = from + PAGE_SIZE - 1;
            const response = await fetch(
              `${supabaseUrl}/rest/v1/${MEMBERS_TABLE}?select=*`,
              {
                signal: controller.signal,
                headers: {
                  ...headers,
                  range: `${from}-${to}`,
                },
                cache: "no-store",
              },
            );

            const body = await response.text();
            if (!response.ok) {
              return Response.json(
                { error: body || response.statusText },
                { status: response.status, headers: { "cache-control": "no-store" } },
              );
            }

            const rows = JSON.parse(body) as unknown[];
            members.push(...rows);

            const contentRange = response.headers.get("content-range");
            const totalMatch = contentRange?.match(/\/(\d+)$/);
            total = totalMatch ? Number(totalMatch[1]) : null;
            if (!rows.length || (total === null && rows.length < PAGE_SIZE)) break;
            from += PAGE_SIZE;
          }

          return Response.json(members, {
            headers: {
              "cache-control": "no-store",
            },
          });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Failed to load members" },
            { status: 500, headers: { "cache-control": "no-store" } },
          );
        } finally {
          clearTimeout(timeoutId);
        }
      },
    },
  },
});
