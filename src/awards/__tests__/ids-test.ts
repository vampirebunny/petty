import {
  CLASSED_EVENTS,
  LOOKBOOK_THEMES,
  OPEN_EVENTS,
  RACE_EVENTS,
  allRounderId,
  careerId,
  classTrophyId,
  coverId,
  featId,
  friendAwardId,
  isOpenEvent,
  lifetimeId,
  lookbookId,
  personalBestKey,
  stampId,
  veteranId,
  winsKey,
} from '../ids';
import { coverArt, stampArt } from '../runwayArt';
import { awardEventOf, trophyArt } from '../trophyArt';

it('names definition ids the way the awards seed does', () => {
  expect(careerId('hurdles', 'gold')).toBe('career_hurdles_gold');
  expect(classTrophyId('weave', 'novice')).toBe('class_weave_novice');
  expect(featId('photo_finish')).toBe('feat_photo_finish');
  expect(allRounderId('open')).toBe('range_all_rounder_open');
  expect(veteranId('silver')).toBe('veteran_silver');
  expect(stampId('space', 'debut')).toBe('stamp_space_debut');
  expect(lookbookId('gold')).toBe('lookbook_gold');
  expect(coverId('platinum')).toBe('cover_platinum');
  expect(friendAwardId('host', 'bronze')).toBe('friend_host_bronze');
  expect(lifetimeId('wins', 'gold')).toBe('lifetime_wins_gold');
});

it('keeps Fun Run and 800 Meters off the classed list', () => {
  expect(RACE_EVENTS).toEqual([...CLASSED_EVENTS, ...OPEN_EVENTS]);
  expect(isOpenEvent('funRun')).toBe(true);
  expect(isOpenEvent('meters800')).toBe(true);
  expect(isOpenEvent('weave')).toBe(false);
  expect(CLASSED_EVENTS).not.toContain('funRun');
  expect(LOOKBOOK_THEMES).toHaveLength(12);
});

it('builds progress keys the grant functions write', () => {
  expect(winsKey('hurdles')).toBe('wins:hurdles');
  expect(personalBestKey('funRun')).toBe('personal_best:funRun');
  expect(personalBestKey('hurdles', 'novice')).toBe('personal_best:hurdles:novice');
});

it('maps definition ids onto trophy art', () => {
  expect(awardEventOf('hurdles')).toBe('hurdle');
  expect(trophyArt('career_hurdles_gold')).toEqual({ shape: 'cup', material: 'gold', event: 'hurdle' });
  expect(trophyArt('class_weave_novice')).toEqual({ shape: 'plinth', material: 'gold', event: 'weave' });
  expect(trophyArt('feat_photo_finish')).toEqual({ shape: 'star', material: 'gold', event: 'none' });
  expect(stampArt('stamp_space_debut')).toEqual({ motif: 'space', kind: 'debut' });
  expect(coverArt('cover_gold')).toMatchObject({ kind: 'ladder', material: 'gold', level: 3 });
  expect(coverArt('friend_host_bronze')).toMatchObject({ kind: 'friend', icon: 'host', material: 'bronze' });
});
