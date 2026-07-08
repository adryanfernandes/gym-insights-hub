import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/keepalive")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const cronSchedule = request.headers.get("x-vercel-cron-schedule");
        const userAgent = request.headers.get("user-agent") ?? "";

        return Response.json(
          {
            ok: true,
            service: "gym-insights-hub",
            triggeredByCron: userAgent.includes("vercel-cron"),
            schedule: cronSchedule,
            checkedAt: new Date().toISOString(),
          },
          {
            headers: {
              "cache-control": "no-store",
            },
          },
        );
      },
    },
  },
});
