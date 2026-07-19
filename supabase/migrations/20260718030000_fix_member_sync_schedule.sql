ALTER TABLE public.member_sync_settings
  ADD COLUMN IF NOT EXISTS schedule_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gym-member-sync-hourly') THEN
    PERFORM cron.unschedule('gym-member-sync-hourly');
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gym-member-sync-check') THEN
    PERFORM cron.unschedule('gym-member-sync-check');
  END IF;
END;
$$;

SELECT cron.schedule(
  'gym-member-sync-check',
  '* * * * *',
  $job$
    SELECT net.http_get(
      url := 'https://gym-insights-hub.vercel.app/api/member-sync-scheduler',
      headers := '{"Accept": "application/json", "User-Agent": "Supabase-Cron"}'::jsonb,
      timeout_milliseconds := 120000
    );
  $job$
);
