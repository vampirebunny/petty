import { getSupabase } from '../compliance/supabase';
import { updateRequired } from './required';

const QUERY_MS = 4_000;

// Reads the public minimum. A missing client, error, or timeout leaves the app open.
export async function fetchUpdateRequired(): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    return false;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const query = supabase.from('app_config').select('min_app_version').eq('id', 1).maybeSingle();
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), QUERY_MS);
    });
    const result = await Promise.race([query, timeout]);
    if (!result || result.error) {
      return false;
    }
    const min = result.data?.min_app_version;
    return updateRequired(typeof min === 'string' ? min : null);
  } catch {
    return false;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
