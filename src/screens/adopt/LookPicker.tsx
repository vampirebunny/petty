import { Pressable, StyleSheet, Text, View } from 'react-native';

import { coatStylesFor, earOptions, isCoatStyle, lookWithCoat, tailOptions } from '../../actor';
import type { Breed, CoatStyle, LookOption } from '../../actor';
import type { Look } from '../../sim';

type Props = {
  breed: Breed;
  look: Look;
  onChange: (look: Look) => void;
};

function OptionRow({
  title,
  options,
  value,
  onPick,
}: {
  title: string;
  options: readonly LookOption[];
  value: string;
  onPick: (id: string) => void;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.row}>
        {options.map((option) => (
          <Pressable
            key={option.id}
            style={[styles.chip, option.id === value && styles.chipOn]}
            onPress={() => onPick(option.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: option.id === value }}
          >
            <Text style={[styles.chipLabel, option.id === value && styles.chipLabelOn]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// A round preview of a coat: the base color, with the accent on one half for points and
// darker bands for stripes.
function Swatch({ style, on, onPress }: { style: CoatStyle; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.swatch, { backgroundColor: style.coat }, on && styles.swatchOn]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Coat ${style.label}`}
      accessibilityState={{ selected: on }}
    >
      {style.pattern === 'points' && style.accent ? (
        <View style={[styles.half, { backgroundColor: style.accent }]} />
      ) : null}
      {style.pattern === 'stripes' ? (
        <View style={styles.stripes}>
          <View style={styles.stripe} />
          <View style={styles.stripe} />
          <View style={styles.stripe} />
        </View>
      ) : null}
    </Pressable>
  );
}

// Coat style (solids, stripes, points), ears (dogs only, the reference cats have one ear shape), and tail.
export function LookPicker({ breed, look, onChange }: Props) {
  const styleList = coatStylesFor(breed);
  const active = styleList.find((style) => isCoatStyle(look, style));
  const ears = earOptions[breed.species];
  const tails = tailOptions[breed.species];
  return (
    <View style={styles.stack}>
      <View style={styles.group}>
        <Text style={styles.groupTitle}>Coat{active ? `: ${active.label}` : ''}</Text>
        <View style={styles.row}>
          {styleList.map((style) => (
            <Swatch
              key={style.id}
              style={style}
              on={active?.id === style.id}
              onPress={() => onChange(lookWithCoat(look, style))}
            />
          ))}
        </View>
      </View>
      {ears.length > 0 ? (
        <OptionRow title="Ears" options={ears} value={look.ear} onPick={(ear) => onChange({ ...look, ear })} />
      ) : null}
      <OptionRow title="Tail" options={tails} value={look.tail} onPick={(tail) => onChange({ ...look, tail })} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 16,
  },
  group: {
    gap: 8,
  },
  groupTitle: {
    fontSize: 13,
    color: '#5C6B80',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#D0D8E3',
    overflow: 'hidden',
  },
  swatchOn: {
    borderColor: '#243044',
    borderWidth: 4,
  },
  half: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '50%',
  },
  stripes: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  stripe: {
    width: 4,
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  chip: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  chipOn: {
    backgroundColor: '#243044',
  },
  chipLabel: {
    fontSize: 15,
    color: '#243044',
  },
  chipLabelOn: {
    color: '#fff',
  },
});
