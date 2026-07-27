CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.sales (
  source_key TEXT PRIMARY KEY,
  id_sale BIGINT,
  id_member BIGINT,
  id_branch INTEGER,
  sale_date TIMESTAMPTZ,
  sale_value NUMERIC(14, 2) NOT NULL DEFAULT 0,
  payload JSONB NOT NULL,
  first_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_id_sale_idx
  ON public.sales (id_sale);
CREATE INDEX IF NOT EXISTS sales_member_idx
  ON public.sales (id_member);
CREATE INDEX IF NOT EXISTS sales_sale_date_idx
  ON public.sales (sale_date DESC);
CREATE INDEX IF NOT EXISTS sales_branch_idx
  ON public.sales (id_branch);

CREATE TABLE IF NOT EXISTS public.sales_sync_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  interval_hours INTEGER NOT NULL DEFAULT 24 CHECK (interval_hours BETWEEN 1 AND 720),
  interval_minutes INTEGER NOT NULL DEFAULT 1440 CHECK (interval_minutes BETWEEN 1 AND 43200),
  evo_api_authorization TEXT,
  next_skip INTEGER NOT NULL DEFAULT 0 CHECK (next_skip >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  schedule_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.sales_sync_settings (id, enabled, interval_hours, interval_minutes)
VALUES (TRUE, TRUE, 24, 1440)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.sales_sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'scheduled')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  total_fetched INTEGER NOT NULL DEFAULT 0,
  new_sales INTEGER NOT NULL DEFAULT 0,
  next_skip INTEGER NOT NULL DEFAULT 0,
  cycle_completed BOOLEAN NOT NULL DEFAULT FALSE,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS sales_sync_history_finished_at_idx
  ON public.sales_sync_history (finished_at DESC);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_sync_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_sync_history ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.sales TO service_role;
GRANT ALL ON public.sales_sync_settings TO service_role;
GRANT ALL ON public.sales_sync_history TO service_role;

COMMENT ON TABLE public.sales IS
  'Sales collected from EVO/W12 /api/v2/sales. The original API record is kept in payload.';
COMMENT ON COLUMN public.sales_sync_settings.evo_api_authorization IS
  'Server-only Authorization header used to access the EVO/W12 sales API.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gym-sales-sync-check') THEN
    PERFORM cron.unschedule('gym-sales-sync-check');
  END IF;
END;
$$;

SELECT cron.schedule(
  'gym-sales-sync-check',
  '* * * * *',
  $job$
    SELECT net.http_get(
      url := 'https://gym-insights-hub.vercel.app/api/sales-sync-scheduler',
      headers := '{"Accept": "application/json", "User-Agent": "Supabase-Cron"}'::jsonb,
      timeout_milliseconds := 120000
    );
  $job$
);

NOTIFY pgrst, 'reload schema';
