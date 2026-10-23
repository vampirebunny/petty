import { breedById } from '../breeds';
import { actorTint, indoorOverlayAlpha, lighting, petLightAmount, petLuminance, sceneryTint, stepNightFade } from '../lighting';
import { scenes } from '../scenes';
import { todAt } from '../timeOfDay';

const coat = breedById('retriever')?.coat ?? '#d9a441';

it('keeps a night pet at least 70 percent as bright as the same pet at noon', () => {
  const indoor = scenes.livingroom;
  const day = petLuminance(coat, indoor, todAt(12));
  const night = petLuminance(coat, indoor, todAt(23));

  expect(night).toBeGreaterThanOrEqual(day * 0.7);
});

it('caps indoor night tint, leaves the outdoor night tint, and fades the pet light', () => {
  const night = todAt(23);
  const indoor = sceneryTint(scenes.bedroom, night);
  const outdoor = sceneryTint(scenes.park, night);

  expect(night.tintChannels.a).toBeCloseTo(0.4, 5);
  expect(night.inTintChannels.a).toBeCloseTo(0.5, 5);
  expect(indoor.a).toBeCloseTo(lighting.indoorAlphaCap, 5);
  expect(indoor.b).toBeGreaterThan(indoor.r);
  expect(outdoor.a).toBeCloseTo(night.tintChannels.a, 5);
  expect(actorTint(scenes.livingroom, night).a).toBeCloseTo(lighting.indoorAlphaCap * lighting.actorTint.indoor, 5);

  const dusk = petLightAmount(todAt(17).dark);
  const evening = petLightAmount(todAt(19).dark);
  const late = petLightAmount(todAt(23).dark);
  expect(petLightAmount(lighting.petLight.darkAbove)).toBe(0);
  expect(evening).toBeGreaterThan(dusk);
  expect(late).toBeGreaterThan(evening);
  expect(indoorOverlayAlpha(1)).toBeCloseTo(lighting.cozyNight.alpha, 5);
  expect(indoorOverlayAlpha(1)).toBeLessThan(lighting.indoorAlphaCap / 2 + 0.02);
  expect(stepNightFade(null, 1, 0, false)).toBe(1);
  expect(stepNightFade(0, 1, 0, true)).toBe(1);
  expect(stepNightFade(0, 1, 0.2, false)).toBeCloseTo(0.2 / lighting.cozyNight.fadeSec, 5);
  expect(stepNightFade(0.4, 0, 0.3, false)).toBeCloseTo(0.2, 5);
});
