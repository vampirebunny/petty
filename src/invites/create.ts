import { track } from '../analytics/analytics';
import { localDay } from '../economy/clock';
import { serverNow } from '../db/accountMeta';
import { runwayThemes, runwayTracks, themeById, type RunwayThemeId } from '../runway/catalog';
import { dressNpcModels, pickNpcModels } from '../runway/npcs';
import { classForEvent, classForLevel, isPlayableEvent } from '../sim/stadium';
import type { PetState } from '../sim/types';
import { fetchBoard, type StadiumBoard } from '../stadium/api';
import { inviteConfig } from './config';
import { soonestRace } from './pick';
import { cancelNpcPush } from './push';
import { chooseFormat, daySpent, formatEligible, formatTrigger, spendDay } from './schedule';
import { loadCounters, saveCounters } from './store';
import type { Invitation, InviteFormat, InviteSurface, RaceOption } from './types';

export function boardRaceOptions(board: StadiumBoard): RaceOption[] {
  return board.slots.flatMap((slot) =>
    slot.events.map((card) => ({
      eventId: card.id,
      event: card.event,
      cup: card.cup,
      classId: classForEvent(card.event, card.cup, board.classId),
      state: card.state,
      startsAt: slot.startsAt,
    })),
  );
}

function pickTheme(seen: readonly string[]): { id: RunwayThemeId; isNew: boolean } {
  const unseen = runwayThemes.filter((theme) => !seen.includes(theme.id));
  const pool = unseen.length > 0 ? unseen : runwayThemes;
  const theme = pool[Math.floor(Math.random() * pool.length)] ?? runwayThemes[0];
  return { id: theme.id, isNew: unseen.length > 0 };
}

function bibNumber(): number {
  const span = inviteConfig.bibMax - inviteConfig.bibMin + 1;
  return inviteConfig.bibMin + Math.floor(Math.random() * span);
}

export async function createInvitation(
  pet: PetState,
  surface: InviteSurface,
  linked: boolean,
): Promise<Invitation | null> {
  if (!pet.ownerId) {
    return null;
  }
  const now = Date.now();
  const today = localDay(now);
  const counters = await loadCounters(pet.ownerId);
  if (daySpent(counters, today)) {
    return null;
  }

  const themePick = pickTheme(counters.seenThemeIds);
  const runwayNew = counters.runway.offered && themePick.isNew;
  const classId = classForLevel(pet.level);
  const mastered = Object.entries(pet.training)
    .filter(([, row]) => row?.mastered)
    .map(([id]) => id);
  const raceNew =
    counters.race.offered &&
    ((counters.lastClass != null && counters.lastClass !== classId) ||
      mastered.some((id) => !counters.seenTrickIds.includes(id)));
  const runwayOk = formatEligible(counters.runway, pet.openedDays, now, runwayNew);
  let options: RaceOption[] = [];
  if (linked && formatEligible(counters.race, pet.openedDays, now, raceNew)) {
    const board = await fetchBoard(pet.id);
    if (board.ok) {
      options = boardRaceOptions(board.data);
    }
  }
  const raceCard = soonestRace(options, serverNow(), !counters.race.offered);
  const format = chooseFormat(runwayOk, raceCard != null, counters.lastFormat, runwayNew, raceNew && raceCard != null);
  if (!format) {
    return null;
  }

  const createdAt = now;
  let invitation: Invitation;
  if (format === 'race' && raceCard) {
    const trigger = formatTrigger(counters.race, raceNew);
    invitation = {
      id: `invite-${createdAt}`,
      type: 'race',
      createdAt,
      expiresAt: raceCard.startsAt,
      surface,
      trigger,
      eventId: raceCard.eventId,
      event: raceCard.event,
      cup: raceCard.cup,
      classId: raceCard.classId,
      startsAt: raceCard.startsAt,
      bib: bibNumber(),
    };
  } else if (runwayOk) {
    const showId = `invite-${pet.ownerId}-${createdAt}`;
    const themeName = themeById(themePick.id)?.name ?? themePick.id;
    const track = runwayTracks[Math.floor(Math.random() * runwayTracks.length)] ?? runwayTracks[0];
    const models = pickNpcModels({ id: showId });
    invitation = {
      id: `invite-${createdAt}`,
      type: 'runway',
      createdAt,
      expiresAt: createdAt + inviteConfig.runwayExpireMs,
      surface,
      trigger: formatTrigger(counters.runway, runwayNew),
      themeId: themePick.id,
      themeName,
      trackId: track.id,
      showId,
      npcSubmissions: dressNpcModels(showId, themePick.id, [], models),
    };
  } else {
    return null;
  }

  const spent = spendDay(counters, today, invitation.type, pet.openedDays);
  await saveCounters(pet.ownerId, {
    ...spent,
    seenThemeIds:
      invitation.type === 'runway' ? [...new Set([...spent.seenThemeIds, invitation.themeId])] : spent.seenThemeIds,
    seenTrickIds: invitation.type === 'race' ? mastered : spent.seenTrickIds,
    lastClass: invitation.type === 'race' ? classId : spent.lastClass,
  });
  await cancelNpcPush();
  track('invite_created', {
    type: invitation.type,
    subject: invitation.type === 'runway' ? invitation.themeId : invitation.event,
    trigger: invitation.trigger,
  });
  track('invite_shown', { type: invitation.type, surface });
  return invitation;
}

/** Development only. Builds an invitation without spending the day or writing scheduler counters. */
export async function createDebugInvitation(
  pet: PetState,
  format: InviteFormat,
  linked: boolean,
): Promise<Invitation | null> {
  if (!pet.ownerId) {
    return null;
  }
  const createdAt = Date.now();
  if (format === 'race') {
    const now = serverNow();
    let board: Awaited<ReturnType<typeof fetchBoard>> | null = null;
    if (linked) {
      try {
        board = await fetchBoard(pet.id);
      } catch {
        board = null;
      }
    }
    const options = board?.ok ? boardRaceOptions(board.data) : [];
    const future = options
      .filter((row) => isPlayableEvent(row.event) && row.startsAt > now + 15_000)
      .sort((a, b) => a.startsAt - b.startsAt);
    const raceCard = future.find((row) => row.state === 'open') ?? future[0] ?? null;
    const startsAt = raceCard?.startsAt ?? now + 5 * 60 * 1000;
    return {
      id: `invite-debug-${createdAt}`,
      type: 'race',
      createdAt,
      expiresAt: startsAt,
      surface: 'in_app',
      trigger: 'first',
      eventId: raceCard?.eventId ?? '',
      event: raceCard?.event ?? 'funRun',
      cup: raceCard?.cup ?? 'open',
      classId: raceCard?.classId ?? classForLevel(pet.level),
      startsAt,
      bib: bibNumber(),
    };
  }
  const counters = await loadCounters(pet.ownerId);
  const themePick = pickTheme(counters.seenThemeIds);
  const showId = `invite-${pet.ownerId}-${createdAt}`;
  const track = runwayTracks[Math.floor(Math.random() * runwayTracks.length)] ?? runwayTracks[0];
  const models = pickNpcModels({ id: showId });
  return {
    id: `invite-debug-${createdAt}`,
    type: 'runway',
    createdAt,
    expiresAt: createdAt + inviteConfig.runwayExpireMs,
    surface: 'in_app',
    trigger: 'first',
    themeId: themePick.id,
    themeName: themeById(themePick.id)?.name ?? themePick.id,
    trackId: track.id,
    showId,
    npcSubmissions: dressNpcModels(showId, themePick.id, [], models),
  };
}
