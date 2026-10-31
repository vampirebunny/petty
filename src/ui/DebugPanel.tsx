import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { phaseOf } from '../actor';
import { setDecorOverride, setWeatherOverride } from '../actor/sky';
import { catalog } from '../economy/catalog';
import { applyCatalogNow } from '../economy/shopState';
import { DefPreview } from '../dev/DefPreview';
import { NpcCalibrationDebug } from './stadium/NpcCalibrationDebug';
import { stageOf } from '../sim';
import { visualLifespanDays } from '../sim/config';
import type { Mood, PetState } from '../sim/types';
import type { PetCue } from '../state/usePet';

type Props = {
  state: PetState;
  mood: Mood;
  cue: PetCue;
  onAdvance: (elapsedMs: number) => void;
  onAge: (ageDays: number) => void;
  onVitality: (vitality: number) => void;
  onWeight: (weight: number) => void;
  hour: number | null;
  onHour: (hour: number | null) => void;
  onReset: () => void;
  onNewPet: () => void;
  onClothing?: () => void;
  onColorways?: () => void;
  onGrant?: (id: string) => void;
  onGrantBoops?: () => void;
  onParkFindForce?: (variant: 'dig' | 'grass' | 'bush') => void;
  onParkFindResetCollection?: () => void;
  onParkFindResetChest?: () => void;
};

const hourMs = 60 * 60 * 1000;

// Test controls for the sky. Live follows the device clock; the others pin the hour.
const phaseButtons: [string, number | null][] = [
  ['Live', null],
  ['Dawn', 6.25],
  ['Morning', 9.5],
  ['Afternoon', 14],
  ['Dusk', 18],
  ['Evening', 19.75],
  ['Night', 23],
];

function liveHour(): number {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
}

function formatHour(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.floor((hour - h) * 60);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 && h < 24 ? 'pm' : 'am'}`;
}

function format(value: number): string {
  return value.toFixed(1);
}

export function RangeControl({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(1);
  const change = (next: number) => onChange(Math.min(max, Math.max(min, next)));
  const pan = Gesture.Pan().onUpdate((event) => {
    const ratio = Math.min(1, Math.max(0, event.x / trackWidth));
    runOnJS(change)(min + (max - min) * ratio);
  });
  const span = max - min;
  const fill = span === 0 ? 0 : ((value - min) / span) * 100;

  return (
    <View style={styles.range}>
      <Text style={styles.line}>{label}</Text>
      <GestureDetector gesture={pan}>
        <View
          style={styles.track}
          onLayout={(event) => {
            setTrackWidth(event.nativeEvent.layout.width);
          }}
        >
          <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, fill))}%` }]} />
        </View>
      </GestureDetector>
    </View>
  );
}

/** Development builds and Expo Go. Release builds leave this off. */
export function DebugPanel(props: Props) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return null;
  }
  return <DebugPanelBody {...props} />;
}

