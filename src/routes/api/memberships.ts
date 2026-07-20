import { createFileRoute } from "@tanstack/react-router";

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function allRows(base: string, table: string, key: string) {
  const rows: unknown[] = [];
  for (let offset = 0; offset < 20000; offset += 1000) {
    const response = await fetch(`${base}/rest/v1/${table}?select=*&offset=${offset}&limit=1000`, {
      headers: { apikey: key },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`${table}: ${await response.text()}`);
    const page = (await response.json()) as unknown[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

export const Route = createFileRoute("/api/memberships")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const base = env("SUPABASE_URL").replace(/\/$/, "");
          const key = env("SUPABASE_SECRET_KEY");
          const [memberships, receivables] = await Promise.all([
            allRows(base, "member_memberships", key),
            allRows(base, "membership_receivables", key),
          ]);
          return Response.json(
            { memberships, receivables },
            {
              headers: { "cache-control": "no-store" },
            },
          );
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Failed to load memberships" },
            { status: 500 },
          );
        }
      },
    },
  },
});
