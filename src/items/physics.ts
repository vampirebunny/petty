import type { Scene } from '../actor/scenes';
import { itemKindById } from './kinds';
import type { Item } from './types';

export function stepItem(item: Item, scene: Scene, dt: number): void {
  if (item.state !== 'free') {
    return;
  }
  const kind = itemKindById(item.kind);
  const phys = kind?.physics ?? { bounce: 1, friction: 1, drag: 1 };
  const floor = scene.floor;
  const surface = scene.surface;
  const bounce = surface.bounce * phys.bounce;
  const frictionRate = surface.friction * phys.friction;
  const lift = phys.lift ?? 0;

  item.vz -= (900 - lift * 120) * dt;
  item.z += item.vz * dt;
  if (item.z < 0) {
    item.z = 0;
    item.vz = Math.abs(item.vz) > 60 ? -item.vz * bounce : 0;
  }
  item.x += item.vx * dt;
  item.y += item.vy * dt;
  const drag = Math.exp(-dt * (item.z > 0 ? 0.3 * phys.drag : frictionRate));
  item.vx *= drag;
  item.vy *= drag;
  if (item.x < floor.xMin - 14) {
    item.x = floor.xMin - 14;
    item.vx = Math.abs(item.vx) * 0.6;
  }
  if (item.x > floor.xMax + 14) {
    item.x = floor.xMax + 14;
    item.vx = -Math.abs(item.vx) * 0.6;
  }
  if (item.y < floor.yMin) {
    item.y = floor.yMin;
    item.vy = Math.abs(item.vy) * 0.6;
  }
  if (item.y > floor.yMax) {
    item.y = floor.yMax;
    item.vy = -Math.abs(item.vy) * 0.6;
  }
}

export function stepItems(items: Item[], scene: Scene, dt: number): void {
  for (const item of items) {
    stepItem(item, scene, dt);
  }
}
