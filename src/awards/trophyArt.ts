import type { AwardEvent, TrophyMaterial, TrophyShape } from '../ui/awards';

const MATERIALS: TrophyMaterial[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'veteran', 'seasonal'];

export function awardEventOf(event: string): AwardEvent {
  if (event === 'funRun' || event === 'run') return 'run';
  if (event === 'meters800' || event === 'meters') return 'meters';
  if (event === 'hurdles' || event === 'hurdle') return 'hurdle';
  if (event === 'dockDive' || event === 'dock') return 'dock';
  if (event === 'sniffOut' || event === 'sniff') return 'sniff';
  if (event === 'trickShow' || event === 'trick') return 'trick';
  if (event === 'weave' || event === 'obstacle') return event;
  return 'none';
}

function materialOf(value: string | undefined): TrophyMaterial {
  return MATERIALS.includes(value as TrophyMaterial) ? (value as TrophyMaterial) : 'gold';
}

export function trophyArt(definitionId: string): { shape: TrophyShape; material: TrophyMaterial; event: AwardEvent } {
  if (definitionId.startsWith('feat_')) {
    return { shape: 'star', material: 'gold', event: 'none' };
  }
  if (definitionId === 'range_grand_champion') {
    return { shape: 'grand', material: 'gold', event: 'none' };
  }
  if (definitionId.startsWith('range_all_rounder_')) {
    return { shape: 'handles', material: 'gold', event: 'none' };
  }
  if (definitionId.startsWith('veteran_')) {
    return { shape: 'big', material: 'veteran', event: 'none' };
  }
  if (definitionId.startsWith('lifetime_') || definitionId.startsWith('lookbook_')) {
    const tier = definitionId.split('_').at(-1);
    return { shape: 'big', material: materialOf(tier), event: 'none' };
  }
  if (definitionId.startsWith('career_') || definitionId.startsWith('class_')) {
    const [, event, rest] = definitionId.split('_');
    return {
      shape: definitionId.startsWith('class_') ? 'plinth' : 'cup',
      material: materialOf(rest),
      event: awardEventOf(event ?? ''),
    };
  }
  return { shape: 'cup', material: 'gold', event: 'none' };
}
