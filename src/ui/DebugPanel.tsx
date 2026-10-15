import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Mood, PetState } from '../sim/types';
import type { PetCue } from '../state/usePet';

type Props = {
  state: PetState;
  mood: Mood;
  cue: PetCue;
  onAdvance: (elapsedMs: number) => void;
  onReset: () => void;
};

const hourMs = 60 * 60 * 1000;

function format(value: number): string {
  return value.toFixed(1);
}

export function DebugPanel({ state, mood, cue, onAdvance, onReset }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.panel}>
      <Pressable onPress={() => setOpen((current) => !current)}>
        <Text style={styles.toggle}>{open ? 'Hide debug' : 'Debug'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.body}>
          <Text style={styles.line}>Fullness {format(state.needs.fullness)}</Text>
          <Text style={styles.line}>Energy {format(state.needs.energy)}</Text>
          <Text style={styles.line}>Happiness {format(state.needs.happiness)}</Text>
          <Text style={styles.line}>Asleep {state.asleep ? 'yes' : 'no'}</Text>
          <Text style={styles.line}>Mood {mood}</Text>
          <Text style={styles.line}>Cue {cue.kind}</Text>
          <View style={styles.actions}>
            <Pressable style={styles.button} onPress={() => onAdvance(hourMs)}>
              <Text style={styles.buttonLabel}>+1 hour</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={() => onAdvance(6 * hourMs)}>
              <Text style={styles.buttonLabel}>+6 hours</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={() => onAdvance(24 * hourMs)}>
              <Text style={styles.buttonLabel}>+24 hours</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={onReset}>
              <Text style={styles.buttonLabel}>Reset</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderTopWidth: 1,
    borderTopColor: '#E4E8EF',
    paddingTop: 8,
    gap: 8,
  },
  toggle: {
    color: '#5C6B80',
    fontSize: 14,
  },
  body: {
    gap: 4,
  },
  line: {
    fontSize: 13,
    color: '#243044',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  button: {
    backgroundColor: '#E4E8EF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 13,
    color: '#243044',
  },
});
