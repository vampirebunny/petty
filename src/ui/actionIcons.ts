import {
  Armchair,
  CircleQuestionMark,
  Droplet,
  HandHeart,
  MessageCircle,
  Moon,
  Music,
  PawPrint,
  Shirt,
  Soup,
  Sparkles,
  Sun,
  Users,
  Volleyball,
  Volume2,
  VolumeX,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

export type ActionSpecies = 'dog' | 'cat';

// One map from action id to icon. A new action or toy adds an entry here and never touches layout code.
export const actionIcons: Record<string, LucideIcon> = {
  feed: Soup,
  refill: Droplet,
  play: Volleyball,
  playdate: Users,
  sit: Armchair,
  speak: MessageCircle,
  paw: PawPrint,
  rest: Moon,
  wake: Sun,
  cuddle: HandHeart,
  wardrobe: Shirt,
  sound: Volume2,
  soundOff: VolumeX,
  // lucide has no slashed music icon, so the off state shows through the button's inactive style.
  music: Music,
  musicOff: Music,
  personality: Sparkles,
  help: CircleQuestionMark,
};

// Species variants: same layout, a different icon or label where the toy differs. Both species play
// with a ball today, so the entries are empty. When the laser toy ships, a cat entry is
// `play: Target` here and `play: 'Laser'` below, and nothing else changes.
const speciesIcons: Record<ActionSpecies, Record<string, LucideIcon>> = {
  dog: {},
  cat: {},
};

const speciesLabels: Record<ActionSpecies, Record<string, string>> = {
  dog: {},
  cat: {},
};

export function iconFor(actionId: string, species: ActionSpecies = 'dog'): LucideIcon | null {
  return speciesIcons[species][actionId] ?? actionIcons[actionId] ?? null;
}

// The default label for an action on a species, or null when the caller's own label should stand.
export function speciesLabel(actionId: string, species: ActionSpecies): string | null {
  return speciesLabels[species][actionId] ?? null;
}
