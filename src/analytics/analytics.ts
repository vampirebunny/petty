import type { AnalyticsEvents, HoursAway, NoParams, Screen, UserProps } from './events';

type Mod = typeof import('@react-native-firebase/analytics');
let mod: Mod | null = null;
let inst: ReturnType<Mod['getAnalytics']> | null = null;

// 'off' = not allowed (pre-consent, under-13, after reset, failed enable, or non-collecting build).
// 'enabling' = consent given, native enable in flight: calls queue.
// 'on' = calls go straight through.
let state: 'off' | 'enabling' | 'on' = 'off';
let queue: (() => void)[] = [];

const BUILD_COLLECTS =
  (!__DEV__ && process.env.EXPO_PUBLIC_ANALYTICS_ENABLED === '1') ||
  process.env.EXPO_PUBLIC_ANALYTICS_DEBUG === '1';

function fb() {
  if (!mod) {
    // Lazy on purpose: a dev or pre-consent import must not load the native module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('@react-native-firebase/analytics') as Mod;
    inst = mod.getAnalytics();
  }
  return { m: mod, a: inst! };
}

function settle(result: unknown) {
  if (result instanceof Promise) {
    result.catch(() => {});
  }
}

const clean = (p: object | undefined) =>
  Object.fromEntries(Object.entries(p ?? {}).filter(([, value]) => value !== undefined));

/** Call when consent is playable: after a yes, at startup, and on every foreground. */
export function enableAfterConsent(): void {
  if (!BUILD_COLLECTS || state !== 'off') {
    return;
  }
  state = 'enabling';
  try {
    const { m, a } = fb();
    m.setAnalyticsCollectionEnabled(a, true)
      .then(() => {
        if (state !== 'enabling') {
          m.setAnalyticsCollectionEnabled(a, false).catch(() => {});
          return;
        }
        state = 'on';
        const pending = queue;
        queue = [];
        pending.forEach((fn) => fn());
      })
      .catch(() => {
        if (state !== 'enabling') {
          m.setAnalyticsCollectionEnabled(a, false).catch(() => {});
          return;
        }
        state = 'off';
        queue = [];
      });
  } catch {
    state = 'off';
    queue = [];
  }
}

function run(fn: (m: Mod, a: NonNullable<typeof inst>) => unknown) {
  if (state === 'off') {
    return;
  }
  const call = () => {
    try {
      const { m, a } = fb();
      settle(fn(m, a));
    } catch {
      // Analytics must never throw into the app.
    }
  };
  if (state === 'enabling') {
    queue.push(call);
  } else {
    call();
  }
}

type Args<E extends keyof AnalyticsEvents> = AnalyticsEvents[E] extends NoParams
  ? [params?: AnalyticsEvents[E]]
  : [params: AnalyticsEvents[E]];

export function track<E extends keyof AnalyticsEvents>(name: E, ...[params]: Args<E>) {
  const payload = clean(params);
  if (__DEV__) {
    console.log(`[analytics${state === 'off' ? ' (dropped)' : ''}]`, name, payload);
  }
  run((m, a) => m.logEvent(a, name as string, payload));
}

export function trackScreen(screen: Screen) {
  if (__DEV__) {
    console.log(`[analytics${state === 'off' ? ' (dropped)' : ''}] screen`, screen);
  }
  run((m, a) => m.logScreenView(a, { screen_name: screen, screen_class: screen }));
}

/** Supabase user id only. Never the install id. */
export function setPlayer(supabaseUserId: string) {
  run((m, a) => m.setUserId(a, supabaseUserId));
}

export function setProp<K extends keyof UserProps>(key: K, value: UserProps[K]) {
  run((m, a) => m.setUserProperty(a, key, value));
}

/**
 * Account deletion and eraseUnder13(). Never awaited.
 * Disables collection even when the wrapper is already off, and does not
 * chain that disable off setUserId.
 */
export function resetAndDisable(): void {
  state = 'off';
  queue = [];
  if (!BUILD_COLLECTS) {
    return;
  }
  try {
    const { m, a } = fb();
    m.setAnalyticsCollectionEnabled(a, false).catch(() => {});
    m.setUserId(a, null).catch(() => {});
    m.resetAnalyticsData(a).catch(() => {});
  } catch {
    // Deletion must not wait on or throw from Firebase.
  }
}

export function analyticsModuleLoaded(): boolean {
  return mod != null;
}

export const bucketHoursAway = (h: number): HoursAway =>
  h < 1 ? '5m-1h' : h < 5 ? '1-5' : h < 12 ? '5-12' : h < 24 ? '12-24' : h < 72 ? '24-72' : '72+';

export const stat = (n: number) => Math.round(Math.max(0, Math.min(100, n)));

export function bucketLevel(level: number): UserProps['pet_level_bucket'] {
  if (level <= 2) {
    return '1-2';
  }
  if (level <= 5) {
    return '3-5';
  }
  if (level <= 10) {
    return '6-10';
  }
  if (level <= 20) {
    return '11-20';
  }
  return '21+';
}

export function bucketFriends(count: number): UserProps['friend_count_bucket'] {
  if (count <= 0) {
    return '0';
  }
  if (count <= 2) {
    return '1-2';
  }
  if (count <= 5) {
    return '3-5';
  }
  return '6+';
}

export function earn(source: AnalyticsEvents['earn_virtual_currency']['source'], value: number) {
  if (value <= 0) {
    return;
  }
  track('earn_virtual_currency', { virtual_currency_name: 'Boops', value, source });
}
