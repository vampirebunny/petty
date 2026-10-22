import { useId } from 'react';
import { ChevronLeft, Cookie, Store, Wind } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { catalogItem } from '../economy/catalog';
import type { InventoryRow } from '../economy/service';
import { CandyShell, Sparkle, WHITE, candyInk, tints } from '../ui/candy';
import { iconStroke } from '../ui/theme';

type Props = {
  inventory: InventoryRow[];
  onClose: () => void;
  onStore: () => void;
  onServe: (itemId: string) => void;
};

export function PantryScreen({ inventory, onClose, onStore, onServe }: Props) {
  const backUid = useId().replace(/:/g, '');
  const qty = (id: string) => inventory.find((row) => row.itemId === id)?.qty ?? 0;
  const basic = qty('biscuit');
  const special = qty('special');
  const wind = qty('second_wind');
  const foods = inventory.filter((row) => catalogItem(row.itemId)?.kind === 'food' && row.qty > 0);
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
            <Text style={styles.subtitle}>Treats, food, and Second Wind</Text>
          </View>
        </View>
        <CandyShell tint={tint} radius={28} uid={`${backUid}treats`} style={styles.card}>
          <View style={[styles.bubble, { shadowColor: tint.lip }]}>
            <Cookie size={30} strokeWidth={iconStroke + 1} color={tint.icon} />
          </View>
          <Text style={[styles.name, { color: ink }]}>Treats × {basic}</Text>
          {special > 0 ? <Text style={[styles.meta, { color: ink }]}>Special treats × {special}</Text> : null}
          {basic <= 0 ? <Text style={[styles.meta, { color: ink }]}>Out of treats. The Pet Store has more.</Text> : null}
          <Sparkle style={styles.sparkle} opacity={0.9} />
        </CandyShell>
        {foods.map((row) => {
          const item = catalogItem(row.itemId);
          return (
            <CandyShell key={row.itemId} tint={tints.peach} radius={24} uid={`${backUid}${row.itemId}`} style={styles.card}>
              <Text style={[styles.name, { color: candyInk(tints.peach) }]}>
                {item?.name ?? 'Food'} × {row.qty}
              </Text>
              <Pressable accessibilityRole="button" onPress={() => onServe(row.itemId)}>
                {({ pressed }) => (
                  <CandyShell tint={tints.mint} radius={16} pressed={pressed} uid={`${backUid}serve${row.itemId}`} style={styles.serve}>
                    <Text style={[styles.serveText, { color: candyInk(tints.mint) }]}>Serve</Text>
                  </CandyShell>
                )}
              </Pressable>
            </CandyShell>
          );
        })}
        <CandyShell tint={tints.sky} radius={24} uid={`${backUid}wind`} style={styles.card}>
          <Wind size={28} strokeWidth={iconStroke + 1} color={tints.sky.icon} />
          <Text style={[styles.name, { color: candyInk(tints.sky) }]}>Second Wind × {wind}</Text>
        </CandyShell>
        <Pressable accessibilityRole="button" onPress={onStore} style={styles.storeHit}>
          {({ pressed }) => (
            <CandyShell tint={tints.lilac} radius={24} pressed={pressed} uid={`${backUid}store`} style={styles.store}>
              <Store size={22} strokeWidth={iconStroke + 1} color={tints.lilac.icon} />
              <Text style={[styles.storeText, { color: candyInk(tints.lilac) }]}>Pet Store</Text>
            </CandyShell>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F7FB', paddingTop: 64 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backHit: { width: 44 },
  backFace: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titles: { flex: 1, gap: 2 },
  title: { fontSize: 28, fontWeight: '900', color: '#243044' },
  subtitle: { fontSize: 13, fontWeight: '700', color: '#5C6B80' },
  card: { alignItems: 'center', gap: 8, paddingVertical: 22, paddingHorizontal: 16 },
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
  serve: { minWidth: 96, minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  serveText: { fontSize: 15, fontWeight: '900' },
  storeHit: { alignSelf: 'stretch' },
  store: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  storeText: { fontSize: 16, fontWeight: '900' },
});
