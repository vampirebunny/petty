import { Badge } from '../awards/Badge';
import { badgeArt } from '../awards/badgeArt';

type Props = {
  id: string;
  size?: number;
};

export function BadgeMedal({ id, size = 56 }: Props) {
  const art = badgeArt(id);
  if (!art) {
    return null;
  }
  return <Badge icon={art.icon} color={art.color} tier={art.tier} size={size} />;
}
