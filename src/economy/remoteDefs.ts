import Constants from 'expo-constants';

import { bindRemoteWear, KNOWN_PATTERNS, KNOWN_SHAPES, PATTERN_PARTS, wardrobe, type CollarAccent, type WearItem } from '../actor/wardrobe';
import { getDb } from '../db/database';
import { setExtraTreatArt, clearExtraTreatArt, KNOWN_REACTIONS, KNOWN_TREAT_ART, type TreatArt, type TreatArtTemplate } from './treatArt';
import { bindRemoteCatalog, catalog, type CatalogItem, type ItemKind, type TreatEffects, type TreatReaction } from './catalog';
import type { ItemDef, SpeciesId } from './shop';
import type { OutfitSlot } from '../sim/types';

export const TREAT_EFFECT_FIELDS = ['casual', 'training', 'fill'] as const;

type Accepted = {
  itemDef: ItemDef;
  catalog: CatalogItem;
  wear: WearItem | null;
  art: TreatArt | null;
};

type Envelope = { name: string; def: unknown };

const memory = new Map<string, Accepted>();
let preview: Accepted | null = null;
let loaded = false;
let versionOverride: string | null = null;
const warned = new Set<string>();

const slots = new Set<OutfitSlot>(['hat', 'glasses', 'neckwear', 'jacket', 'boots']);
const accents = new Set<CollarAccent>(['tag', 'bell', 'studs']);
const hex = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function appVersion(): string {
  return versionOverride ?? Constants.expoConfig?.version ?? '1.0.0';
}

export function setAppVersionForTest(version: string | null): void {
  versionOverride = version;
}

export function versionAllows(min: string | null | undefined, current = appVersion()): boolean {
  if (min == null || min.trim() === '') {
    return true;
  }
  const required = semver(min);
  const running = semver(current);
  if (!required || !running) {
    return false;
  }
  for (let i = 0; i < 3; i += 1) {
    const have = running[i] ?? 0;
    const need = required[i] ?? 0;
    if (have > need) {
      return true;
    }
    if (have < need) {
      return false;
    }
  }
  return true;
}

function semver(value: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value.trim());
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function warnOnce(id: string, message: string): void {
  if (warned.has(id)) {
    return;
  }
  warned.add(id);
  console.warn(message);
}

export function isBundledItemId(id: string): boolean {
  if (catalog.some((item) => item.id === id)) {
    return true;
  }
  const split = id.split(':');
  if (split.length !== 2) {
    return false;
  }
  const [slot, wearId] = split;
  if (!slots.has(slot as OutfitSlot)) {
    return false;
  }
  return wardrobe[slot as OutfitSlot].items.some((item) => item.id === wearId);
}

