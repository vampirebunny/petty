import { wardrobe, outfitSlots, wearItem, type WearItem } from '../actor/wardrobe';
import { fitsSpecies, type SpeciesId } from '../economy/shop';
import { loadShopCatalog } from '../economy/shopState';
import { npcMayWear, parkStranger } from '../playdate/npcs';
import { pickIndex, rngFrom, shuffle } from '../playdate/rng';
import type { OutfitSlot } from '../sim/types';
import { costumeById, rackForTheme, type RunwayCostume, type RunwayThemeId } from './catalog';
import { runwayConfig, type RunwayStyle } from './config';
import {
  costumeToOutfit,
  type FrozenLook,
  type FrozenPiece,
  type LocalRunwayShow,
  type RunwayPetSnap,
  type RunwaySubmission,
} from './types';

type LookRole = 'light' | 'middle' | 'full';

const neutrals = new Set(['#ffffff', '#fff', '#000000', '#000', '#222222', '#26262c', '#3a2a1a', '#c9a27a', '#c98a66', '#888888', '#999999', '#cccccc', '#e8eef5', '#f4f4f4']);

function hexFamily(hex: string): string {
  const h = hex.replace('#', '').toLowerCase();
  if (h.length < 6) {
    return 'other';
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 30) {
    return 'neutral';
  }
  if (r >= g && r >= b) {
    return g > b + 40 ? 'orange' : 'red';
  }
  if (g >= r && g >= b) {
    return 'green';
  }
  if (b >= r && b >= g) {
    return r > 100 ? 'purple' : 'blue';
  }
  return 'other';
}

function isNeutral(hex: string): boolean {
  return neutrals.has(hex.toLowerCase()) || hexFamily(hex) === 'neutral';
}

function colorOk(itemColor: string, costumeColors: string[], style: RunwayStyle): boolean {
  if (style === 'goofy') {
    return true;
  }
  if (isNeutral(itemColor)) {
    return true;
  }
  if (costumeColors.length === 0) {
    return true;
  }
  const family = hexFamily(itemColor);
  return costumeColors.some((c) => hexFamily(c) === family || isNeutral(c));
}

function styleWeight(style: RunwayStyle, tags: readonly string[]): number {
  const table = runwayConfig.styleWeights[style];
  let best = 1;
  for (const tag of tags) {
    const w = table[tag];
    if (w != null && w > best) {
      best = w;
    }
  }
  return best;
}

function weightedPick<T>(rng: () => number, items: T[], weightOf: (item: T) => number): T | undefined {
  if (items.length === 0) {
    return undefined;
  }
  let total = 0;
  const weights = items.map((item) => {
    const w = Math.max(0.01, weightOf(item));
    total += w;
    return w;
  });
  let roll = rng() * total;
  for (let i = 0; i < items.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) {
      return items[i];
    }
  }
  return items[items.length - 1];
}

function freezeCostume(piece: RunwayCostume): FrozenPiece {
  return {
    id: piece.id,
    slot: costumeToOutfit[piece.slot],
    kind: 'costume',
    label: piece.name,
    shape: piece.shape,
    colorway: { ...piece.colorway },
  };
}

function freezeWardrobe(item: WearItem, slot: OutfitSlot): FrozenPiece {
  return {
    id: item.id,
    slot,
    kind: 'wardrobe',
    label: item.label,
    shape: String(item.shape),
    colorway: { ...item.colorway },
    ...(item.patternParts ? { patternParts: item.patternParts } : {}),
    ...(item.lensTint ? { lensTint: item.lensTint } : {}),
  };
}

function shopCatalog() {
  try {
    return loadShopCatalog();
  } catch {
    return null;
  }
}

function wardrobeChoices(species: SpeciesId, usedIds: Set<string>, style: RunwayStyle, costumeColors: string[]): { slot: OutfitSlot; item: WearItem }[] {
  const catalog = shopCatalog();
  const out: { slot: OutfitSlot; item: WearItem }[] = [];
  for (const slot of outfitSlots) {
    for (const item of wardrobe[slot].items) {
      if (item.id === 'none' || usedIds.has(`${slot}:${item.id}`)) {
        continue;
      }
      if (!npcMayWear(slot, item.id, catalog)) {
        continue;
      }
      const listing = catalog?.items.find((row) => row.id === `${slot}:${item.id}`);
      if (listing && !fitsSpecies(listing.species, species)) {
        continue;
      }
      if (!colorOk(item.colorway.c, costumeColors, style)) {
        continue;
      }
      out.push({ slot, item });
    }
  }
  return out;
}

