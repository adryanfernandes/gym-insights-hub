import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-webhook-source, x-event-type, x-event-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonObject = Record<string, unknown>;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

function getServiceRoleKey() {
  const value =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SECRET_KEY");

  if (!value) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY");
  }

  return value;
}

function sanitizeHeaders(headers: Headers) {
  const hiddenHeaders = new Set([
    "authorization",
    "x-webhook-secret",
    "apikey",
    "cookie",
    "set-cookie",
  ]);
  const result: Record<string, string> = {};

  headers.forEach((value, key) => {
    if (!hiddenHeaders.has(key.toLowerCase())) {
      result[key] = value;
    }
  });

  return result;
}

async function readPayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return await request.json();
  }

  const body = await request.text();

  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    return { raw: body };
  }
}

function getPayloadValue(payload: unknown, keys: string[]) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const objectPayload = payload as JsonObject;

  for (const key of keys) {
    const value = objectPayload[key];

    if (value !== undefined && value !== null && value !== "") {
      return String(value);
    }
  }

  return null;
}

function getWebhookSecretFromRequest(request: Request) {
  const bearerToken = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();

  return request.headers.get("x-webhook-secret") ?? bearerToken ?? "";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const expectedSecret = Deno.env.get("WEBHOOK_SECRET");

    if (expectedSecret) {
      const receivedSecret = getWebhookSecretFromRequest(request);

      if (receivedSecret !== expectedSecret) {
        return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
      }
    }

    const payload = await readPayload(request);
    const url = new URL(request.url);
    const source =
      url.searchParams.get("source") ??
      request.headers.get("x-webhook-source") ??
      "unknown";
    const eventType =
      request.headers.get("x-event-type") ??
      getPayloadValue(payload, ["event_type", "eventType", "type", "event"]);
    const externalId =
      request.headers.get("x-event-id") ??
      getPayloadValue(payload, ["external_id", "externalId", "event_id", "eventId", "id"]);

    const supabase = createClient(
      getRequiredEnv("SUPABASE_URL"),
      getServiceRoleKey(),
      { auth: { persistSession: false } },
    );

    const { data, error } = await supabase
      .from("webhook_events")
      .insert({
        source,
        event_type: eventType,
        external_id: externalId,
        headers: sanitizeHeaders(request.headers),
        payload,
      })
      .select("id, received_at")
      .single();

    if (error) {
      throw error;
    }

    return jsonResponse({ ok: true, event: data }, 201);
  } catch (error) {
    console.error(error);

    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Webhook failed",
      },
      500,
    );
  }
});
