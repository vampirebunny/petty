import { BlendMode, Skia, TileMode } from '@shopify/react-native-skia';
import type { SkCanvas, SkPaint } from '@shopify/react-native-skia';

import { applyVariant, depthScale, dogBreeds, resolveBreedById, spawnActor } from '../../actor';
import { furnitureClaims } from '../../actor/furnitureUse';
import type { Actor, TimeOfDay, World } from '../../actor';
import { stageBleed, type Prop } from '../../actor/scenes';
import { drawBird, drawBirdGround } from './birds';
import { stageHeight, stageWidth } from '../../actor/geometry';
import { actorTint, lighting, petLightAmount, sceneryTint, stepNightFade } from '../../actor/lighting';
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
import { bedCushionPoint, bedCushionReach } from '../../actor/furniture';
import { drawPupCabana } from './cabana';
import { drawStyledBed, isStyledBed } from './beds';
import { drawAmbient, drawBackdrop, drawHeldPlay, drawProp, drawToyShape, drawTreatShape } from './scenery';
import { drawParkFindFx } from '../../parkFinds/draw';
import { drawTrickProp, splitsAroundActors } from './trickPropArt';
import type { Contact, Env } from './scenery';

function drawCabanaFit(canvas: SkCanvas, prop: Prop, floor: { yMin: number; yMax: number }): void {
  const rest = bedCushionPoint(prop);
  for (const breed of dogBreeds()) {
    const actor = spawnActor(
      { id: breed.id, breedId: breed.id, ageDays: 40, weight: 0, vitality: 1, equipped: {}, asleep: false },
      rest,
    );
    actor.octant = 'E';
    actor.octantFrom = 'E';
    actor.octantTarget = 'E';
    actor.octantBlend = 1;
    drawActor(canvas, actor, breed, floor, 0, null, true, true);
    actor.octant = 'S';
    actor.octantFrom = 'S';
    actor.octantTarget = 'S';
    actor.pose.lie = 1;
    drawActor(canvas, actor, breed, floor, 0, null, true, true);
  }
}

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

const petLights = new Map<string, SkPaint>();