function rolesForNpc(rng: () => number): LookRole[] {
  const roles: LookRole[] = ['light', 'middle', 'full'];
  return shuffle(roles, rng);
}

function buildLook(
  rng: () => number,
  role: LookRole,
  style: RunwayStyle,
  species: SpeciesId,
  rackLeft: RunwayCostume[],
  usedWardrobe: Set<string>,
  usedCostumes: Set<string>,
): { look: FrozenLook; lookNumber: 1 | 2 | 3; claimed: string[] } {
  const pieces: FrozenPiece[] = [];
  const claimed: string[] = [];
  const takenSlots = new Set<string>();

  const wantCostumes = role === 'light' ? 1 : role === 'middle' ? 1 + pickIndex(rng, 2) : 1 + pickIndex(rng, 2);
  const available = rackLeft.filter((piece) => !usedCostumes.has(piece.id));
  const costumePool = shuffle(available, rng);
  let costumeCount = 0;
  for (const piece of costumePool) {
    if (costumeCount >= wantCostumes) {
      break;
    }
    const slot = costumeToOutfit[piece.slot];
    if (takenSlots.has(slot)) {
      continue;
    }
    if (role === 'light' && pieces.length >= 2) {
      break;
    }
    pieces.push(freezeCostume(piece));
    claimed.push(piece.id);
    usedCostumes.add(piece.id);
    takenSlots.add(slot);
    costumeCount += 1;
  }

  const costumeColors = pieces.filter((p) => p.kind === 'costume').map((p) => p.colorway.c);
  const wardrobeNeed =
    role === 'light' ? Math.max(0, 2 + pickIndex(rng, 2) - pieces.length) : role === 'middle' ? 2 + pickIndex(rng, 2) : 3 + pickIndex(rng, 2);

  let guard = 0;
  while (pieces.length < (role === 'light' ? 2 : role === 'full' ? 4 : 3) && guard < 20) {
    guard += 1;
    const choices = wardrobeChoices(species, usedWardrobe, style, costumeColors).filter((row) => !takenSlots.has(row.slot));
    if (role === 'full') {
      const needHead = !takenSlots.has('hat');
      const needFeet = !takenSlots.has('boots');
      if (needHead || needFeet) {
        const forced = choices.filter((row) => (needHead && row.slot === 'hat') || (needFeet && row.slot === 'boots'));
        const pick = weightedPick(rng, forced.length ? forced : choices, (row) => styleWeight(style, [row.slot, String(row.item.shape)]));
        if (!pick) {
          break;
        }
        pieces.push(freezeWardrobe(pick.item, pick.slot));
        usedWardrobe.add(`${pick.slot}:${pick.item.id}`);
        takenSlots.add(pick.slot);
        continue;
      }
    }
    if (pieces.length >= 2 + wardrobeNeed && role !== 'full') {
      break;
    }
    const pick = weightedPick(rng, choices, (row) => styleWeight(style, [row.slot, String(row.item.shape)]));
    if (!pick) {
      break;
    }
    pieces.push(freezeWardrobe(pick.item, pick.slot));
    usedWardrobe.add(`${pick.slot}:${pick.item.id}`);
    takenSlots.add(pick.slot);
    if (role === 'light' && pieces.length >= 3) {
      break;
    }
  }

  if (pieces.length === 0) {
    const fallback = wardrobeChoices(species, usedWardrobe, style, []).filter((row) => !takenSlots.has(row.slot));
    const pick = fallback[0];
    if (pick) {
      pieces.push(freezeWardrobe(pick.item, pick.slot));
      usedWardrobe.add(`${pick.slot}:${pick.item.id}`);
    }
  }

  return { look: { lookNumber: 1, pieces }, lookNumber: 1, claimed };
}

