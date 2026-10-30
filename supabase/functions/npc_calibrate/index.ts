import { adminClient, callerFromRequest, json, readJson } from '../_shared/supabase.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

import {
  CURVE_POINTS,
  GRID_SEEDS,
  OFFSET_LIMIT,
  RACE_CLASSES,
  WIN_WINDOW_DAYS,
  WINDOW_DAYS,
  currentCatalog,
  decideCurve,
  defaultCurve,
  enforceMonotonic,
  isRaceClass,
  isReplayEvent,
  knownConfig,
  metricKind,
  nextOffset,
  playerMedians,
  replayNpc,
  skillSteps,
  windowStart,
  type CalibrationStatus,
  type GridPoint,
  type MetricKind,
  type RaceClassId,
  type RaceEventType,
} from '../_shared/race-sim/index.ts';

type CellKey = {
  event: RaceEventType;
  classId: RaceClassId;
  version: string;
};

type CalibrationRow = {
  event: string;
  class: string;
  config_version: string;
  curve: unknown;
  n_runs: number;
  n_players: number;
  metric_kind: string;
  status: string;
};

type GridRow = {
  event: string;
  class: string;
  config_version: string;
  skill_step: number;
  metric: number | string;
};

type DifficultyRow = {
  event: string;
  class: string;
  config_version: string;
  skill_offset: number | string;
  frozen: boolean;
  manual: boolean;
  solo_win_rate: number | string | null;
  solo_count: number;
};

type ResultRow = {
  event: string;
  class: string;
  config_version: string;
  player_id: string;
  metric_adj: number | string;
  metric_kind: string;
};

const SEED_LIMIT = 24;

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return Number.NaN;
}

function keyOf(cell: CellKey): string {
  return `${cell.event}|${cell.classId}|${cell.version}`;
}

function parseKey(event: string, classId: string, version: string): CellKey | null {
  if (!isReplayEvent(event) || !isRaceClass(classId) || !knownConfig(event, version)) return null;
  return { event, classId, version };
}

function curveNumbers(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length !== CURVE_POINTS) return null;
  const curve = value.map(asNumber);
  return curve.every((point) => Number.isFinite(point)) ? curve : null;
}

function serviceRequest(req: Request): boolean {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return token.length > 0 && token === service;
}

function adminEnabled(): boolean {
  return Deno.env.get('NPC_CALIBRATION_ADMIN') === '1';
}

function gridMetric(cell: CellKey, skill: number, seed: string): number | null {
  const finish = replayNpc(
    { event: cell.event, classId: cell.classId, seed, configVersion: cell.version },
    'grid',
    skill,
  );
  const metric = cell.event === 'dockDive' ? finish.scoreDm : finish.finishMs;
  return metric == null || !Number.isFinite(metric) ? null : metric;
}

function buildGrid(cell: CellKey): GridPoint[] | null {
  const kind = metricKind(cell.event);
  const raw: number[] = [];
  for (const skill of skillSteps()) {
    const samples: number[] = [];
    for (const seed of GRID_SEEDS) {
      const metric = gridMetric(cell, skill, seed);
      if (metric == null) return null;
      samples.push(metric);
    }
    raw.push(samples.reduce((sum, value) => sum + value, 0) / samples.length);
  }
  const metrics = enforceMonotonic(raw, kind);
  return metrics.map((metric, index) => ({ skill: index / (CURVE_POINTS - 1), metric }));
}

async function fetchAll<T>(
  load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await load(from, from + page - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < page) break;
  }
  return rows;
}

