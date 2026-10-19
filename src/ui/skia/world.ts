import { BlendMode, Skia, TileMode } from '@shopify/react-native-skia';
import type { SkCanvas } from '@shopify/react-native-skia';

import { depthScale, resolveBreedById } from '../../actor';
import type { TimeOfDay, World } from '../../actor';
import { stageHeight, stageWidth } from '../../actor/geometry';
import { actorTint, lighting, petLightAmount, sceneryTint } from '../../actor/lighting';
import type { Rgba } from '../../actor/timeOfDay';
import { clamp, fillOval } from './draw';
import { drawActor } from './pet';
import { drawAmbient, drawBackdrop, drawBallShape, drawProp } from './scenery';
import type { Env } from './scenery';

function drawTinted(canvas: SkCanvas, tint: Rgba, draw: () => void): void {
  if (tint.a <= 0.001) {
    draw();
    return;
  }
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColorFilter(
    Skia.ColorFilter.MakeBlend(
      Skia.Color(`rgba(${Math.round(tint.r)},${Math.round(tint.g)},${Math.round(tint.b)},${tint.a})`),
      BlendMode.SrcATop,
    ),
  );
  canvas.saveLayer(paint);
  draw();
  canvas.restore();
}

// A warm pool on the floor under the pet once the room is dark, drawn after the tint with screen blending.
function drawPetLight(canvas: SkCanvas, x: number, y: number, amount: number): void {
  const { radius, color } = lighting.petLight;
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setBlendMode(BlendMode.Screen);
  paint.setShader(
    Skia.Shader.MakeRadialGradient(
      Skia.Point(x, y),
      radius,
      [
        Skia.Color(`rgba(${color[0]},${color[1]},${color[2]},${amount})`),
        Skia.Color(`rgba(${color[0]},${color[1]},${color[2]},0)`),
      ],
      null,
      TileMode.Clamp,
    ),
  );
  canvas.drawCircle(x, y, radius, paint);
}

export function drawWorld(
  canvas: SkCanvas,
  world: World,
  width: number,
  height: number,
  tod: TimeOfDay,
  reduced: boolean,
  visibleHeight: number = stageHeight,
): void {
  const scene = world.scene;
  const floor = scene.floor;
  canvas.scale(width / stageWidth, height / visibleHeight);
  const feeding: Env['feeding'] = [];
  for (const actor of world.actors) {
    if (actor.task.type === 'eat' && actor.task.stage === 'eating' && actor.task.poi) {
      feeding.push({ x: actor.task.poi.x, y: actor.task.poi.y, kind: actor.task.kind === 'drink' ? 'drink' : 'eat' });
    }
  }
  const env: Env = {
    tod,
    t: world.t,
    reduced,
    bowlFill: world.bowlFill,
    waterLevel: world.waterLevel,
    glows: [],
    feeding,
  };
  const roomTint = sceneryTint(scene, tod);
  const bodyTint = actorTint(scene, tod);

  drawTinted(canvas, roomTint, () => drawBackdrop(canvas, scene, env));
  if (scene.time === 'indoor') {
    const glow = petLightAmount(tod.dark);
    if (glow > 0) {
      for (const actor of world.actors) {
        drawPetLight(canvas, actor.x, actor.y, glow);
      }
    }
  }

  // props, pets and the ball are sorted by their baseline so the pet walks behind and in front of furniture
  const items: { y: number; draw: () => void }[] = [];
  for (const prop of scene.props) {
    if ((prop.layer ?? 'sorted') === 'sorted') {
      items.push({ y: prop.y, draw: () => drawTinted(canvas, roomTint, () => drawProp(canvas, prop, env)) });
    }
  }
  for (const actor of world.actors) {
    const breed = resolveBreedById(actor.breedId, actor.look);
    if (!breed) {
      continue;
    }
    const carrying = world.items.some((item) => item.state === 'carried' && item.holderId === actor.id);
    // A pet at its bowl stands just in front of it, so the head is seen over the bowl and not hidden by it.
    const atBowl = actor.task.type === 'eat' && actor.task.stage === 'eating';
    items.push({
      y: actor.y + (atBowl ? 1 : 0),
      draw: () => drawTinted(canvas, bodyTint, () => drawActor(canvas, actor, breed, floor, world.t, carrying)),
    });
  }
  for (const toy of world.items) {
    if (toy.state !== 'free') {
      continue;
    }
    items.push({
      y: toy.y,
      draw: () =>
        drawTinted(canvas, bodyTint, () => {
          const radius = 8 * depthScale(toy.y, floor.yMin, floor.yMax);
          const shade = clamp(1 - toy.z / 260, 0.4, 1);
          fillOval(canvas, toy.x, toy.y + 1, radius * shade * 1.1, radius * 0.4 * shade, '#000000', 0.15);
          drawBallShape(canvas, toy.x, toy.y - toy.z - radius, radius);
        }),
    });
  }
  items.sort((a, b) => a.y - b.y);
  for (const item of items) {
    item.draw();
  }
  for (const prop of scene.props) {
    if (prop.layer === 'front') {
      drawTinted(canvas, roomTint, () => drawProp(canvas, prop, env));
    }
  }
  drawAmbient(canvas, world, env);
}