function drawPetLight(canvas: SkCanvas, x: number, y: number, amount: number): void {
  const { radius, color } = lighting.petLight;
  // The gradient is centered on the pet, so the key includes a coarse position as well as brightness.
  const qx = Math.round(x / 8) * 8;
  const qy = Math.round(y / 8) * 8;
  const qa = Math.round(amount * 20) / 20;
  const key = `${qx}|${qy}|${qa}`;
  let paint = petLights.get(key);
  if (!paint) {
    if (petLights.size > 48) {
      petLights.clear();
    }
    paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setBlendMode(BlendMode.Screen);
    paint.setShader(
      Skia.Shader.MakeRadialGradient(
        Skia.Point(qx, qy),
        radius,
        [
          Skia.Color(`rgba(${color[0]},${color[1]},${color[2]},${qa})`),
          Skia.Color(`rgba(${color[0]},${color[1]},${color[2]},0)`),
        ],
        null,
        TileMode.Clamp,
      ),
    );
    petLights.set(key, paint);
  }
  canvas.drawCircle(qx, qy, radius, paint);
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

export type DrawLayer = 'all' | 'back' | 'live' | 'front';

// Home draws the room as three pictures. Furniture behind the pet and the ball stays in `back`,
// furniture in front of both stays in `front`, and those two are recorded again only when the
// split changes or the slow scenery step ticks. The pet, the ball, and the birds are `live`.
function actorSortY(world: World, actor: Actor): number {
  let sortY = actor.y + (actor.task.type === 'eat' && actor.task.stage === 'eating' ? 1 : 0);
  const use = actor.furniture;
  const onFurniture =
    use != null &&
    (use.phase === 'climb' ||
      use.phase === 'pull' ||
      use.phase === 'perch' ||
      use.phase === 'land' ||
      (use.phase === 'air' && use.surface !== 'floor'));
  for (const prop of world.scene.props) {
    const cushion = prop.kind === 'bed' || prop.kind === 'dogHouse';
    const reach = prop.kind === 'bed' && !isStyledBed(prop) ? 60 : cushion ? bedCushionReach(prop) : 0;
    if (cushion && Math.abs(actor.x - prop.x) < (prop.w ?? 0) / 2 && actor.y > prop.y - reach) {
      sortY = Math.max(sortY, prop.y + 1);
    }
    if (onFurniture && prop.id && furnitureClaims(actor, prop.id)) {
      sortY = Math.max(sortY, prop.y + 1);
    }
  }
  return sortY;
}

function moverSpan(world: World): { minY: number; maxY: number } {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const actor of world.actors) {
    const y = actorSortY(world, actor);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  for (const toy of world.items) {
    if (toy.state !== 'free') {
      continue;
    }
    minY = Math.min(minY, toy.y);
    maxY = Math.max(maxY, toy.y);
  }
  if (minY === Infinity) {
    return { minY: stageHeight, maxY: stageHeight };
  }
  return { minY, maxY };
}

function propEngaged(world: World, id: string | undefined): boolean {
  return (
    !!id &&
    world.actors.some((actor) => {
      const kind = actor.task.type;
      return actor.task.poi?.propId === id && (kind === 'eat' || kind === 'sleep' || kind === 'treat');
    })
  );
}

function staticBand(y: number, late: boolean, night: boolean, span: { minY: number; maxY: number }): 'back' | 'live' | 'front' {
  if (night) {
    return late ? 'live' : 'back';
  }
  if (y < span.minY) {
    return 'back';
  }
  if (y > span.maxY) {
    return 'front';
  }
  return 'live';
}

// A piece in hand stays in the picture that redraws every frame. The room behind and in
// front of the pet can stay frozen while he runs, and a new bowl would never show up there.
function heldBand(
  lifted: boolean,
  y: number,
  late: boolean,
  night: boolean,
  span: { minY: number; maxY: number },
): 'back' | 'live' | 'front' {
  if (lifted) {
    return 'live';
  }
  return staticBand(y, late, night, span);
}

export function roomPlateKey(world: World, width: number, height: number, tod: TimeOfDay, step?: number): string {
  const night = world.scene.time === 'indoor' && tod.dark > 0.02;
  const span = moverSpan(world);
  const props = world.scene.props
    .map((prop) => {
      const late = night && propEngaged(world, prop.id);
      const band = heldBand(world.liftedId === prop.id, prop.y, late, night, span);
      return `${prop.id ?? ''}:${prop.kind}:${Math.round(prop.x)}:${Math.round(prop.y)}:${band}`;
    })
    .join(',');
  const tricks = (world.trickProps ?? [])
    .map((prop) => {
      const band = heldBand(world.liftedPropId === prop.instanceId, prop.y, false, night, span);
      return `${prop.instanceId}:${Math.round(prop.x)}:${Math.round(prop.y)}:${band}`;
    })
    .join(',');
  const decorBand = staticBand(world.scene.floor.yMin + 4, false, night, span);
  const sway = step ?? (world.reducedMotion ? 0 : Math.round(world.t * 10));
  return [
    world.scene.id,
    Math.round(width),
    Math.round(height),
    sway,
    night ? 1 : 0,
    Math.round(tod.dark * 20),
    world.liftedId ?? '',
    world.squishId ?? '',
    world.cabanaFit ? 1 : 0,
    decorBand,
    props,
    tricks,
  ].join('|');
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
  layer: DrawLayer = 'all',
): void {
  const scene = world.scene;
  const floor = scene.floor;
  const viewHeight = visibleHeight ?? stageHeight;
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
    const scaleY = height / viewHeight;
    bleed = stageBleed(width, height, viewHeight);
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
  // The split uses the real darkness. The veil still fades through shownNight.
  const night = cozy && tod.dark > 0.02;
  const movers = moverSpan(world);
  const show = (part: 'back' | 'live' | 'front') => layer === 'all' || layer === part;
  if (cozy) {
    // Only the back picture advances the fade, and it is recorded on the scenery step.
    const dark = show('back') ? shownNight(tod.dark, reduced) : (cozyShown ?? tod.dark);
    env.tod = { ...tod, dark };
  }
  env.light = lightRig(scene, env);
  const clear = { r: 0, g: 0, b: 0, a: 0 };
  const roomTint = cozy ? clear : sceneryTint(scene, tod);
  const bodyTint = cozy ? clear : actorTint(scene, tod);
  const decor = buildDecor(scene, env);

  if (show('back')) {
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
  }

  const engaged = (id: string | undefined) => propEngaged(world, id);

  // props, pets and the ball are sorted by their baseline so the pet walks behind and in front of furniture.
  // Indoors at night the pet, his toy, and the prop he is using stay above the navy veil.
  const items: { y: number; late: boolean; band: 'back' | 'live' | 'front'; draw: () => void }[] = [];
  for (const prop of scene.props) {
    if ((prop.layer ?? 'sorted') === 'sorted') {
      if (isStyledBed(prop)) {
        const late = night && engaged(prop.id);
        items.push({
          y: prop.y,
          late,
          band: heldBand(world.liftedId === prop.id, prop.y, late, night, movers),
          draw: () => withTint(roomTint, () => drawStyledBed(canvas, prop)),
        });
        continue;
      }
      if (prop.kind === 'dogHouse') {
        const late = night && engaged(prop.id);
        const band = heldBand(world.liftedId === prop.id, prop.y, late, night, movers);
        items.push({
          y: prop.y,
          late,
          band,
          draw: () => withTint(roomTint, () => drawPupCabana(canvas, prop)),
        });
        if (world.cabanaFit) {
          items.push({
            y: prop.y + 0.2,
            late,
            band,
            draw: () => drawCabanaFit(canvas, prop, floor),
          });
        }
        continue;
      }
      const late = night && engaged(prop.id);
      items.push({
        y: prop.y,
        late,
        band: heldBand(world.liftedId === prop.id, prop.y, late, night, movers),
        draw: () => withTint(roomTint, () => drawProp(canvas, prop, env)),
      });
    }
  }
  for (const piece of decor.floor) {
    items.push({
      y: piece.y,
      late: false,
      band: staticBand(piece.y, false, night, movers),
      draw: () => withTint(roomTint, () => piece.draw(canvas)),
    });
  }
  const span = { x: -bleed - 400, y: -600, w: stageWidth + bleed * 2 + 800, h: stageHeight + 1200 };
  for (const prop of world.trickProps ?? []) {
    const liftedProp = world.liftedPropId === prop.instanceId;
    const trickBand = heldBand(liftedProp, prop.y, night && liftedProp, night, movers);
    if (!splitsAroundActors(prop)) {
      items.push({
        y: prop.y,
        late: liftedProp,
        band: trickBand,
        draw: () => drawTrickProp(canvas, prop, 'whole'),
      });
      continue;
    }
    const petInFront = world.actors.some((actor) => actor.y > prop.y + 8);
    items.push({
      y: petInFront ? prop.y - 4 : prop.y - 1,
      late: liftedProp,
      band: trickBand,
      draw: () => drawTrickProp(canvas, prop, 'back'),
    });
    items.push({
      y: petInFront ? prop.y - 3 : prop.y + 1,
      late: liftedProp,
      band: trickBand,
      draw: () => drawTrickProp(canvas, prop, 'front'),
    });
  }
  for (const actor of world.actors) {
    const resolved = resolveBreedById(actor.breedId, actor.look);
    if (!resolved) {
      continue;
    }
    const breed = applyVariant(resolved, actor.variant);
    const carrying = world.items.find((item) => item.state === 'carried' && item.holderId === actor.id)?.kind ?? null;
    const sortY = actorSortY(world, actor);
    const paintActor = (showGlow: boolean) => {
      const bed = scene.props.find(
        (prop) => prop.id && prop.id === actor.task.poi?.propId && (prop.kind === 'bed' || prop.kind === 'dogHouse'),
      );
      const onBed =
        bed != null && actor.asleep && actor.task.type === 'sleep' && actor.task.stage === 'sleeping';
      const multiplier = bed?.restMultiplier ?? 1;
      const glow = showGlow && onBed && !actor.guest && multiplier > 1;
      if (glow && bed) {
        const tint = multiplier > 2 ? '#FFE1A8' : '#D7F6EA';
        const pulse = world.reducedMotion ? 0.35 : 0.28 + Math.sin(world.t * 3) * 0.08;
        fillOval(canvas, actor.x, actor.y - 10, 54, 22, tint, pulse);
      }
      const drawPet = () => {
        const rim = !cozy && (env.light?.rimStrength ?? 0) > 0.03;
        if (bodyTint.a <= 0.001 && !rim) {
          drawActor(canvas, actor, breed, floor, world.t, carrying, world.silhouette === true, world.reducedMotion);
          return;
        }
        canvas.saveLayer();
        drawActor(canvas, actor, breed, floor, world.t, carrying, world.silhouette === true, world.reducedMotion);
        if (world.silhouette !== true) {
          shadeActorLayer(canvas, env, actor, bodyTint, span);
        } else if (bodyTint.a > 0.001) {
          shadeActorLayer(canvas, { ...env, light: undefined }, actor, bodyTint, span);
        }
        canvas.restore();
      };
      const scale = actor.clipScale ?? 1;
      if (scale !== 1) {
        canvas.save();
        canvas.translate(actor.x, actor.y);
        canvas.scale(scale, scale);
        canvas.translate(-actor.x, -actor.y);
        drawPet();
        canvas.restore();
      } else {
        drawPet();
      }
    };
    const front = (actor.clipScale ?? 1) > 1;
    items.push({ y: front ? 10000 : sortY, late: night, band: front ? 'front' : 'live', draw: () => paintActor(true) });
  }
  if (overlay?.rope && world.actors.length >= 2) {
    const lower = Math.max(world.actors[0]?.y ?? 0, world.actors[1]?.y ?? 0);
    const sag = overlay.rope.sag;
    items.push({
      y: lower + 0.01,
      late: night,
      band: 'live',
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
      late: night,
      band: 'live',
      draw: () =>
        drawTinted(canvas, bodyTint, () => {
          const radius = (toy.kind === 'frisbee' ? 16 : 8) * depthScale(toy.y, floor.yMin, floor.yMax);
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
      band: 'live',
      draw: () =>
        withTint(roomTint, () => {
          drawBirdGround(canvas, bird, env);
          drawBird(canvas, bird, env);
        }),
    });
  }
  items.sort((a, b) => a.y - b.y);
  for (const item of items) {
    if (!item.late && show(item.band)) {
      item.draw();
    }
  }
  if (cozy) {
    // Non-engaged front props sit under the veil. At night that is the back picture; by day they are in front of the pet.
    if (show(night ? 'back' : 'front')) {
      withTint(roomTint, () => {
        for (const prop of scene.props) {
          if (prop.layer === 'front' && !engaged(prop.id)) {
            drawProp(canvas, prop, env);
          }
        }
      });
    }
    if (show('back')) {
      // Room art stays full color. Night is this veil, then the lights that punch through it.
      drawNightVeil(canvas, bleed, env.tod.dark);
      untinted(() => {
        drawMoonPools(canvas, scene, env.tod.dark);
        if (env.light) {
          drawCozyPools(canvas, env.light, env.glows);
        }
      });
    }
    if (show('live')) {
      const glow = petLightAmount(env.tod.dark);
      if (glow > 0) {
        for (const actor of world.actors) {
          drawPetLight(canvas, actor.x, actor.y, glow);
        }
      }
    }
  }
  for (const item of items) {
    if (item.late && show(item.band)) {
      item.draw();
    }
  }
  if (cozy && show('front')) {
    for (const prop of scene.props) {
      if (prop.layer === 'front' && engaged(prop.id)) {
        drawProp(canvas, prop, env);
      }
    }
  }
  if (!cozy && show('front')) {
    withTint(roomTint, () => {
      for (const prop of scene.props) {
        if (prop.layer === 'front') {
          drawProp(canvas, prop, env);
        }
      }
    });
  }
  if (show('live')) {
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
    if (world.parkFindVisit) {
      withTint(roomTint, () => drawParkFindFx(canvas, world));
    }
    if (overlay && (overlay.bursts.length > 0 || overlay.butterfly || (overlay.zzz?.length ?? 0) > 0)) {
      drawOverlay(canvas, overlay.bursts, { butterfly: overlay.butterfly, zzz: overlay.zzz, t: world.t });
    }
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
  const lead = world.actors[0];
  const petInFront = (propY: number, pad: number) => lead != null && lead.y > propY + pad;
  for (const prop of world.trickProps ?? []) {
    if (!splitsAroundActors(prop)) {
      if (lead == null || lead.y >= prop.y) {
        drawTrickProp(canvas, prop, 'whole');
      }
    } else if (!petInFront(prop.y, 8)) {
      drawTrickProp(canvas, prop, 'back');
    }
  }
  for (const actor of world.actors) {
    const resolved = resolveBreedById(actor.breedId, actor.look);
    if (!resolved) {
      continue;
    }
    const breed = applyVariant(resolved, actor.variant);
    drawTinted(canvas, bodyTint, () => drawActor(canvas, actor, breed, floor, world.t, null, world.silhouette === true, world.reducedMotion));
  }
  for (const prop of world.trickProps ?? []) {
    if (!splitsAroundActors(prop)) {
      if (lead != null && lead.y < prop.y) {
        drawTrickProp(canvas, prop, 'whole');
      }
    } else {
      if (petInFront(prop.y, 8)) {
        drawTrickProp(canvas, prop, 'back');
      }
      drawTrickProp(canvas, prop, 'front');
    }
  }
  canvas.restore();
}
