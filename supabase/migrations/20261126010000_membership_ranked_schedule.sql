CREATE TABLE IF NOT EXISTS public.membership_member_schedule (
  id_member BIGINT PRIMARY KEY,
  registered_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  next_check_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  schedule_reason TEXT NOT NULL DEFAULT 'initial',
  baseline_run_id UUID,
  baseline_checked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS membership_member_schedule_due_idx
  ON public.membership_member_schedule (next_check_at, id_member);
CREATE INDEX IF NOT EXISTS membership_member_schedule_baseline_idx
  ON public.membership_member_schedule (baseline_run_id, baseline_checked_at);

ALTER TABLE public.membership_member_schedule ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.membership_member_schedule TO service_role;

ALTER TABLE public.membership_sync_settings
  ADD COLUMN IF NOT EXISTS baseline_run_id UUID,
  ADD COLUMN IF NOT EXISTS baseline_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS baseline_completed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.seed_membership_schedule()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INTEGER;
BEGIN
  INSERT INTO public.membership_member_schedule (id_member, registered_at, next_check_at)
  SELECT
    m."idMember"::BIGINT,
    CASE
      WHEN pg_input_is_valid(NULLIF(to_jsonb(m)->>'registerDate', ''), 'timestamptz')
        THEN (to_jsonb(m)->>'registerDate')::TIMESTAMPTZ
      ELSE NULL
    END,
    now()
  FROM public.members m
  WHERE m."idMember" IS NOT NULL
  ON CONFLICT (id_member) DO UPDATE SET
    registered_at = COALESCE(EXCLUDED.registered_at, public.membership_member_schedule.registered_at),
    updated_at = now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_membership_baseline()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  run_id UUID := gen_random_uuid();
BEGIN
  PERFORM public.seed_membership_schedule();

  UPDATE public.membership_member_schedule
  SET baseline_run_id = run_id,
      baseline_checked_at = NULL,
      next_check_at = now(),
      schedule_reason = 'baseline',
      updated_at = now();

  UPDATE public.membership_sync_settings
  SET baseline_run_id = run_id,
      baseline_started_at = now(),
      baseline_completed_at = NULL,
      enabled = TRUE,
      updated_at = now()
  WHERE id = TRUE;

  RETURN run_id;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_membership_schedule() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_membership_baseline() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_membership_schedule() TO service_role;
GRANT EXECUTE ON FUNCTION public.start_membership_baseline() TO service_role;

SELECT public.seed_membership_schedule();

-- The ranked routine starts only after the user explicitly launches the one-time baseline.
UPDATE public.membership_sync_settings
SET enabled = FALSE,
    updated_at = now()
WHERE id = TRUE;

COMMENT ON TABLE public.membership_member_schedule IS
  'Ranked per-member contract refresh schedule. Daily for urgent members, otherwise every 15, 20 or 25 days.';

NOTIFY pgrst, 'reload schema';
