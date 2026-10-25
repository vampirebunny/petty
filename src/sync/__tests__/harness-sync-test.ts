import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { request as httpRequest } from 'node:http';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Alert } from 'react-native';

import { createUuid, ensureAnonymousUserId, getCachedInstallId, setCachedUserId } from '../../compliance/identity';
import { commitPendingInstall, installServerPet } from '../../compliance/restoreAccount';
import { recoverLinkedSession, signBackIn } from '../../compliance/reauth';
import { readAccountLinked, readServerOffsetMs, readStandby, serverNow, setAccountLinked, setSyncedRevision } from '../../db/accountMeta';
import { getDb } from '../../db/database';
import { testPet } from '../../sim/__fixtures__/pets';
import { authTransition, finishInstalledPet, onInstallState, setAuthTransition } from '../../state/sessionGate';
import { claimDevice, enterStandby, peekActiveDevice } from '../activeDevice';
import { activeClient, leaveClient, withClient, type ClientBinding } from '../clientScope';
import { assertClientsDiffer } from '../harness';
import { openClientDatabase } from '../harnessDb';
import { queuePet } from '../queue';
import { reconcileFromServer } from '../reconcile';

jest.mock('expo-secure-store', () => {
  const { activeClient: current } = require('../clientScope') as typeof import('../clientScope');
  return {
    getItemAsync: async (key: string) => current()?.secure.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
      current()?.secure.set(key, value);
    },
    deleteItemAsync: async (key: string) => {
      current()?.secure.delete(key);
    },
  };
});

jest.mock('@react-native-async-storage/async-storage', () => {
  const { activeClient: current } = require('../clientScope') as typeof import('../clientScope');
  return {
    __esModule: true,
    default: {
      getItem: async (key: string) => current()?.asyncStorage.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        current()?.asyncStorage.set(key, value);
      },
      removeItem: async (key: string) => {
        current()?.asyncStorage.delete(key);
      },
      getAllKeys: async () => [...(current()?.asyncStorage.keys() ?? [])],
      multiRemove: async (keys: string[]) => {
        for (const key of keys) {
          current()?.asyncStorage.delete(key);
        }
      },
    },
  };
});

type Local = { url: string; anon: string; service: string };

/** Jest swaps in Expo's fetch, which cannot read these local responses. */
function nodeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = typeof input === 'string' || input instanceof URL ? null : input;
  const target = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const body = init?.body == null ? undefined : String(init.body);
  const headers: Record<string, string> = {};
  new Headers(init?.headers ?? request?.headers).forEach((value, key) => {
    headers[key] = value;
  });
  if (body != null) {
    headers['content-length'] = String(body.length);
  }
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method: init?.method ?? request?.method ?? 'GET',
        headers,
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          text += chunk;
        });
        res.on('end', () => {
          const table = new Map<string, string>();
          for (const [key, value] of Object.entries(res.headers)) {
            if (typeof value === 'string') {
              table.set(key.toLowerCase(), value);
            } else if (Array.isArray(value)) {
              table.set(key.toLowerCase(), value.join(', '));
            }
          }
          const response = {
            ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
            status: res.statusCode ?? 0,
            headers: { get: (name: string) => table.get(name.toLowerCase()) ?? null },
            json: async () => (text ? JSON.parse(text) : null),
            text: async () => text,
            clone() {
              return response;
            },
          };
          resolve(response as unknown as Response);
        });
      },
    );
    req.on('error', reject);
    if (body != null) {
      req.write(body);
    }
    req.end();
  });
}

const endings: { name: string; negative: boolean }[] = [];
const userIds: string[] = [];
const emails = new Map<string, string>();
const harnessPassword = 'harness-password-ok';
let local: Local;
let admin: SupabaseClient;

function readStatus(): Local {
  let output = '';
  try {
    output = execSync('npx supabase status -o env', { encoding: 'utf8' });
  } catch {
    throw new Error('supabase start is not up. Run npx supabase start, then npm run test:harness.');
  }
  const value = (name: string) => {
    const match = output.match(new RegExp(`^(?:export )?${name}=(?:"([^"]+)"|(\\S+))`, 'm'));
    const found = match?.[1] ?? match?.[2];
    if (!found) {
      throw new Error(`supabase status did not print ${name}. supabase start is not up.`);
    }
    return found;
  };
  return {
    url: value('API_URL'),
    anon: value('ANON_KEY'),
    service: value('SERVICE_ROLE_KEY'),
  };
}

