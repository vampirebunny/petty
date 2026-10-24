import type { SupabaseClient } from '@supabase/supabase-js';

/** The sync methods the app uses. A harness database only has to provide these. */
export type BoundDatabase = {
  execSync: (source: string) => void;
  getFirstSync: <T>(source: string, ...params: unknown[]) => T | null | undefined;
  getAllSync: <T>(source: string, ...params: unknown[]) => T[];
  runSync: (source: string, ...params: unknown[]) => { changes: number; lastInsertRowId: number };
  withTransactionSync: (task: () => void) => void;
};

export type ClientBinding = {
  databasePath: string;
  ownerId: string;
  installId: string;
  db: BoundDatabase;
  supabase: SupabaseClient | null;
  now: () => number;
  timezone: string;
  /** Minutes east of UTC. Set while entered so local days don't share the process timezone. */
  utcOffsetMinutes?: number;
  /** iPhone, iPad, or Android. Claim uses this instead of the process platform. */
  label?: 'iPhone' | 'iPad' | 'Android';
  secure: Map<string, string>;
  asyncStorage: Map<string, string>;
};

const stack: ClientBinding[] = [];
let savedTz: string | undefined;

export function activeClient(): ClientBinding | null {
  return stack[stack.length - 1] ?? null;
}

export function enterClient(client: ClientBinding): void {
  if (stack.length === 0) {
    savedTz = process.env.TZ;
  }
  stack.push(client);
  if (client.timezone) {
    process.env.TZ = client.timezone;
  }
}

export function leaveClient(): void {
  stack.pop();
  const current = stack[stack.length - 1];
  if (current?.timezone) {
    process.env.TZ = current.timezone;
    return;
  }
  if (savedTz === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = savedTz;
  }
}

export async function withClient<T>(client: ClientBinding, run: () => Promise<T> | T): Promise<T> {
  enterClient(client);
  try {
    return await run();
  } finally {
    leaveClient();
  }
}

/** Device clock. The app uses Date.now unless a harness client is entered. */
export function deviceNow(): number {
  return activeClient()?.now() ?? Date.now();
}
