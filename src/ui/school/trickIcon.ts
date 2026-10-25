import {
  ArrowUp,
  Circle,
  Hand,
  Moon,
  Music,
  RefreshCw,
  Shuffle,
  Sparkles,
  ChevronsDown,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

const bySuffix: Record<string, LucideIcon> = {
  spin: RefreshCw,
  high_five: Hand,
  down: ChevronsDown,
  lie_down: ChevronsDown,
  bow: Sparkles,
  jump_up: ArrowUp,
  roll_over: RefreshCw,
  catch: Circle,
  fetch: Circle,
  stand_tall: ArrowUp,
  tunnel: Circle,
  hurdle: ArrowUp,
  hoop: Circle,
  play_dead: Moon,
  sing: Music,
  weave: Shuffle,
};

export function trickIcon(id: string): LucideIcon {
  const suffix = id.replace(/^(dog|cat)_/, '');
  return bySuffix[suffix] ?? Sparkles;
}