function onlyKeys(value: object, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isSpecies(value: unknown): value is SpeciesId[] {
  return Array.isArray(value) && value.length > 0 && value.every((entry) => entry === 'dog' || entry === 'cat');
}

function speciesClash(rowSpecies: SpeciesId[] | null | undefined, defSpecies: SpeciesId[] | null): boolean {
  if (rowSpecies == null || rowSpecies.length === 0 || defSpecies == null || defSpecies.length === 0) {
    return false;
  }
  const left = [...rowSpecies].sort().join(',');
  const right = [...defSpecies].sort().join(',');
  return left !== right;
}

function readEffects(value: unknown): { hunger: number; weight: number; mood: number } | null {
  if (!value || typeof value !== 'object' || !onlyKeys(value, ['hunger', 'weight', 'mood'])) {
    return null;
  }
  const row = value as { hunger?: unknown; weight?: unknown; mood?: unknown };
  if (typeof row.hunger !== 'number' || typeof row.weight !== 'number' || typeof row.mood !== 'number') {
    return null;
  }
  if (!Number.isFinite(row.hunger) || !Number.isFinite(row.weight) || !Number.isFinite(row.mood)) {
    return null;
  }
  return { hunger: row.hunger, weight: row.weight, mood: row.mood };
}

function acceptDef(id: string, def: unknown, rowSpecies: SpeciesId[] | null | undefined, name: string): Accepted | null {
  if (!def || typeof def !== 'object' || Array.isArray(def)) {
    return null;
  }
  const row = def as { v?: unknown; kind?: unknown };
  if (row.v !== 1 || (row.kind !== 'outfit' && row.kind !== 'treat')) {
    return null;
  }
  if (row.kind === 'outfit') {
    return acceptOutfit(id, def, rowSpecies, name);
  }
  return acceptTreat(id, def, rowSpecies, name);
}

function acceptOutfit(id: string, def: object, _rowSpecies: SpeciesId[] | null | undefined, name: string): Accepted | null {
  if (!onlyKeys(def, ['v', 'kind', 'slot', 'shape', 'label', 'colorway', 'patternParts', 'lensTint'])) {
    return null;
  }
  const row = def as {
    slot?: unknown;
    shape?: unknown;
    label?: unknown;
    colorway?: unknown;
    patternParts?: unknown;
    lensTint?: unknown;
  };
  if (typeof row.slot !== 'string' || !slots.has(row.slot as OutfitSlot)) {
    return null;
  }
  const slot = row.slot as OutfitSlot;
  const wearId = id.startsWith(`${slot}:`) ? id.slice(slot.length + 1) : '';
  if (!wearId || wearId.includes(':') || id !== `${slot}:${wearId}`) {
    return null;
  }
  if (typeof row.shape !== 'string' || !KNOWN_SHAPES[slot].includes(row.shape)) {
    return null;
  }
  if (typeof row.label !== 'string' || row.label.trim() === '') {
    return null;
  }
  if (!row.colorway || typeof row.colorway !== 'object' || Array.isArray(row.colorway)) {
    return null;
  }
  if (!onlyKeys(row.colorway, ['c', 'd', 'pattern', 'accent'])) {
    return null;
  }
  const colorway = row.colorway as { c?: unknown; d?: unknown; pattern?: unknown; accent?: unknown };
  if (typeof colorway.c !== 'string' || !hex.test(colorway.c)) {
    return null;
  }
  if (colorway.d != null && (typeof colorway.d !== 'string' || !hex.test(colorway.d))) {
    return null;
  }
  if (colorway.pattern != null && (typeof colorway.pattern !== 'string' || !KNOWN_PATTERNS.includes(colorway.pattern as (typeof KNOWN_PATTERNS)[number]))) {
    return null;
  }
  const parts = PATTERN_PARTS[row.shape] ?? [];
  if (colorway.pattern != null && parts.length === 0) {
    return null;
  }
  if (colorway.accent != null && (row.shape !== 'collar' || typeof colorway.accent !== 'string' || !accents.has(colorway.accent as CollarAccent))) {
    return null;
  }
  let patternParts: string[] | undefined;
  if (row.patternParts != null) {
    if (!Array.isArray(row.patternParts) || colorway.pattern == null) {
      return null;
    }
    if (!row.patternParts.every((part) => typeof part === 'string' && parts.includes(part))) {
      return null;
    }
    patternParts = row.patternParts as string[];
  }
  if (row.lensTint != null && (slot !== 'glasses' || typeof row.lensTint !== 'string' || !hex.test(row.lensTint))) {
    return null;
  }
  const wear: WearItem = {
    id: wearId,
    slot,
    label: row.label,
    shape: row.shape,
    colorway: {
      c: colorway.c,
      ...(typeof colorway.d === 'string' ? { d: colorway.d } : {}),
      ...(typeof colorway.pattern === 'string' ? { pattern: colorway.pattern as WearItem['colorway']['pattern'] } : {}),
      ...(typeof colorway.accent === 'string' ? { accent: colorway.accent as CollarAccent } : {}),
    },
    ...(patternParts ? { patternParts } : {}),
    ...(typeof row.lensTint === 'string' ? { lensTint: row.lensTint } : {}),
  };
  const catalogItem: CatalogItem = {
    id,
    name: name || row.label,
    kind: 'outfit',
    price: null,
    available: true,
    slot,
    wearId,
  };
  return {
    itemDef: { id, name: catalogItem.name, kind: 'outfit', slot, wearId },
    catalog: catalogItem,
    wear,
    art: null,
  };
}

function acceptTreat(id: string, def: object, rowSpecies: SpeciesId[] | null | undefined, name: string): Accepted | null {
  if (id.includes(':') || !/^[a-z0-9_]+$/.test(id)) {
    return null;
  }
  if (!onlyKeys(def, ['v', 'kind', 'reaction', 'art', 'effects', 'species'])) {
    return null;
  }
  const row = def as {
    reaction?: unknown;
    art?: unknown;
    effects?: unknown;
    species?: unknown;
  };
  if (typeof row.reaction !== 'string' || !KNOWN_REACTIONS.includes(row.reaction as (typeof KNOWN_REACTIONS)[number])) {
    return null;
  }
  if (!row.art || typeof row.art !== 'object' || Array.isArray(row.art) || !onlyKeys(row.art, ['template', 'c', 'd'])) {
    return null;
  }
  const art = row.art as { template?: unknown; c?: unknown; d?: unknown };
  if (typeof art.template !== 'string' || !KNOWN_TREAT_ART.includes(art.template as TreatArtTemplate)) {
    return null;
  }
  if (typeof art.c !== 'string' || !hex.test(art.c)) {
    return null;
  }
  if (art.d != null && (typeof art.d !== 'string' || !hex.test(art.d))) {
    return null;
  }
  if (!row.effects || typeof row.effects !== 'object' || Array.isArray(row.effects) || !onlyKeys(row.effects, TREAT_EFFECT_FIELDS)) {
    return null;
  }
  const effects = row.effects as { casual?: unknown; training?: unknown; fill?: unknown };
  const casual = effects.casual == null ? undefined : readEffects(effects.casual);
  if (effects.casual != null && !casual) {
    return null;
  }
  const training = effects.training === null ? null : effects.training == null ? undefined : readEffects(effects.training);
  if (effects.training != null && effects.training !== null && !training) {
    return null;
  }
  if (effects.fill != null && effects.fill !== 'energy' && effects.fill !== 'mood') {
    return null;
  }
  if (effects.fill == null && !casual && !training) {
    return null;
  }
  let species: SpeciesId[] | null = null;
  if (row.species != null) {
    if (!isSpecies(row.species)) {
      return null;
    }
    species = row.species;
  }
  if (speciesClash(rowSpecies, species)) {
    return null;
  }
  const treatArt: TreatArt = {
    template: art.template as TreatArtTemplate,
    c: art.c,
    ...(typeof art.d === 'string' ? { d: art.d } : {}),
  };
  const catalogItem: CatalogItem = {
    id,
    name: name || id,
    kind: 'treat' satisfies ItemKind,
    price: null,
    available: true,
    ...(species ? { species } : {}),
    reaction: row.reaction as TreatReaction,
    effects: {
      ...(casual ? { casual: casual as TreatEffects } : {}),
      ...(training !== undefined ? { training: training as TreatEffects | null } : {}),
      ...(effects.fill === 'energy' || effects.fill === 'mood' ? { fill: effects.fill } : {}),
    },
  };
  return {
    itemDef: { id, name: catalogItem.name, kind: 'treat', ...(species ? { species } : {}) },
    catalog: catalogItem,
    wear: null,
    art: treatArt,
  };
}

export type RemoteDefRow = {
  id: string;
  name?: string;
  species?: SpeciesId[] | null;
  def?: unknown;
  minAppVersion?: string | null;
};

export function explainRemoteRow(row: RemoteDefRow): 'hide' | 'omit' | 'invalid' | 'bundled' | 'ok' {
  if (!versionAllows(row.minAppVersion)) {
    return 'hide';
  }
  if (isBundledItemId(row.id)) {
    if (row.def != null) {
      warnOnce(row.id, `remote def for bundled item ${row.id} ignored`);
    }
    return 'bundled';
  }
  if (row.def == null) {
    return 'invalid';
  }
  const accepted = acceptDef(row.id, row.def, row.species, row.name ?? row.id);
  if (!accepted) {
    const probe = acceptDef(row.id, row.def, null, row.name ?? row.id);
    return probe ? 'omit' : 'invalid';
  }
  return 'ok';
}

export function remoteItemDef(row: RemoteDefRow): ItemDef | null {
  if (!versionAllows(row.minAppVersion) || isBundledItemId(row.id) || row.def == null) {
    if (isBundledItemId(row.id) && row.def != null) {
      warnOnce(row.id, `remote def for bundled item ${row.id} ignored`);
    }
    return null;
  }
  return acceptDef(row.id, row.def, row.species, row.name ?? row.id)?.itemDef ?? null;
}

function rememberOne(row: RemoteDefRow, version: number, persist: (id: string, json: string, version: number) => void): void {
  if (!versionAllows(row.minAppVersion) || isBundledItemId(row.id) || row.def == null || memory.has(row.id)) {
    if (isBundledItemId(row.id) && row.def != null) {
      warnOnce(row.id, `remote def for bundled item ${row.id} ignored`);
    }
    return;
  }
  const accepted = acceptDef(row.id, row.def, row.species, row.name ?? row.id);
  if (!accepted) {
    return;
  }
  const envelope: Envelope = { name: row.name ?? accepted.catalog.name, def: row.def };
  memory.set(row.id, accepted);
  if (accepted.art) {
    setExtraTreatArt(row.id, accepted.art);
  }
  persist(row.id, JSON.stringify(envelope), version);
}

function persistSqlite(id: string, json: string, version: number): void {
  try {
    getDb().runSync(
      'INSERT INTO item_defs (id, def_json, first_seen_version) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING',
      id,
      json,
      version,
    );
  } catch (error) {
    console.warn('item_defs insert failed', error);
  }
}

function hydrate(id: string, json: string): void {
  if (memory.has(id) || isBundledItemId(id)) {
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return;
  }
  const envelope = parsed as Envelope;
  const def = envelope && typeof envelope === 'object' && 'def' in envelope ? envelope.def : parsed;
  const name = envelope && typeof envelope === 'object' && typeof envelope.name === 'string' ? envelope.name : id;
  const accepted = acceptDef(id, def, null, name);
  if (!accepted) {
    return;
  }
  memory.set(id, accepted);
  if (accepted.art) {
    setExtraTreatArt(id, accepted.art);
  }
}

export function ensureRemoteDefs(): void {
  if (loaded) {
    return;
  }
  loaded = true;
  try {
    const rows = getDb().getAllSync<{ id: string; def_json: string }>('SELECT id, def_json FROM item_defs');
    for (const row of rows) {
      hydrate(row.id, row.def_json);
    }
  } catch {
    // Tests and a missing native db still resolve bundled items.
  }
}

export function rememberActiveDefs(
  remote: { version: number; items: RemoteDefRow[] },
  persist: (id: string, json: string, version: number) => void = persistSqlite,
): void {
  ensureRemoteDefs();
  for (const row of remote.items) {
    rememberOne(row, remote.version, persist);
  }
}

export function remoteItemDefs(): ItemDef[] {
  ensureRemoteDefs();
  return [...memory.values()].map((accepted) => accepted.itemDef);
}

export function remoteWearItem(slot: OutfitSlot, id: string): WearItem | null {
  ensureRemoteDefs();
  if (preview?.wear && preview.wear.slot === slot && preview.wear.id === id) {
    return preview.wear;
  }
  return memory.get(`${slot}:${id}`)?.wear ?? null;
}

export function remoteCatalogItem(id: string): CatalogItem | null {
  ensureRemoteDefs();
  if (preview?.catalog.id === id) {
    return preview.catalog;
  }
  return memory.get(id)?.catalog ?? null;
}

export function setRemotePreview(row: RemoteDefRow | null): string | null {
  if (!row) {
    if (preview?.art) {
      setExtraTreatArt(preview.catalog.id, null);
    }
    preview = null;
    return null;
  }
  const why = explainRemoteRow(row);
  if (why !== 'ok') {
    return why;
  }
  const accepted = acceptDef(row.id, row.def, row.species, row.name ?? row.id);
  if (!accepted) {
    return 'invalid';
  }
  if (preview?.art) {
    setExtraTreatArt(preview.catalog.id, null);
  }
  preview = accepted;
  if (accepted.art) {
    setExtraTreatArt(row.id, accepted.art);
  }
  return null;
}

export function resetRemoteDefsForTest(): void {
  memory.clear();
  preview = null;
  loaded = true;
  warned.clear();
  clearExtraTreatArt();
}

export function reloadRetainedForTest(rows: { id: string; def_json: string }[]): void {
  resetRemoteDefsForTest();
  for (const row of rows) {
    hydrate(row.id, row.def_json);
  }
}

bindRemoteWear(remoteWearItem);
bindRemoteCatalog(remoteCatalogItem);
