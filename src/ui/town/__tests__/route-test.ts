import { approachNode, legsBetween, legsFromProgress, routeNodes, tripSeconds } from '../route';
import { edges, nodes } from '../map';

describe('town routes', () => {
  it('walks home to the arcade on the road, and back again', () => {
    const there = routeNodes('home', 'arcade');
    const back = routeNodes('arcade', 'home');
    expect(there[0]).toBe('home');
    expect(there[there.length - 1]).toBe('arcade');
    expect(back).toEqual([...there].reverse());
    for (let i = 0; i < there.length - 1; i += 1) {
      const from = there[i];
      const to = there[i + 1];
      expect(edges.some((edge) => (edge.from === from && edge.to === to) || (edge.from === to && edge.to === from))).toBe(true);
    }
    const legs = legsBetween('home', 'arcade');
    expect(legs.length).toBe(there.length - 1);
    expect(tripSeconds(400)).toBeGreaterThanOrEqual(0.8);
    expect(tripSeconds(400)).toBeLessThanOrEqual(2.5);
    expect(tripSeconds(20)).toBe(0.8);
    expect(tripSeconds(2000)).toBe(2.5);
  });

  it('sends a mid-edge reroute to the nearest node first', () => {
    const edge = edges.find((item) => item.id === 'home-plazaA');
    expect(edge).toBeTruthy();
    if (!edge) {
      return;
    }
    expect(approachNode(edge, 0.15)).toBe('home');
    expect(approachNode(edge, 0.85)).toBe('plazaA');
    const towardShop = legsFromProgress(edge, 0.85, 'petShop');
    expect(towardShop[0]?.t1 === 1 || towardShop[0]?.edge.to === 'plazaA').toBe(true);
    expect(routeNodes('plazaA', 'petShop')).toEqual(['plazaA', 'petShop']);
    expect(nodes.home.y).toBeGreaterThan(118);
  });
});
