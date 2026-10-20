import { breedAttributes } from '../../actor/breedAttributes';
import { addStack, emptyEconomy, settleEconomy, stackQty } from '../../economy/state';
import { reconcileBand, attributeScore } from '../attributes';
import { applyCareTime } from '../care';
import { careConfig } from '../careConfig';
import { testPet } from '../__fixtures__/pets';
import { resume, setVitality, tickForeground } from '../clock';
import { dayMs, GEN } from '../config';
import { applyEvent } from '../events';
import { payRep, resolveReward, rewardCredit, rollTrick, successChance } from '../training';
import { lockHint, trackDef, trackDefs } from '../tracks';
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
  expect(missed.weight).toBeCloseTo(before.weight - 0.12 * 7, 5);

  const moved = applyEvent(before, { type: 'setScene', sceneId: 'park' }).state;
  expect(moved.sceneId).toBe('park');
  expect(moved.weight).toBe(before.weight);
  expect(moved.ageDays).toBe(before.ageDays);
  expect(moved.needs).toEqual(before.needs);
});

it('keeps thinning through a long absence after needs have stopped', () => {
  const before = trainedPet();
  const longGap = resume(before, before.lastUpdatedAt + 100 * 60 * 60 * 1000);
  const capped = resume(before, before.lastUpdatedAt + 48 * 60 * 60 * 1000);

  expect(longGap.weight).toBeLessThan(capped.weight);
  expect(longGap.needs).toEqual(capped.needs);
});

