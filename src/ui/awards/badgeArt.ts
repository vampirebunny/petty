import type { BadgeColor, BadgeIcon, BadgeTier } from './Badge';

export type BadgeArt = {
  icon: BadgeIcon;
  color: BadgeColor;
  tier: BadgeTier;
};

const once = (icon: BadgeIcon, color: BadgeColor): BadgeArt => ({ icon, color, tier: 'none' });

const series: Record<string, { icon: BadgeIcon; color: BadgeColor }> = {
  'ribbon-rack': { icon: 'podium', color: 'yellow' },
  'best-friend-streak': { icon: 'flame', color: 'orange' },
  devoted: { icon: 'heart', color: 'pink' },
  'trick-collector': { icon: 'stars', color: 'purple' },
  finder: { icon: 'acorn', color: 'green' },
};

const ONCE: Record<string, BadgeArt> = {
  'welcome-home': once('home', 'pink'),
  'came-back': once('calendar', 'blue'),
  'good-listener': once('trick', 'purple'),
  'prop-pro': once('prop', 'green'),
  'treasure-hunter': once('chest', 'orange'),
  'dressed-up': once('outfit', 'pink'),
  playmate: once('paws', 'yellow'),
  'off-to-the-races': once('flag', 'blue'),
  'first-win': once('first', 'purple'),
  'moving-up': once('up', 'green'),
};

export function badgeArt(id: string): BadgeArt | null {
  const onceArt = ONCE[id === 'blue-ribbon' ? 'first-win' : id];
  if (onceArt) {
    return onceArt;
  }
  const match = /^(.*)-(bronze|silver|gold)$/.exec(id);
  if (!match) {
    return null;
  }
  const spec = series[match[1]];
  if (!spec) {
    return null;
  }
  return { icon: spec.icon, color: spec.color, tier: match[2] as BadgeTier };
}
