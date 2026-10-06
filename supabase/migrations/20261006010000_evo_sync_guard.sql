CREATE TABLE IF NOT EXISTS public.evo_sync_guard (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  locked_by TEXT,
  locked_until TIMESTAMPTZ,
  blocked_until TIMESTAMPTZ,
  last_status INTEGER,
  last_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.evo_sync_guard (id) VALUES (TRUE)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.evo_sync_guard ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.evo_sync_guard TO service_role;

CREATE OR REPLACE FUNCTION public.acquire_evo_sync(p_worker TEXT, p_lock_minutes INTEGER DEFAULT 3)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed public.evo_sync_guard%ROWTYPE;
  current_guard public.evo_sync_guard%ROWTYPE;
BEGIN
  UPDATE public.evo_sync_guard
  SET locked_by = p_worker,
      locked_until = now() + make_interval(mins => GREATEST(1, p_lock_minutes)),
      updated_at = now()
  WHERE id = TRUE
    AND (blocked_until IS NULL OR blocked_until <= now())
    AND (locked_until IS NULL OR locked_until <= now())
  RETURNING * INTO claimed;

  IF FOUND THEN
    RETURN jsonb_build_object('acquired', TRUE, 'locked_until', claimed.locked_until);
  END IF;

  SELECT * INTO current_guard FROM public.evo_sync_guard WHERE id = TRUE;
  RETURN jsonb_build_object(
    'acquired', FALSE,
    'blocked_until', current_guard.blocked_until,
    'locked_until', current_guard.locked_until,
    'reason', current_guard.last_reason
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.release_evo_sync(p_worker TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.evo_sync_guard
  SET locked_by = NULL, locked_until = NULL, updated_at = now()
  WHERE id = TRUE AND locked_by = p_worker;
$$;

CREATE OR REPLACE FUNCTION public.block_evo_sync(
  p_worker TEXT,
  p_status INTEGER,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.evo_sync_guard
  SET locked_by = NULL,
      locked_until = NULL,
      blocked_until = CASE
        WHEN p_status = 423 THEN date_trunc('hour', now()) + interval '1 hour 5 minutes'
        ELSE now() + interval '2 minutes'
      END,
      last_status = p_status,
      last_reason = p_worker || ': ' || p_reason,
      updated_at = now()
  WHERE id = TRUE;
$$;

REVOKE ALL ON FUNCTION public.acquire_evo_sync(TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_evo_sync(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.block_evo_sync(TEXT, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acquire_evo_sync(TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_evo_sync(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.block_evo_sync(TEXT, INTEGER, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
