import { testPet } from '../__fixtures__/pets';
import * as catalog from '../../economy/catalog';
import {
  applyDailyPick,
  armDailyOutfit,
  clearDailyOutfit,
  dailyOutfitDue,
  noteManualOutfit,
  pickDailyOutfit,
  sameOutfit,
  silenceDressedUp,
  type OwnedWear,
} from '../dailyOutfit';
import { gameplayConfig } from '../gameplayConfig';
import type { Equipped, OutfitSlot } from '../types';

const starters: OwnedWear[] = [
  { slot: 'neckwear', id: 'collar' },
  { slot: 'neckwear', id: 'bandana' },
  { slot: 'neckwear', id: 'scarf' },
  { slot: 'hat', id: 'beanie' },
  { slot: 'glasses', id: 'red-rim' },
  { slot: 'jacket', id: 'puffer' },
  { slot: 'boots', id: 'red' },
];

function wornCount(outfit: Equipped): number {
  return Object.values(outfit).filter((id) => Boolean(id)).length;
}

function pick(partial: Partial<Parameters<typeof pickDailyOutfit>[0]> = {}) {
  return pickDailyOutfit({
    owned: starters,
    species: 'dog',
    previous: {},
    tilt: false,
    seed: 4,
    day: '2026-10-30',
    ...partial,
  });
}

it('wears only owned pieces, one per slot, and at least one', () => {
  const outfit = pick();
  expect(outfit).not.toBeNull();
  expect(wornCount(outfit!)).toBeGreaterThan(0);
  for (const slot of Object.keys(outfit!) as OutfitSlot[]) {
    expect(starters.some((item) => item.slot === slot && item.id === outfit![slot])).toBe(true);
  }
});

it('skips a slot the pet owns nothing for', () => {
  const outfit = pick({
    owned: [
      { slot: 'hat', id: 'beanie' },
      { slot: 'boots', id: 'red' },
    ],
  });
  expect(outfit?.glasses).toBeUndefined();
  expect(outfit?.jacket).toBeUndefined();
  expect(outfit?.neckwear).toBeUndefined();
});

it('drops an item the species cannot wear', () => {
  const real = catalog.catalogItem;
  const spy = jest.spyOn(catalog, 'catalogItem').mockImplementation((id: string) => {
    const item = real(id);
    if (id === 'hat:beanie' && item) {
      return { ...item, species: ['cat'] };
    }
    return item;
  });
  try {
    const outfit = pick({
      owned: [
        { slot: 'hat', id: 'beanie' },
        { slot: 'boots', id: 'red' },
      ],
      species: 'dog',
    });
    expect(outfit?.hat).toBeUndefined();
    expect(outfit?.boots).toBe('red');
  } finally {
    spy.mockRestore();
  }
});

it('wears one item when every slot misses', () => {
  const saved = gameplayConfig.dailyOutfit.slotChance;
  gameplayConfig.dailyOutfit.slotChance = 0;
  try {
    const outfit = pick({ seed: 9 });
    expect(wornCount(outfit!)).toBe(1);
  } finally {
    gameplayConfig.dailyOutfit.slotChance = saved;
  }
});

it('returns null when nothing owned can be worn', () => {
  expect(pick({ owned: [{ slot: 'hat', id: 'not-a-hat' }] })).toBeNull();
  expect(pick({ owned: [] })).toBeNull();
});

it('does not repeat the previous outfit when another one exists', () => {
  const savedChance = gameplayConfig.dailyOutfit.slotChance;
  const savedTries = gameplayConfig.dailyOutfit.maxRetries;
  gameplayConfig.dailyOutfit.slotChance = 0;
  gameplayConfig.dailyOutfit.maxRetries = 40;
  try {
    const first = pick({
      owned: [
        { slot: 'hat', id: 'beanie' },
        { slot: 'boots', id: 'red' },
      ],
      seed: 2,
    });
    const second = pick({
      owned: [
        { slot: 'hat', id: 'beanie' },
        { slot: 'boots', id: 'red' },
      ],
      seed: 2,
      previous: first!,
    });
    expect(sameOutfit(first!, second!)).toBe(false);
  } finally {
    gameplayConfig.dailyOutfit.slotChance = savedChance;
    gameplayConfig.dailyOutfit.maxRetries = savedTries;
  }
});

it('accepts a repeat when only one item is owned', () => {
  const only = [{ slot: 'hat' as const, id: 'beanie' }];
  const outfit = pick({ owned: only, previous: { hat: 'beanie' } });
  expect(outfit).toEqual({ hat: 'beanie' });
});

it('raises jacket and boot odds in bad weather without guaranteeing them', () => {
  const owned: OwnedWear[] = [
    { slot: 'hat', id: 'beanie' },
    { slot: 'jacket', id: 'puffer' },
    { slot: 'boots', id: 'red' },
  ];
  let plain = 0;
  let tilted = 0;
  let tiltedMiss = 0;
  const samples = 400;
  for (let seed = 0; seed < samples; seed += 1) {
    const base = pick({ owned, seed, day: '2026-01-02' });
    const cold = pick({ owned, seed, day: '2026-01-02', tilt: true });
    if (base?.jacket) plain += 1;
    if (cold?.jacket) tilted += 1;
    if (!cold?.jacket || !cold?.boots) tiltedMiss += 1;
  }
  expect(tilted).toBeGreaterThan(plain);
  expect(tiltedMiss).toBeGreaterThan(0);
});

it('picks on a later local day only', () => {
  const pet = testPet(1, 'retriever', 1, 'Maple', 'pet');
  expect(dailyOutfitDue(pet, '2026-10-30')).toBe(false);
  const armed = armDailyOutfit(pet, '2026-10-30');
  expect(armed.dailyOutfitEnabled).toBe(true);
  expect(armed.equipped).toEqual(pet.equipped);
  expect(dailyOutfitDue(armed, '2026-10-30')).toBe(false);
  expect(dailyOutfitDue(armed, '2026-10-29')).toBe(false);
  expect(dailyOutfitDue(armed, '2026-10-31')).toBe(true);
  expect(dailyOutfitDue({ ...armed, retiredAt: 1 }, '2026-10-31')).toBe(false);
});

it('holds a manual outfit for the day and clears without undressing', () => {
  const pet = armDailyOutfit(testPet(1, 'retriever', 1, 'Maple', 'pet'), '2026-10-30');
  const changed = { ...pet, equipped: { hat: 'beanie' } };
  const held = noteManualOutfit(changed, '2026-10-30');
  expect(held.lastOutfitPickDate).toBe('2026-10-30');
  expect(held.previousOutfit).toEqual({ hat: 'beanie' });
  expect(dailyOutfitDue(held, '2026-10-30')).toBe(false);
  const off = clearDailyOutfit(held);
  expect(off.dailyOutfitEnabled).toBe(false);
  expect(off.equipped).toEqual({ hat: 'beanie' });
  expect(noteManualOutfit(off, '2026-10-31')).toBe(off);
});

it('stores Dressed Up without paying it when the pick is the first outfit', () => {
  const pet = testPet(1, 'retriever', 1, 'Maple', 'pet');
  const dressed = applyDailyPick(pet, { hat: 'beanie' }, '2026-10-30');
  expect(dressed.equipped).toEqual({ hat: 'beanie' });
  expect(dressed.previousOutfit).toEqual({ hat: 'beanie' });
  expect(dressed.badges).toContain('dressed-up');
  expect(dressed.badgeXpSkipped).toContain('dressed-up');
  expect(silenceDressedUp(dressed)).toBe(dressed);
});
