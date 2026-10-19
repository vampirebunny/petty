import { BlendMode, Skia, TileMode } from '@shopify/react-native-skia';
import type { SkCanvas } from '@shopify/react-native-skia';

import { applyVariant, depthScale, resolveBreedById } from '../../actor';
import type { TimeOfDay, World } from '../../actor';
import { stageHeight, stageWidth } from '../../actor/geometry';
import { actorTint, lighting, petLightAmount, sceneryTint } from '../../actor/lighting';
import type { Rgba } from '../../actor/timeOfDay';
import { clamp, fillOval } from './draw';
import { drawActor } from './pet';
import { drawAmbient, drawBackdrop, drawProp, drawToyShape } from './scenery';
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
  camera?: { x: number; y: number; zoom: number },
): void {
  const scene = world.scene;
  const floor = scene.floor;
  canvas.save();
  if (camera) {
    const fit = Math.min(width / stageWidth, height / stageHeight);
    canvas.translate(width / 2, height * 0.62);
    const scale = fit * camera.zoom;
    canvas.scale(scale, scale);
    canvas.translate(-camera.x, -camera.y);
  } else {
    canvas.scale(width / stageWidth, height / visibleHeight);
  }
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
    const resolved = resolveBreedById(actor.breedId, actor.look);
    if (!resolved) {
      continue;
    }
    const breed = applyVariant(resolved, actor.variant);
    const carrying = world.items.find((item) => item.state === 'carried' && item.holderId === actor.id)?.kind ?? null;
    // A pet at its bowl stands just in front of it, so the head is seen over the bowl and not hidden by it.
    const atBowl = actor.task.type === 'eat' && actor.task.stage === 'eating';
    // A pet stepping onto a bed from behind would be covered by it until it crosses the bed's sort line,
    // so a pet over a bed is always drawn in front of it.
    let sortY = actor.y + (atBowl ? 1 : 0);
    for (const prop of scene.props) {
      if (prop.kind === 'bed' && Math.abs(actor.x - prop.x) < (prop.w ?? 0) / 2 && actor.y > prop.y - 60) {
        sortY = Math.max(sortY, prop.y + 1);
      }
    }
    items.push({
      y: sortY,
      draw: () => drawTinted(canvas, bodyTint, () => drawActor(canvas, actor, breed, floor, world.t, carrying, world.silhouette === true)),
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
          drawToyShape(canvas, toy.kind, toy.x, toy.y - toy.z - radius, radius, world.t);
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
  canvas.restore();
}
