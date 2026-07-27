ALTER TABLE public.membership_sync_settings
  ADD COLUMN IF NOT EXISTS next_member_offset INTEGER NOT NULL DEFAULT 0 CHECK (next_member_offset >= 0);

ALTER TABLE public.membership_sync_history
  ADD COLUMN IF NOT EXISTS members_checked INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.membership_sync_settings.next_member_offset IS
  'Offset in the prioritized members queue used by the contract sync. Active members are queried before the remaining members.';

NOTIFY pgrst, 'reload schema';
