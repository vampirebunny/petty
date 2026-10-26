import { spotsFor } from '../spots';

describe('spotsFor', () => {
  it('lists the shop, park, living room, and bedroom for a dog', () => {
    expect(spotsFor('dog').map((spot) => spot.id)).toEqual(['shop', 'school', 'park', 'livingroom', 'bedroom', 'arcade']);
    expect(spotsFor('dog').map((spot) => spot.label)).toEqual([
      'Pet Shop',
      'Training School',
      'Park',
      'Living room',
      'Bedroom',
      'Arcade',
    ]);
    expect(spotsFor('dog').find((spot) => spot.id === 'arcade')?.dest).toBe('arcade');
  });

  it('adds the catio as the fifth cell for a cat', () => {
    const spots = spotsFor('cat');
    expect(spots.map((spot) => spot.id)).toEqual(['shop', 'school', 'park', 'livingroom', 'bedroom', 'catio', 'arcade']);
    expect(spots.find((spot) => spot.id === 'catio')?.label).toBe('Catio');
    expect(spots.find((spot) => spot.id === 'shop')?.sceneId).toBeNull();
    expect(spots.find((spot) => spot.id === 'shop')?.dest).toBe('shop');
    expect(spots.find((spot) => spot.id === 'catio')?.sceneId).toBe('catio');
    expect(spots.find((spot) => spot.id === 'arcade')?.dest).toBe('arcade');
  });
});
