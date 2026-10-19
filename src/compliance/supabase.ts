import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { secureStoreAuthStorage } from './secureStoreAuthStorage';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
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
      },
    });
  }
  return client;
}
