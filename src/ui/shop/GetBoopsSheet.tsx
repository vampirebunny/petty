import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, SlideInDown, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { X } from 'lucide-react-native';

import { PawCoin } from '../../components/currency/PawCoin';
import { buyBoopsPack } from '../../economy/buyBoops';
import { onIapBoops } from '../../economy/iapApply';
import { loadBoopsPrices } from '../../economy/boopsOffering';
import { boopsPacks } from '../../economy/boopsPacks';
import { requestAgeGateRefresh } from '../../state/ageGateRefresh';
import { onAgeGatePhase, readAgeGatePhase, type AgeGatePhase } from '../../state/ageGatePhase';
import { fontFamily } from '../font';
import { LilacFace } from './LilacFace';
import { PackArt } from './PackArt';
import { packArtBoxHeight, packArtWidth } from './packDrawing';
import { LedgeCard } from './Glossy';
import { shop, shopRadius } from './theme';

type Props = {
  balance: number;
  reducedMotion: boolean;
  onClose: () => void;
};

function useAgePhase(): AgeGatePhase {
  const [phase, setPhase] = useState(readAgeGatePhase);
  useEffect(() => onAgeGatePhase(setPhase), []);
  return phase;
}

function money(amount: number): string {
  return amount.toLocaleString('en-US');
}

