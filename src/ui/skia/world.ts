import { BlendMode, Skia, TileMode } from '@shopify/react-native-skia';
import type { SkCanvas } from '@shopify/react-native-skia';

import { applyVariant, depthScale, resolveBreedById } from '../../actor';
import { furnitureClaims } from '../../actor/furnitureUse';
import type { TimeOfDay, World } from '../../actor';
import { schoolStageHeight, stageBleed } from '../../actor/scenes';
import { drawBird, drawBirdGround } from './birds';
import { stageHeight, stageWidth } from '../../actor/geometry';
import { actorTint, indoorOverlayAlpha, lighting, petLightAmount, sceneryTint, stepNightFade } from '../../actor/lighting';
import { skyAt } from '../../actor/sky';
import type { SkyState } from '../../actor/sky';
import type { Rgba } from '../../actor/timeOfDay';
import { buildDecor } from './decor';
import { clamp, fillOval, paintOf } from './draw';
import { untinted, withTint, noise } from './ink';
import { drawCozyPools, drawLampPools, drawMoonPools, drawNightVeil, drawWindowLight, lightRig, shadeActorLayer } from './light';
import { drawOverlay } from './marks';
import { drawActor } from './pet';
import type { OverlayBurst } from '../../playdate/overlay';
import { drawDogHouse } from './props';
import { catBack, catFront, dogBack, dogFront, nightOverlay, room, skyDay, skyNight } from './schoolSvgs';
import { drawAmbient, drawBackdrop, drawHeldPlay, drawProp, drawToyShape, drawTreatShape } from './scenery';
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
let cozyShown: number | null = null;
let cozyAt = 0;

function shownNight(target: number, reduced: boolean): number {
  const now = Date.now();
  const dt = cozyAt === 0 ? 1 : (now - cozyAt) / 1000;
  cozyAt = now;
  cozyShown = stepNightFade(cozyShown, target, dt, reduced);
  return cozyShown;
}

const schoolSvgCache = new Map<string, ReturnType<typeof Skia.SVG.MakeFromString>>();

function schoolSvg(key: string, xml: string) {
  const hit = schoolSvgCache.get(key);
  if (hit !== undefined) {
    return hit;
  }
  const made = Skia.SVG.MakeFromString(xml);
  schoolSvgCache.set(key, made);
  return made;
}

function drawSchoolSvg(canvas: SkCanvas, key: string, xml: string, alpha = 1): void {
  const svg = schoolSvg(key, xml);
  if (!svg || alpha <= 0.01) {
    return;
  }
  if (alpha < 0.99) {
    const paint = Skia.Paint();
    paint.setAlphaf(alpha);
    canvas.saveLayer(paint);
    canvas.drawSvg(svg, stageWidth, schoolStageHeight);
    canvas.restore();
    return;
  }
  canvas.drawSvg(svg, stageWidth, schoolStageHeight);
}

