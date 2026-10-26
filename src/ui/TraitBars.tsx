import { StyleSheet, Text, View } from 'react-native';

import { archetypeNames, archetypeStyleNames, attributeScore, currentStyle, styleBasis, traits } from '../sim';
import type { PetState, Trait } from '../sim/types';
import { candyInk, tints, type Tint } from './candy';
import { fontFamily } from './font';
import { formatScore } from './GainBar';
import { theme } from './theme';

const traitLabel: Record<Trait, string> = {
  stamina: 'Stamina',
  agility: 'Agility',
  intelligence: 'Intelligence',
  boldness: 'Boldness',
  affection: 'Affection',
  obedience: 'Obedience',
};

const traitTint: Record<Trait, Tint> = {
  stamina: tints.peach,
  agility: tints.aqua,
  intelligence: tints.lilac,
  boldness: tints.coral,
  affection: tints.pink,
  obedience: tints.sky,
};

const trackMax = 100;

function percent(value: number): `${number}%` {
  return `${Math.max(0, Math.min(100, (value / trackMax) * 100))}%`;
}

export function TraitBars({ pet }: { pet: PetState }) {
  const origin = pet.attributes.archetype;
  const style = currentStyle(origin, styleBasis(pet), pet.attributes.potential);
  const styleLine =
    style === origin
      ? archetypeNames[origin]
      : `Born: ${archetypeNames[origin]} · Style: ${archetypeStyleNames[style]}`;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Traits</Text>
      <Text style={styles.meta}>{styleLine}</Text>
      {traits.map((trait) => {
        const current = attributeScore(pet, trait);
        const potential = pet.attributes.potential[trait];
        const tint = traitTint[trait];
        const ink = candyInk(tint);
        return (
          <View
            key={trait}
            style={styles.row}
            accessibilityLabel={`${traitLabel[trait]} ${formatScore(current)} of ${potential}`}
          >
            <Text style={[styles.label, { color: ink }]}>{traitLabel[trait]}</Text>
            <View style={[styles.track, { backgroundColor: tint.top, borderColor: tint.lip }]}>
              <View style={[styles.fill, { width: percent(potential), backgroundColor: tint.base }]} />
              <View style={[styles.fill, styles.current, { width: percent(current), backgroundColor: tint.icon }]}>
                <View style={styles.gloss} />
              </View>
            </View>
            <Text style={styles.score}>
              <Text style={[styles.scoreNow, { color: ink }]}>{formatScore(current)}</Text>
              <Text style={styles.scoreCap}> / {potential}</Text>
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: tints.lilac.lip,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 10,
  },
  title: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 18,
    color: theme.ink,
    textAlign: 'center',
  },
  meta: {
    fontFamily: fontFamily.extraBold,
    fontSize: 14,
    lineHeight: 18,
    color: theme.muted,
    textAlign: 'center',
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    width: 104,
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 14,
  },
  track: {
    flex: 1,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  current: {
    overflow: 'hidden',
  },
  gloss: {
    position: 'absolute',
    left: 2,
    right: 2,
    top: 2,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  score: {
    width: 72,
    textAlign: 'right',
  },
  scoreNow: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 13,
  },
  scoreCap: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 13,
    color: theme.muted,
  },
});
