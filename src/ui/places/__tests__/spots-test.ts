import { spotsFor } from '../spots';

describe('spotsFor', () => {
  it('lists the shop, park, living room, and bedroom for a dog', () => {
    expect(spotsFor('dog').map((spot) => spot.id)).toEqual(['shop', 'park', 'livingroom', 'bedroom']);
    expect(spotsFor('dog').map((spot) => spot.label)).toEqual(['Pet Shop', 'Park', 'Living room', 'Bedroom']);
  });

  it('adds the catio as the fifth cell for a cat', () => {
    const spots = spotsFor('cat');
    expect(spots.map((spot) => spot.id)).toEqual(['shop', 'park', 'livingroom', 'bedroom', 'catio']);
    expect(spots[4]?.label).toBe('Catio');
    expect(spots.find((spot) => spot.id === 'shop')?.sceneId).toBeNull();
    expect(spots.find((spot) => spot.id === 'catio')?.sceneId).toBe('catio');
  });
});
