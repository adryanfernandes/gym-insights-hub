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
      updated_at = now()
  WHERE id_member IS NOT NULL;

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

REVOKE ALL ON FUNCTION public.start_membership_baseline() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_membership_baseline() TO service_role;

NOTIFY pgrst, 'reload schema';
