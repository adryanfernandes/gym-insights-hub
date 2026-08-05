ALTER TABLE public.member_sync_settings
  ADD COLUMN IF NOT EXISTS sync_mode TEXT NOT NULL DEFAULT 'full'
    CHECK (sync_mode IN ('full', 'recent')),
  ADD COLUMN IF NOT EXISTS recent_days INTEGER NOT NULL DEFAULT 7
    CHECK (recent_days BETWEEN 1 AND 30);

COMMENT ON COLUMN public.member_sync_settings.sync_mode IS
  'Member sync mode. full paginates the whole EVO members endpoint; recent fetches only recently registered members.';

COMMENT ON COLUMN public.member_sync_settings.recent_days IS
  'Number of days used by the recent member sync window. Default is 7 days.';

NOTIFY pgrst, 'reload schema';
