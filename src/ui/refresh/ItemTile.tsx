import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check, Lock, ShoppingBag } from 'lucide-react-native';

import { fontFamily } from '../font';
import { PressableCard } from './PressableCard';
import { ui } from './tokens';

export type TileState = 'default' | 'selected' | 'locked' | 'used' | 'shop';

type Props = {
  label: string;
  state?: TileState;
  art?: ReactNode;
  tag?: string;
  onPress: () => void;
  reducedMotion?: boolean;
};

export function ItemTile({ label, state = 'default', art, tag, onPress, reducedMotion = false }: Props) {
  const locked = state === 'locked' || state === 'used';
  const shop = state === 'shop';
  return (
    <View style={styles.cell}>
      {shop ? (
        <PressableCard onPress={onPress} reducedMotion={reducedMotion} radius={ui.radius.tile} accessibilityLabel={label}>
          <View style={[styles.body, styles.shop]}>
            <ShoppingBag color={ui.inkMuted} size={22} />
            <Text style={styles.name}>{label}</Text>
          </View>
        </PressableCard>
      ) : (
        <PressableCard
          disabled={locked}
          onPress={onPress}
          reducedMotion={reducedMotion}
          radius={ui.radius.tile}
          selected={state === 'selected'}
          accessibilityLabel={tag ? `${label}, ${tag}` : label}
        >
          <View style={styles.body}>
            {state === 'selected' ? (
              <View style={styles.check}>
                <Check color={ui.card} size={14} strokeWidth={3} />
              </View>
            ) : null}
            {tag ? (
              <View style={styles.tag}>
                {state === 'locked' ? <Lock color={ui.card} size={10} /> : null}
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ) : null}
            <View style={[styles.art, locked && styles.dim]}>{art}</View>
            <Text style={[styles.name, state === 'selected' && styles.nameOn]} numberOfLines={2}>
              {label}
            </Text>
          </View>
        </PressableCard>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    width: '31%',
  },
  body: {
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    gap: 4,
  },
  shop: {
    borderWidth: 2.5,
    borderStyle: 'dashed',
    borderColor: ui.shopDash,
    borderRadius: 18,
  },
  art: {
    height: 52,
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: {
    opacity: 0.55,
  },
  name: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 13,
    color: ui.ink,
    textAlign: 'center',
  },
  nameOn: {
    color: ui.equipped.text,
  },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: ui.equipped.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: ui.accent.train.main,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: {
    color: ui.card,
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 10,
  },
});
