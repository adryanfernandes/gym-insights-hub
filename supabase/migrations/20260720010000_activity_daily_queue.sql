ALTER TABLE public.activity_sync_settings
  ADD COLUMN IF NOT EXISTS interval_minutes INTEGER NOT NULL DEFAULT 5
    CHECK (interval_minutes BETWEEN 1 AND 1440),
  ADD COLUMN IF NOT EXISTS next_query_date DATE,
  ADD COLUMN IF NOT EXISTS cycle_month DATE,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;

UPDATE public.activity_sync_settings
SET
  next_query_date = COALESCE(next_query_date, date_trunc('month', now() AT TIME ZONE 'America/Fortaleza')::date),
  cycle_month = COALESCE(cycle_month, date_trunc('month', now() AT TIME ZONE 'America/Fortaleza')::date)
WHERE id = TRUE;

ALTER TABLE public.activity_sync_history
  ADD COLUMN IF NOT EXISTS query_date DATE,
  ADD COLUMN IF NOT EXISTS cycle_completed BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.activity_sync_settings.interval_minutes IS
  'Minutes between daily EVO activity queries. Each execution processes one date only.';
COMMENT ON COLUMN public.activity_sync_settings.next_query_date IS
  'Next day of the current month that will be queried from the EVO activities API.';
COMMENT ON COLUMN public.activity_sync_settings.cycle_month IS
  'Month currently being processed by the one-day-at-a-time activity queue.';

NOTIFY pgrst, 'reload schema';
