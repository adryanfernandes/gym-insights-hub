CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'unknown',
  event_type TEXT,
  external_id TEXT,
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processing_error TEXT,
  inserted_by TEXT NOT NULL DEFAULT 'edge-function'
);

CREATE INDEX IF NOT EXISTS webhook_events_received_at_idx
  ON public.webhook_events (received_at DESC);

CREATE INDEX IF NOT EXISTS webhook_events_source_idx
  ON public.webhook_events (source);

CREATE INDEX IF NOT EXISTS webhook_events_event_type_idx
  ON public.webhook_events (event_type);

CREATE INDEX IF NOT EXISTS webhook_events_external_id_idx
  ON public.webhook_events (external_id);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.webhook_events TO service_role;

COMMENT ON TABLE public.webhook_events IS
  'Raw webhook payloads received by the Supabase Edge Function webhook-ingest.';

COMMENT ON COLUMN public.webhook_events.headers IS
  'Request headers saved without sensitive authorization, cookies, api keys or webhook secrets.';

NOTIFY pgrst, 'reload schema';
