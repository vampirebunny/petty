import { useId, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import type { LucideIcon } from 'lucide-react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { mixHexColor } from '../actor/color';
import { iconFor } from './actionIcons';
import type { ActionSpecies } from './actionIcons';
import { iconSize, iconStroke, minTouch } from './theme';

export type PetAction = {
  id: string;
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  // Toggled on: the button fills with its full tint.
  active?: boolean;
  // Set when the scene cannot offer this action. The button dims and tapping it explains why.
  reason?: string;
};

type Props = {
  actions: PetAction[];
  species?: ActionSpecies;
  onBlocked?: (reason: string) => void;
};

// Each action gets a candy tint: soft `bg` at rest, a darker `edge` for the chunky bottom lip,
// and a saturated `strong` that fills the icon bubble (and the whole button when active).
type Tint = { bg: string; edge: string; strong: string; ink: string };

const tints: Record<string, Tint> = {
  pink: { bg: '#FFE3EC', edge: '#F5B5C9', strong: '#FF7BA5', ink: '#8A1F4B' },
  peach: { bg: '#FFE9D6', edge: '#F7C49A', strong: '#FF9F5A', ink: '#8A4210' },
  butter: { bg: '#FFF5CC', edge: '#F2DC82', strong: '#FFCB3D', ink: '#7A5A00' },
  mint: { bg: '#DDF6E8', edge: '#A6DFC0', strong: '#4FC98A', ink: '#14503A' },
  sky: { bg: '#DCEEFF', edge: '#A7CDF2', strong: '#5AA9F0', ink: '#16466F' },
  lilac: { bg: '#EBE2FF', edge: '#C6B4F2', strong: '#9B7BF0', ink: '#412784' },
};

const tintFor: Record<string, keyof typeof tints> = {
  sit: 'peach',
  paw: 'butter',
  speak: 'sky',
  cuddle: 'pink',
  rest: 'lilac',
  wake: 'butter',
  feed: 'peach',
  refill: 'sky',
  play: 'mint',
  playdate: 'lilac',
  wardrobe: 'pink',
  sound: 'sky',
  soundOff: 'sky',
  music: 'lilac',
  musicOff: 'lilac',
  personality: 'mint',
  help: 'lilac',
  potty: 'butter',
  clean: 'peach',
  treat: 'butter',
  inventory: 'lilac',
  walk: 'mint',
  train: 'sky',
};

const WHITE = '#FFFFFF';
const BUTTON_WIDTH = 88;
const GAP = 10;
const LIP = 5;
const RADIUS = 30;
const BUBBLE = 44;

// A four-point twinkle drawn in a 10x10 box.
const SPARKLE_PATH = 'M5 0 C5.6 3.4 6.6 4.4 10 5 C6.6 5.6 5.6 6.6 5 10 C4.4 6.6 3.4 5.6 0 5 C3.4 4.4 4.4 3.4 5 0 Z';

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
  const tint = tints[tintFor[action.id] ?? 'mint'];
  const on = !!action.active;

  const faceTop = on ? mixHexColor(tint.strong, WHITE, 0.35) : mixHexColor(tint.bg, WHITE, 0.6);
  const faceBottom = on ? mixHexColor(tint.strong, tint.ink, 0.18) : mixHexColor(tint.bg, tint.edge, 0.55);
  const lip = on ? mixHexColor(tint.strong, tint.ink, 0.5) : tint.edge;
  const bubbleCore = on ? mixHexColor(tint.strong, WHITE, 0.4) : WHITE;
  const bubbleRim = on ? mixHexColor(tint.strong, tint.ink, 0.1) : mixHexColor(tint.bg, tint.edge, 0.7);

  return (
    <Pressable
      style={({ pressed }: { pressed: boolean }) => [
        styles.button,
        { backgroundColor: lip, shadowColor: on ? tint.strong : tint.edge },
        pressed && styles.buttonPressed,
        action.reason ? styles.disabled : null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ disabled: !!action.reason, selected: on }}
      onPress={() => (action.reason ? onBlocked?.(action.reason) : action.onPress())}
      onLongPress={action.onLongPress}
    >
      <View style={[styles.face, { borderColor: on ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.9)' }]}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
          <Defs>
            <LinearGradient id={`face${uid}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={faceTop} />
              <Stop offset="0.55" stopColor={on ? tint.strong : tint.bg} />
              <Stop offset="1" stopColor={faceBottom} />
            </LinearGradient>
            <LinearGradient id={`gloss${uid}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={WHITE} stopOpacity={on ? 0.6 : 0.95} />
              <Stop offset="1" stopColor={WHITE} stopOpacity="0" />
            </LinearGradient>
            <RadialGradient id={`glow${uid}`} cx="50%" cy="100%" rx="60%" ry="40%">
              <Stop offset="0" stopColor={WHITE} stopOpacity={on ? 0.28 : 0.5} />
              <Stop offset="1" stopColor={WHITE} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#face${uid})`} />
          <Rect x="0" y="55%" width="100%" height="45%" fill={`url(#glow${uid})`} />
          <Rect x="7%" y="3%" width="86%" height="44%" rx={RADIUS - 6} fill={`url(#gloss${uid})`} />
        </Svg>

        <View style={[styles.bubble, { shadowColor: on ? tint.ink : tint.strong }]}>
          <Svg style={StyleSheet.absoluteFill} width={BUBBLE} height={BUBBLE} pointerEvents="none">
            <Defs>
              <RadialGradient id={`orb${uid}`} cx="40%" cy="32%" r="70%">
                <Stop offset="0" stopColor={bubbleCore} stopOpacity={on ? 0.55 : 1} />
                <Stop offset="0.7" stopColor={WHITE} stopOpacity={on ? 0.2 : 1} />
                <Stop offset="1" stopColor={bubbleRim} stopOpacity={on ? 0.45 : 1} />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width={BUBBLE} height={BUBBLE} rx={BUBBLE / 2} fill={`url(#orb${uid})`} />
            <Ellipse cx={BUBBLE * 0.36} cy={BUBBLE * 0.24} rx={BUBBLE * 0.17} ry={BUBBLE * 0.09} fill={WHITE} opacity={0.9} />
          </Svg>
          {Icon ? (
            <Icon size={iconSize} strokeWidth={iconStroke + 0.5} color={on ? WHITE : tint.strong} />
          ) : null}
        </View>

        <Text
          style={[styles.label, on ? styles.labelOn : { color: tint.ink }, on && { textShadowColor: tint.ink }]}
          numberOfLines={1}
        >
          {action.label}
        </Text>

        <Sparkle style={styles.sparkleBig} opacity={on ? 1 : 0.95} />
        <Sparkle style={styles.sparkleSmall} opacity={on ? 0.85 : 0.75} />
      </View>
    </Pressable>
  );
}

function Sparkle({ style, opacity }: { style: object; opacity: number }) {
  return (
    <Svg style={style} viewBox="0 0 10 10" pointerEvents="none">
      <Path d={SPARKLE_PATH} fill={WHITE} opacity={opacity} />
    </Svg>
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
  button: {
    width: BUTTON_WIDTH,
    borderRadius: RADIUS,
    paddingBottom: LIP,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  buttonPressed: {
    transform: [{ translateY: LIP - 2 }, { scale: 0.96 }],
    paddingBottom: 2,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  face: {
    minHeight: minTouch + 25,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: RADIUS,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  bubble: {
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: 'rgba(255,255,255,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0.5,
  },
  labelOn: {
    color: WHITE,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1.5,
  },
  sparkleBig: {
    position: 'absolute',
    top: 9,
    right: 13,
    width: 9,
    height: 9,
  },
  sparkleSmall: {
    position: 'absolute',
    top: 20,
    right: 9,
    width: 5,
    height: 5,
  },
});
