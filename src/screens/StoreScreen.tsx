import { useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getCatalog, newRequestId, purchase } from '../economy/service';
import { CandyShell, WHITE, candyInk, tints } from '../ui/candy';
import { iconStroke } from '../ui/theme';

type Props = {
  balance: number;
  onClose: () => void;
};

export function StoreScreen({ balance, onClose }: Props) {
  const lock = useRef(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const items = getCatalog();

  const buy = (itemId: string) => {
    if (lock.current) {
      return;
    }
    lock.current = true;
    setBusyId(itemId);
    const result = purchase(itemId, 1, newRequestId());
    lock.current = false;
    setBusyId(null);
    setNote(result.ok ? 'Added to your things.' : result.reason === 'insufficient_boops' ? 'Not enough Boops.' : 'Not for sale.');
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onClose} style={styles.backHit}>
            {({ pressed }) => (
              <CandyShell tint={tints.sky} radius={16} pressed={pressed} uid="store-back" style={styles.backFace}>
                <ChevronLeft size={22} strokeWidth={iconStroke + 1} color={tints.sky.icon} />
              </CandyShell>
            )}
          </Pressable>
          <View style={styles.titles}>
            <Text style={styles.title}>Pet Store</Text>
            <Text style={styles.subtitle}>{balance} Boops</Text>
          </View>
        </View>
        {note ? <Text style={styles.note}>{note}</Text> : null}
        {items.map((item) => (
          <View key={item.id} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>{item.price} Boops</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Buy ${item.name}`}
              disabled={busyId != null}
              onPress={() => buy(item.id)}
            >
              {({ pressed }) => (
                <CandyShell tint={tints.lilac} radius={18} pressed={pressed} uid={`buy-${item.id}`} style={styles.buy}>
                  <Text style={[styles.buyText, { color: candyInk(tints.lilac) }]}>{busyId === item.id ? '...' : 'Buy'}</Text>
                </CandyShell>
              )}
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F7FB', paddingTop: 64 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  backHit: { width: 44 },
  backFace: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titles: { flex: 1, gap: 2 },
  title: { fontSize: 28, fontWeight: '900', color: '#243044' },
  subtitle: { fontSize: 13, fontWeight: '700', color: '#5C6B80' },
  note: { fontSize: 14, fontWeight: '800', color: '#243044' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: WHITE,
    borderRadius: 20,
    padding: 14,
  },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '900', color: '#243044' },
  meta: { fontSize: 13, fontWeight: '700', color: '#5C6B80' },
  buy: { minWidth: 72, minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  buyText: { fontSize: 15, fontWeight: '900' },
});
