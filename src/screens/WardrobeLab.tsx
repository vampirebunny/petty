import { useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import { catBreeds, dogBreeds } from '../actor';
import { outfitSlots, wardrobe } from '../actor/wardrobe';
import { visualLifespanDays } from '../sim/config';
import type { Equipped, Look, OutfitSlot } from '../sim/types';
import { OutfitPreview, useOutfitClock, type OutfitPose } from '../ui/OutfitPreview';
import { RangeControl } from '../ui/DebugPanel';
import { minTouch, theme } from '../ui/theme';
import { PoseChips } from '../ui/WardrobePicker';

type Species = 'dog' | 'cat';

const ages = [
  { label: 'Puppy', days: 0.5 },
  { label: 'Adult', days: 16 },
];

type Props = {
  look: Look;
  reducedMotion: boolean;
  onClose: () => void;
};

export function WardrobeLab({ look, reducedMotion, onClose }: Props) {
  const dogs = dogBreeds();
  const cats = catBreeds();
  const [species, setSpecies] = useState<Species>('dog');
  const breeds = species === 'cat' ? cats : dogs;
  const [breedId, setBreedId] = useState(dogs[0]?.id ?? 'retriever');
  const [ageDays, setAgeDays] = useState(16);
  const [equipped, setEquipped] = useState<Equipped>({});
  const [pose, setPose] = useState<OutfitPose>('sit');
  const t = useOutfitClock(reducedMotion);
  const { width } = useWindowDimensions();
  const previewWidth = Math.min(420, Math.max(260, width - 32));
  const breed = breeds.find((entry) => entry.id === breedId) ?? breeds[0];

  const chooseSpecies = (next: Species) => {
    setSpecies(next);
    const list = next === 'cat' ? cats : dogs;
    setBreedId(list[0]?.id ?? breedId);
  };

  const equip = (slot: OutfitSlot, itemId: string | null) => {
    setEquipped((current) => {
      const next = { ...current };
      if (!itemId) {
        delete next[slot];
      } else {
        next[slot] = itemId;
      }
      return next;
    });
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onClose} style={styles.back}>
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Wardrobe lab</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {breed ? (
          <OutfitPreview
            breedId={breed.id}
            ageDays={ageDays}
            weight={0}
            vitality={1}
            look={look}
            seed={1}
            equipped={equipped}
            width={previewWidth}
            height={230}
            t={t}
            pose={pose}
          />
        ) : null}
        <PoseChips pose={pose} onPose={setPose} />
        <View style={styles.row}>
          {ages.map((entry) => (
            <Pressable
              key={entry.label}
              accessibilityRole="button"
              accessibilityState={{ selected: ageDays === entry.days }}
              onPress={() => setAgeDays(entry.days)}
              style={[styles.button, ageDays === entry.days && styles.selected]}
            >
              <Text style={[styles.buttonLabel, ageDays === entry.days && styles.selectedLabel]}>{entry.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.row}>
          {(['dog', 'cat'] as const).map((entry) => (
            <Pressable
              key={entry}
              accessibilityRole="button"
              accessibilityState={{ selected: species === entry }}
              onPress={() => chooseSpecies(entry)}
              style={[styles.button, species === entry && styles.selected]}
            >
              <Text style={[styles.buttonLabel, species === entry && styles.selectedLabel]}>{entry}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.row}>
          {breeds.map((entry) => (
            <Pressable
              key={entry.id}
              accessibilityRole="button"
              accessibilityState={{ selected: entry.id === breed?.id }}
              onPress={() => setBreedId(entry.id)}
              style={[styles.button, entry.id === breed?.id && styles.selected]}
            >
              <Text style={[styles.buttonLabel, entry.id === breed?.id && styles.selectedLabel]}>{entry.name}</Text>
            </Pressable>
          ))}
        </View>
        <RangeControl label={`Age days ${ageDays.toFixed(0)}`} min={0} max={visualLifespanDays} value={ageDays} onChange={setAgeDays} />
        {outfitSlots.map((slot) => (
          <View key={slot} style={styles.section}>
            <Text style={styles.sectionLabel}>{wardrobe[slot].label}</Text>
            <View style={styles.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${wardrobe[slot].label} none`}
                accessibilityState={{ selected: !equipped[slot] }}
                onPress={() => equip(slot, null)}
                style={[styles.button, !equipped[slot] && styles.selected]}
              >
                <Text style={[styles.buttonLabel, !equipped[slot] && styles.selectedLabel]}>None</Text>
              </Pressable>
              {wardrobe[slot].items.map((item) => {
                const selected = equipped[slot] === item.id;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    accessibilityState={{ selected }}
                    onPress={() => equip(slot, item.id)}
                    style={[styles.button, selected && styles.selected]}
                  >
                    <Text style={[styles.buttonLabel, selected && styles.selectedLabel]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F4F7FB',
    paddingTop: 64,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
    minHeight: 52,
  },
  back: {
    minWidth: minTouch,
    minHeight: minTouch,
    justifyContent: 'center',
  },
  backLabel: {
    color: theme.accentDark,
    fontSize: 16,
  },
  title: {
    color: theme.ink,
    fontSize: 20,
    fontWeight: '700',
  },
  scroll: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  section: {
    gap: 6,
  },
  sectionLabel: {
    color: theme.ink,
    fontSize: 15,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    backgroundColor: theme.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: minTouch,
    justifyContent: 'center',
  },
  buttonLabel: {
    color: theme.ink,
    fontSize: 13,
  },
  selected: {
    backgroundColor: theme.accentDark,
  },
  selectedLabel: {
    color: '#fff',
  },
});
