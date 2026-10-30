import { adminClient, callerFromRequest, json, readJson } from '../_shared/supabase.ts';
import {
  REPLAY_MAX_INPUT_BYTES,
  classIdOf,
  finishMismatch,
  flagBotLike,
  inputLogBytes,
  isReplayEvent,
  parseInputLog,
  parseModifiers,
  replayNpc,
  replayPlayer,
  scoreMismatch,
  type RaceInputLog,
  type ReplayFinish,
  type ReplayRace,
} from '../_shared/race-sim/index.ts';

type EntryRow = {
  id: string;
  is_npc: boolean;
  player_id: string | null;
  status: string;
  skill: number | null;
  modifiers: unknown;
  finish_ms: number | null;
};

function npcPayload(entryId: string, finish: ReplayFinish): Record<string, unknown> {
  if (finish.finishMs == null) {
    return { entry_id: entryId, finish_ms: null };
  }
  return {
    entry_id: entryId,
    finish_ms: Math.round(finish.finishMs),
    ...(finish.scoreDm == null
      ? {}
      : {
          score_dm: finish.scoreDm,
          detail: finish.detail,
        }),
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'POST required' }, 405);
  }
  const caller = await callerFromRequest(req);
  if (!caller) {
    return json({ error: 'not authenticated' }, 401);
  }

  const body = await readJson(req);
  const raceId = typeof body.raceId === 'string' ? body.raceId : '';
  if (!raceId) {
    return json({ error: 'raceId required' }, 400);
  }
  const claimedFinishMs =
    typeof body.claimedFinishMs === 'number' && Number.isFinite(body.claimedFinishMs)
      ? Math.round(body.claimedFinishMs)
      : body.claimedFinishMs === null
        ? null
        : undefined;
  const claimedScoreDm =
    typeof body.claimedScoreDm === 'number' && Number.isFinite(body.claimedScoreDm)
      ? Math.round(body.claimedScoreDm)
      : undefined;

  const admin = adminClient();
  const loaded = await admin
    .from('races')
    .select('id, status, class, seed, config_version, event_id')
    .eq('id', raceId)
    .maybeSingle();

  if (loaded.error) {
    console.error('race_report load failed', loaded.error);
    return json({ error: 'load failed' }, 500);
  }
  if (!loaded.data) {
    return json({ error: 'race not found' }, 404);
  }

  const eventRow = await admin
    .from('competition_events')
    .select('event_type')
    .eq('id', loaded.data.event_id)
    .maybeSingle();
  if (eventRow.error || !eventRow.data) {
    return json({ error: 'event not found' }, 404);
  }
  const eventRaw = eventRow.data.event_type;
  if (!isReplayEvent(eventRaw)) {
    return json({ error: 'unsupported event' }, 400);
  }

  const entryRows = await admin
    .from('race_entries')
    .select('id, is_npc, player_id, status, skill, modifiers, finish_ms')
    .eq('race_id', raceId);
  if (entryRows.error) {
    console.error('race_report entries failed', entryRows.error);
    return json({ error: 'load failed' }, 500);
  }

  const entries = (entryRows.data ?? []) as EntryRow[];
  const mine = entries.find(
    (row) => row.player_id === caller.id && !row.is_npc && (row.status === 'checked_in' || row.status === 'finished'),
  );
  if (!mine) {
    return json({ error: 'not in race' }, 403);
  }

  if (loaded.data.status === 'finished' || mine.finish_ms != null || mine.status === 'finished') {
    const state = await admin.rpc('race_state_for', { p_race_id: raceId, p_viewer_id: caller.id });
    if (state.error) {
      return json({ error: state.error.message }, 500);
    }
    return json(state.data);
  }

  const race: ReplayRace = {
    event: eventRaw,
    classId: classIdOf(loaded.data.class),
    seed: typeof loaded.data.seed === 'string' ? loaded.data.seed : '',
    configVersion: typeof loaded.data.config_version === 'string' ? loaded.data.config_version : 'funrun-2',
  };

  const inputLog = parseInputLog(race.event, body.inputLog, race.configVersion);
  if (!inputLog) {
    return json({ error: 'bad inputLog' }, 400);
  }
  if (inputLogBytes(inputLog) > REPLAY_MAX_INPUT_BYTES) {
    return json({ error: 'inputLog too large' }, 400);
  }

  const player = replayPlayer(race, parseModifiers(mine.modifiers), inputLog);
  const npcs = entries.filter((row) => row.is_npc && row.status === 'checked_in' && row.finish_ms == null);
  const npcFinishes = npcs.map((row) => npcPayload(row.id, replayNpc(race, row.id, row.skill ?? 0.5)));

  const flags: {
    kind: 'mismatch' | 'bot_like';
    claimed_finish_ms: number | null;
    replayed_finish_ms: number | null;
    detail: Record<string, unknown>;
  }[] = [];

  if (finishMismatch(claimedFinishMs, player.finishMs) || scoreMismatch(claimedScoreDm, player.scoreDm)) {
    flags.push({
      kind: 'mismatch',
      claimed_finish_ms: claimedFinishMs ?? null,
      replayed_finish_ms: player.finishMs,
      detail: {
        claimedScoreDm: claimedScoreDm ?? null,
        replayedScoreDm: player.scoreDm,
      },
    });
  }
  if (flagBotLike(player.acceptedTaps)) {
    flags.push({
      kind: 'bot_like',
      claimed_finish_ms: claimedFinishMs ?? null,
      replayed_finish_ms: player.finishMs,
      detail: { accepted: player.acceptedTaps.length },
    });
  }

  for (const flag of flags) {
    const inserted = await admin.from('race_report_flags').insert({
      race_id: raceId,
      entry_id: mine.id,
      kind: flag.kind,
      claimed_finish_ms: flag.claimed_finish_ms,
      replayed_finish_ms: flag.replayed_finish_ms,
      detail: flag.detail,
    });
    if (inserted.error) {
      console.error('race_report flag insert failed', inserted.error);
    }
  }

  const applied = await admin.rpc('apply_verified_race_report', {
    p_race_id: raceId,
    p_player_id: caller.id,
    p_finish_ms: player.finishMs == null ? null : Math.round(player.finishMs),
    p_npc_finishes: npcFinishes,
    p_score_dm: player.scoreDm,
    p_detail: player.detail,
    p_input_log: inputLog as RaceInputLog,
  });
  if (applied.error) {
    console.error('apply_verified_race_report failed', applied.error);
    return json({ error: applied.error.message }, 500);
  }
  return json(applied.data);
});
