CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL UNIQUE,
  query_date DATE NOT NULL,
  branch_id INTEGER NOT NULL DEFAULT 1,
  payload JSONB NOT NULL,
  first_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activities_query_date_idx
  ON public.activities (query_date DESC);

CREATE INDEX IF NOT EXISTS activities_branch_id_idx
  ON public.activities (branch_id);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.activities TO service_role;

COMMENT ON TABLE public.activities IS
  'Activities collected from the EVO/W12 monthly schedule API. The original API record is kept in payload.';

CREATE TABLE IF NOT EXISTS public.activity_sync_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  interval_hours INTEGER NOT NULL DEFAULT 24 CHECK (interval_hours BETWEEN 1 AND 720),
  evo_api_authorization TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  schedule_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.activity_sync_settings (id, enabled, interval_hours)
VALUES (TRUE, TRUE, 24)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.activity_sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'scheduled')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  month_start DATE,
  month_end DATE,
  days_queried INTEGER NOT NULL DEFAULT 0,
  total_fetched INTEGER NOT NULL DEFAULT 0,
  new_activities INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS activity_sync_history_finished_at_idx
  ON public.activity_sync_history (finished_at DESC);

ALTER TABLE public.activity_sync_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_sync_history ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.activity_sync_settings TO service_role;
GRANT ALL ON public.activity_sync_history TO service_role;

COMMENT ON COLUMN public.activity_sync_settings.evo_api_authorization IS
  'Server-only Authorization header used to access the EVO/W12 activities API.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gym-activity-sync-check') THEN
    PERFORM cron.unschedule('gym-activity-sync-check');
  END IF;
END;
$$;

SELECT cron.schedule(
  'gym-activity-sync-check',
  '* * * * *',
  $job$
    SELECT net.http_get(
      url := 'https://gym-insights-hub.vercel.app/api/activity-sync-scheduler',
      headers := '{"Accept": "application/json", "User-Agent": "Supabase-Cron"}'::jsonb,
      timeout_milliseconds := 120000
    );
  $job$
);

NOTIFY pgrst, 'reload schema';
