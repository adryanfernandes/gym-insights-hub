ALTER TABLE public.sales_sync_settings
  ADD COLUMN IF NOT EXISTS next_member_offset INTEGER NOT NULL DEFAULT 0 CHECK (next_member_offset >= 0);

ALTER TABLE public.sales_sync_history
  ADD COLUMN IF NOT EXISTS members_checked INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.sales_sync_settings.next_member_offset IS
  'Offset in the members table used by the sales sync queue. Each execution queries sales by idMember.';

NOTIFY pgrst, 'reload schema';
