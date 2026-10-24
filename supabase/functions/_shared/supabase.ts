import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';

export function adminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('Supabase service credentials are not set');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function callerFromRequest(req: Request): Promise<User | null> {
  const header = req.headers.get('Authorization') ?? '';
  const jwt = header.replace(/^Bearer\s+/i, '');
  if (!jwt) {
    return null;
  }
  const { data, error } = await adminClient().auth.getUser(jwt);
  if (error || !data.user) {
    return null;
  }
  return data.user;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  if (req.method === 'GET' || req.headers.get('content-length') === '0') {
    return {};
  }
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
