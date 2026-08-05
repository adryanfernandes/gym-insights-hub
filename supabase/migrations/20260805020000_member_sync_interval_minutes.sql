ALTER TABLE public.member_sync_settings
  ADD COLUMN IF NOT EXISTS interval_minutes INTEGER NOT NULL DEFAULT 1440
    CHECK (interval_minutes BETWEEN 1 AND 43200);

UPDATE public.member_sync_settings
SET interval_minutes = COALESCE(interval_minutes, interval_hours * 60, 1440)
WHERE id = TRUE;

COMMENT ON COLUMN public.member_sync_settings.interval_minutes IS
  'Minutes between EVO member sync attempts. Allows schedules such as 1 minute or 20 hours.';

NOTIFY pgrst, 'reload schema';
