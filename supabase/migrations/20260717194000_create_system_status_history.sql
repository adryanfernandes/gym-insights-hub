CREATE TABLE IF NOT EXISTS public.system_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('ok', 'warning', 'error')),
  incidents INTEGER NOT NULL DEFAULT 0 CHECK (incidents >= 0),
  maintenances INTEGER NOT NULL DEFAULT 0 CHECK (maintenances >= 0),
  response_time_ms INTEGER NOT NULL DEFAULT 0 CHECK (response_time_ms >= 0),
  summary JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS system_status_history_checked_at_idx
  ON public.system_status_history (checked_at DESC);

ALTER TABLE public.system_status_history ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.system_status_history TO service_role;

COMMENT ON TABLE public.system_status_history IS
  'Hourly snapshots from https://status.abcevo.app/v3/summary.json, retained for 30 days.';

CREATE TABLE IF NOT EXISTS public.member_sync_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  interval_hours INTEGER NOT NULL DEFAULT 24 CHECK (interval_hours BETWEEN 1 AND 720),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.member_sync_settings (id, enabled, interval_hours)
VALUES (TRUE, TRUE, 24)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.member_sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'scheduled')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  total_fetched INTEGER NOT NULL DEFAULT 0,
  new_members INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS member_sync_history_finished_at_idx
  ON public.member_sync_history (finished_at DESC);

ALTER TABLE public.member_sync_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_sync_history ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.member_sync_settings TO service_role;
GRANT ALL ON public.member_sync_history TO service_role;
