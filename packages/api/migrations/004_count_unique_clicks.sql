-- Count distinct IP hashes for a link (PostgREST RPC, used by WS subscribe + link detail).
-- Replaces the previous in-memory scan of click_events rows in Node.
CREATE OR REPLACE FUNCTION public.count_unique_clicks(p_link_id bigint)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT ip_hash)::integer
  FROM public.click_events
  WHERE link_id = p_link_id;
$$;

GRANT EXECUTE ON FUNCTION public.count_unique_clicks(bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.count_unique_clicks(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_unique_clicks(bigint) TO service_role;