async function runCalibration(admin: SupabaseClient, nowMs: number): Promise<{ seeded: number; updated: number; pending: number }> {
  const since = windowStart(nowMs, WINDOW_DAYS);
  const winSince = windowStart(nowMs, WIN_WINDOW_DAYS);
  const results = await fetchAll<ResultRow>((from, to) =>
    admin
      .from('race_results')
      .select('event, class, config_version, player_id, metric_adj, metric_kind')
      .gte('created_at', since)
      .order('id')
      .range(from, to),
  );
  const calibration = await fetchAll<CalibrationRow>((from, to) =>
    admin
      .from('npc_calibration')
      .select('event, class, config_version, curve, n_runs, n_players, metric_kind, status')
      .order('event')
      .order('class')
      .order('config_version')
      .range(from, to),
  );
  const gridRows = await fetchAll<GridRow>((from, to) =>
    admin
      .from('npc_calibration_grid')
      .select('event, class, config_version, skill_step, metric')
      .order('event')
      .order('class')
      .order('config_version')
      .order('skill_step')
      .range(from, to),
  );
  const difficulty = await fetchAll<DifficultyRow>((from, to) =>
    admin
      .from('npc_difficulty')
      .select('event, class, config_version, skill_offset, frozen, manual, solo_win_rate, solo_count')
      .order('event')
      .order('class')
      .order('config_version')
      .range(from, to),
  );
  const stats = await admin.rpc('npc_solo_stats', { p_since: winSince });
  if (stats.error) throw new Error(stats.error.message);

  const wanted = new Map<string, CellKey>();
  for (const item of currentCatalog()) {
    for (const classId of RACE_CLASSES) {
      const cell = { event: item.event, classId, version: item.version };
      wanted.set(keyOf(cell), cell);
    }
  }
  for (const row of results) {
    const cell = parseKey(row.event, row.class, row.config_version);
    if (cell) wanted.set(keyOf(cell), cell);
  }

  const grids = new Map<string, GridPoint[]>();
  for (const row of gridRows) {
    const cell = parseKey(row.event, row.class, row.config_version);
    if (!cell) continue;
    const id = keyOf(cell);
    const points = grids.get(id) ?? [];
    const metric = asNumber(row.metric);
    if (!Number.isFinite(metric)) continue;
    points.push({ skill: row.skill_step / (CURVE_POINTS - 1), metric });
    grids.set(id, points);
  }

  let seeded = 0;
  let pending = 0;
  for (const cell of wanted.values()) {
    const id = keyOf(cell);
    const existing = grids.get(id);
    if (existing && existing.length >= CURVE_POINTS) continue;
    if (seeded >= SEED_LIMIT) {
      pending += 1;
      continue;
    }
    const built = buildGrid(cell);
    if (!built) continue;
    const rows = built.map((point, index) => ({
      event: cell.event,
      class: cell.classId,
      config_version: cell.version,
      skill_step: index,
      metric: point.metric,
    }));
    const saved = await admin.from('npc_calibration_grid').upsert(rows, {
      onConflict: 'event,class,config_version,skill_step',
    });
    if (saved.error) throw new Error(saved.error.message);
    grids.set(id, built);
    seeded += 1;
  }

  const curves = new Map<string, CalibrationRow>();
  for (const row of calibration) {
    const cell = parseKey(row.event, row.class, row.config_version);
    if (cell) curves.set(keyOf(cell), row);
  }
  const offsets = new Map<string, DifficultyRow>();
  for (const row of difficulty) {
    const cell = parseKey(row.event, row.class, row.config_version);
    if (cell) offsets.set(keyOf(cell), row);
  }
  const byCell = new Map<string, ResultRow[]>();
  for (const row of results) {
    const cell = parseKey(row.event, row.class, row.config_version);
    if (!cell) continue;
    const id = keyOf(cell);
    const list = byCell.get(id) ?? [];
    list.push(row);
    byCell.set(id, list);
  }
  const solo = new Map<string, { solos: number; wins: number }>();
  for (const row of (stats.data ?? []) as { event: string; class: string; config_version: string; solos: number; wins: number }[]) {
    const cell = parseKey(row.event, row.class, row.config_version);
    if (!cell) continue;
    solo.set(keyOf(cell), { solos: asNumber(row.solos), wins: asNumber(row.wins) });
  }

  let updated = 0;
  for (const cell of wanted.values()) {
    const id = keyOf(cell);
    const grid = grids.get(id);
    if (!grid || grid.length < CURVE_POINTS) continue;
    const defaults = defaultCurve(grid);
    const kind = metricKind(cell.event);
    const previous = curves.get(id);
    const previousCurve = previous ? curveNumbers(previous.curve) : null;
    const previousStatus: CalibrationStatus | null =
      previous?.status === 'active' || previous?.status === 'default' ? previous.status : null;
    const grouped = playerMedians(
      (byCell.get(id) ?? []).map((row) => ({ playerId: row.player_id, metric: asNumber(row.metric_adj) })).filter((row) => Number.isFinite(row.metric)),
    );
    const frozen = offsets.get(id)?.frozen === true;
    const decision = frozen
      ? {
          curve: previousCurve ?? defaults,
          status: previousStatus ?? 'default',
        }
      : decideCurve({
          samples: grouped.medians,
          nRuns: grouped.nRuns,
          nPlayers: grouped.nPlayers,
          kind,
          defaults,
          current: previousCurve,
          status: previousStatus,
        });
    const saved = await admin.from('npc_calibration').upsert(
      {
        event: cell.event,
        class: cell.classId,
        config_version: cell.version,
        curve: decision.curve,
        n_runs: grouped.nRuns,
        n_players: grouped.nPlayers,
        metric_kind: kind,
        status: decision.status,
        computed_at: new Date(nowMs).toISOString(),
      },
      { onConflict: 'event,class,config_version' },
    );
    if (saved.error) throw new Error(saved.error.message);

    const statsRow = solo.get(id);
    const solos = statsRow?.solos ?? 0;
    const wins = statsRow?.wins ?? 0;
    const winRate = solos > 0 ? wins / solos : null;
    const prior = offsets.get(id);
    const manual = prior?.manual === true;
    const rawOffset =
      frozen || manual
        ? asNumber(prior?.skill_offset ?? 0)
        : nextOffset(asNumber(prior?.skill_offset ?? 0) || 0, winRate ?? 0, solos);
    const clamped = Number.isFinite(rawOffset) ? Math.min(OFFSET_LIMIT, Math.max(-OFFSET_LIMIT, rawOffset)) : 0;
    const offset = Math.round(clamped * 100) / 100;
    const difficultySaved = await admin.from('npc_difficulty').upsert(
      {
        event: cell.event,
        class: cell.classId,
        config_version: cell.version,
        skill_offset: Number.isFinite(offset) ? offset : 0,
        frozen,
        manual,
        solo_win_rate: winRate,
        solo_count: solos,
        updated_at: new Date(nowMs).toISOString(),
      },
      { onConflict: 'event,class,config_version' },
    );
    if (difficultySaved.error) throw new Error(difficultySaved.error.message);
    updated += 1;
  }

  return { seeded, updated, pending };
}

