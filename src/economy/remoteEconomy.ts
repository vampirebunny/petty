import { getDb } from '../db/database';
import { economyConfig } from './economyConfig';

const META_KEY = 'economyConfig';

function numberField(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function assign(target: object, source: unknown, key: string): void {
  if (!source || typeof source !== 'object') {
    return;
  }
  const value = numberField((source as Record<string, unknown>)[key]);
  if (value != null) {
    (target as Record<string, number>)[key] = value;
  }
}

/** Overlay a downloaded economy_config blob onto the bundled defaults. */
export function applyRemoteEconomy(raw: unknown): void {
  if (!raw || typeof raw !== 'object') {
    return;
  }
  const body = raw as Record<string, unknown>;
  assign(economyConfig.timeAccrual, body.timeAccrual, 'boopsPerHour');
  assign(economyConfig.timeAccrual, body.timeAccrual, 'payoutStep');
  assign(economyConfig.timeAccrual, body.timeAccrual, 'awayCapHours');
  assign(economyConfig.timeAccrual, body.timeAccrual, 'dailyCap');
  assign(economyConfig.firstOpen, body.firstOpen, 'boops');
  assign(economyConfig.streak, body.streak, 'length');
  assign(economyConfig.streak, body.streak, 'bonus');
  assign(economyConfig.streak, body.streak, 'graceDays');
  assign(economyConfig.dayBoundary, body.dayBoundary, 'minGapHours');
  assign(economyConfig.activities, body.activities, 'boops');
  assign(economyConfig.activities, body.activities, 'dailyCap');
  assign(economyConfig.playdate, body.playdate, 'boops');
  assign(economyConfig.playdate, body.playdate, 'dailyCap');
  assign(economyConfig.competition, body.competition, 'finish');
  assign(economyConfig.competition, body.competition, 'top3');
  assign(economyConfig.competition, body.competition, 'dailyCap');
  assign(economyConfig.parkFind, body.parkFind, 'boops');
  assign(economyConfig.parkFind, body.parkFind, 'dailyCap');
  assign(economyConfig.levelUp, body.levelUp, 'boops');
  assign(economyConfig.milestones, body.milestones, 'trickMastered');
  assign(economyConfig.milestones, body.milestones, 'lifeStage');
  assign(economyConfig.secondWind, body.secondWind, 'dailyLimitPerPet');
  assign(economyConfig.secondWind, body.secondWind, 'energy');
  assign(economyConfig, body, 'exclusiveMultiplier');
  assign(economyConfig, body, 'limitedMultiplier');
}

export function loadSavedEconomy(): void {
  const row = getDb().getFirstSync<{ value: string }>('SELECT value FROM meta WHERE key = ?', META_KEY);
  if (!row?.value) {
    return;
  }
  try {
    applyRemoteEconomy(JSON.parse(row.value));
  } catch {
    // A bad cache keeps the bundled defaults.
  }
}

export function saveEconomyConfig(raw: unknown): void {
  applyRemoteEconomy(raw);
  getDb().runSync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', META_KEY, JSON.stringify(raw));
}
