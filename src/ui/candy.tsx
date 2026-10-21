import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { mixHexColor } from '../actor/color';

// A pastel candy flavor: `top` is the lit upper face, `base` the body, `bottom` the deeper
// underside, `lip` the chunky 3D edge, `icon` the saturated glyph color, and `ink` the label.
export type Tint = { top: string; base: string; bottom: string; lip: string; icon: string; ink: string };

export const tints = {
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

export type TintName = keyof typeof tints;

// Unavailable actions keep the candy shape but lose the flavor.
export const GRAY: Tint = { top: '#F6F6F9', base: '#E4E4EB', bottom: '#D7D7E0', lip: '#B7B7C4', icon: '#9A9AA8', ink: '#55556A' };

export const WHITE = '#FFFFFF';

// A four-point twinkle drawn in a 10x10 box.
export const SPARKLE_PATH = 'M5 0 C5.6 3.4 6.6 4.4 10 5 C6.6 5.6 5.6 6.6 5 10 C4.4 6.6 3.4 5.6 0 5 C3.4 4.4 4.4 3.4 5 0 Z';

const RING = 2.5;
const LIP_ACTIVE = 3;

export function candyInk(tint: Tint): string {
  return mixHexColor(tint.ink, '#1A1A1A', 0.35);
}

export function Sparkle({ style, opacity }: { style: object; opacity: number }) {
  return (
    <Svg style={style} viewBox="0 0 10 10" pointerEvents="none">
      <Path d={SPARKLE_PATH} fill={WHITE} opacity={opacity} />
    </Svg>
  );
}

type FaceProps = {
  tint: Tint;
  radius: number;
  lit?: boolean;
  uid: string;
};

export function CandyFace({ tint, radius, lit = false, uid }: FaceProps) {
  const top = lit ? mixHexColor(tint.top, WHITE, 0.3) : tint.top;
  const base = lit ? mixHexColor(tint.base, tint.icon, 0.18) : tint.base;
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <ClipPath id={`clip${uid}`}>
          <Rect x="0" y="0" width="100%" height="100%" rx={radius - 1.5} />
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
        <RadialGradient id={`glow${uid}`} cx="50%" cy="100%" rx="55%" ry="45%">
          <Stop offset="0" stopColor={WHITE} stopOpacity={lit ? 0.3 : 0.2} />
          <Stop offset="1" stopColor={WHITE} stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id={`shade${uid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={tint.ink} stopOpacity="0" />
          <Stop offset="1" stopColor={tint.ink} stopOpacity={0.18} />
        </LinearGradient>
      </Defs>
      <G clipPath={`url(#clip${uid})`}>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#body${uid})`} />
        <Rect x="0" y="50%" width="100%" height="50%" fill={`url(#shade${uid})`} />
        <Rect x="0" y="58%" width="100%" height="42%" fill={`url(#glow${uid})`} />
        <Rect x="7%" y="4%" width="86%" height="40%" rx={radius - 8} fill={`url(#gloss${uid})`} />
        <Ellipse cx="22%" cy="13%" rx="9%" ry="4.5%" fill={WHITE} opacity={0.95} />
        <Circle cx="35%" cy="11%" r="2" fill={WHITE} opacity={0.9} />
      </G>
    </Svg>
  );
}

type ShellProps = {
  tint: Tint;
  radius: number;
  lip?: number;
  selected?: boolean;
  pressed?: boolean;
  uid: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export function CandyShell({ tint, radius, lip = 6, selected = false, pressed = false, uid, style, children }: ShellProps) {
  const restingLip = selected ? LIP_ACTIVE : lip;
  const drawnLip = pressed ? 1 : restingLip;
  return (
    <View
      style={[
        styles.ring,
        { borderRadius: radius + RING + 1 },
        selected && { borderColor: WHITE, shadowColor: tint.icon, shadowOpacity: 0.55, shadowRadius: 10 },
      ]}
    >
      <View
        style={[
          styles.lip,
          {
            backgroundColor: tint.lip,
            shadowColor: tint.lip,
            borderRadius: radius,
            paddingBottom: drawnLip,
            transform: [{ translateY: pressed ? restingLip - 1 : lip - restingLip }],
          },
        ]}
      >
        <View
          style={[
            styles.face,
            {
              borderRadius: radius,
              borderColor: 'rgba(255,255,255,0.55)',
            },
            style,
          ]}
        >
          <CandyFace tint={tint} radius={radius} lit={selected} uid={uid} />
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderWidth: RING,
    borderColor: 'transparent',
    padding: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
  },
  lip: {
    shadowOpacity: 0.45,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  face: {
    borderWidth: 1.5,
    overflow: 'hidden',
  },
});