export function GetBoopsSheet({ balance, reducedMotion, onClose }: Props) {
  const phase = useAgePhase();
  const { height: screenH } = useWindowDimensions();
  const drag = useSharedValue(0);
  const spin = useSharedValue(0);
  const [reload, setReload] = useState(0);
  const [prices, setPrices] = useState<ReadonlyMap<string, string> | 'pending' | 'missing'>('pending');
  const [buying, setBuying] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const packs = [...boopsPacks].sort((a, b) => a.sortOrder - b.sortOrder);
  const storeMissing = phase === 'unavailable' || (phase === 'ready' && prices === 'missing');
  const showPacks = !storeMissing;
  const animateArt = phase === 'ready' && !reducedMotion;
  const visiblePacks = prices instanceof Map ? packs.filter((pack) => prices.has(pack.productId)) : packs;

  useEffect(() => {
    if (phase !== 'ready') {
      return;
    }
    let cancelled = false;
    void loadBoopsPrices().then((next) => {
      if (cancelled) {
        return;
      }
      setPrices(next && next.size > 0 ? next : 'missing');
    });
    return () => {
      cancelled = true;
    };
  }, [phase, reload]);

  useEffect(() => onIapBoops(() => setNotice(null)), []);

  const buy = (productId: string) => {
    if (buying) {
      return;
    }
    setBuying(productId);
    setNotice(null);
    void buyBoopsPack(productId, () => setNotice('Adding your Boops…')).then((result) => {
      setBuying(null);
      if (result.status === 'cancelled') {
        setNotice(null);
        return;
      }
      if (result.status === 'pending') {
        setNotice("Waiting for approval. Your Boops will arrive once it's approved.");
        return;
      }
      if (result.status === 'credited') {
        setNotice(null);
        return;
      }
      if (result.status === 'on_the_way') {
        setNotice("Your Boops are on the way. They'll appear shortly.");
        return;
      }
      if (result.status === 'unavailable') {
        setNotice("Can't reach the store right now");
        return;
      }
      setNotice(result.notCharged ? `${result.message} You weren't charged.` : result.message);
    });
  };

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      drag.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY > 80 || event.velocityY > 800) {
        runOnJS(onClose)();
        return;
      }
      drag.value = withTiming(0, { duration: 180 });
    });
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drag.value }] }));
  const storeName = Platform.OS === 'android' ? 'Google account' : 'Apple ID';

  return (
    <View style={styles.layer}>
      <View style={styles.dim} />
      <Animated.View
        entering={reducedMotion ? FadeIn.duration(180) : SlideInDown.duration(250)}
        style={[styles.sheet, { maxHeight: screenH * 0.92 }, sheetStyle]}
      >
        <GestureDetector gesture={pan}>
          <View>
            <View style={styles.grabber} />
            <View style={styles.header}>
              <Text style={styles.title}>Buy Boops</Text>
              <View style={styles.headerEnd}>
                <View style={styles.pill}>
                  <PawCoin size={22} spinAngle={spin} shine={false} />
                  <Text style={styles.pillText}>{money(balance)}</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose}>
                  {({ pressed }) => (
                    <View style={[styles.close, pressed && styles.closePressed]}>
                      <X size={18} strokeWidth={3} color="#2A1E26" />
                    </View>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </GestureDetector>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {showPacks ? (
            <View style={styles.grid}>
              {visiblePacks.map((pack) => {
                const price = prices instanceof Map ? prices.get(pack.productId) : null;
                return (
                  <View key={pack.artKey} style={styles.slot}>
                    <LedgeCard face="#FFFFFF" ledge="#F0CFE0" radius={22} ledgeHeight={4} style={styles.card}>
                      {pack.tag ? (
                        <View style={styles.tag}>
                          <Text style={styles.tagText}>{pack.tag}</Text>
                        </View>
                      ) : null}
                      <View style={styles.artBox}>
                        <PackArt artKey={pack.artKey} width={packArtWidth} animate={animateArt} />
                      </View>
                      <Text style={styles.amount}>{money(pack.boops)}</Text>
                      <Text style={styles.unit}>Boops</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={price ? `Buy ${money(pack.boops)} Boops for ${price}` : undefined}
                        accessibilityState={{ disabled: !price || buying != null }}
                        disabled={!price || buying != null}
                        onPress={() => buy(pack.productId)}
                        style={styles.price}
                      >
                        {({ pressed }) => (
                          <LilacFace pressed={pressed && Boolean(price) && buying == null}>
                            {price ? (
                              <Text style={styles.priceText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                                {buying === pack.productId ? '…' : price}
                              </Text>
                            ) : null}
                          </LilacFace>
                        )}
                      </Pressable>
                    </LedgeCard>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.offline}>
              <Text style={styles.offlineText}>Can&apos;t reach the store right now</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Try again"
                onPress={() => {
                  requestAgeGateRefresh();
                  setPrices('pending');
                  setReload((attempt) => attempt + 1);
                }}
              >
                {({ pressed }) => (
                  <LilacFace pressed={pressed} radius={22} style={styles.retry}>
                    <Text style={styles.retryText}>Try again</Text>
                  </LilacFace>
                )}
              </Pressable>
            </View>
          )}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          <Text style={styles.footer}>
            {`Prices shown in your local currency and charged to your ${storeName}. Boops have no cash value.`}
          </Text>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end', zIndex: 8 },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(42, 30, 38, 0.45)' },
  sheet: {
    backgroundColor: shop.surface,
    borderTopLeftRadius: shopRadius.sheet,
    borderTopRightRadius: shopRadius.sheet,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 18,
    gap: 8,
  },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E5C3D4',
    marginBottom: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flexShrink: 1, fontFamily: fontFamily.fredokaBold, fontSize: 26, color: '#2A1E26' },
  headerEnd: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: shop.goldLight,
  },
  pillText: { fontFamily: fontFamily.black, fontSize: 16, color: shop.onGold },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: shop.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePressed: { opacity: 0.7 },
  scroll: { paddingTop: 8, paddingBottom: 8, gap: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  slot: { width: '48%' },
  card: { paddingTop: 14, paddingBottom: 12, paddingHorizontal: 10, alignItems: 'center', gap: 2 },
  tag: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#4A1E44',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { fontFamily: fontFamily.extraBold, fontSize: 10, color: '#FFFFFF' },
  artBox: {
    height: packArtBoxHeight,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  amount: { fontFamily: fontFamily.fredokaBold, fontSize: 24, color: '#2A1E26' },
  unit: { fontFamily: fontFamily.fredokaSemibold, fontSize: 12, color: '#6B4F5E', marginBottom: 8 },
  price: { alignSelf: 'stretch', marginTop: 6 },
  priceText: { fontFamily: fontFamily.fredokaBold, fontSize: 16, color: '#2E1A5E', paddingHorizontal: 8 },
  offline: { alignItems: 'center', gap: 14, paddingVertical: 28, paddingHorizontal: 12 },
  offlineText: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 18,
    color: '#2A1E26',
    textAlign: 'center',
  },
  retry: { paddingHorizontal: 22 },
  retryText: { fontFamily: fontFamily.fredokaBold, fontSize: 18, color: '#2E1A5E' },
  notice: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 16,
    lineHeight: 22,
    color: '#2A1E26',
    textAlign: 'center',
  },
  footer: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: '#6B4F5E',
    textAlign: 'center',
  },
});
