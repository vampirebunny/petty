import { addStack, emptyEconomy, settleEconomy, spendTreat, stackQty } from '../../economy/state';
import { attributeScore, naturalGrowth, reconcileBand, styleBasis } from '../attributes';
import { currentStyle } from '../offers';
import { applyAwayDecay, applyAwayWeight } from '../awayDecay';
import { AWAY_DECAY } from '../awayDecayConfig';
import { applyCareTime } from '../care';
import { careConfig } from '../careConfig';
import { testPet } from '../__fixtures__/pets';
import { resume, setVitality } from '../clock';
import { dayMs, daysToSenior } from '../config';
import { applyEvent } from '../events';
import { isResting, payRep, resolveReward, rollTrick, sessionLength, successChance } from '../training';
import { ensureGame } from '../game';
import { lockHint, refreshUnlocks, trackDef, trackName } from '../tracks';
import type { PetState, TrainingTrack } from '../types';
import { planReminders } from '../../reminders/nextReminder';

function pet() {
  return testPet(1, 'retriever', 0, 'Pup', 'pet');
}

it('adds a meal to the weight index and leaves a water refill unchanged', () => {
  const before = trainedPet();
  const fed = applyEvent(applyEvent(before, { type: 'feed' }).state, { type: 'ate', now: 1 }).state;
  const watered = applyEvent(before, { type: 'refillWater' }).state;

  expect(fed.weight).toBeCloseTo(before.weight + 0.12, 5);
  expect(fed.vitality).toBe(before.vitality);
  expect(watered.weight).toBe(before.weight);
  expect(watered.ageDays).toBe(before.ageDays);
});

it('thins the pet across missed days and leaves a scene change alone', () => {
  const before = trainedPet();
  const missed = resume(before, before.lastUpdatedAt + 7 * dayMs);
  expect(missed.weight).toBeCloseTo(applyAwayWeight(before.weight, 7 * 24), 5);

  const moved = applyEvent(before, { type: 'setScene', sceneId: 'park' }).state;
  expect(moved.sceneId).toBe('park');
  expect(moved.weight).toBe(before.weight);
  expect(moved.ageDays).toBe(before.ageDays);
  expect(moved.needs).toEqual(before.needs);
});

it('keeps thinning through a long absence without zeroing needs', () => {
  const before = trainedPet();
  const longGap = resume(before, before.lastUpdatedAt + 100 * hourMs);
  const twoDays = resume(before, before.lastUpdatedAt + 48 * hourMs);
  const atCap = resume(before, before.lastUpdatedAt + AWAY_DECAY.maxElapsedH * hourMs);
  const pastCap = resume(before, before.lastUpdatedAt + (AWAY_DECAY.maxElapsedH + 200) * hourMs);

  expect(longGap.weight).toBeLessThan(twoDays.weight);
  expect(longGap.weight).toBeGreaterThan(-1);
  expect(100 - longGap.needs.hunger).toBeGreaterThan(0);
  expect(longGap.needs.happiness).toBeGreaterThan(0);
  expect(longGap.needs.energy).toBeGreaterThan(0);
  expect(pastCap.needs).toEqual(atCap.needs);
  expect(pastCap.weight).toBeCloseTo(atCap.weight, 5);
  expect(pastCap.ageDays).toBeGreaterThan(atCap.ageDays);
});

it('keeps care vitality at or above 0.35 and remembers band hysteresis', () => {
  const drained = applyCareTime(pet(), 40 * dayMs, true, false);
  expect(drained.vitality).toBeGreaterThanOrEqual(0.35);

  const senior = setVitality({ ...pet(), ageDays: daysToSenior }, 0.5);
  expect(senior.seniorBand).toBe('senior');
  const inside = setVitality(senior, 0.72);
  expect(inside.seniorBand).toBe('senior');
  const left = setVitality(senior, 0.76);
  expect(left.seniorBand).toBe('earlySenior');
  const back = setVitality(left, 0.64);
  expect(back.seniorBand).toBe('senior');
  expect(reconcileBand(setVitality(back, 0.34))).toBe('elderly');
});

const hourMs = 60 * 60 * 1000;

function trainedPet(breedId = 'retriever', now = 1_000_000) {
  return testPet(1, breedId, now, 'Pup', 'pet');
}

it('sizes a session from stamina, between 5 and 10 treated reps', () => {
  const before = trainedPet();
  const length = sessionLength(before);
  const stamina = Math.max(0, Math.min(1, attributeScore(before, 'stamina') / 100));
  expect(length).toBe(Math.round(careConfig.sessionBase + careConfig.sessionStaminaSpan * stamina));
  expect(length).toBeGreaterThanOrEqual(careConfig.sessionBase);
  expect(length).toBeLessThanOrEqual(careConfig.sessionBase + careConfig.sessionStaminaSpan);
});

