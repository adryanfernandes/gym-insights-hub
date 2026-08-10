CREATE TABLE IF NOT EXISTS public.membership_recurring_members (
  id_member BIGINT PRIMARY KEY,
  last_contract_id BIGINT,
  membership_name TEXT,
  membership_start TIMESTAMPTZ,
  membership_end TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  priority_sync_count INTEGER NOT NULL DEFAULT 0 CHECK (priority_sync_count BETWEEN 0 AND 2),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS membership_recurring_members_priority_idx
  ON public.membership_recurring_members (priority_sync_count, active DESC, membership_end DESC);

ALTER TABLE public.membership_recurring_members ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.membership_recurring_members TO service_role;

COMMENT ON TABLE public.membership_recurring_members IS
  'Auxiliary queue of members with recurring contracts. Contract sync prioritizes these members twice before scanning the remaining customers.';

INSERT INTO public.membership_recurring_members (
  id_member,
  last_contract_id,
  membership_name,
  membership_start,
  membership_end,
  active,
  priority_sync_count,
  last_seen_at
)
SELECT DISTINCT ON (id_member)
  id_member,
  id_member_membership,
  membership_name,
  membership_start,
  membership_end,
  (
    status = 1
    AND cancel_date IS NULL
    AND membership_end >= now()
  ) AS active,
  0,
  now()
FROM public.member_memberships
WHERE id_member IS NOT NULL
  AND membership_name IS NOT NULL
  AND lower(trim(membership_name)) NOT LIKE '%avulso%'
  AND lower(trim(membership_name)) NOT IN (
    'professor exclusivo movip max',
    'aula exclusiva movip max',
    'massagem movida movip max'
  )
ORDER BY id_member, COALESCE(membership_end, sale_date, membership_start) DESC NULLS LAST
ON CONFLICT (id_member) DO UPDATE SET
  last_contract_id = EXCLUDED.last_contract_id,
  membership_name = EXCLUDED.membership_name,
  membership_start = EXCLUDED.membership_start,
  membership_end = EXCLUDED.membership_end,
  active = EXCLUDED.active,
  last_seen_at = EXCLUDED.last_seen_at;

NOTIFY pgrst, 'reload schema';
