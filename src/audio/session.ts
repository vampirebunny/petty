import { setAudioModeAsync } from 'expo-audio';

let pending: Promise<void> | null = null;
let configured = false;

function apply(): Promise<void> {
  return setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
}

// One session for music, voice, and bloops. Concurrent callers share the in-flight
// call. iOS rejects with OSStatus 1836282486 ('msrv', media services reset) when the
// audio server restarts during a reload; retry once, then stay silent.
export function configurePlayback(): void {
  if (configured || pending) {
    return;
  }
  pending = apply()
    .catch(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, 300);
        }).then(apply),
    )
    .then(() => {
      configured = true;
    })
    .catch(() => undefined)
    .finally(() => {
      pending = null;
    });
}
