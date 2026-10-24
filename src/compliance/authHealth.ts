import { getSupabase } from './supabase';

/** True only when the public health RPC answers. A failure means offline, not a dead session. */
export async function pingAuthHealth(): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    return false;
  }
  const { data, error } = await supabase.rpc('app_health');
  return !error && data === 'ok';
}
