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
  'playdate',
  'cuddle',
  'wardrobe',
  'sound',
  'soundOff',
  'music',
  'musicOff',
  'personality',
  'help',
  'potty',
  'clean',
  'treat',
  'inventory',
  'storage',
  'walk',
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

  it('names the paw trick Give paw for dogs and High five for cats', () => {
    expect(speciesLabel('paw', 'dog')).toBe('Give paw');
    expect(speciesLabel('paw', 'cat')).toBe('High five');
    expect(iconFor('paw', 'cat')).not.toBe(iconFor('paw', 'dog'));
  });
});