function DebugPanelBody({
  state,
  mood,
  cue,
  onAdvance,
  onAge,
  onVitality,
  onWeight,
  hour,
  onHour,
  onReset,
  onNewPet,
  onClothing,
  onColorways,
  onGrant,
  onGrantBoops,
  onParkFindForce,
  onParkFindResetCollection,
  onParkFindResetChest,
}: Props) {
  const [open, setOpen] = useState(false);
  const care = state.careWindow[state.careWindow.length - 1];

  return (
    <View style={styles.panel}>
      <Pressable onPress={() => setOpen((current) => !current)}>
        <Text style={styles.toggle}>{open ? 'Hide settings' : 'Settings'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.body}>
      {onGrantBoops ? (
        <Pressable style={styles.button} onPress={onGrantBoops}>
          <Text style={styles.buttonLabel}>+10000 boops</Text>
        </Pressable>
      ) : null}
      <Text style={styles.line}>Hunger {format(state.needs.hunger)}</Text>
      <Text style={styles.line}>Energy {format(state.needs.energy)}</Text>
      <Text style={styles.line}>Happiness {format(state.needs.happiness)}</Text>
      <Text style={styles.line}>Hydration {format(state.hydration)}</Text>
      <Text style={styles.line}>Asleep {state.asleep ? 'yes' : 'no'}</Text>
      <Text style={styles.line}>Mood {mood}</Text>
      <Text style={styles.line}>Cue {cue.kind}</Text>
      <View style={styles.actions}>
        {typeof __DEV__ !== 'undefined' && __DEV__ && onClothing ? (
          <Pressable style={styles.button} onPress={onClothing}>
            <Text style={styles.buttonLabel}>Clothing</Text>
          </Pressable>
        ) : null}
        {typeof __DEV__ !== 'undefined' && __DEV__ && onColorways ? (
          <Pressable style={styles.button} onPress={onColorways}>
            <Text style={styles.buttonLabel}>Colorways</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.line}>Stage {stageOf(state.ageDays)}</Text>
      <Text style={styles.line}>Senior band {state.seniorBand ?? 'none'}</Text>
      <Text style={styles.line}>Age days {format(state.ageDays)}</Text>
      <Text style={styles.line}>Maturity {state.maturity.toFixed(3)}</Text>
      <Text style={styles.line}>Vitality {state.vitality.toFixed(3)}</Text>
      <Text style={styles.line}>Weight {format(state.weight)}</Text>
      <Text style={styles.line}>
        Care {care ? `${care.dietQuality.toFixed(2)} diet, ${care.attention.toFixed(2)} attention` : 'none'}
      </Text>
      <Text style={styles.line}>
        Level {state.level} · xp {Math.floor(state.xpIntoLevel)} / {state.xpTotal}
      </Text>
      <RangeControl
        label="Age"
        min={0}
        max={visualLifespanDays}
        value={Math.min(visualLifespanDays, state.ageDays)}
        onChange={onAge}
      />
      <RangeControl label="Vitality" min={0} max={1} value={state.vitality} onChange={onVitality} />
      <RangeControl label="Weight" min={-1} max={1} value={state.weight} onChange={onWeight} />
      <RangeControl
        label={`Time of day: ${phaseOf(hour ?? liveHour())}, ${formatHour(hour ?? liveHour())}${hour == null ? ' (live)' : ''}`}
        min={0}
        max={24}
        value={hour ?? liveHour()}
        onChange={onHour}
      />
      <View style={styles.actions}>
        {phaseButtons.map(([label, value]) => {
          const selected = value == null ? hour == null : hour != null && phaseOf(hour) === label;
          return (
            <Pressable
              key={label}
              style={[styles.button, selected && styles.selected]}
              onPress={() => onHour(value)}
            >
              <Text style={[styles.buttonLabel, selected && styles.selectedLabel]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
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
        {typeof __DEV__ !== 'undefined' && __DEV__ ? (
          <Pressable style={styles.button} onPress={onReset}>
            <Text style={styles.buttonLabel}>Reset</Text>
          </Pressable>
        ) : null}
        {typeof __DEV__ !== 'undefined' && __DEV__ ? (
          <Pressable style={styles.button} onPress={() => applyCatalogNow()}>
            <Text style={styles.buttonLabel}>Apply catalog now</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.button} onPress={onNewPet}>
          <Text style={styles.buttonLabel}>Retire</Text>
        </Pressable>
      </View>
      {onParkFindForce ? (
        <View style={styles.actions}>
          <Pressable style={styles.button} onPress={() => onParkFindForce('dig')}>
            <Text style={styles.buttonLabel}>Find dig</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => onParkFindForce('grass')}>
            <Text style={styles.buttonLabel}>Find grass</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => onParkFindForce('bush')}>
            <Text style={styles.buttonLabel}>Find bush</Text>
          </Pressable>
          {onParkFindResetCollection ? (
            <Pressable style={styles.button} onPress={onParkFindResetCollection}>
              <Text style={styles.buttonLabel}>Reset finds</Text>
            </Pressable>
          ) : null}
          {onParkFindResetChest ? (
            <Pressable style={styles.button} onPress={onParkFindResetChest}>
              <Text style={styles.buttonLabel}>Reset chest intro</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.button}
            onPress={() => setWeatherOverride({ precip: 'rain', intensity: 0.8 })}
          >
            <Text style={styles.buttonLabel}>Rain</Text>
          </Pressable>
          <Pressable
            style={styles.button}
            onPress={() => setWeatherOverride({ precip: 'snow', intensity: 0.8 })}
          >
            <Text style={styles.buttonLabel}>Snow</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => setWeatherOverride({ rainbow: 1 })}>
            <Text style={styles.buttonLabel}>Rainbow</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => setWeatherOverride(null)}>
            <Text style={styles.buttonLabel}>Clear weather</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => setDecorOverride(['halloween'])}>
            <Text style={styles.buttonLabel}>Halloween decor</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => setDecorOverride(null)}>
            <Text style={styles.buttonLabel}>Clear decor</Text>
          </Pressable>
        </View>
      ) : null}
        {typeof __DEV__ !== 'undefined' && __DEV__ ? <DefPreview /> : null}
        {typeof __DEV__ !== 'undefined' && __DEV__ ? <NpcCalibrationDebug /> : null}
        {typeof __DEV__ !== 'undefined' && __DEV__ && onGrant ? (
        <View style={styles.actions}>
          {catalog.map((item) => (
            <Pressable key={item.id} style={styles.button} onPress={() => onGrant(item.id)}>
              <Text style={styles.buttonLabel}>{item.id}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
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
    gap: 4,
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
  range: {
    gap: 4,
    marginTop: 6,
  },
  track: {
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E4E8EF',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#7CB8E8',
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
  selected: {
    backgroundColor: '#2f7d5b',
  },
  selectedLabel: {
    color: '#fff',
  },
});
