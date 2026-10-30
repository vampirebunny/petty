import type { ClipRecord } from './types';

type Listener = () => void;

const listeners = new Set<Listener>();

let pending: ClipRecord | null = null;
let overlayShown = false;
let reported = false;
let bursts = false;
let badges = false;
let greetHold = false;
let greetActive = false;
let stageMounted = false;
let slotSkip = false;
let launchSkip = false;
let raceCall = false;
let welcomeHomeSkip = false;
let welcomeHomeConsumed = false;

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function onPetCam(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function queueCam(record: ClipRecord): void {
  pending = record;
  overlayShown = false;
  reported = false;
  emit();
}

export function pendingCam(): ClipRecord | null {
  return pending;
}

/** The overlay is allowed once Home has reported bursts, badges, and the greeting. */
export function camReady(): boolean {
  if (!pending || overlayShown) {
    return false;
  }
  if (!reported || bursts || badges) {
    return false;
  }
  if (stageMounted && (greetHold || greetActive)) {
    return false;
  }
  return true;
}

export function markOverlayShown(): void {
  overlayShown = true;
  welcomeHomeSkip = false;
  welcomeHomeConsumed = true;
  emit();
}

export function overlayIsShown(): boolean {
  return overlayShown && pending != null;
}

export function dismissCam(): void {
  pending = null;
  overlayShown = false;
  reported = false;
  welcomeHomeSkip = false;
  emit();
}

/** Background before the card appears. The first-show guarantee stays until the card is seen. */
export function dropPendingCam(): void {
  if (overlayShown) {
    return;
  }
  if (!pending) {
    return;
  }
  pending = null;
  reported = false;
  welcomeHomeSkip = false;
  emit();
}

export function reportPresentation(next: { bursts: boolean; badges: boolean }): void {
  const changed = !reported || bursts !== next.bursts || badges !== next.badges;
  bursts = next.bursts;
  badges = next.badges;
  reported = true;
  if (changed) {
    emit();
  }
}

export function expectGreet(): void {
  greetHold = true;
  emit();
}

export function setGreetActive(active: boolean): void {
  greetActive = active;
  if (!active) {
    greetHold = false;
  }
  emit();
}

export function setStageMounted(mounted: boolean): void {
  stageMounted = mounted;
  emit();
}

export function noteSlotSkip(): void {
  slotSkip = true;
}

export function clearReturnSkips(): void {
  slotSkip = false;
  launchSkip = false;
}

export function noteLaunchSkip(): void {
  launchSkip = true;
  dropPendingCam();
}

export function returnBlocked(): boolean {
  return slotSkip || launchSkip;
}

export function armWelcomeHomeSkip(): void {
  welcomeHomeSkip = true;
  welcomeHomeConsumed = false;
}

/** Welcome Home stays out of the toast queue until this showing is dropped or seen. */
export function welcomeHomeHeld(): boolean {
  return welcomeHomeSkip;
}

/** The card was actually shown, so the Welcome Home toast stays skipped. */
export function welcomeHomeWasReplaced(): boolean {
  return welcomeHomeConsumed;
}

export function setRaceCallOpen(open: boolean): void {
  if (raceCall === open) {
    return;
  }
  raceCall = open;
  if (open && pending) {
    dismissCam();
  }
}