function drawSchool(canvas: SkCanvas, world: World, width: number, height: number, tod: TimeOfDay, reduced: boolean): void {
  const scale = Math.min(width / stageWidth, height / schoolStageHeight);
  canvas.save();
  canvas.translate((width - stageWidth * scale) / 2, (height - schoolStageHeight * scale) / 2);
  canvas.scale(scale, scale);
  const dark = shownNight(tod.dark, reduced);
  drawSchoolSvg(canvas, 'sky-day', skyDay);
  drawSchoolSvg(canvas, 'sky-night', skyNight, dark);
  const nightRoom = dark > 0.2;
  const roomXml = nightRoom ? room.replace(/<path id="sunpatch"[^>]*\/>/, '') : room;
  drawSchoolSvg(canvas, nightRoom ? 'room-night' : 'room-day', roomXml);
  const cat = world.actors.some((actor) => !actor.guest && resolveBreedById(actor.breedId, actor.look)?.species === 'cat');
  drawSchoolSvg(canvas, cat ? 'cat-back' : 'dog-back', cat ? catBack : dogBack);
  drawSchoolSvg(canvas, 'night', nightOverlay, dark);
  const floor = world.scene.floor;
  for (const actor of world.actors) {
    const breed = resolveBreedById(actor.breedId, actor.look);
    if (!breed) {
      continue;
    }
    const carrying = world.items.find((item) => item.state === 'carried' && item.holderId === actor.id)?.kind ?? null;
    drawActor(canvas, actor, breed, floor, world.t, carrying, world.silhouette === true, world.reducedMotion);
  }
  for (const toy of world.items) {
    if (!toy.kind.startsWith('treat:')) {
      continue;
    }
    const treatId = toy.kind.slice('treat:'.length);
    const radius = 8 * depthScale(toy.y, floor.yMin, floor.yMax);
    const actor = world.actors[0];
    const breed = actor ? resolveBreedById(actor.breedId, actor.look) : null;
    drawTreatShape(canvas, treatId, toy.x, toy.y - toy.z - radius, radius, world.t, breed?.species ?? null);
  }
  drawSchoolSvg(canvas, cat ? 'cat-front' : 'dog-front', cat ? catFront : dogFront);
  canvas.restore();
}

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
  if (scene.id === 'school') {
    drawSchool(canvas, world, width, height, tod, reduced);
    canvas.restore();
    return;
  }
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
    bleed = stageBleed(width, height, visibleHeight);
    if (bleed > 0) {
      const pad = bleed * scaleY;
      canvas.translate(pad, 0);
      canvas.scale(scaleY, scaleY);
    } else {
      canvas.scale(width / stageWidth, scaleY);
    }
  }
  const feeding: Env['feeding'] = [];
  const scratches: NonNullable<Env['scratches']> = [];
  for (const actor of world.actors) {
    if (actor.task.type === 'eat' && actor.task.stage === 'eating' && actor.task.poi) {
      feeding.push({ x: actor.task.poi.x, y: actor.task.poi.y, kind: actor.task.kind === 'drink' ? 'drink' : 'eat' });
    }
    const use = actor.furniture;
    if (!use) {
      continue;
    }
    for (const speck of use.rig.specks) {
      scratches.push({ id: use.pieceId, x: speck.x, y: speck.y, a: 1 - speck.age / Math.max(speck.life, 0.01) });
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
    liftedId: world.liftedId,
    squishId: world.squishId,
    squishAt: world.squishAt,
    glows: [],
    feeding,
    sky,
    wind: reduced ? baseWind : baseWind * (0.75 + 0.25 * noise(world.t * 0.1, 3)) + Math.sign(baseWind || 1) * gust,
    contacts: contactsOf(world),
    scratches,
    scene,
    bleed,
  };
  const cozy = scene.time === 'indoor';
  if (cozy) {
    env.tod = { ...tod, dark: shownNight(tod.dark, reduced) };
  }
  env.light = lightRig(scene, env);
  const clear = { r: 0, g: 0, b: 0, a: 0 };
  const roomTint = cozy ? clear : sceneryTint(scene, tod);
  const bodyTint = cozy ? clear : actorTint(scene, tod);
  const decor = buildDecor(scene, env);

  withTint(roomTint, () => {
    drawBackdrop(canvas, scene, env, bleed);
    decor.wall(canvas);
  });
  untinted(() => {
    drawWindowLight(canvas, scene, env);
    if (env.light && !cozy) {
      drawLampPools(canvas, env.light);
    }
  });

  const lifted = cozy && env.tod.dark > 0.02;
  const engaged = (id: string | undefined) =>
    !!id &&
    world.actors.some((actor) => {
      const kind = actor.task.type;
      return actor.task.poi?.propId === id && (kind === 'eat' || kind === 'sleep' || kind === 'treat');
    });

  // props, pets and the ball are sorted by their baseline so the pet walks behind and in front of furniture.
  // Indoors at night the pet, his toy, and the prop he is using stay above the navy veil.
  const items: { y: number; late: boolean; draw: () => void }[] = [];
  for (const prop of scene.props) {
    if ((prop.layer ?? 'sorted') === 'sorted') {
      const napper =
        prop.kind === 'dogHouse'
          ? world.actors.find(
              (actor) =>
                actor.task.type === 'idle' &&
                actor.idle.mode === 'nap' &&
                Math.hypot(actor.x - prop.x, actor.y - prop.y) < 36,
            )
          : undefined;
      if (napper) {
        const drawPart = (part: 'back' | 'front') => {
          canvas.save();
          canvas.translate(prop.x, prop.y);
          drawDogHouse(canvas, part);
          canvas.restore();
        };
        items.push({ y: napper.y - 0.2, late: false, draw: () => withTint(roomTint, () => drawPart('back')) });
        items.push({ y: napper.y + 0.2, late: false, draw: () => withTint(roomTint, () => drawPart('front')) });
        continue;
      }
      items.push({
        y: prop.y,
        late: lifted && engaged(prop.id),
        draw: () => withTint(roomTint, () => drawProp(canvas, prop, env)),
      });
    }
  }
  for (const piece of decor.floor) {
    items.push({ y: piece.y, late: false, draw: () => withTint(roomTint, () => piece.draw(canvas)) });
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
    const use = actor.furniture;
    const onFurniture =
      use != null &&
      (use.phase === 'climb' ||
        use.phase === 'pull' ||
        use.phase === 'perch' ||
        use.phase === 'land' ||
        (use.phase === 'air' && use.surface !== 'floor'));
    for (const prop of scene.props) {
      if (prop.kind === 'bed' && Math.abs(actor.x - prop.x) < (prop.w ?? 0) / 2 && actor.y > prop.y - 60) {
        sortY = Math.max(sortY, prop.y + 1);
      }
      // The tree is one draw, so a cat on it has to sort in front or the platforms cover the climb.
      if (onFurniture && prop.id && furnitureClaims(actor, prop.id)) {
        sortY = Math.max(sortY, prop.y + 1);
      }
    }
    items.push({
      y: sortY,
      late: lifted,
      draw: () => {
        const rim = !cozy && (env.light?.rimStrength ?? 0) > 0.03;
        if (bodyTint.a <= 0.001 && !rim) {
          drawActor(canvas, actor, breed, floor, world.t, carrying, world.silhouette === true, world.reducedMotion);
          return;
        }
        // The pet gets its own layer: tint and rim light are painted SrcATop, so only the pet is touched.
        canvas.saveLayer();
        drawActor(canvas, actor, breed, floor, world.t, carrying, world.silhouette === true, world.reducedMotion);
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
      late: lifted,
      draw: () => {
        const left = world.actors[0]?.mouthMark;
        const right = world.actors[1]?.mouthMark;
        if (!left || !right) {
          return;
        }
        const curve = Skia.PathBuilder.Make();
        curve.moveTo(left.x, left.y);
        curve.quadTo((left.x + right.x) / 2, (left.y + right.y) / 2 + sag, right.x, right.y);
        canvas.drawPath(curve.build(), paintOf('#c4553a', 1, 3.2));
      },
    });
  }
  for (const toy of world.items) {
    if (toy.state !== 'free') {
      continue;
    }
    items.push({
      y: toy.y,
      late: lifted,
      draw: () =>
        drawTinted(canvas, bodyTint, () => {
          const radius = 8 * depthScale(toy.y, floor.yMin, floor.yMax);
          const shade = clamp(1 - toy.z / 260, 0.4, 1);
          fillOval(canvas, toy.x, toy.y + 1, radius * shade * 1.1, radius * 0.4 * shade, '#000000', 0.15);
          const treatId = toy.kind.startsWith('treat:') ? toy.kind.slice('treat:'.length) : null;
          if (treatId) {
            const nibbling = world.actors.some((actor) => actor.task.type === 'treat' && actor.task.stage === 'nibble');
            const bob = nibbling ? Math.sin(world.t * 18) * 1.4 : 0;
            const actor = world.actors[0];
            const breed = actor ? resolveBreedById(actor.breedId, actor.look) : null;
            drawTreatShape(canvas, treatId, toy.x, toy.y - toy.z - radius + bob, radius, world.t, breed?.species ?? null);
            return;
          }
          drawToyShape(canvas, toy.kind, toy.x, toy.y - toy.z - radius, radius, world.t);
        }),
    });
  }
  for (const bird of world.birds) {
    if (bird.state === 'away' || bird.airborne) {
      continue;
    }
    items.push({
      y: bird.depth,
      late: false,
      draw: () =>
        withTint(roomTint, () => {
          drawBirdGround(canvas, bird, env);
          drawBird(canvas, bird, env);
        }),
    });
  }
  items.sort((a, b) => a.y - b.y);
  for (const item of items) {
    if (!item.late) {
      item.draw();
    }
  }
  if (cozy) {
    withTint(roomTint, () => {
      for (const prop of scene.props) {
        if (prop.layer === 'front' && !engaged(prop.id)) {
          drawProp(canvas, prop, env);
        }
      }
    });
    // Room art stays full color. Night is this veil, then the lights that punch through it.
    drawNightVeil(canvas, bleed, env.tod.dark);
    untinted(() => {
      drawMoonPools(canvas, scene, env.tod.dark);
      if (env.light) {
        drawCozyPools(canvas, env.light, env.glows);
      }
    });
    const glow = petLightAmount(env.tod.dark);
    if (glow > 0) {
      for (const actor of world.actors) {
        drawPetLight(canvas, actor.x, actor.y, glow);
      }
    }
  }
  for (const item of items) {
    if (item.late) {
      item.draw();
    }
  }
  if (cozy) {
    for (const prop of scene.props) {
      if (prop.layer === 'front' && engaged(prop.id)) {
        drawProp(canvas, prop, env);
      }
    }
  }
  if (!cozy) {
    withTint(roomTint, () => {
      for (const prop of scene.props) {
        if (prop.layer === 'front') {
          drawProp(canvas, prop, env);
        }
      }
    });
  }
  if (world.held) {
    drawHeldPlay(canvas, world, env.t);
  }
  withTint(roomTint, () => {
    for (const bird of world.birds) {
      if (bird.airborne) {
        drawBird(canvas, bird, env);
      }
    }
  });
  drawAmbient(canvas, world, env, bleed, cozy);
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
  const bodyTint = scene.time === 'indoor' ? { r: 0, g: 0, b: 0, a: 0 } : actorTint(scene, tod);
  for (const actor of world.actors) {
    const resolved = resolveBreedById(actor.breedId, actor.look);
    if (!resolved) {
      continue;
    }
    const breed = applyVariant(resolved, actor.variant);
    drawTinted(canvas, bodyTint, () => drawActor(canvas, actor, breed, floor, world.t, null, world.silhouette === true, world.reducedMotion));
  }
  canvas.restore();
}
