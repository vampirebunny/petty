import type { CoverIcon, CoverKind, CoverMaterial, StampKind, StampMotif } from '../ui/awards';

const STAMP_KINDS: StampKind[] = ['debut', 'encore', 'party', 'rack', 'star'];
const MOTIFS: StampMotif[] = [
  'space',
  'sea',
  'royal',
  'beach',
  'winter',
  'rock',
  'garden',
  'spooky',
  'west',
  'hero',
  'pirate',
  'safari',
];
const MATERIALS: CoverMaterial[] = ['bronze', 'silver', 'gold', 'platinum'];
const FRIEND_ICONS: CoverIcon[] = ['host', 'crew', 'front'];

export function stampArt(definitionId: string): { kind: StampKind; motif: StampMotif } | null {
  if (!definitionId.startsWith('stamp_')) {
    return null;
  }
  const rest = definitionId.slice('stamp_'.length);
  const cut = rest.lastIndexOf('_');
  if (cut <= 0) {
    return null;
  }
  const motif = rest.slice(0, cut);
  const kind = rest.slice(cut + 1);
  if (!MOTIFS.includes(motif as StampMotif) || !STAMP_KINDS.includes(kind as StampKind)) {
    return null;
  }
  return { motif: motif as StampMotif, kind: kind as StampKind };
}

export function coverArt(
  definitionId: string,
): { kind: CoverKind; icon?: CoverIcon; material: CoverMaterial; level: 1 | 2 | 3 | 4 } | null {
  if (definitionId.startsWith('cover_')) {
    const material = definitionId.slice('cover_'.length);
    if (!MATERIALS.includes(material as CoverMaterial)) {
      return null;
    }
    const level = (MATERIALS.indexOf(material as CoverMaterial) + 1) as 1 | 2 | 3 | 4;
    return { kind: 'ladder', material: material as CoverMaterial, level };
  }
  if (definitionId.startsWith('friend_')) {
    const parts = definitionId.split('_');
    const icon = parts[1];
    const material = parts[2];
    if (!FRIEND_ICONS.includes(icon as CoverIcon) || !MATERIALS.includes(material as CoverMaterial)) {
      return null;
    }
    const level = Math.min(3, MATERIALS.indexOf(material as CoverMaterial) + 1) as 1 | 2 | 3 | 4;
    return { kind: 'friend', icon: icon as CoverIcon, material: material as CoverMaterial, level };
  }
  return null;
}

export function isSashAward(definitionId: string): boolean {
  return definitionId === 'crowd_favorite';
}
