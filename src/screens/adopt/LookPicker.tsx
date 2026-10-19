import { Pressable, StyleSheet, Text, View } from 'react-native';

import { coatStylesFor, eyeColorsFor, isCoatStyle, lookWithCoat } from '../../actor';
import type { Breed, CoatStyle } from '../../actor';
import type { Look } from '../../sim';

type Props = {
  breed: Breed;
  look: Look;
  onChange: (look: Look) => void;
};

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
      {style.pattern === 'bicolor' ? <View style={[styles.half, { backgroundColor: '#f7f4ee' }]} /> : null}
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

// Coat style (colors, plus the pattern variants the breed allows) and, for unlocked breeds, eye color.
// Ears and tail come from breed data, so they are not offered.
export function LookPicker({ breed, look, onChange }: Props) {
  const styleList = coatStylesFor(breed);
  const active = styleList.find((style) => isCoatStyle(look, style));
  const eyes = eyeColorsFor(breed);
  const eyeNow = look.eyeColor ?? breed.eyeColor;
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
      {eyes.length > 0 ? (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Eyes</Text>
          <View style={styles.row}>
            {eyes.map((option) => (
              <Pressable
                key={option.id}
                style={[styles.swatch, { backgroundColor: option.color }, eyeNow === option.color && styles.swatchOn]}
                onPress={() => onChange({ ...look, eyeColor: option.color })}
                accessibilityRole="button"
                accessibilityLabel={`Eyes ${option.label}`}
                accessibilityState={{ selected: eyeNow === option.color }}
              />
            ))}
          </View>
        </View>
      ) : null}
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
