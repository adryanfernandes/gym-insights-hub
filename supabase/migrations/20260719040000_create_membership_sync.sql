CREATE TABLE IF NOT EXISTS public.member_memberships (
  id_member_membership BIGINT PRIMARY KEY,
  id_member BIGINT NOT NULL,
  id_membership BIGINT,
  id_branch INTEGER,
  id_sale BIGINT,
  sale_value NUMERIC(14, 2) NOT NULL DEFAULT 0,
  membership_name TEXT,
  membership_start TIMESTAMPTZ,
  membership_end TIMESTAMPTZ,
  register_cancel_date TIMESTAMPTZ,
  cancel_date TIMESTAMPTZ,
  cancellation_reason TEXT,
  cancellation_fine NUMERIC(14, 2) NOT NULL DEFAULT 0,
  remaining_value NUMERIC(14, 2) NOT NULL DEFAULT 0,
  sale_date TIMESTAMPTZ,
  minimum_stay_period INTEGER,
  transferred BOOLEAN NOT NULL DEFAULT FALSE,
  membership_swapped BOOLEAN NOT NULL DEFAULT FALSE,
  status INTEGER,
  first_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS member_memberships_member_idx
  ON public.member_memberships (id_member);
CREATE INDEX IF NOT EXISTS member_memberships_sale_date_idx
  ON public.member_memberships (sale_date DESC);
CREATE INDEX IF NOT EXISTS member_memberships_cancel_date_idx
  ON public.member_memberships (cancel_date DESC);
CREATE INDEX IF NOT EXISTS member_memberships_branch_idx
  ON public.member_memberships (id_branch);

CREATE TABLE IF NOT EXISTS public.membership_receivables (
  id_receivable BIGINT PRIMARY KEY,
  id_member_membership BIGINT NOT NULL
    REFERENCES public.member_memberships (id_member_membership) ON DELETE CASCADE,
  description TEXT,
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(14, 2) NOT NULL DEFAULT 0,
  current_installment INTEGER,
  total_installments INTEGER,
  canceled BOOLEAN NOT NULL DEFAULT FALSE,
  cancellation_date TIMESTAMPTZ,
  cancellation_description TEXT,
  registration_date TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  receiving_date TIMESTAMPTZ,
  payment_type_id INTEGER,
  payment_type_name TEXT,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS membership_receivables_membership_idx
  ON public.membership_receivables (id_member_membership);
CREATE INDEX IF NOT EXISTS membership_receivables_due_date_idx
  ON public.membership_receivables (due_date DESC);

CREATE TABLE IF NOT EXISTS public.membership_sync_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  interval_hours INTEGER NOT NULL DEFAULT 24 CHECK (interval_hours BETWEEN 1 AND 720),
  evo_api_authorization TEXT,
  next_skip INTEGER NOT NULL DEFAULT 0 CHECK (next_skip >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  schedule_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.membership_sync_settings (id, enabled, interval_hours)
VALUES (TRUE, TRUE, 24)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.membership_sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'scheduled')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  total_fetched INTEGER NOT NULL DEFAULT 0,
  new_memberships INTEGER NOT NULL DEFAULT 0,
  receivables_synced INTEGER NOT NULL DEFAULT 0,
  next_skip INTEGER NOT NULL DEFAULT 0,
  cycle_completed BOOLEAN NOT NULL DEFAULT FALSE,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS membership_sync_history_finished_at_idx
  ON public.membership_sync_history (finished_at DESC);

ALTER TABLE public.member_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_sync_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_sync_history ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.member_memberships TO service_role;
GRANT ALL ON public.membership_receivables TO service_role;
GRANT ALL ON public.membership_sync_settings TO service_role;
GRANT ALL ON public.membership_sync_history TO service_role;

COMMENT ON TABLE public.member_memberships IS
  'Non-sensitive membership data collected from EVO/W12 /api/v3/membermembership.';
COMMENT ON TABLE public.membership_receivables IS
  'Non-sensitive receivables. TID, NSU, authorization and member documents are intentionally discarded.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gym-membership-sync-check') THEN
    PERFORM cron.unschedule('gym-membership-sync-check');
  END IF;
END;
$$;

SELECT cron.schedule(
  'gym-membership-sync-check',
  '* * * * *',
  $job$
    SELECT net.http_get(
      url := 'https://gym-insights-hub.vercel.app/api/membership-sync-scheduler',
      headers := '{"Accept": "application/json", "User-Agent": "Supabase-Cron"}'::jsonb,
      timeout_milliseconds := 120000
    );
  $job$
);

NOTIFY pgrst, 'reload schema';
