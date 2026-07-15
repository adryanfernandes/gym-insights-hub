import { createFileRoute } from "@tanstack/react-router";

const MEMBERS_TABLE = "members";
const PAGE_SIZE = 1000;

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function getApiKeys() {
  return [
    process.env.SUPABASE_SECRET_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
  ].filter((key, index, keys): key is string => Boolean(key) && keys.indexOf(key) === index);
}

function getHeaders(apiKey: string) {
  const headers: Record<string, string> = {
    apikey: apiKey,
    accept: "application/json",
    prefer: "count=exact",
  };

  if (apiKey.split(".").length === 3) {
    headers.authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

export const Route = createFileRoute("/api/members")({
  server: {
    handlers: {
      GET: async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000);

        try {
          const supabaseUrl = getRequiredEnv("SUPABASE_URL").replace(/\/$/, "");
          const apiKeys = getApiKeys();
          if (!apiKeys.length) getRequiredEnv("SUPABASE_PUBLISHABLE_KEY");
          const members: unknown[] = [];
          let from = 0;
          let total: number | null = null;

          while (total === null || from < total) {
            const to = from + PAGE_SIZE - 1;
            let response: Response | null = null;
            for (const apiKey of apiKeys) {
              response = await fetch(`${supabaseUrl}/rest/v1/${MEMBERS_TABLE}?select=*`, {
                signal: controller.signal,
                headers: {
                  ...getHeaders(apiKey),
                  range: `${from}-${to}`,
                },
                cache: "no-store",
              });

              if (response.status !== 401 && response.status !== 403) break;
            }

            if (!response) throw new Error("No Supabase API key configured");

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
