import { actionIcons, iconFor, speciesLabel } from '../actionIcons';

// Every id the home screen can put in the action bar or the toggle row.
const actionIds = [
  'sit',
  'paw',
  'speak',
  'rest',
  'wake',
  'feed',
  'refill',
  'play',
  'cuddle',
  'wardrobe',
  'reminders',
  'sound',
  'soundOff',
  'personality',
  'help',
];

describe('actionIcons', () => {
  it('has an icon for every action id', () => {
    for (const id of actionIds) {
      expect(iconFor(id)).not.toBeNull();
    }
  });

  it('keeps the map and the id list in step', () => {
    expect(Object.keys(actionIcons).sort()).toEqual([...actionIds].sort());
  });

  it('falls back to the shared icon for cats and returns null for unknown ids', () => {
    expect(iconFor('play', 'cat')).toBe(iconFor('play', 'dog'));
    expect(iconFor('nope')).toBeNull();
    expect(speciesLabel('play', 'cat')).toBeNull();
  });
});