it('pays a full-credit sit rep from the tier gain and the intelligence factor', () => {
  const before = trainedPet();
  const factor = careConfig.intelligenceBase + careConfig.intelligenceSpan * Math.min(1, attributeScore(before, 'intelligence') / 100);
  const after = payRep(before, 'sit', 'treat', before.lastUpdatedAt);
  expect(after.training.sit?.progress).toBeCloseTo(careConfig.tierGain[1] * factor, 5);
  expect(after.training.sit?.focusUsed).toBe(careConfig.focusCostTreat);
  expect(after.xp).toBe(before.xp + careConfig.trainingRepXp);
  expect(after.attributes.trained?.obedience ?? 0).toBeGreaterThan(0);
  expect(after.attributes.trained?.boldness ?? 0).toBe(0);
});

it('clamps success chance and treats a mastered trick as certain', () => {
  expect(successChance(0, 0, false)).toBeCloseTo(0.55, 5);
  expect(successChance(100, 100, false)).toBe(careConfig.pSuccessMax);
  expect(successChance(0, 0, true)).toBe(1);
});

it('pays a treat at full credit and a skipped treat at a quarter', () => {
  const before = trainedPet();
  const opened = {
    ...before,
    care: { ...before.care, pendingReward: { trackId: 'sit', openedAt: before.lastUpdatedAt } },
  };
  const treated = resolveReward(opened, opened.lastUpdatedAt, 'treat');
  const skipped = resolveReward(opened, opened.lastUpdatedAt, 'none');
  expect(treated.training.sit?.progress).toBeGreaterThan(skipped.training.sit?.progress ?? 0);
  expect(treated.training.sit?.focusUsed).toBe(careConfig.focusCostTreat);
  expect(skipped.training.sit?.focusUsed).toBe(careConfig.focusCostNoTreat);
  expect(skipped.training.sit?.hadNoTreat).toBe(true);
  expect(treated.care.pendingReward).toBeNull();
});

it('unlocks Paw after Sit and Speak are mastered, and calls it High five for cats', () => {
  const young = pet();
  const paw = trackDef('paw');
  expect(paw).not.toBeNull();
  expect(paw?.species).toEqual(['dog', 'cat']);
  expect(young.training.paw?.unlocked).toBe(false);
  expect(lockHint(young, paw!)).toMatch(/Sit/);

  const mastered = (state: PetState, id: string, progress = 100): PetState => ({
    ...state,
    training: {
      ...state.training,
      [id]: { ...(state.training[id] as TrainingTrack), mastered: progress >= 100, progress },
    },
  });
  const sitDone = mastered(young, 'sit');
  expect(lockHint(sitDone, paw!)).toMatch(/Speak/);
  expect(refreshUnlocks(sitDone).unlocked).toEqual([]);

  const both = mastered(sitDone, 'speak');
  const unlocked = refreshUnlocks(both);
  expect(unlocked.unlocked).toEqual(['paw']);
  expect(unlocked.state.training.paw?.unlocked).toBe(true);
  expect(trackName('paw', 'dog')).toBe('Paw');
  expect(trackName('paw', 'cat')).toBe('High five');

  const cat = trainedPet('domesticShorthair');
  expect(cat.training.paw?.unlocked).toBe(false);
  const ready = mastered(mastered(cat, 'sit'), 'speak', 99);
  const learned = payRep(ready, 'speak', 'treat', ready.lastUpdatedAt);
  expect(learned.training.speak?.mastered).toBe(true);
  expect(learned.training.paw?.unlocked).toBe(true);

  const saved = { ...cat, training: { sit: cat.training.sit! }, milestones: ['house_trained', 'sit'] };
  const repaired = ensureGame(saved);
  expect(repaired.training.paw?.unlocked).toBe(false);
  expect(repaired.training.house_training).toBeUndefined();
  expect(repaired.milestones).toEqual(['sit']);
});

it('keeps a resting pet asleep and applies away mood without raising it', () => {
  const resting = pet();
  const before = { ...resting, asleep: true, needs: { ...resting.needs, energy: 0 } };
  const after = resume(before, before.lastUpdatedAt + 20 * 60 * 1000);
  expect(after.asleep).toBe(true);
  const start = trainedPet();
  const away = resume(start, start.lastUpdatedAt + 72 * hourMs);
  const expected = applyAwayDecay(
    { tummy: 100 - start.needs.hunger, mood: start.needs.happiness, energy: start.needs.energy },
    72,
  );
  expect(away.needs.happiness).toBeCloseTo(expected.mood, 5);
  expect(away.needs.happiness).toBeGreaterThan(AWAY_DECAY.needs.mood.floor);
});

it('resolves an open reward when the treat arrives inside the window', () => {
  const before = trainedPet();
  const opened = {
    ...before,
    care: { ...before.care, pendingReward: { trackId: 'sit', openedAt: before.lastUpdatedAt } },
  };
  const paid = resolveReward(opened, opened.lastUpdatedAt + 1_000, 'treat');
  expect(paid.care.pendingReward).toBeNull();
  expect(paid.training.sit?.progress).toBeGreaterThan(0);
  const missed = rollTrick(before, 'paw', before.lastUpdatedAt);
  expect(missed.ok).toBe(false);
});