function sampleAt(grid: GridPoint[], skill: number): number | null {
  const step = Math.round(skill * (CURVE_POINTS - 1));
  const point = grid.find((item) => Math.round(item.skill * (CURVE_POINTS - 1)) === step);
  return point ? point.metric : null;
}

async function snapshot(admin: SupabaseClient): Promise<unknown> {
  const calibration = await fetchAll<CalibrationRow>((from, to) =>
    admin
      .from('npc_calibration')
      .select('event, class, config_version, curve, n_runs, n_players, metric_kind, status')
      .order('event')
      .order('class')
      .order('config_version')
      .range(from, to),
  );
  const gridRows = await fetchAll<GridRow>((from, to) =>
    admin
      .from('npc_calibration_grid')
      .select('event, class, config_version, skill_step, metric')
      .order('event')
      .order('class')
      .order('config_version')
      .order('skill_step')
      .range(from, to),
  );
  const difficulty = await fetchAll<DifficultyRow>((from, to) =>
    admin
      .from('npc_difficulty')
      .select('event, class, config_version, skill_offset, frozen, manual, solo_win_rate, solo_count')
      .order('event')
      .order('class')
      .order('config_version')
      .range(from, to),
  );
  const grids = new Map<string, GridPoint[]>();
  for (const row of gridRows) {
    const id = `${row.event}|${row.class}|${row.config_version}`;
    const points = grids.get(id) ?? [];
    points.push({ skill: row.skill_step / (CURVE_POINTS - 1), metric: asNumber(row.metric) });
    grids.set(id, points);
  }
  const offsets = new Map(difficulty.map((row) => [`${row.event}|${row.class}|${row.config_version}`, row]));
  return {
    cells: calibration.map((row) => {
      const id = `${row.event}|${row.class}|${row.config_version}`;
      const grid = grids.get(id) ?? [];
      const offset = offsets.get(id);
      const winRate = offset?.solo_win_rate == null ? null : asNumber(offset.solo_win_rate);
      return {
        event: row.event,
        classId: row.class,
        configVersion: row.config_version,
        status: row.status,
        nRuns: row.n_runs,
        nPlayers: row.n_players,
        metricKind: row.metric_kind as MetricKind,
        curve: curveNumbers(row.curve) ?? [],
        offset: asNumber(offset?.skill_offset ?? 0),
        frozen: offset?.frozen === true,
        manual: offset?.manual === true,
        soloWinRate: winRate != null && Number.isFinite(winRate) ? winRate : null,
        soloCount: offset?.solo_count ?? 0,
        samples: [0.2, 0.5, 0.8].map((skill) => ({ skill, metric: sampleAt(grid, skill) })),
      };
    }),
  };
}

