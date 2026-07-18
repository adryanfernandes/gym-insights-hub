ALTER TABLE public.member_sync_settings
  ADD COLUMN IF NOT EXISTS evo_api_authorization TEXT;

COMMENT ON COLUMN public.member_sync_settings.evo_api_authorization IS
  'Server-only Authorization header used to access the EVO/W12 members API.';