it('keeps care vitality at or above 0.35 and remembers band hysteresis', () => {
  const drained = applyCareTime(pet(), 40 * dayMs, true, false);
  expect(drained.vitality).toBeGreaterThanOrEqual(0.35);

  const senior = setVitality({ ...pet(), ageDays: 200 }, 0.5);
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

it('keeps every shipped trick inside three daily caps at the lowest starting intelligence', () => {
  let lowest = 100;
  for (const breed of Object.values(breedAttributes)) {
    lowest = Math.min(lowest, breed.ranges.intelligence[0]);
  }
  const start = Math.max(1, Math.round(lowest * GEN.START_FRACTION));
  const factor = careConfig.intelligenceBase + careConfig.intelligenceSpan * Math.min(1, start / 100);
  for (const def of trackDefs) {
    if (def.tier == null) {
      continue;
    }
    const gain = careConfig.tierGain[def.tier] * factor;
    const reps = Math.ceil(100 / gain);
    expect(reps).toBeLessThanOrEqual(careConfig.dailyRepCap * 3);
  }
});

it('pays a full-credit sit rep from the tier gain and the intelligence factor', () => {
  const before = trainedPet();
  const factor = careConfig.intelligenceBase + careConfig.intelligenceSpan * Math.min(1, attributeScore(before, 'intelligence') / 100);
  const after = payRep(before, 'sit', 1, before.lastUpdatedAt);
  expect(after.training.sit?.progress).toBeCloseTo(careConfig.tierGain[1] * factor, 5);
  expect(after.training.sit?.repsToday).toBe(1);
  expect(after.xp).toBe(before.xp + careConfig.trainingRepXp);
});

it('clamps success chance and treats a mastered trick as certain', () => {
  expect(successChance(0, 0, false)).toBeCloseTo(0.55, 5);
  expect(successChance(100, 100, false)).toBe(careConfig.pSuccessMax);
  expect(successChance(0, 0, true)).toBe(1);
});

it('scores a treat by how soon it arrives', () => {
  expect(rewardCredit(1_000, 'basic')).toBe(1);
  expect(rewardCredit(1_000, 'special')).toBe(1.5);
  expect(rewardCredit(8_000, 'special')).toBe(0.5);
  expect(rewardCredit(20_000, 'basic')).toBe(0.25);
  expect(rewardCredit(1_000, null)).toBe(0.25);
});

it('keeps Paw locked until Sit is mastered and the pup is a day old', () => {
  const young = pet();
  const paw = trackDef('paw');
  expect(paw).not.toBeNull();
  expect(young.training.paw?.unlocked).toBe(false);
  expect(lockHint(young, paw!)).toMatch(/Sit/);
});

it('does not start accidents while the pet is resting', () => {
  const resting = pet();
  const before = { ...resting, asleep: true, needs: { ...resting.needs, energy: 0 } };
  const after = resume(before, before.lastUpdatedAt + 20 * 60 * 1000);
  expect(after.asleep).toBe(true);
  expect(after.care.messes).toEqual([]);
});

it('gives a house-trained pet no accidents across a long absence', () => {
  const before = trainedPet();
  const trained = {
    ...before,
    training: {
      ...before.training,
      house_training: { ...before.training.house_training!, mastered: true, progress: 100 },
    },
    milestones: ['house_trained'],
    care: { ...before.care, potty: { ...before.care.potty, nextUrgeAt: null, signal: null, outing: null } },
  };
  for (const gap of [5_000, hourMs, 8 * hourMs, 72 * hourMs]) {
    const after = resume(trained, trained.lastUpdatedAt + gap);
    expect(after.care.messes).toEqual([]);
    expect(after.care.potty.signal).toBeNull();
  }
});

it('still runs the care clock for an untrained pet over short and long gaps', () => {
  const before = trainedPet();
  const live = tickForeground(before, before.lastUpdatedAt + 5_000);
  expect(live.care.potty.nextUrgeAt).not.toBeNull();
  const away = resume(before, before.lastUpdatedAt + 72 * hourMs);
  expect(away.needs.happiness).toBeGreaterThanOrEqual(careConfig.awayHappinessFloor);
});

it('resolves an open reward when the treat arrives inside the window', () => {
  const before = trainedPet();
  const opened = {
    ...before,
    care: { ...before.care, pendingReward: { trackId: 'sit', openedAt: before.lastUpdatedAt } },
  };
  const paid = resolveReward(opened, opened.lastUpdatedAt + 1_000, 'basic');
  expect(paid.care.pendingReward).toBeNull();
  expect(paid.training.sit?.progress).toBeGreaterThan(0);
  const missed = rollTrick(before, 'paw', before.lastUpdatedAt);
  expect(missed.ok).toBe(false);
});

it('caps treat regen, the login bonus, and the stack ceiling', () => {
  const now = Date.UTC(2026, 9, 19, 15, 0, 0);
  const start = { ...emptyEconomy(now - 15 * careConfig.regenMs), lastDailyBonusLocalDate: '2026-10-19' };
  const regenerated = settleEconomy(start, now);
  expect(stackQty(regenerated, 'biscuit')).toBe(careConfig.regenCap);
  const topped = addStack(regenerated, 'biscuit', 200);
  expect(stackQty(topped, 'biscuit')).toBe(careConfig.stackCeiling);
  const nextDay = settleEconomy(topped, now + 24 * hourMs);
  expect(stackQty(nextDay, 'biscuit')).toBe(careConfig.stackCeiling);
});

it('keeps the notification plan inside the daily cap and quiet hours', () => {
  const before = trainedPet();
  const evening = Date.UTC(2026, 9, 19, 22, 0, 0);
  const planned = planReminders(
    { ...before, care: { ...before.care, messes: [{ id: 'm', sceneId: 'livingroom', x: 1, y: 1, createdAt: evening }] } },
    evening,
    { reminders: true, care: true, basicTreats: 0 },
  );
  expect(planned.length).toBeLessThanOrEqual(careConfig.notificationMax);
  for (const item of planned) {
    const hour = new Date(item.at).getHours();
    expect(hour >= 8 && hour < 21).toBe(true);
  }
});

it('pays a cuddle like a basic treat inside the reward window and ignores it otherwise', () => {
  const before = trainedPet();
  const opened = {
    ...before,
    care: { ...before.care, pendingReward: { trackId: 'sit', openedAt: before.lastUpdatedAt } },
  };
  const cuddled = applyEvent(opened, { type: 'rewardCuddle', now: opened.lastUpdatedAt + 1_000 }).state;
  const treated = applyEvent(opened, { type: 'rewardTreat', tier: 'basic', now: opened.lastUpdatedAt + 1_000 }).state;
  expect(cuddled.care.pendingReward).toBeNull();
  expect(cuddled.training.sit?.progress).toBe(treated.training.sit?.progress);
  const idle = applyEvent(before, { type: 'rewardCuddle', now: before.lastUpdatedAt });
  expect(idle.state).toBe(before);
});
