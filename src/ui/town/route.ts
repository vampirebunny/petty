import { edgeBetween, edges, type Cubic, type Edge, type NodeId, type Point } from './map';
import type { RoadSpot } from '../../sim/road';

export type Leg = {
  edge: Edge;
  t0: number;
  t1: number;
};

const walkSpeed = 220;

export function cubicAt(cubic: Cubic, t: number): Point {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  return {
    x: uu * u * cubic.a.x + 3 * uu * t * cubic.c1.x + 3 * u * tt * cubic.c2.x + tt * t * cubic.b.x,
    y: uu * u * cubic.a.y + 3 * uu * t * cubic.c1.y + 3 * u * tt * cubic.c2.y + tt * t * cubic.b.y,
  };
}

export function legLength(leg: Leg, steps = 16): number {
  let length = 0;
  let prev = cubicAt(leg.edge.cubic, leg.t0);
  for (let i = 1; i <= steps; i += 1) {
    const t = leg.t0 + ((leg.t1 - leg.t0) * i) / steps;
    const point = cubicAt(leg.edge.cubic, t);
    length += Math.hypot(point.x - prev.x, point.y - prev.y);
    prev = point;
  }
  return length;
}

export function edgeLength(edge: Edge): number {
  return legLength({ edge, t0: 0, t1: 1 });
}

/** The node closer to `t` along the stored direction of the edge. `t` is 0 at `from`. */
export function approachNode(edge: Edge, t: number): NodeId {
  const total = edgeLength(edge);
  const walked = legLength({ edge, t0: 0, t1: t });
  return walked <= total / 2 ? edge.from : edge.to;
}

function neighbors(id: NodeId): { node: NodeId; edge: Edge; length: number }[] {
  const next: { node: NodeId; edge: Edge; length: number }[] = [];
  for (const edge of edges) {
    if (edge.from === id) {
      next.push({ node: edge.to, edge, length: edgeLength(edge) });
    } else if (edge.to === id) {
      next.push({ node: edge.from, edge, length: edgeLength(edge) });
    }
  }
  return next;
}

/** Shortest node list, including both ends. Empty when no route exists. */
export function routeNodes(from: NodeId, to: NodeId): NodeId[] {
  if (from === to) {
    return [from];
  }
  const dist = new Map<NodeId, number>([[from, 0]]);
  const prev = new Map<NodeId, NodeId>();
  const open = new Set<NodeId>([from]);
  while (open.size > 0) {
    let current: NodeId | null = null;
    let best = Infinity;
    for (const id of open) {
      const weight = dist.get(id) ?? Infinity;
      if (weight < best) {
        best = weight;
        current = id;
      }
    }
    if (current == null) {
      break;
    }
    open.delete(current);
    if (current === to) {
      break;
    }
    const soFar = dist.get(current) ?? Infinity;
    for (const step of neighbors(current)) {
      const next = soFar + step.length;
      if (next < (dist.get(step.node) ?? Infinity)) {
        dist.set(step.node, next);
        prev.set(step.node, current);
        open.add(step.node);
      }
    }
  }
  if (!prev.has(to) && from !== to) {
    return [];
  }
  const path: NodeId[] = [to];
  let cursor = to;
  while (cursor !== from) {
    const before = prev.get(cursor);
    if (!before) {
      return [];
    }
    path.push(before);
    cursor = before;
  }
  path.reverse();
  return path;
}

function legBetween(from: NodeId, to: NodeId): Leg | null {
  const edge = edgeBetween(from, to);
  if (!edge) {
    return null;
  }
  if (edge.from === from) {
    return { edge, t0: 0, t1: 1 };
  }
  return { edge, t0: 1, t1: 0 };
}

export function legsBetween(from: NodeId, to: NodeId): Leg[] {
  const nodes = routeNodes(from, to);
  const legs: Leg[] = [];
  for (let i = 0; i < nodes.length - 1; i += 1) {
    const leg = legBetween(nodes[i], nodes[i + 1]);
    if (leg) {
      legs.push(leg);
    }
  }
  return legs;
}

/** Walk back to the nearest node on this edge, then on to `dest`. */
export function legsFromProgress(edge: Edge, t: number, dest: NodeId): Leg[] {
  const node = approachNode(edge, t);
  const back: Leg = { edge, t0: t, t1: node === edge.from ? 0 : 1 };
  const rest = node === dest ? [] : legsBetween(node, dest);
  const legs = [back, ...rest];
  return legs.filter((leg) => Math.abs(leg.t1 - leg.t0) > 0.001);
}

export function routeLength(legs: Leg[]): number {
  return legs.reduce((sum, leg) => sum + legLength(leg), 0);
}

export function tripSeconds(length: number): number {
  if (length <= 0) {
    return 0.8;
  }
  return Math.min(2.5, Math.max(0.8, length / walkSpeed));
}

export function trace(legs: Leg[], spacing = 6): Point[] {
  const points: Point[] = [];
  for (const leg of legs) {
    const length = legLength(leg);
    const steps = Math.max(1, Math.ceil(length / spacing));
    for (let i = 0; i <= steps; i += 1) {
      const t = leg.t0 + ((leg.t1 - leg.t0) * i) / steps;
      const point = cubicAt(leg.edge.cubic, t);
      const last = points[points.length - 1];
      if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 0.5) {
        points.push(point);
      }
    }
  }
  return points;
}

export function pointAlong(points: Point[], progress: number): Point {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }
  const clamped = Math.max(0, Math.min(1, progress));
  const span = (points.length - 1) * clamped;
  const index = Math.min(points.length - 2, Math.floor(span));
  const t = span - index;
  const a = points[Math.max(0, index)];
  const b = points[Math.min(points.length - 1, index + 1)];
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Which stored edge and parameter the pet is on, for a mid-walk reroute. */
export function progressOnLegs(legs: Leg[], progress: number): { edge: Edge; t: number } | null {
  if (legs.length === 0) {
    return null;
  }
  const total = routeLength(legs);
  let remain = total * Math.max(0, Math.min(1, progress));
  for (const leg of legs) {
    const length = legLength(leg);
    if (remain <= length || leg === legs[legs.length - 1]) {
      const share = length <= 0 ? 0 : Math.max(0, Math.min(1, remain / length));
      return { edge: leg.edge, t: leg.t0 + (leg.t1 - leg.t0) * share };
    }
    remain -= length;
  }
  const last = legs[legs.length - 1];
  return { edge: last.edge, t: last.t1 };
}

export function isDoor(id: NodeId): id is RoadSpot {
  return id !== 'plazaA' && id !== 'plazaB';
}
