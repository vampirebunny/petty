import { useId, useState } from 'react';
import { ChevronLeft, Cookie, Store } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { basicTreatId, specialTreatId, stackQty } from '../economy/state';
import type { UserEconomy } from '../economy/state';
import { CandyShell, Sparkle, WHITE, candyInk, tints } from '../ui/candy';
import { FunModal } from '../ui/FunModal';
import { iconStroke } from '../ui/theme';

type Props = {
  economy: UserEconomy | null;
  reducedMotion: boolean;
  onClose: () => void;
};

export function PantryScreen({ economy, reducedMotion, onClose }: Props) {
  const backUid = useId().replace(/:/g, '');
  const cardUid = useId().replace(/:/g, '');
  const [storeOpen, setStoreOpen] = useState(false);
  const basic = economy ? stackQty(economy, basicTreatId) : 0;
  const special = economy ? stackQty(economy, specialTreatId) : 0;
  const tint = tints.butter;
  const ink = candyInk(tint);
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onClose} style={styles.backHit}>
            {({ pressed }) => (
              <CandyShell tint={tints.sky} radius={16} pressed={pressed} uid={backUid} style={styles.backFace}>
                <ChevronLeft size={22} strokeWidth={iconStroke + 1} color={tints.sky.icon} />
              </CandyShell>
            )}
          </Pressable>
          <View style={styles.titles}>
            <Text style={styles.title}>Pantry</Text>
            <Text style={styles.subtitle}>Treats and snacks</Text>
          </View>
        </View>
        <CandyShell tint={tint} radius={28} uid={cardUid} style={styles.card}>
          <View style={[styles.bubble, { shadowColor: tint.lip }]}>
            <Cookie size={30} strokeWidth={iconStroke + 1} color={tint.icon} />
          </View>
          <Text style={[styles.name, { color: ink }]}>Treats × {basic}</Text>
          {special > 0 ? <Text style={[styles.meta, { color: ink }]}>Special treats × {special}</Text> : null}
          {basic <= 0 ? <Text style={[styles.meta, { color: ink }]}>Out of treats! The Pet Store is opening soon.</Text> : null}
          <Sparkle style={styles.sparkle} opacity={0.9} />
        </CandyShell>
        <Pressable accessibilityRole="button" onPress={() => setStoreOpen(true)} style={styles.storeHit}>
          {({ pressed }) => (
            <CandyShell tint={tints.lilac} radius={24} pressed={pressed} uid={`${cardUid}store`} style={styles.store}>
              <Store size={22} strokeWidth={iconStroke + 1} color={tints.lilac.icon} />
              <Text style={[styles.storeText, { color: candyInk(tints.lilac) }]}>Pet Store</Text>
            </CandyShell>
          )}
        </Pressable>
      </ScrollView>
      {storeOpen ? (
        <FunModal
          title="Coming soon!"
          body="The Pet Store is opening soon."
          icon={Store}
          tint="lilac"
          reducedMotion={reducedMotion}
          primary={{ label: 'OK', onPress: () => setStoreOpen(false) }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F4F7FB',
    paddingTop: 64,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backHit: { width: 44 },
  backFace: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: { flex: 1, gap: 2 },
  title: { fontSize: 28, fontWeight: '900', color: '#243044' },
  subtitle: { fontSize: 13, fontWeight: '700', color: '#5C6B80' },
  card: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 22,
    paddingHorizontal: 16,
  },
  bubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE,
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  name: { fontSize: 22, fontWeight: '900' },
  meta: { fontSize: 14, fontWeight: '800', textAlign: 'center' },
  sparkle: { position: 'absolute', top: 14, right: 16, width: 12, height: 12 },
  storeHit: { alignSelf: 'stretch' },
  store: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  storeText: { fontSize: 16, fontWeight: '900' },
});
