import { useId, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import type { LucideIcon } from 'lucide-react-native';

import { iconFor } from './actionIcons';
import type { ActionSpecies } from './actionIcons';
import { CandyShell, Sparkle, candyInk, tints, GRAY } from './candy';
import type { TintName } from './candy';
import { iconSize, iconStroke, minTouch } from './theme';

export type PetAction = {
  id: string;
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  // Toggled on: the button looks pressed in, with a white ring and a glow.
  active?: boolean;
  // Set when the scene cannot offer this action. The button turns gray and tapping it explains why.
  reason?: string;
};

type Props = {
  actions: PetAction[];
  species?: ActionSpecies;
  onBlocked?: (reason: string) => void;
};

// Spread across flavors so neighboring buttons rarely share a color.
const tintFor: Record<string, TintName> = {
  sit: 'peach',
  paw: 'pistachio',
  speak: 'sky',
  cuddle: 'pink',
  rest: 'periwinkle',
  wake: 'butter',
  feed: 'coral',
  refill: 'aqua',
  play: 'mint',
  playdate: 'lilac',
  wardrobe: 'orchid',
  sound: 'sky',
  soundOff: 'sky',
  music: 'lilac',
  musicOff: 'lilac',
  personality: 'orchid',
  help: 'periwinkle',
  potty: 'butter',
  clean: 'peach',
  treat: 'coral',
  inventory: 'lilac',
  walk: 'pistachio',
  train: 'aqua',
};

const BUTTON_WIDTH = 88;
const GAP = 10;
const RADIUS = 28;
const GLYPH = iconSize + 4;

// A wrapping flex row centers the group, and a short last line stays pinned to the start.
// Measure the width, pack full lines, and center each line on its own.
function buttonsPerRow(width: number): number {
  if (width <= 0) return 1;
  return Math.max(1, Math.floor((width + GAP) / (BUTTON_WIDTH + GAP)));
}

function rowsOf<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

export function ActionButtons({ actions, species = 'dog', onBlocked }: Props) {
  const [width, setWidth] = useState(0);

  function onLayout(event: LayoutChangeEvent) {
    const next = Math.round(event.nativeEvent.layout.width);
    setWidth((current) => (current === next ? current : next));
  }

  const button = (action: PetAction) => (
    <ActionButton key={action.id} action={action} Icon={iconFor(action.id, species)} onBlocked={onBlocked} />
  );

  // Width is unknown on the first frame. Wrap so the buttons do not overflow in one line.
  if (width <= 0) {
    return (
      <View style={styles.pending} onLayout={onLayout}>
        {actions.map(button)}
      </View>
    );
  }

  return (
    <View style={styles.rows} onLayout={onLayout}>
      {rowsOf(actions, buttonsPerRow(width)).map((row) => (
        <View key={row.map((action) => action.id).join('|')} style={styles.row}>
          {row.map(button)}
        </View>
      ))}
    </View>
  );
}

type ButtonProps = {
  action: PetAction;
  Icon: LucideIcon | null;
  onBlocked?: (reason: string) => void;
};

function ActionButton({ action, Icon, onBlocked }: ButtonProps) {
  // SVG gradient ids are document-global on web, so each button needs its own.
  const uid = useId().replace(/:/g, '');
  const blocked = !!action.reason;
  const on = !!action.active && !blocked;
  const tint = blocked ? GRAY : tints[tintFor[action.id] ?? 'mint'];

  return (
    <Pressable
      style={({ pressed }: { pressed: boolean }) => [styles.hit, pressed && styles.hitPressed, blocked && styles.blocked]}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ disabled: blocked, selected: on }}
      onPress={() => (action.reason ? onBlocked?.(action.reason) : action.onPress())}
      onLongPress={action.onLongPress}
    >
      {({ pressed }: { pressed: boolean }) => (
        <CandyShell tint={tint} radius={RADIUS} selected={on} pressed={pressed} uid={uid} style={styles.face}>
          {Icon ? (
            <View style={styles.glyph}>
              <View style={styles.glyphShadow}>
                <Icon size={GLYPH} strokeWidth={iconStroke + 1} color="#FFFFFF" opacity={0.9} />
              </View>
              <Icon size={GLYPH} strokeWidth={iconStroke + 1} color={on ? tint.ink : tint.icon} />
            </View>
          ) : null}
          <Text style={[styles.label, { color: candyInk(tint) }]} numberOfLines={1}>
            {action.label}
          </Text>
          {!blocked ? (
            <>
              <Sparkle style={styles.sparkleBig} opacity={on ? 1 : 0.9} />
              <Sparkle style={styles.sparkleSmall} opacity={on ? 0.9 : 0.7} />
            </>
          ) : null}
        </CandyShell>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pending: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    rowGap: GAP,
    columnGap: GAP,
  },
  rows: {
    width: '100%',
    alignItems: 'center',
    rowGap: GAP,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    columnGap: GAP,
  },
  hit: {
    width: BUTTON_WIDTH,
  },
  hitPressed: {
    transform: [{ scale: 0.96 }],
  },
  blocked: {
    opacity: 0.75,
  },
  face: {
    minHeight: minTouch + 25,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  glyph: {
    width: GLYPH,
    height: GLYPH,
  },
  glyphShadow: {
    position: 'absolute',
    top: 2,
    left: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  sparkleBig: {
    position: 'absolute',
    top: 9,
    right: 12,
    width: 9,
    height: 9,
  },
  sparkleSmall: {
    position: 'absolute',
    top: 20,
    right: 8,
    width: 5,
    height: 5,
  },
});
