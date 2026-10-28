import { createAudioPlayer } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

import { syncRemoteMusic } from './remoteMusic';
import { configurePlayback } from './session';

type Track = number | string;

// Metro needs static requires. These stay in the binary. The rest download into `downloaded`.
const bundled: Track[] = [
  require('../../assets/background music/bransboynd-night-summer-lounge-473222.mp3'),
  require('../../assets/background music/grumpynora-lay-back-619255.mp3'),
  require('../../assets/background music/kontraa-water-afro-pop-music-445661.mp3'),
  require('../../assets/background music/mfcc-background-music-274290.mp3'),
  require('../../assets/background music/penguinmusic-lazy-day-stylish-futuristic-chill-239287.mp3'),
  require('../../assets/background music/sonican-lo-fi-music-loop-sentimental-jazzy-love-473154.mp3'),
  require('../../assets/background music/penguinmusic-better-day-186374.mp3'),
  require('../../assets/background music/jonasblakewood-background-music-618629.mp3'),
  require('../../assets/background music/kiravale-happy-music-593649.mp3'),
  require('../../assets/background music/nastelbom-happy-happy-music-481659.mp3'),
  require('../../assets/background music/nastelbom-happy-happy-piano-513420.mp3'),
  require('../../assets/background music/paulyudin-happy-happy-music-513014.mp3'),
];

const downloaded: string[] = [];

function playlist(): Track[] {
  return downloaded.length === 0 ? bundled : bundled.concat(downloaded);
}

export function addDownloadedTrack(uri: string): void {
  if (!downloaded.includes(uri)) {
    downloaded.push(uri);
  }
}

// Fills the playlist from disk, then downloads anything still missing.
export function prepareRemoteMusic(): void {
  syncRemoteMusic(addDownloadedTrack);
}

const volume = 0.075;

let player: AudioPlayer | null = null;
let subscription: { remove(): void } | null = null;
let last = -1;
let wanted = false;
let suspended = false;
let held = false;

export function isMusicEnabled(): boolean {
  return wanted;
}

// A random index in 0..count-1 that is never `prev`: draw from the other count-1 slots, then skip over prev.
export function pickNext(count: number, prev: number, rand: () => number = Math.random): number {
  if (count <= 1) {
    return 0;
  }
  let index = Math.floor(rand() * (count - 1));
  if (index >= prev) {
    index += 1;
  }
  return Math.min(index, count - 1);
}

function dispose(): void {
  subscription?.remove();
  subscription = null;
  player?.release();
  player = null;
}

function playNext(): void {
  if (!wanted) {
    return;
  }
  try {
    dispose();
    const list = playlist();
    last = pickNext(list.length, last);
    const next = createAudioPlayer(list[last], { keepAudioSessionActive: true });
    next.volume = volume;
    subscription = next.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) {
        playNext();
      }
    });
    player = next;
    if (!suspended && !held) {
      next.play();
    }
  } catch {
    // stay silent
  }
}

// Skips to a different track. Does nothing while music is off.
export function switchMusic(): void {
  if (!wanted) {
    return;
  }
  playNext();
}

export function setMusicEnabled(on: boolean): void {
  wanted = on;
  try {
    if (!on) {
      player?.pause();
      return;
    }
    if (player) {
      if (!suspended && !held) {
        player.play();
      }
      return;
    }
    configurePlayback();
    playNext();
  } catch {
    // stay silent
  }
}

// Pauses while the app is in the background and resumes on return if music is still wanted.
export function suspendMusic(off: boolean): void {
  suspended = off;
  try {
    if (off || held) {
      player?.pause();
    } else if (wanted) {
      player?.play();
    }
  } catch {
    // stay silent
  }
}

// Keeps scene music quiet while an arcade round owns the speakers.
export function holdMusic(on: boolean): void {
  held = on;
  try {
    if (on || suspended) {
      player?.pause();
      return;
    }
    if (wanted) {
      player?.play();
    }
  } catch {
    // stay silent
  }
}

export function releaseMusic(): void {
  wanted = false;
  held = false;
  dispose();
}
