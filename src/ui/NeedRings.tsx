import { Bone, Heart, Zap } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import type { Needs } from '../sim/types';

type Props = {
  needs: Needs;
};

const size = 76;
const stroke = 10;
const radius = (size - stroke) / 2;
const circumference = 2 * Math.PI * radius;

// Same candy tints as the action buttons: soft card, darker lip, saturated ring.
type Tint = { bg: string; edge: string; strong: string; ink: string };

// Any need below this takes the alarm tint, whatever its normal color is.
const lowThreshold = 25;
const alarmTint: Tint = { bg: '#FFE0DC', edge: '#F2A9A0', strong: '#F2635A', ink: '#8A2019' };

// Captions from best to worst. A value gets the first caption whose `min` it reaches.
type Tier = { min: number; text: string };
type Need = { label: string; Icon: LucideIcon; tint: Tint; tiers: Tier[] };

const tummy: Need = {
  label: 'Tummy',
  Icon: Bone,
  tint: { bg: '#FFE9D6', edge: '#F7C49A', strong: '#FF9F5A', ink: '#8A4210' },
  tiers: [
    { min: 75, text: 'Yummy!' },
    { min: 50, text: 'Peckish' },
    { min: lowThreshold, text: 'Rumbly' },
    { min: 0, text: 'Starving!' },
  ],
};

const energy: Need = {
  label: 'Energy',
  Icon: Zap,
  tint: { bg: '#DDF6E8', edge: '#A6DFC0', strong: '#4FC98A', ink: '#14503A' },
  tiers: [
    { min: 75, text: 'Zoomy!' },
    { min: 50, text: 'Chill' },
    { min: lowThreshold, text: 'Sleepy' },
    { min: 0, text: 'Exhausted!' },
  ],
};

const mood: Need = {
  label: 'Mood',
  Icon: Heart,
  tint: { bg: '#FFE3EC', edge: '#F5B5C9', strong: '#FF7BA5', ink: '#8A1F4B' },
  tiers: [
    { min: 75, text: 'Joyful!' },
    { min: 50, text: 'Content' },
    { min: lowThreshold, text: 'Meh' },
    { min: 0, text: 'Gloomy!' },
  ],
};

function Ring({ need, value }: { need: Need; value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const filled = (clamped / 100) * circumference;
  const { label, Icon, tiers } = need;
  const tint = clamped < lowThreshold ? alarmTint : need.tint;
  const caption = (tiers.find((tier) => clamped >= tier.min) ?? tiers[tiers.length - 1]).text;
  return (
    <View
      style={[styles.card, { backgroundColor: tint.bg, borderBottomColor: tint.edge, shadowColor: tint.strong }]}
      accessible
      accessibilityLabel={`${label} ${Math.round(clamped)} percent, ${caption.replace('!', '')}`}
    >
      <View style={styles.ring}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#FFFFFF" strokeWidth={stroke} fill="none" />
          {clamped > 0 ? (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={tint.strong}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${filled} ${circumference}`}
              fill="none"
              // Start at 12 o'clock and fill clockwise.
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          ) : null}
        </Svg>
        <View style={styles.center}>
          <Icon size={18} strokeWidth={2.5} color={tint.strong} fill={tint.strong} fillOpacity={0.25} />
          <Text style={[styles.value, { color: tint.ink }]}>{Math.round(clamped)}</Text>
        </View>
      </View>
      <View style={styles.text}>
        <Text style={[styles.label, { color: tint.ink }]}>{label}</Text>
        <Text style={[styles.caption, { color: tint.ink }]} numberOfLines={1}>
          {caption}
        </Text>
      </View>
    </View>
  );
}

export function NeedRings({ needs }: Props) {
  return (
    <View style={styles.row}>
      {/* The sim stores hunger (0 = not hungry, 100 = starving). The ring shows the inverse so a
          full ring is the good state, like Energy and Mood. */}
      <Ring need={tummy} value={100 - needs.hunger} />
      <Ring need={energy} value={needs.energy} />
      <Ring need={mood} value={needs.happiness} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  card: {
    flex: 1,
    maxWidth: 112,
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    paddingBottom: 10,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderBottomWidth: 5,
    shadowOpacity: 0.25,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  ring: {
    width: size,
    height: size,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    gap: 0,
  },
  value: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
  text: {
    alignItems: 'center',
    gap: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  caption: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.8,
  },
});
