CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gym-system-status-hourly') THEN
    PERFORM cron.unschedule('gym-system-status-hourly');
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gym-member-sync-hourly') THEN
    PERFORM cron.unschedule('gym-member-sync-hourly');
  END IF;
END;
$$;

SELECT cron.schedule(
  'gym-system-status-hourly',
  '0 * * * *',
  $job$
    SELECT net.http_get(
      url := 'https://gym-insights-hub.vercel.app/api/status-snapshot',
      headers := '{"Accept": "application/json", "User-Agent": "Supabase-Cron"}'::jsonb,
      timeout_milliseconds := 60000
    );
  $job$
);

SELECT cron.schedule(
  'gym-member-sync-hourly',
  '5 * * * *',
  $job$
    SELECT net.http_get(
      url := 'https://gym-insights-hub.vercel.app/api/member-sync-scheduler',
      headers := '{"Accept": "application/json", "User-Agent": "Supabase-Cron"}'::jsonb,
      timeout_milliseconds := 120000
    );
  $job$
);

COMMENT ON EXTENSION pg_cron IS
  'Runs hourly API monitoring and member synchronization without Vercel Cron.';
