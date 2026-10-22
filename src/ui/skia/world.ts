import { BlendMode, Skia, TileMode } from '@shopify/react-native-skia';
import type { SkCanvas } from '@shopify/react-native-skia';

import { applyVariant, depthScale, resolveBreedById } from '../../actor';
import type { TimeOfDay, World } from '../../actor';
import { stageHeight, stageWidth } from '../../actor/geometry';
import { actorTint, lighting, petLightAmount, sceneryTint } from '../../actor/lighting';
import { skyAt } from '../../actor/sky';
import type { SkyState } from '../../actor/sky';
import type { Rgba } from '../../actor/timeOfDay';
import { buildDecor } from './decor';
import { clamp, fillOval, paintOf } from './draw';
import { untinted, withTint, noise } from './ink';
import { drawLampPools, drawWindowLight, lightRig, shadeActorLayer } from './light';
import { drawOverlay } from './marks';
import { drawActor } from './pet';
import type { OverlayBurst } from '../../playdate/overlay';
import { drawAmbient, drawBackdrop, drawProp, drawToyShape, drawTreatShape } from './scenery';
import type { Contact, Env } from './scenery';

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

// How fast each pet is moving, from its position last frame. Props use it to react (bush rustles).
const lastSeen = new Map<string, { x: number; y: number; t: number; speed: number }>();

function contactsOf(world: World): Contact[] {
  const out: Contact[] = [];
  for (const actor of world.actors) {
    const id = String(actor.id);
    const prev = lastSeen.get(id);
    let speed = 0;
    if (prev && world.t > prev.t) {
      const raw = Math.hypot(actor.x - prev.x, actor.y - prev.y) / (world.t - prev.t);
      speed = prev.speed * 0.7 + Math.min(raw, 600) * 0.3;
    }
    lastSeen.set(id, { x: actor.x, y: actor.y, t: world.t, speed });
    out.push({ id, x: actor.x, y: actor.y, speed });
  }
  if (lastSeen.size > 32) {
    lastSeen.clear();
  }
  return out;
}

export type Atmosphere = {
  /** The moment to draw the sky for (moon phase, season, decor, weather). Defaults to now. */
  date?: Date;
  /** A precomputed sky, or null to draw without one (plain sky, no weather or decor). */
  sky?: SkyState | null;
};