function makeClient(label: 'iPhone' | 'iPad', timezone: string): ClientBinding {
  const opened = openClientDatabase();
  const secure = new Map<string, string>();
  const binding: ClientBinding = {
    ...opened,
    ownerId: '',
    installId: createUuid(),
    supabase: null,
    now: () => Date.now(),
    timezone,
    label,
    secure,
    asyncStorage: new Map(),
  };
  binding.ownerId = binding.installId;
  binding.supabase = createClient(local.url, local.anon, {
    global: { fetch: nodeFetch },
    auth: {
      storage: {
        getItem: (key) => secure.get(key) ?? null,
        setItem: (key, value) => {
          secure.set(key, value);
        },
        removeItem: (key) => {
          secure.delete(key);
        },
      },
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'boop-harness-auth',
    },
  });
  return binding;
}

async function adoptSession(client: ClientBinding, userId: string, anonymous: boolean): Promise<void> {
  const email = emails.get(userId);
  if (!email || !client.supabase) {
    throw new Error('missing harness user');
  }
  const signed = await client.supabase.auth.signInWithPassword({ email, password: harnessPassword });
  if (signed.error || !signed.data.user) {
    throw new Error(signed.error?.message ?? 'sign-in failed');
  }
  client.ownerId = userId;
  if (!anonymous) {
    return;
  }
  signed.data.user.is_anonymous = true;
  if (signed.data.session?.user) {
    signed.data.session.user.is_anonymous = true;
  }
  const raw = client.secure.get('boop-harness-auth');
  if (!raw) {
    return;
  }
  const stored = JSON.parse(raw) as { user?: { is_anonymous?: boolean } };
  if (stored.user) {
    stored.user.is_anonymous = true;
    client.secure.set('boop-harness-auth', JSON.stringify(stored));
  }
}

async function createUser(_anonymous: boolean): Promise<string> {
  const email = `harness-${randomUUID()}@boop.test`;
  const response = await nodeFetch(`${local.url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: local.service,
      Authorization: `Bearer ${local.service}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password: harnessPassword,
      email_confirm: true,
    }),
  });
  const body = (await response.json()) as { id?: string; msg?: string; message?: string };
  if (!response.ok || !body.id) {
    throw new Error(body.msg || body.message || `could not create a user (${response.status})`);
  }
  emails.set(body.id, email);
  userIds.push(body.id);
  return body.id;
}

function petFor(userId: string, name: string) {
  const pet = testPet(1, 'retriever', Date.now(), name, createUuid());
  pet.ownerId = userId;
  return pet;
}

async function waitFor(ready: () => boolean, label: string): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < 8000) {
    if (ready()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`timed out: ${label}`);
}

function resetLock(): void {
  if (authTransition() !== 'idle') {
    setAuthTransition('idle');
  }
}

async function note(name: string, client: ClientBinding): Promise<void> {
  await withClient(client, async () => {
    const row = getDb().getFirstSync<{ total: number | null }>(
      "SELECT COALESCE(SUM(delta), 0) AS total FROM transaction_lines WHERE asset = 'boops'",
    );
    endings.push({ name, negative: Number(row?.total ?? 0) < 0 });
  });
}

const live = process.env.BOOP_HARNESS === '1';