async function mutate(admin: SupabaseClient, body: Record<string, unknown>): Promise<{ ok: true } | { error: string }> {
  const cell = parseKey(
    typeof body.event === 'string' ? body.event : '',
    typeof body.classId === 'string' ? body.classId : '',
    typeof body.configVersion === 'string' ? body.configVersion : '',
  );
  if (!cell) return { error: 'unknown cell' };
  const action = body.action;
  if (action === 'freeze') {
    const frozen = body.frozen === true;
    const saved = await admin.from('npc_difficulty').upsert(
      {
        event: cell.event,
        class: cell.classId,
        config_version: cell.version,
        frozen,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'event,class,config_version' },
    );
    if (saved.error) return { error: saved.error.message };
    return { ok: true };
  }
  if (action === 'offset') {
    const offset = asNumber(body.offset);
    if (!Number.isFinite(offset)) return { error: 'offset required' };
    const saved = await admin.from('npc_difficulty').upsert(
      {
        event: cell.event,
        class: cell.classId,
        config_version: cell.version,
        skill_offset: Math.min(OFFSET_LIMIT, Math.max(-OFFSET_LIMIT, offset)),
        manual: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'event,class,config_version' },
    );
    if (saved.error) return { error: saved.error.message };
    return { ok: true };
  }
  if (action === 'auto') {
    const saved = await admin.from('npc_difficulty').upsert(
      {
        event: cell.event,
        class: cell.classId,
        config_version: cell.version,
        manual: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'event,class,config_version' },
    );
    if (saved.error) return { error: saved.error.message };
    return { ok: true };
  }
  if (action === 'reset') {
    const gridRows = await admin
      .from('npc_calibration_grid')
      .select('skill_step, metric')
      .eq('event', cell.event)
      .eq('class', cell.classId)
      .eq('config_version', cell.version);
    if (gridRows.error) return { error: gridRows.error.message };
    const points = ((gridRows.data ?? []) as { skill_step: number; metric: number | string }[])
      .map((row) => ({ skill: row.skill_step / (CURVE_POINTS - 1), metric: asNumber(row.metric) }))
      .filter((point) => Number.isFinite(point.metric))
      .sort((a, b) => a.skill - b.skill);
    if (points.length !== CURVE_POINTS) return { error: 'grid missing' };
    const curve = defaultCurve(points);
    const saved = await admin.from('npc_calibration').upsert(
      {
        event: cell.event,
        class: cell.classId,
        config_version: cell.version,
        curve,
        n_runs: 0,
        n_players: 0,
        metric_kind: metricKind(cell.event),
        status: 'default',
        computed_at: new Date().toISOString(),
      },
      { onConflict: 'event,class,config_version' },
    );
    if (saved.error) return { error: saved.error.message };
    const difficultySaved = await admin.from('npc_difficulty').upsert(
      {
        event: cell.event,
        class: cell.classId,
        config_version: cell.version,
        skill_offset: 0,
        frozen: false,
        manual: false,
        solo_win_rate: null,
        solo_count: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'event,class,config_version' },
    );
    if (difficultySaved.error) return { error: difficultySaved.error.message };
    return { ok: true };
  }
  return { error: 'unknown action' };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'POST required' }, 405);
  }
  const body = await readJson(req);
  const action = typeof body.action === 'string' ? body.action : 'snapshot';
  const service = serviceRequest(req);
  const caller = service ? null : await callerFromRequest(req);
  if (!service && !caller) {
    return json({ error: 'not authenticated' }, 401);
  }

  const admin = adminClient();
  try {
    if (action === 'run') {
      if (!service) return json({ error: 'admin disabled' }, 403);
      const summary = await runCalibration(admin, Date.now());
      return json(summary);
    }
    if (action === 'snapshot' || action === '') {
      return json(await snapshot(admin));
    }
    if (!service && !adminEnabled()) {
      return json({ error: 'admin disabled' }, 403);
    }
    const result = await mutate(admin, body);
    if ('error' in result) return json(result, 400);
    return json(await snapshot(admin));
  } catch (error) {
    console.error('npc_calibrate failed', error);
    return json({ error: 'calibration failed' }, 500);
  }
});
