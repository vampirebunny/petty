import { useId, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import type { LucideIcon } from 'lucide-react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { mixHexColor } from '../actor/color';
import { iconFor } from './actionIcons';
import type { ActionSpecies } from './actionIcons';
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

// A pastel candy flavor: `top` is the lit upper face, `base` the body, `bottom` the deeper
// underside, `lip` the chunky 3D edge, `icon` the saturated glyph color, and `ink` the label.
type Tint = { top: string; base: string; bottom: string; lip: string; icon: string; ink: string };

const tints = {
  pink: { top: '#FFEAF1', base: '#FFC8DA', bottom: '#FFB0CA', lip: '#E98DAE', icon: '#EE5A8E', ink: '#7A1E44' },
  peach: { top: '#FFF0E3', base: '#FFD5B5', bottom: '#FFC198', lip: '#E89E70', icon: '#EE7A30', ink: '#7A3A0E' },
  coral: { top: '#FFEDE9', base: '#FFCABF', bottom: '#FFB3A4', lip: '#E78B77', icon: '#EE5C40', ink: '#7A2414' },
  butter: { top: '#FFF9DB', base: '#FFEBA6', bottom: '#FFDF80', lip: '#DDB851', icon: '#D69800', ink: '#6B4E00' },
  pistachio: { top: '#F3FAE2', base: '#DCF2B3', bottom: '#CCEA96', lip: '#A3C863', icon: '#6CA51E', ink: '#344F0A' },
  mint: { top: '#E8FAF0', base: '#C3F0D7', bottom: '#A9E7C5', lip: '#79C8A0', icon: '#2DAA6C', ink: '#104A33' },
  aqua: { top: '#E4F9F8', base: '#BAEFED', bottom: '#9DE5E2', lip: '#67C5C1', icon: '#1CA39D', ink: '#0D4A47' },
  sky: { top: '#E7F3FF', base: '#C2E0FF', bottom: '#A8D1FA', lip: '#7AB0E3', icon: '#3A8DDE', ink: '#113F6B' },
  periwinkle: { top: '#ECEEFF', base: '#CBD1FF', bottom: '#B4BDFA', lip: '#8995E0', icon: '#5465E4', ink: '#222C7A' },
  lilac: { top: '#F2ECFF', base: '#DBCDFF', bottom: '#C9B6FA', lip: '#A28AE3', icon: '#7853E6', ink: '#35207A' },
  orchid: { top: '#FCEAFB', base: '#F3C8F0', bottom: '#ECAFE8', lip: '#CC86C8', icon: '#C04DBB', ink: '#5E1A5A' },
} satisfies Record<string, Tint>;

// Unavailable actions keep the candy shape but lose the flavor.
const GRAY: Tint = { top: '#F6F6F9', base: '#E4E4EB', bottom: '#D7D7E0', lip: '#B7B7C4', icon: '#9A9AA8', ink: '#55556A' };

// Spread across flavors so neighboring buttons rarely share a color.
const tintFor: Record<string, keyof typeof tints> = {
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

const WHITE = '#FFFFFF';
const BUTTON_WIDTH = 88;
const GAP = 10;
const LIP = 6;
const LIP_ACTIVE = 3;
const RING = 2.5;
const RADIUS = 28;
const GLYPH = iconSize + 4;

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
  const blocked = !!action.reason;
  const on = !!action.active && !blocked;
  const tint = blocked ? GRAY : tints[tintFor[action.id] ?? 'mint'];

  // Active buttons take a deeper dose of their flavor, as if lit from inside.
  const top = on ? mixHexColor(tint.top, WHITE, 0.3) : tint.top;
  const base = on ? mixHexColor(tint.base, tint.icon, 0.18) : tint.base;
  const lipSize = on ? LIP_ACTIVE : LIP;

  return (
    <Pressable
      style={({ pressed }: { pressed: boolean }) => [
        styles.ring,
        on && { borderColor: WHITE, shadowColor: tint.icon, shadowOpacity: 0.55, shadowRadius: 10 },
        pressed && styles.ringPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ disabled: blocked, selected: on }}
      onPress={() => (action.reason ? onBlocked?.(action.reason) : action.onPress())}
      onLongPress={action.onLongPress}
    >
      {({ pressed }: { pressed: boolean }) => (
        <View
          style={[
            styles.button,
            {
              backgroundColor: tint.lip,
              shadowColor: tint.lip,
              paddingBottom: pressed ? 1 : lipSize,
              transform: [{ translateY: pressed ? lipSize - 1 : LIP - lipSize }],
            },
            blocked && styles.blocked,
          ]}
        >
          <View style={styles.face}>
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
              <Defs>
                {/* Clip inside the SVG: overflow + borderRadius does not reliably clip SVG on every platform. */}
                <ClipPath id={`clip${uid}`}>
                  <Rect x="0" y="0" width="100%" height="100%" rx={RADIUS - 1.5} />
                </ClipPath>
                <LinearGradient id={`body${uid}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={top} />
                  <Stop offset="0.45" stopColor={base} />
                  <Stop offset="1" stopColor={tint.bottom} />
                </LinearGradient>
                <LinearGradient id={`gloss${uid}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={WHITE} stopOpacity={0.9} />
                  <Stop offset="0.6" stopColor={WHITE} stopOpacity={0.35} />
                  <Stop offset="1" stopColor={WHITE} stopOpacity={0.05} />
                </LinearGradient>
                {/* Light passing through the jelly pools at the bottom edge. */}
                <RadialGradient id={`glow${uid}`} cx="50%" cy="100%" rx="55%" ry="45%">
                  <Stop offset="0" stopColor={WHITE} stopOpacity={on ? 0.3 : 0.2} />
                  <Stop offset="1" stopColor={WHITE} stopOpacity="0" />
                </RadialGradient>
                {/* A soft darkening under the gloss gives the body some depth. */}
                <LinearGradient id={`shade${uid}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={tint.ink} stopOpacity="0" />
                  <Stop offset="1" stopColor={tint.ink} stopOpacity={0.18} />
                </LinearGradient>
              </Defs>
              <G clipPath={`url(#clip${uid})`}>
                <Rect x="0" y="0" width="100%" height="100%" fill={`url(#body${uid})`} />
                <Rect x="0" y="50%" width="100%" height="50%" fill={`url(#shade${uid})`} />
                <Rect x="0" y="58%" width="100%" height="42%" fill={`url(#glow${uid})`} />
                <Rect x="7%" y="4%" width="86%" height="40%" rx={RADIUS - 8} fill={`url(#gloss${uid})`} />
                {/* Specular highlights: the hard little shine that sells "candy". */}
                <Ellipse cx="22%" cy="13%" rx="9%" ry="4.5%" fill={WHITE} opacity={0.95} />
                <Circle cx="35%" cy="11%" r="2" fill={WHITE} opacity={0.9} />
              </G>
            </Svg>

            {Icon ? (
              <View style={styles.glyph}>
                {/* A white highlight under a colored glyph reads as embossed on pastel. */}
                <View style={styles.glyphShadow}>
                  <Icon size={GLYPH} strokeWidth={iconStroke + 1} color={WHITE} opacity={0.9} />
                </View>
                <Icon size={GLYPH} strokeWidth={iconStroke + 1} color={on ? tint.ink : tint.icon} />
              </View>
            ) : null}

            <Text style={[styles.label, { color: mixHexColor(tint.ink, '#1A1A1A', 0.35) }]} numberOfLines={1}>
              {action.label}
            </Text>

            {!blocked ? (
              <>
                <Sparkle style={styles.sparkleBig} opacity={on ? 1 : 0.9} />
                <Sparkle style={styles.sparkleSmall} opacity={on ? 0.9 : 0.7} />
              </>
            ) : null}
          </View>
        </View>
      )}
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
  // The ring is always reserved so toggling active never shifts the layout.
  ring: {
    width: BUTTON_WIDTH,
    borderRadius: RADIUS + RING + 1,
    borderWidth: RING,
    borderColor: 'transparent',
    padding: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
  },
  ringPressed: {
    transform: [{ scale: 0.96 }],
  },
  button: {
    borderRadius: RADIUS,
    shadowOpacity: 0.45,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
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
    borderRadius: RADIUS,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    overflow: 'hidden',
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
