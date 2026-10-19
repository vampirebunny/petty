import AsyncStorage from '@react-native-async-storage/async-storage';

const seenKey = 'petty.cuddle.coachSeen';
const sessionsKey = 'petty.cuddle.sessions';

// The ghost finger shows for the first few Cuddle sessions only.
export const ghostSessions = 3;
// How long a settled pet goes untouched before the ghost finger shows once.
export const ghostDelayMs = 3000;

export function coachSteps(name: string): string[] {
  return [
    `Stroke ${name}'s back or head with your finger.`,
    'Tap the nose for a boop!',
    `Keep going and ${name} might roll over for a belly rub.`,
  ];
}

export const coachClosing = "Tap Cuddle again when you're done.";

export const cuddleHint = 'Cuddle mode · stroke, scratch, or boop';

export const helpTitle = 'How to cuddle';

export const helpItems: { title: string; text: string }[] = [
  { title: 'Stroke', text: 'Slowly drag along the back or head. Gentle and steady works best.' },
  { title: 'Scratch', text: 'Small back-and-forth on the head or behind the ears.' },
  { title: 'Boop', text: 'Tap the nose.' },
  {
    title: 'Belly rub',
    text: 'Keep petting and your pet may roll over. Then stroke the belly. If a cat doesn\'t roll over, that\'s expected.',
  },
  {
    title: 'Every pet is different',
    text: 'Some love long cuddles, others want a quick one. Cuddling often helps build affection.',
  },
  { title: 'Done?', text: 'Tap Cuddle again to go back to play.' },
];

export async function loadCoachSeen(): Promise<boolean> {
  return (await AsyncStorage.getItem(seenKey)) === 'yes';
}

export async function saveCoachSeen(): Promise<void> {
  await AsyncStorage.setItem(seenKey, 'yes');
}

export async function loadCuddleSessions(): Promise<number> {
  const raw = await AsyncStorage.getItem(sessionsKey);
  const value = raw == null ? 0 : Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

// Counts a new Cuddle session and returns its number, starting at 1.
export async function startCuddleSession(): Promise<number> {
  const next = (await loadCuddleSessions()) + 1;
  await AsyncStorage.setItem(sessionsKey, String(next));
  return next;
}

export function ghostEligible(sessionNumber: number): boolean {
  return sessionNumber >= 1 && sessionNumber <= ghostSessions;
}