(live ? describe : describe.skip)('two-device harness', () => {
  beforeAll(() => {
    local = readStatus();
    admin = createClient(local.url, local.service, {
      global: { fetch: nodeFetch },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  afterEach(() => {
    leaveClient();
    resetLock();
  });

  afterAll(async () => {
    const negative = endings.filter((item) => item.negative).length;
    const rate = endings.length === 0 ? 0 : negative / endings.length;
    console.log(`negative-balance rate ${rate} (${negative}/${endings.length})`);
    await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id).catch(() => undefined)));
  });

  it('fails when two clients would be the same device', () => {
    const phone = makeClient('iPhone', 'America/New_York');
    expect(() => assertClientsDiffer(phone, phone)).toThrow(/same device/);
  });

  it('asks before taking the slot, and standby never claims on foreground', async () => {
    const userId = await createUser(false);
    const phone = makeClient('iPhone', 'America/New_York');
    const tablet = makeClient('iPad', 'Asia/Tokyo');
    assertClientsDiffer(phone, tablet);
    await adoptSession(phone, userId, false);
    await adoptSession(tablet, userId, false);

    const claim = await withClient(phone, () => claimDevice());
    expect(claim?.active_device_id_before ?? null).toBeNull();
    const peek = await withClient(tablet, () => peekActiveDevice());
    expect(peek?.active_device_id).toBe(phone.installId);
    expect(peek?.active_device_label).toBe('iPhone');

    await withClient(tablet, () => enterStandby(true));
    await withClient(tablet, async () => {
      await peekActiveDevice();
      expect(readStandby()).toBe(true);
    });
    const still = await withClient(phone, () => peekActiveDevice());
    expect(still?.active_device_id).toBe(phone.installId);

    const taken = await withClient(tablet, () => claimDevice());
    expect(taken?.active_device_id_before).toBe(phone.installId);
    const after = await withClient(phone, () => peekActiveDevice());
    expect(after?.active_device_label).toBe('iPad');
    await note('handoff', phone);
  });

  it('keeps a standby flush from claiming or dropping the other device', async () => {
    const userId = await createUser(false);
    const phone = makeClient('iPhone', 'UTC');
    const tablet = makeClient('iPad', 'UTC');
    await adoptSession(phone, userId, false);
    await adoptSession(tablet, userId, false);
    await withClient(phone, () => claimDevice());
    await withClient(tablet, () => enterStandby(false));
    await withClient(tablet, async () => {
      queuePet(petFor(userId, 'Queued'));
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(getDb().getFirstSync('SELECT seq FROM push_queue LIMIT 1')).toBeTruthy();
      expect(readStandby()).toBe(true);
    });
    const peek = await withClient(phone, () => peekActiveDevice());
    expect(peek?.active_device_id).toBe(phone.installId);
    await note('standby push', phone);
  });

  it('ignores a late claim and retries with the same claim id', async () => {
    const userId = await createUser(false);
    const phone = makeClient('iPhone', 'UTC');
    await adoptSession(phone, userId, false);
    const claimId = randomUUID();
    const supabase = phone.supabase!;
    const original = supabase.rpc.bind(supabase);
    supabase.rpc = ((fn: string, args?: never) => {
      if (fn === 'claim_device') {
        return new Promise((resolve) => {
          setTimeout(() => resolve(original(fn, args)), 80);
        });
      }
      return original(fn, args);
    }) as typeof supabase.rpc;

    const late = await withClient(phone, () => claimDevice({ claimId, timeoutMs: 1 }));
    expect(late).toBeNull();
    supabase.rpc = original;
    const retry = await withClient(phone, () => claimDevice({ claimId }));
    expect(retry?.last_seen_before ?? null).toBeNull();
    const again = await withClient(phone, () => claimDevice({ claimId }));
    expect(again?.last_seen_before ?? null).toBe(retry?.last_seen_before ?? null);
    await note('claim timeout', phone);
  });

  it('accepts an offline purchase after the moment it was priced, and rejects a forged one', async () => {
    const userId = await createUser(false);
    const phone = makeClient('iPhone', 'UTC');
    await adoptSession(phone, userId, false);
    await withClient(phone, () => claimDevice());
    const old = new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString();
    const bought = `purchase:${createUuid()}`;
    const forged = `purchase:${createUuid()}`;
    const bogus = `earn:${createUuid()}`;
    await withClient(phone, async () => {
      const insert = (key: string, payload: unknown) => {
        getDb().runSync('INSERT INTO ledger_outbox (idempotency_key, payload) VALUES (?, ?)', key, JSON.stringify(payload));
      };
      insert(bought, {
        idempotency_key: bought,
        kind: 'purchase',
        source: 'purchase',
        lines: [
          { asset: 'boops', qty: -10, deal: true },
          { asset: 'toy', qty: 1, toy_id: 'ball' },
        ],
        device_time: old,
      });
      insert(forged, {
        idempotency_key: forged,
        kind: 'purchase',
        source: 'purchase',
        lines: [{ asset: 'furniture', qty: 1, furniture_id: 'dogHouse' }],
        device_time: old,
      });
      insert(bogus, {
        idempotency_key: bogus,
        kind: 'earn',
        source: 'not_a_source',
        lines: [{ asset: 'boops', qty: 10 }],
        device_time: old,
      });
      const { data, error } = await phone.supabase!.rpc('append_ledger_entries', {
        p_device_id: phone.installId,
        p_entries: [bought, forged, bogus].map((key) => {
          const row = getDb().getFirstSync<{ payload: string }>(
            'SELECT payload FROM ledger_outbox WHERE idempotency_key = ?',
            key,
          );
          return JSON.parse(row!.payload) as unknown;
        }),
        p_replay: false,
      });
      expect(error).toBeNull();
      const results = data as { idempotency_key: string; status: string }[];
      expect(results.find((item) => item.idempotency_key === bought)?.status).toBe('ok');
      expect(results.find((item) => item.idempotency_key === forged)?.status).toBe('invalid');
      expect(results.find((item) => item.idempotency_key === bogus)?.status).toBe('invalid');
    });
    await note('deal purchase', phone);
  });

  it('replaces a queued save when reconcile pulls the other device', async () => {
    const userId = await createUser(false);
    const phone = makeClient('iPhone', 'UTC');
    const tablet = makeClient('iPad', 'UTC');
    await adoptSession(phone, userId, false);
    await adoptSession(tablet, userId, false);
    await withClient(tablet, () => claimDevice());
    const serverPet = petFor(userId, 'Server');
    await withClient(tablet, async () => {
      setAccountLinked(true);
      queuePet(serverPet);
      await waitFor(() => !getDb().getFirstSync('SELECT seq FROM push_queue LIMIT 1'), 'tablet push');
    });
    await withClient(phone, async () => {
      setAccountLinked(true);
      setSyncedRevision(0);
      queuePet(petFor(userId, 'Local'));
      await claimDevice();
      const ok = await reconcileFromServer();
      expect(ok).toBe(true);
      const row = getDb().getFirstSync<{ json: string }>('SELECT json FROM pet');
      expect(JSON.parse(row?.json ?? '{}').id).toBe(serverPet.id);
      expect(getDb().getFirstSync('SELECT seq FROM push_queue LIMIT 1')).toBeNull();
    });
    await note('save versus reconcile', phone);
  });

  it('shows deleted-elsewhere when the open device signs into a different account', async () => {
    const gone = await createUser(false);
    const next = await createUser(false);
    const phone = makeClient('iPhone', 'UTC');
    await adoptSession(phone, next, false);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await withClient(phone, async () => {
      setCachedUserId(gone);
      phone.supabase!.auth.signInWithIdToken = async () =>
        ({ data: { user: null, session: null }, error: null }) as never;
      await signBackIn({ provider: 'apple', idToken: 'harness', rawNonce: null }, 'Boop');
    });
    expect(alert).toHaveBeenCalledWith('This account was deleted', expect.stringContaining('Boop'), expect.any(Array));
    alert.mockRestore();
    await admin.auth.admin.deleteUser(gone);
    await note('deleted elsewhere', phone);
  });

  it('keeps a guest pet when the anonymous user is already gone', async () => {
    const guest = await createUser(true);
    const phone = makeClient('iPhone', 'UTC');
    await adoptSession(phone, guest, true);
    await withClient(phone, async () => {
      const pet = petFor(guest, 'Guest');
      getDb().runSync('INSERT INTO pet (id, json, updated_at) VALUES (?, ?, ?)', pet.id, JSON.stringify(pet), Date.now());
      getDb().runSync(
        'INSERT INTO balances (owner_id, boops, updated_at) VALUES (?, ?, ?)',
        guest,
        15,
        't',
      );
    });
    await admin.auth.admin.deleteUser(guest);
    await phone.supabase!.auth.signOut({ scope: 'local' });
    await withClient(phone, async () => {
      const created = await ensureAnonymousUserId();
      if (created) {
        expect(created).not.toBe(guest);
        userIds.push(created);
      }
      const row = getDb().getFirstSync<{ json: string }>('SELECT json FROM pet');
      expect(JSON.parse(row?.json ?? '{}').name).toBe('Guest');
      const balance = getDb().getFirstSync<{ boops: number }>('SELECT boops FROM balances WHERE owner_id = ?', guest);
      expect(balance?.boops).toBe(15);
    });
    await note('guest deleted', phone);
  });

  it('restores a linked reinstall, an anonymous pet, and a guest with nothing', async () => {
    const linked = await createUser(false);
    const phone = makeClient('iPhone', 'UTC');
    await adoptSession(phone, linked, false);
    const pet = petFor(linked, 'Kept');
    await withClient(phone, async () => {
      setAccountLinked(true);
      await claimDevice();
      queuePet(pet);
      await waitFor(() => !getDb().getFirstSync('SELECT seq FROM push_queue LIMIT 1'), 'linked push');
    });
    const keptSession = phone.supabase;
    const keptSecure = phone.secure;
    const stopInstall = onInstallState(() => {
      finishInstalledPet();
    });
    const reinstall = openClientDatabase();
    phone.db = reinstall.db;
    phone.databasePath = reinstall.databasePath;
    const linkedResult = await withClient(phone, () => installServerPet());
    expect(linkedResult).toBe('restore');
    await withClient(phone, async () => {
      expect(getDb().getFirstSync('SELECT id FROM pet LIMIT 1')).toBeNull();
      const committed = await commitPendingInstall();
      expect(committed).toBe('home');
      const row = getDb().getFirstSync<{ json: string }>('SELECT json FROM pet');
      expect(JSON.parse(row?.json ?? '{}').name).toBe('Kept');
    });

    const anon = await createUser(true);
    const guest = makeClient('iPhone', 'UTC');
    await adoptSession(guest, anon, true);
    const anonPet = petFor(anon, 'Anon');
    await withClient(guest, async () => {
      await claimDevice();
      queuePet(anonPet);
      await waitFor(() => !getDb().getFirstSync('SELECT seq FROM push_queue LIMIT 1'), 'anon push');
    });
    const fresh = openClientDatabase();
    guest.db = fresh.db;
    guest.databasePath = fresh.databasePath;
    const anonResult = await withClient(guest, () => installServerPet());
    expect(anonResult).toBe('restore');
    await withClient(guest, async () => {
      expect(getDb().getFirstSync('SELECT id FROM pet LIMIT 1')).toBeNull();
      const committed = await commitPendingInstall();
      expect(committed).toBe('home');
      expect(readAccountLinked()).toBe(false);
      const row = getDb().getFirstSync<{ json: string }>('SELECT json FROM pet');
      expect(JSON.parse(row?.json ?? '{}').name).toBe('Anon');
    });

    const nobody = await createUser(true);
    const empty = makeClient('iPhone', 'UTC');
    await adoptSession(empty, nobody, true);
    const welcome = await withClient(empty, async () => {
      const result = await installServerPet();
      expect(readAccountLinked()).toBe(false);
      return result;
    });
    expect(welcome).toBe('welcome');
    expect(keptSession).toBe(phone.supabase);
    expect(keptSecure).toBe(phone.secure);
    stopInstall();
    await note('reinstall', phone);
  });

  it('stops adoption on a stale device instead of writing a new pet', async () => {
    const userId = await createUser(false);
    const phone = makeClient('iPhone', 'UTC');
    const tablet = makeClient('iPad', 'UTC');
    await adoptSession(phone, userId, false);
    await adoptSession(tablet, userId, false);
    const current = petFor(userId, 'Current');
    await withClient(tablet, async () => {
      setAccountLinked(true);
      await claimDevice();
      queuePet(current);
      await waitFor(() => !getDb().getFirstSync('SELECT seq FROM push_queue LIMIT 1'), 'current push');
    });
    await withClient(phone, async () => {
      setAccountLinked(true);
      setSyncedRevision(0);
      const claim = await claimDevice();
      expect(claim?.active_device_id_before).toBe(tablet.installId);
      const ok = await reconcileFromServer(claim);
      expect(ok).toBe(true);
      const row = getDb().getFirstSync<{ json: string }>('SELECT json FROM pet');
      expect(JSON.parse(row?.json ?? '{}').id).toBe(current.id);
      expect(getDb().getAllSync('SELECT id FROM pet')).toHaveLength(1);
    });
    await note('stale adoption', phone);
  });

  it('treats a dead refresh token as dead, and a clock skew as an offset', async () => {
    const userId = await createUser(false);
    const phone = makeClient('iPhone', 'UTC');
    await adoptSession(phone, userId, false);
    const real = Date.now();
    phone.now = () => real + 5 * 60_000;
    await withClient(phone, async () => {
      await claimDevice();
      expect(readServerOffsetMs()).toBeLessThan(-4 * 60_000);
      expect(Math.abs(serverNow() - real)).toBeLessThan(30_000);
    });
    phone.now = () => real - 5 * 60_000;
    await withClient(phone, async () => {
      await claimDevice();
      expect(readServerOffsetMs()).toBeGreaterThan(4 * 60_000);
    });
    await withClient(phone, async () => {
      setAccountLinked(true);
      const current = await phone.supabase!.auth.getSession();
      const access = current.data.session?.access_token;
      if (!access) {
        throw new Error('missing access token');
      }
      await phone.supabase!.auth.setSession({
        access_token: access,
        refresh_token: 'not-a-refresh-token',
      });
      const outcome = await recoverLinkedSession();
      expect(outcome.kind).toBe('dead');
      expect(getCachedInstallId()).toBe(phone.installId);
    });
    await note('dead session', phone);
  });

  it('does not claim while the client has no session', async () => {
    const phone = makeClient('iPhone', 'UTC');
    phone.supabase = null;
    const claim = await withClient(phone, () => claimDevice());
    expect(claim).toBeNull();
    expect(activeClient()).toBeNull();
    await note('offline claim', phone);
  });
});
