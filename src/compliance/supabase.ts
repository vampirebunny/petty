import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { activeClient } from '../sync/clientScope';
import { secureStoreAuthStorage } from './secureStoreAuthStorage';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const bound = activeClient();
  if (bound) {
    return bound.supabase;
  }
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return null;
  }
  if (!client) {
    client = createClient(url, key, {
      auth: {
        storage: secureStoreAuthStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
      // Realtime protocol 2.0.0 sends broadcasts as binary frames decoded with TextDecoder, which Hermes
      // doesn't reliably provide; the decode throws and race broadcasts never arrive. 1.0.0 is plain JSON.
      realtime: { vsn: '1.0.0' },
    });
  }
  return client;
}
