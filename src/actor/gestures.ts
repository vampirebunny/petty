import { jump } from './jump';
import type { GestureRun, Pose } from './types';
import type { Actor } from './types';

export type GestureStep = {
  ms: number;
  pose: Partial<Pose>;
  rate?: Partial<Record<keyof Pose, number>>;
};

export type Gesture = {
  id: string;
  faceCamera?: boolean;
  steps: GestureStep[];
};

const snap = { headTurn: 40, earBack: 28 };

const gestures: Record<string, Gesture> = {
  double_take: {
    id: 'double_take',
    steps: [
      { ms: 120, pose: { headTurn: 1, earBack: 1 }, rate: snap },
      { ms: 120, pose: { headTurn: 0, earBack: 0 }, rate: snap },
      { ms: 120, pose: { headTurn: 1, earBack: 0.4 }, rate: snap },
      { ms: 120, pose: { headTurn: 0, earBack: 0 }, rate: snap },
    ],
  },
  startle: {
    id: 'startle',
    steps: [
      { ms: 280, pose: { earBack: 1, rearUp: 0.6, pupils: 1 }, rate: { earBack: 24, rearUp: 12, pupils: 16 } },
      { ms: 220, pose: { earBack: 0.2, rearUp: 0, pupils: 0 } },
    ],
  },
  sneeze: {
    id: 'sneeze',
    steps: [
      { ms: 150, pose: { headDown: 1, shake: 1, jawHold: 1 }, rate: { headDown: 30, shake: 24, jawHold: 30 } },
      { ms: 220, pose: { headDown: 0, shake: 0, jawHold: 0 } },
    ],
  },
  yawn: {
    id: 'yawn',
    steps: [
      { ms: 900, pose: { bow: 1, headUp: 0.55, jawHold: 1, eyes: 1 } },
      { ms: 400, pose: { bow: 0.3, headUp: 0, jawHold: 0, eyes: 0 } },
    ],
  },
  butt_wiggle: {
    id: 'butt_wiggle',
    steps: [{ ms: 700, pose: { stalk: 0.6, wiggle: 1 } }],
  },
  shake_off: {
    id: 'shake_off',
    steps: [{ ms: 600, pose: { shake: 1 }, rate: { shake: 18 } }],
  },
  look_at_camera: {
    id: 'look_at_camera',
    faceCamera: true,
    steps: [{ ms: 900, pose: { faceFront: 1, headTurn: 1 }, rate: { headTurn: 18, faceFront: 18 } }],
  },
  big_stretch: {
    id: 'big_stretch',
    steps: [{ ms: 600, pose: { bow: 1, headUp: 0.6 } }],
  },
  head_tilt: {
    id: 'head_tilt',
    steps: [
      { ms: 400, pose: { headRot: 0.4 } },
      { ms: 400, pose: { headRot: -0.4 } },
    ],
  },
  glance: {
    id: 'glance',
    steps: [{ ms: 400, pose: { earBack: 1, headTurn: 1 }, rate: { earBack: 16, headTurn: 16 } }],
  },
  scratch: {
    id: 'scratch',
    steps: [{ ms: 500, pose: { paw: 1, headDown: 1 } }],
  },
  tail_up: {
    id: 'tail_up',
    steps: [{ ms: 500, pose: { tailLift: 1 } }],
  },
};

export function gestureById(id: string): Gesture | null {
  return gestures[id] ?? null;
}

export function currentGestureStep(actor: Actor): GestureStep | null {
  const run = actor.gesture;
  if (!run) {
    return null;
  }
  const gesture = gestures[run.id];
  if (!gesture) {
    return null;
  }
  return gesture.steps[run.index] ?? null;
}

export function gestureWantsCamera(actor: Actor): boolean {
  const run = actor.gesture;
  if (!run) {
    return false;
  }
  return gestures[run.id]?.faceCamera === true;
}

export function gestureOwns(actor: Actor, key: keyof Pose): boolean {
  const step = currentGestureStep(actor);
  return step != null && step.pose[key] !== undefined;
}

export function startGesture(actor: Actor, id: string, reduced: boolean): boolean {
  const gesture = gestures[id];
  if (!gesture) {
    return false;
  }
  const run: GestureRun = { id, index: 0, elapsed: 0 };
  actor.gesture = run;
  if (id === 'startle') {
    jump(actor, { fast: true, reduced });
  }
  return true;
}

// Copies the active step onto the pose targets, then advances. Returns that step's rates.
export function applyGesture(actor: Actor, dt: number, targets: Pose): Partial<Record<keyof Pose, number>> | undefined {
  const run = actor.gesture;
  if (!run) {
    return undefined;
  }
  const gesture = gestures[run.id];
  const step = gesture?.steps[run.index];
  if (!gesture || !step) {
    actor.gesture = null;
    return undefined;
  }
  (Object.keys(step.pose) as (keyof Pose)[]).forEach((key) => {
    const value = step.pose[key];
    if (value != null) {
      targets[key] = value;
    }
  });
  run.elapsed += dt;
  if (run.elapsed >= step.ms / 1000) {
    run.index += 1;
    run.elapsed = 0;
    if (run.index >= gesture.steps.length) {
      actor.gesture = null;
    }
  }
  return step.rate;
}