it('starts with 10 treats and does not regenerate or add a daily bonus', () => {
  const now = Date.UTC(2026, 9, 19, 15, 0, 0);
  const start = emptyEconomy(now);
  expect(stackQty(start, 'biscuit')).toBe(careConfig.startingTreats);
  const later = settleEconomy(start, now + 24 * hourMs);
  expect(stackQty(later, 'biscuit')).toBe(careConfig.startingTreats);
  const topped = addStack(start, 'biscuit', 200);
  expect(stackQty(topped, 'biscuit')).toBe(careConfig.startingTreats + 200);
  const spent = spendTreat(emptyEconomy(now), 'biscuit');
  expect(spent.ok).toBe(true);
  let wallet = spent.economy;
  for (let i = 1; i < careConfig.startingTreats; i += 1) {
    const next = spendTreat(wallet, 'biscuit');
    expect(next.ok).toBe(true);
    wallet = next.economy;
  }
  expect(spendTreat(wallet, 'biscuit').ok).toBe(false);
  expect(stackQty(wallet, 'biscuit')).toBe(0);
});

it('keeps the notification plan inside the daily cap and quiet hours', () => {
  const before = trainedPet();
  const evening = Date.UTC(2026, 9, 19, 22, 0, 0);
  const planned = planReminders(before, evening, { reminders: true, care: true, basicTreats: 0 });
  expect(planned.length).toBeLessThanOrEqual(careConfig.notificationMax);
  for (const item of planned) {
    const hour = new Date(item.at).getHours();
    expect(hour >= 8 && hour < 21).toBe(true);
  }
});

it('rests a trick when focus is spent and blocks another roll', () => {
  let state = trainedPet();
  const length = sessionLength(state);
  const now = state.lastUpdatedAt;
  let guard = 0;
  while ((state.training.sit?.focusUsed ?? 0) + careConfig.focusCostNoTreat < length && guard < 20) {
    state = payRep(state, 'sit', 'none', now);
    expect(isResting(state.training.sit!, now)).toBe(false);
    guard += 1;
  }
  state = payRep(state, 'sit', 'none', now);
  expect(state.training.sit?.mastered).toBe(false);
  expect(state.training.sit?.restUntil).toBe(now + careConfig.trickRestMs);
  const blocked = payRep(state, 'sit', 'treat', now);
  expect(blocked.training.sit?.progress).toBe(state.training.sit?.progress);
  const speak = payRep(state, 'speak', 'treat', now);
  expect(speak.training.speak?.progress).toBeGreaterThan(0);

  const awake = payRep(state, 'sit', 'treat', now + careConfig.trickRestMs);
  expect(awake.training.sit?.focusUsed).toBe(careConfig.focusCostTreat);
  expect(isResting(awake.training.sit!, now + careConfig.trickRestMs)).toBe(false);
});

it('raises boldness for speak, affection for paw, and intelligence on mastery', () => {
  const before = trainedPet();
  const spoken = payRep(before, 'speak', 'treat', before.lastUpdatedAt);
  expect(spoken.attributes.trained?.boldness ?? 0).toBeGreaterThan(0);
  expect(spoken.attributes.trained?.obedience ?? 0).toBe(0);
  const paw = payRep(before, 'paw', 'none', before.lastUpdatedAt);
  expect(paw.attributes.trained?.affection ?? 0).toBeGreaterThan(0);
  expect(paw.training.paw?.focusUsed).toBe(careConfig.focusCostNoTreat);

  const almost = {
    ...before,
    training: {
      ...before.training,
      sit: { ...before.training.sit!, progress: 99 },
    },
  };
  const mastered = payRep(almost, 'sit', 'treat', almost.lastUpdatedAt);
  expect(mastered.training.sit?.mastered).toBe(true);
  expect(mastered.attributes.trained?.intelligence ?? 0).toBeGreaterThan(0);
  expect(mastered.milestones).toContain('sit');
});

it('shows training above natural growth and keeps style free of weight', () => {
  const before = trainedPet();
  const natural = attributeScore(before, 'obedience');
  const trained = payRep(before, 'sit', 'treat', before.lastUpdatedAt);
  expect(attributeScore(trained, 'obedience')).toBeGreaterThan(natural);

  const heavy = { ...before, weight: 1 };
  expect(styleBasis(heavy)).toEqual(styleBasis(before));
  expect(currentStyle(before.attributes.archetype, styleBasis(heavy), before.attributes.potential)).toBe(
    currentStyle(before.attributes.archetype, styleBasis(before), before.attributes.potential),
  );
  expect(attributeScore(heavy, 'stamina')).toBeLessThan(attributeScore(before, 'stamina'));
});

it('copies surplus current into trained once', () => {
  const before = trainedPet();
  const natural = naturalGrowth(before.attributes.potential.obedience, before.maturity);
  const legacy = {
    ...before,
    attributes: {
      ...before.attributes,
      trained: undefined,
      current: { ...before.attributes.current, obedience: natural + 5 },
    },
  };
  const fixed = ensureGame(legacy);
  expect(fixed.attributes.trained?.obedience).toBeCloseTo(5, 5);
  const again = ensureGame(fixed);
  expect(again.attributes.trained?.obedience).toBeCloseTo(5, 5);
});
