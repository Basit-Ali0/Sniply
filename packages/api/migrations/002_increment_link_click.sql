-- Atomic click_count increment for workers (PostgREST RPC via Supabase client)

CREATE OR REPLACE FUNCTION public.increment_link_click(p_link_id bigint)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.links
  SET click_count = click_count + 1
  WHERE id = p_link_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_link_click(bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_link_click(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_link_click(bigint) TO service_role;
