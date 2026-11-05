import { setAudioModeAsync } from 'expo-audio';

let pending: Promise<void> | null = null;
let rerun = false;
let videoRestore: ReturnType<typeof setTimeout> | null = null;

// expo-video writes the shared session on a background queue after play, pause,
// mute, and view setup. That write is usually under 70ms. Wait past it.
const videoSessionDelay = 200;

function apply(): Promise<void> {
  return setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
}

function applyWithRetry(): Promise<void> {
  return apply().catch(
    () =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, 300);
      }).then(apply),
  );
}

// Ambient session so the hardware silent switch mutes playback. Not one-shot:
// a muted lobby video sets the shared iOS session to .playback, which ignores
// the switch, and a later call has to put ambient back. Concurrent callers
// share the in-flight call, and a call that arrives during it runs once more
// when that call finishes. iOS rejects with OSStatus 1836282486 ('msrv', media
// services reset) when the audio server restarts during a reload; retry once,
// then stay silent.
export function configurePlayback(): Promise<void> {
  if (pending) {
    rerun = true;
    return pending;
  }
  const run = applyWithRetry()
    .catch(() => undefined)
    .finally(() => {
      pending = null;
      if (rerun) {
        rerun = false;
        void configurePlayback();
      }
    });
  pending = run;
  return run;
}

// Call after a lobby video plays, pauses, or unmounts. The video session write
// is async, so this waits and then puts the silent switch back.
export function restoreAfterVideoSession(): void {
  if (videoRestore) {
    clearTimeout(videoRestore);
  }
  videoRestore = setTimeout(() => {
    videoRestore = null;
    void configurePlayback();
  }, videoSessionDelay);
}