export function drawWorld(
  canvas: SkCanvas,
  world: World,
  width: number,
  height: number,
  tod: TimeOfDay,
  reduced: boolean,
  visibleHeight: number = stageHeight,
  camera?: { x: number; y: number; zoom: number },
  overlay?: {
    bursts: readonly OverlayBurst[];
    rope?: { sag: number } | null;
    butterfly?: { x: number; y: number } | null;
    zzz?: readonly { x: number; y: number; phase: number }[];
  },
  atmosphere?: Atmosphere,
): void {
  const scene = world.scene;
  const floor = scene.floor;
  canvas.save();
  // Extra stage units of sky and floor on each side when the view is wider than the stage.
  let bleed = 0;
  if (camera) {
    const fit = Math.min(width / stageWidth, height / stageHeight);
    canvas.translate(width / 2, height * 0.62);
    const scale = fit * camera.zoom;
    canvas.scale(scale, scale);
    canvas.translate(-camera.x, -camera.y);
  } else {
    const scaleY = height / visibleHeight;
    const contentPx = stageWidth * scaleY;
    if (width > contentPx + 0.5) {
      const pad = (width - contentPx) / 2;
      bleed = pad / scaleY;
      canvas.translate(pad, 0);
      canvas.scale(scaleY, scaleY);
    } else {
      canvas.scale(width / stageWidth, scaleY);
    }
  }
  const feeding: Env['feeding'] = [];
  for (const actor of world.actors) {
    if (actor.task.type === 'eat' && actor.task.stage === 'eating' && actor.task.poi) {
      feeding.push({ x: actor.task.poi.x, y: actor.task.poi.y, kind: actor.task.kind === 'drink' ? 'drink' : 'eat' });
    }
  }
  const sky = atmosphere?.sky === null ? undefined : atmosphere?.sky ?? skyAt(atmosphere?.date ?? new Date());
  const baseWind = sky?.weather.wind ?? 0.2;
  // Gusts on top of the day's wind.
  const gust = Math.max(0, noise(world.t * 0.25, 5)) ** 2 * 0.6;
  const env: Env = {
    tod,
    t: world.t,
    reduced,
    bowlFill: world.bowlFill,
    waterLevel: world.waterLevel,
    glows: [],
    feeding,
    sky,
    wind: reduced ? baseWind : baseWind * (0.75 + 0.25 * noise(world.t * 0.1, 3)) + Math.sign(baseWind || 1) * gust,
    contacts: contactsOf(world),
    scene,
    bleed,
  };
  env.light = lightRig(scene, env);
  const roomTint = sceneryTint(scene, tod);
  const bodyTint = actorTint(scene, tod);
  const decor = buildDecor(scene, env);

  withTint(roomTint, () => {
    drawBackdrop(canvas, scene, env, bleed);
    decor.wall(canvas);
  });
  untinted(() => {
    drawWindowLight(canvas, scene, env);
    if (env.light) {
      drawLampPools(canvas, env.light);
    }
  });
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
      items.push({ y: prop.y, draw: () => withTint(roomTint, () => drawProp(canvas, prop, env)) });
    }
  }
  for (const piece of decor.floor) {
    items.push({ y: piece.y, draw: () => withTint(roomTint, () => piece.draw(canvas)) });
  }
  const span = { x: -bleed - 400, y: -600, w: stageWidth + bleed * 2 + 800, h: stageHeight + 1200 };
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
      draw: () => {
        const rim = (env.light?.rimStrength ?? 0) > 0.03;
        if (bodyTint.a <= 0.001 && !rim) {
          drawActor(canvas, actor, breed, floor, world.t, carrying, world.silhouette === true);
          return;
        }
        // The pet gets its own layer: tint and rim light are painted SrcATop, so only the pet is touched.
        canvas.saveLayer();
        drawActor(canvas, actor, breed, floor, world.t, carrying, world.silhouette === true);
        if (world.silhouette !== true) {
          shadeActorLayer(canvas, env, actor, bodyTint, span);
        } else if (bodyTint.a > 0.001) {
          shadeActorLayer(canvas, { ...env, light: undefined }, actor, bodyTint, span);
        }
        canvas.restore();
      },
    });
  }
  if (overlay?.rope && world.actors.length >= 2) {
    const lower = Math.max(world.actors[0]?.y ?? 0, world.actors[1]?.y ?? 0);
    const sag = overlay.rope.sag;
    items.push({
      y: lower + 0.01,
      draw: () => {
        const left = world.actors[0]?.mouthMark;
        const right = world.actors[1]?.mouthMark;
        if (!left || !right) {
          return;
        }
        const curve = Skia.Path.Make();
        curve.moveTo(left.x, left.y);
        curve.quadTo((left.x + right.x) / 2, (left.y + right.y) / 2 + sag, right.x, right.y);
        canvas.drawPath(curve, paintOf('#c4553a', 1, 3.2));
      },
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
          const treatId = toy.kind.startsWith('treat:') ? toy.kind.slice('treat:'.length) : null;
          if (treatId) {
            const nibbling = world.actors.some((actor) => actor.task.type === 'treat' && actor.task.stage === 'nibble');
            const bob = nibbling ? Math.sin(world.t * 18) * 1.4 : 0;
            drawTreatShape(canvas, treatId, toy.x, toy.y - toy.z - radius + bob, radius * 1.25, world.t);
            return;
          }
          drawToyShape(canvas, toy.kind, toy.x, toy.y - toy.z - radius, radius, world.t);
        }),
    });
  }
  items.sort((a, b) => a.y - b.y);
  for (const item of items) {
    item.draw();
  }
  withTint(roomTint, () => {
    for (const prop of scene.props) {
      if (prop.layer === 'front') {
        drawProp(canvas, prop, env);
      }
    }
  });
  drawAmbient(canvas, world, env, bleed);
  untinted(() => decor.ambient(canvas));
  if (overlay && (overlay.bursts.length > 0 || overlay.butterfly || (overlay.zzz?.length ?? 0) > 0)) {
    drawOverlay(canvas, overlay.bursts, { butterfly: overlay.butterfly, zzz: overlay.zzz, t: world.t });
  }
  canvas.restore();
}

// The closet mirror paints its own wall and floor, so the preview draws the pet with no room.
export function drawPetOnly(
  canvas: SkCanvas,
  world: World,
  width: number,
  height: number,
  tod: TimeOfDay,
  camera: { x: number; y: number; zoom: number },
): void {
  const scene = world.scene;
  const floor = scene.floor;
  canvas.save();
  const fit = Math.min(width / stageWidth, height / stageHeight);
  canvas.translate(width / 2, height * 0.62);
  const scale = fit * camera.zoom;
  canvas.scale(scale, scale);
  canvas.translate(-camera.x, -camera.y);
  const bodyTint = actorTint(scene, tod);
  for (const actor of world.actors) {
    const resolved = resolveBreedById(actor.breedId, actor.look);
    if (!resolved) {
      continue;
    }
    const breed = applyVariant(resolved, actor.variant);
    drawTinted(canvas, bodyTint, () => drawActor(canvas, actor, breed, floor, world.t, null, world.silhouette === true));
  }
  canvas.restore();
}
