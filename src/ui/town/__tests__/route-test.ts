import { approachNode, legsBetween, legsFromProgress, routeNodes, tripSeconds } from '../route';
import { portraitLayout, wideLayout, type TownLayout } from '../map';
import { roadSpots } from '../../../sim/road';

function connects(layout: TownLayout) {
  expect(layout.nodes.bend).toBeTruthy();
  expect(layout.nodes.catwalk).toBeTruthy();
  expect(layout.buildings.some((building) => building.id === 'catwalk')).toBe(true);
  for (const spot of roadSpots) {
    const there = routeNodes('home', spot, layout.edges);
    const back = routeNodes(spot, 'home', layout.edges);
    expect(there[0]).toBe('home');
    expect(there[there.length - 1]).toBe(spot);
    if (spot === 'catwalk' || spot === 'arcade' || spot === 'stadium') {
      expect(there).toContain('bend');
    } else {
      expect(there).not.toContain('bend');
    }
    expect(back).toEqual([...there].reverse());
    for (let i = 0; i < there.length - 1; i += 1) {
      const from = there[i];
      const to = there[i + 1];
      expect(
        layout.edges.some((edge) => (edge.from === from && edge.to === to) || (edge.from === to && edge.to === from)),
      ).toBe(true);
    }
  }
}

describe('town routes', () => {
  it('walks every door on the portrait road, and back again', () => {
    connects(portraitLayout);
    const legs = legsBetween('home', 'arcade', portraitLayout.edges);
    expect(legs.length).toBeGreaterThan(0);
    expect(tripSeconds(400)).toBeGreaterThanOrEqual(0.8);
    expect(tripSeconds(400)).toBeLessThanOrEqual(2.5);
    expect(tripSeconds(20)).toBe(0.8);
    expect(tripSeconds(2000)).toBe(2.5);
  });

  it('walks every door on the widescreen road, and back again', () => {
    connects(wideLayout);
    const there = routeNodes('home', 'stadium', wideLayout.edges);
    expect(there).toContain('trainingSchool');
    expect(there).toContain('catwalk');
    expect(there.indexOf('arcade')).toBeGreaterThan(there.indexOf('trainingSchool'));
  });

  it('sends a mid-edge reroute to the nearest node first', () => {
    const edge = portraitLayout.edges.find((item) => item.id === 'home-petShop');
    expect(edge).toBeTruthy();
    if (!edge) {
      return;
    }
    expect(approachNode(edge, 0.15)).toBe('home');
    expect(approachNode(edge, 0.85)).toBe('petShop');
    const towardPark = legsFromProgress(edge, 0.85, 'park', portraitLayout.edges);
    expect(towardPark[0]?.edge.to).toBe('petShop');
    expect(routeNodes('petShop', 'park', portraitLayout.edges)).toEqual(['petShop', 'park']);
    expect(portraitLayout.nodes.home.y).toBeGreaterThan(118);
  });
});
