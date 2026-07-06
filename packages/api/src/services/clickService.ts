import type { SupabaseClient } from '@supabase/supabase-js';

export interface RecordClickParams {
  linkId: bigint;
  referrer: string | null;
  country: string | null;
  userAgent: string | null;
  ipHash: string;
}

export async function recordClick(
  supabase: SupabaseClient,
  params: RecordClickParams
): Promise<void> {
  const { error: insertError } = await supabase.from('click_events').insert({
    link_id: Number(params.linkId),
    referrer: params.referrer,
    country: params.country,
    user_agent: params.userAgent,
    ip_hash: params.ipHash,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }

  const { error: rpcError } = await supabase.rpc('increment_link_click', {
    p_link_id: Number(params.linkId),
  });

  if (rpcError) {
    throw new Error(rpcError.message);
  }
}