/** Source of NPC pets for a solo show. Swap later without changing dress. */
export function pickNpcModels(show: { id: string }): RunwayPetSnap[] {
  const count = runwayConfig.npcCount;
  const styles = shuffle([...runwayConfig.styles], rngFrom(show.id, 'styles'));
  const pets: RunwayPetSnap[] = [];
  for (let i = 0; i < count; i += 1) {
    const snap = parkStranger(show.id, i + 1);
    pets.push({
      snapshotId: `npc-${show.id}-${i}`,
      source: 'npc',
      name: snap.name,
      species: snap.species,
      breedId: snap.breedId,
      look: { ...snap.look },
      ageDays: snap.ageDays,
      weight: snap.weight,
      style: styles[i % styles.length],
    });
  }
  return pets;
}

export function dressNpcModels(
  showId: string,
  themeId: RunwayThemeId,
  playerClaimed: readonly string[],
  models: RunwayPetSnap[],
): RunwaySubmission[] {
  const rack = rackForTheme(themeId).filter((piece) => !playerClaimed.includes(piece.id));
  const usedCostumes = new Set<string>(playerClaimed);
  const out: RunwaySubmission[] = [];

  models.forEach((pet, index) => {
    const rng = rngFrom(showId, 'dress', index);
    const style = pet.style ?? runwayConfig.styles[index % runwayConfig.styles.length];
    const roles = rolesForNpc(rng);
    const usedWardrobe = new Set<string>();
    const looks: FrozenLook[] = [];
    const claimed: string[] = [];
    roles.forEach((role, lookIndex) => {
      const built = buildLook(rng, role, style, pet.species, rack, usedWardrobe, usedCostumes);
      looks.push({ lookNumber: (lookIndex + 1) as 1 | 2 | 3, pieces: built.look.pieces });
      claimed.push(...built.claimed);
    });
    out.push({
      submissionId: `sub-${showId}-npc-${index}`,
      pet: { ...pet, style },
      looks,
      submittedAt: Date.now() + index,
      claimedCostumeIds: claimed,
    });
  });

  return out;
}

export function freezePlayerLooks(
  looks: { lookNumber: 1 | 2 | 3; wardrobe: Partial<Record<OutfitSlot, string>>; costumes: string[] }[],
): { looks: FrozenLook[]; claimed: string[] } {
  const claimed: string[] = [];
  const frozen: FrozenLook[] = looks.map((look) => {
    const pieces: FrozenPiece[] = [];
    for (const slot of outfitSlots) {
      const id = look.wardrobe[slot];
      if (!id) {
        continue;
      }
      const item = wearItem(slot, id);
      if (item) {
        pieces.push(freezeWardrobe(item, slot));
      }
    }
    for (const costumeId of look.costumes) {
      const piece = costumeById(costumeId);
      if (piece) {
        pieces.push(freezeCostume(piece));
        claimed.push(piece.id);
      }
    }
    return { lookNumber: look.lookNumber, pieces };
  });
  return { looks: frozen, claimed };
}

export function buildSoloShow(args: {
  ownerId: string;
  themeId: RunwayThemeId;
  trackId: string;
  pet: RunwayPetSnap;
  playerLooks: { lookNumber: 1 | 2 | 3; wardrobe: Partial<Record<OutfitSlot, string>>; costumes: string[] }[];
}): LocalRunwayShow {
  const id = `solo-${args.ownerId}-${Date.now()}`;
  const frozen = freezePlayerLooks(args.playerLooks);
  const playerSub: RunwaySubmission = {
    submissionId: `sub-${id}-self`,
    playerId: args.ownerId,
    pet: args.pet,
    looks: frozen.looks,
    submittedAt: Date.now(),
    claimedCostumeIds: frozen.claimed,
  };
  const npcs = pickNpcModels({ id });
  const npcSubs = dressNpcModels(id, args.themeId, frozen.claimed, npcs);
  return {
    id,
    mode: 'solo',
    themeId: args.themeId,
    trackId: args.trackId,
    hostPlayerId: args.ownerId,
    createdAt: Date.now(),
    submissions: [playerSub, ...npcSubs],
  };
}
