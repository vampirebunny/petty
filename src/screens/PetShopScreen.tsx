import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  SlideInDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Check, ChevronLeft, Clock, Minus, Plus, ShoppingBag, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { playBloop } from '../audio/bloop';
import { playVoice } from '../audio/voice';
import { PawCoin } from '../components/currency/PawCoin';
import { catalogItem } from '../economy/catalog';
import { localDay, nextLocalMidnight } from '../economy/clock';
import { newRequestId, purchaseCart } from '../economy/service';
import type { InventoryRow } from '../economy/service';
import {
  contentsValue,
  countdownLabel,
  discounted,
  featuredBundle,
  fitsSpecies,
  isNewItem,
  priceCart,
  savePercent,
  shownDeal,
  shownPicks,
  tabItems,
  type ShopCatalog,
  type ShopCategory,
  type ShopListing,
  type SpeciesId,
} from '../economy/shop';
import { ensureShopDay, loadShopCatalog } from '../economy/shopState';
import { refreshShopCatalog } from '../economy/shopSync';
import type { Equipped, OutfitSlot, PetState } from '../sim/types';
import { fontFamily } from '../ui/font';
import { Glossy, LedgeCard, glossInk } from '../ui/shop/Glossy';
import { ItemArt } from '../ui/shop/ItemArt';
import { ShopStage } from '../ui/shop/ShopStage';
import { shop, shopRadius } from '../ui/shop/theme';

type CartRow = { id: string; kind: 'item' | 'bundle'; qty: number; addedAt: number };

type Props = {
  pet: PetState;
  balance: number;
  inventory: InventoryRow[];
  toys: string[];
  species: SpeciesId;
  initialTab?: ShopCategory;
  reducedMotion: boolean;
  onClose: () => void;
  onOpenCloset: () => void;
};

const tabs: { id: ShopCategory; label: string; title: string; note: string }[] = [
  { id: 'treats', label: 'Treats', title: 'Treats & Food', note: 'Goes to your Pantry' },
  { id: 'clothes', label: 'Clothes', title: 'Clothes', note: 'Try on, then Closet' },
  { id: 'toys', label: 'Toys', title: 'Toys', note: 'Goes to your Toy Box' },
  { id: 'boosts', label: 'Boosts', title: 'Boosts', note: 'Goes to your Pantry' },
];

function money(amount: number): string {
  return amount.toLocaleString('en-US');
}

function placeLine(place: string): string {
  if (place === 'Closet') {
    return 'Goes to your Closet';
  }
  if (place === 'Toy Box') {
    return 'Goes to your Toy Box';
  }
  return 'Goes to your Pantry';
}

function ownedIds(inventory: InventoryRow[], toys: string[]): Set<string> {
  const owned = new Set<string>(toys);
  for (const row of inventory) {
    if (row.qty <= 0) {
      continue;
    }
    const item = catalogItem(row.itemId);
    if (item?.kind === 'outfit' || item?.kind === 'toy') {
      owned.add(row.itemId);
    }
  }
  return owned;
}

function findItem(catalog: ShopCatalog, id: string): ShopListing | null {
  return catalog.items.find((item) => item.id === id) ?? null;
}

function tryOn(catalog: ShopCatalog | null, cart: CartRow[]): Map<OutfitSlot, string> {
  const wearing = new Map<OutfitSlot, { id: string; at: number }>();
  if (!catalog) {
    return new Map();
  }
  for (const row of cart) {
    if (row.kind !== 'item') {
      continue;
    }
    const item = findItem(catalog, row.id);
    if (!item?.slot) {
      continue;
    }
    const prev = wearing.get(item.slot);
    if (!prev || row.addedAt >= prev.at) {
      wearing.set(item.slot, { id: item.id, at: row.addedAt });
    }
  }
  return new Map([...wearing.entries()].map(([slot, worn]) => [slot, worn.id]));
}

function wearingHas(wearing: Map<OutfitSlot, string>, id: string): boolean {
  for (const itemId of wearing.values()) {
    if (itemId === id) {
      return true;
    }
  }
  return false;
}

function lineIsStackable(catalog: ShopCatalog, line: { id: string; kind: 'item' | 'bundle' }): boolean {
  if (line.kind === 'bundle') {
    return true;
  }
  return findItem(catalog, line.id)?.stackable ?? false;
}

function StillCoin({ size }: { size: number }) {
  const spin = useSharedValue(0);
  return <PawCoin size={size} spinAngle={spin} shine={false} />;
}

export function PetShopScreen({
  pet,
  balance,
  inventory,
  toys,
  species,
  initialTab = 'treats',
  reducedMotion,
  onClose,
  onOpenCloset,
}: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const stageWidthPx = screenW - 32;
  const cardWidth = (screenW - 32 - 12) / 2;
  const spin = useSharedValue(0);
  const celebrateSpin = useSharedValue(0);
  const celebrateDrop = useSharedValue(0);
  const [now, setNow] = useState(() => Date.now());
  const [clock, setClock] = useState(() => Date.now());
  const [tab, setTab] = useState<ShopCategory>(initialTab);
  const [cart, setCart] = useState<CartRow[]>([]);
  const [sheet, setSheet] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [celebration, setCelebration] = useState<{ charge: number; lines: { name: string; place: string }[]; closet: boolean } | null>(
    null,
  );
  const dealRef = useRef<string | null>(null);
  const dayRef = useRef<string | null>(null);
  const dealReady = useRef(false);
  const catalog = useMemo(() => loadShopCatalog(now), [now]);
  const day = useMemo(() => (catalog ? ensureShopDay(species, now) : null), [catalog, now, species]);
  const owned = useMemo(() => ownedIds(inventory, toys), [inventory, toys]);
  const dealId = day ? shownDeal(day.dealId, day.picks, owned) : null;
  const picks = day ? shownPicks(day.picks, owned) : [];
  const quote = useMemo(() => {
    if (!catalog || !day) {
      return null;
    }
    return priceCart(
      catalog,
      cart.map(({ id, kind, qty }) => ({ id, kind, qty })),
      dealId,
      owned,
      species,
      Number.MAX_SAFE_INTEGER,
    );
  }, [cart, catalog, day, dealId, owned, species]);

  useEffect(() => {
    void refreshShopCatalog().then((ok) => {
      if (ok) {
        setNow(Date.now());
      }
    });
  }, []);

  useEffect(() => {
    if (catalog) {
      return;
    }
    const timer = setInterval(() => {
      void refreshShopCatalog().then((ok) => {
        if (ok) {
          setNow(Date.now());
        }
      });
    }, 8000);
    return () => clearInterval(timer);
  }, [catalog]);

  useEffect(() => {
    const wait = Math.max(0, nextLocalMidnight(localDay(now)) - Date.now()) + 40;
    const timer = setTimeout(() => setNow(Date.now()), wait);
    return () => clearTimeout(timer);
  }, [now]);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const date = day?.date ?? null;
    if (!dealReady.current) {
      dealReady.current = true;
      dealRef.current = dealId;
      dayRef.current = date;
      return;
    }
    const previous = dealRef.current;
    const dayChanged = dayRef.current != null && date != null && date !== dayRef.current;
    if (dayChanged && previous && cart.some((row) => row.kind === 'item' && row.id === previous)) {
      setNote("Today's deal ended. Price updated.");
      setSheet(true);
    }
    dealRef.current = dealId;
    dayRef.current = date;
  }, [cart, day?.date, dealId]);

  const wearing = useMemo(() => tryOn(catalog, cart), [cart, catalog]);
  const equipped = useMemo(() => {
    const next: Equipped = { ...pet.equipped };
    if (!catalog) {
      return next;
    }
    for (const [slot, itemId] of wearing) {
      const item = findItem(catalog, itemId);
      if (item?.wearId) {
        next[slot] = item.wearId;
      }
    }
    return next;
  }, [catalog, pet.equipped, wearing]);

  useEffect(() => {
    if (!celebration) {
      celebrateSpin.value = 0;
      celebrateDrop.value = 0;
      return;
    }
    if (reducedMotion) {
      return;
    }
    celebrateSpin.value = withRepeat(withTiming(360, { duration: 1300, easing: Easing.inOut(Easing.ease) }), -1, false);
    celebrateDrop.value = withRepeat(
      withSequence(
        withTiming(-22, { duration: 650, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 650, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [celebrateDrop, celebrateSpin, celebration, reducedMotion]);

  const coinStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: celebrateDrop.value }, { perspective: 400 }],
  }));

  const cartCount = cart.reduce((sum, row) => sum + row.qty, 0);
  const charge = quote?.ok ? quote.charge : 0;
  const short = Math.max(0, charge - balance);
  const canBuy = !!quote?.ok && cart.length > 0 && short === 0 && !busy;
  const today = localDay(clock);
  const bundle = catalog ? featuredBundle(catalog, today) : null;
  const grid = catalog ? tabItems(catalog, tab, species) : [];
  const remain = day ? nextLocalMidnight(day.date) - clock : 0;
  const tabMeta = tabs.find((entry) => entry.id === tab) ?? tabs[0];

  const add = (id: string, kind: CartRow['kind']) => {
    setCart((rows) => {
      const existing = rows.find((row) => row.id === id && row.kind === kind);
      if (existing && kind === 'item') {
        const item = catalog ? findItem(catalog, id) : null;
        if (item && !item.stackable) {
          return rows;
        }
      }
      if (existing) {
        return rows.map((row) => (row === existing ? { ...row, qty: row.qty + 1, addedAt: Date.now() } : row));
      }
      return [...rows, { id, kind, qty: 1, addedAt: Date.now() }];
    });
  };
  const remove = (id: string, kind: CartRow['kind']) => {
    setCart((rows) => rows.filter((row) => !(row.id === id && row.kind === kind)));
  };
  const setQty = (id: string, kind: CartRow['kind'], qty: number) => {
    if (qty < 1) {
      remove(id, kind);
      return;
    }
    setCart((rows) => rows.map((row) => (row.id === id && row.kind === kind ? { ...row, qty } : row)));
  };

  const buy = () => {
    if (!canBuy) {
      return;
    }
    setBusy(true);
    const result = purchaseCart(
      cart.map(({ id, kind, qty }) => ({ id, kind, qty })),
      newRequestId(),
      species,
    );
    setBusy(false);
    if (!result.ok || result.charge == null || !result.lines) {
      return;
    }
    setCart([]);
    setSheet(false);
    setCelebration({
      charge: result.charge,
      closet: !!result.includesClothes,
      lines: result.lines.map((line) => ({ name: line.qty > 1 ? `${line.name} ×${line.qty}` : line.name, place: line.place })),
    });
    playVoice({ actorId: pet.id, sound: species === 'cat' ? 'meow' : 'bark', rate: 1 });
    playBloop(0);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onClose} style={styles.backHit}>
          {({ pressed }) => (
            <Glossy variant="white" pressed={pressed} style={styles.backFace}>
              <ChevronLeft size={22} strokeWidth={2.8} color={shop.inkStrong} />
            </Glossy>
          )}
        </Pressable>
        <Text style={styles.title} pointerEvents="none">
          Pet Shop
        </Text>
        <Glossy variant="white" style={styles.pill}>
          <StillCoin size={28} />
          <Text style={styles.pillText}>{money(balance)}</Text>
        </Glossy>
      </View>
      {!catalog || !day ? (
        <View style={styles.closed}>
          <Text style={styles.closedTitle}>The shop is opening soon!</Text>
          <Text style={styles.closedBody}>Connect to the internet to visit.</Text>
        </View>
      ) : (
        <>
          <ShopStage
            pet={pet}
            equipped={equipped}
            reducedMotion={reducedMotion}
            width={stageWidthPx}
          />
          <ScrollView stickyHeaderIndices={[2]} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Animated.View key={day.date} entering={reducedMotion ? undefined : FadeIn.duration(280)} style={styles.picks}>
              <View style={styles.picksHead}>
                <Text style={styles.section}>{"Today's picks"}</Text>
                <Glossy variant="white" ledge={2} style={styles.countChip}>
                  <Clock size={14} strokeWidth={2.6} color={shop.inkAccent} />
                  <Text style={styles.countText}>{countdownLabel(remain)}</Text>
                </Glossy>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickRow}>
                {picks.map((pick) => {
                  const item = findItem(catalog, pick.itemId);
                  if (!item || !fitsSpecies(item.species, species)) {
                    return null;
                  }
                  return (
                    <ShopCard
                      key={pick.itemId}
                      item={item}
                      catalog={catalog}
                      deal={item.id === dealId}
                      fresh={isNewItem(item, today)}
                      owned={owned.has(item.id)}
                      row={cart.find((entry) => entry.kind === 'item' && entry.id === item.id) ?? null}
                      wearing={wearingHas(wearing, item.id)}
                      width={142}
                      butter
                      onAdd={() => add(item.id, 'item')}
                      onRemove={() => remove(item.id, 'item')}
                      onQty={(qty) => setQty(item.id, 'item', qty)}
                    />
                  );
                })}
              </ScrollView>
            </Animated.View>
            {bundle ? (
              <BundleCard
                name={bundle.name}
                description={bundle.description}
                price={bundle.price}
                was={contentsValue(bundle, catalog.items)}
                percent={savePercent(bundle.price, contentsValue(bundle, catalog.items))}
                qty={cart.find((row) => row.kind === 'bundle' && row.id === bundle.id)?.qty ?? 0}
                catalog={catalog}
                onAdd={() => add(bundle.id, 'bundle')}
                onQty={(qty) => setQty(bundle.id, 'bundle', qty)}
              />
            ) : (
              <View />
            )}
            <View style={styles.tabsSticky}>
              <View style={styles.tabRow}>
                {tabs.map((entry) => {
                  const on = entry.id === tab;
                  return (
                    <Pressable
                      key={entry.id}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: on }}
                      onPress={() => setTab(entry.id)}
                      style={styles.tabHit}
                    >
                      {({ pressed }) => (
                        <Glossy variant={on ? 'pink' : 'white'} pressed={pressed} style={styles.tabFace}>
                          <Text style={[styles.tabText, { color: glossInk[on ? 'pink' : 'white'] }]}>{entry.label}</Text>
                        </Glossy>
                      )}
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.tabTitle}>
                <Text style={styles.section}>{tabMeta.title}</Text>
                <Text style={styles.tabNote}>{tabMeta.note}</Text>
              </View>
            </View>
            <View style={styles.grid}>
              {grid.map((item) => (
                <ShopCard
                  key={item.id}
                  item={item}
                  catalog={catalog}
                  deal={item.id === dealId}
                  fresh={isNewItem(item, today)}
                  owned={!item.stackable && owned.has(item.id)}
                  row={cart.find((entry) => entry.kind === 'item' && entry.id === item.id) ?? null}
                  wearing={wearingHas(wearing, item.id)}
                  width={cardWidth}
                  onAdd={() => add(item.id, 'item')}
                  onRemove={() => remove(item.id, 'item')}
                  onQty={(qty) => setQty(item.id, 'item', qty)}
                />
              ))}
            </View>
          </ScrollView>
        </>
      )}
      {cart.length > 0 && !sheet && !celebration ? (
        <CartBar
          count={cartCount}
          charge={charge}
          reducedMotion={reducedMotion}
          onOpen={() => setSheet(true)}
        />
      ) : null}
      {sheet && quote?.ok && catalog ? (
        <CartSheet
          catalog={catalog}
          quote={quote}
          balance={balance}
          short={short}
          note={note}
          busy={busy}
          canBuy={canBuy}
          petName={pet.name}
          reducedMotion={reducedMotion}
          maxHeight={screenH * 0.7}
          onClose={() => setSheet(false)}
          onRemove={remove}
          onQty={setQty}
          onBuy={buy}
        />
      ) : null}
      {celebration ? (
        <View style={styles.celebrate}>
          <Animated.View style={coinStyle} entering={reducedMotion ? FadeIn.duration(180) : FadeIn.duration(350)}>
            <PawCoin size={110} spinAngle={celebrateSpin} shine shineMs={1300} />
          </Animated.View>
          <Text style={styles.yay}>Yay! {pet.name} loves it!</Text>
          <Text style={styles.debit}>−{money(celebration.charge)} Boops</Text>
          <View style={styles.grantList}>
            {celebration.lines.map((line) => (
              <View key={`${line.name}${line.place}`} style={styles.grantPill}>
                <View style={styles.grantLedge} />
                <Text style={styles.grant}>
                  {line.name} → {line.place}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.celebrateButtons}>
            <Pressable accessibilityRole="button" accessibilityLabel="Keep shopping" onPress={() => setCelebration(null)} style={styles.celebrateHit}>
              {({ pressed }) => (
                <Glossy variant="mint" pressed={pressed} style={styles.celebrateFace}>
                  <Text style={[styles.celebrateText, { color: shop.onMint }]}>Keep shopping</Text>
                </Glossy>
              )}
            </Pressable>
            {celebration.closet ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Open Closet" onPress={onOpenCloset} style={styles.celebrateHit}>
                {({ pressed }) => (
                  <Glossy variant="white" pressed={pressed} style={styles.celebrateFace}>
                    <Text style={[styles.celebrateText, { color: shop.inkStrong }]}>Open Closet</Text>
                  </Glossy>
                )}
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function ShopCard({
  item,
  catalog,
  deal,
  fresh,
  owned,
  row,
  wearing,
  width,
  butter,
  onAdd,
  onRemove,
  onQty,
}: {
  item: ShopListing;
  catalog: ShopCatalog;
  deal: boolean;
  fresh: boolean;
  owned: boolean;
  row: CartRow | null;
  wearing: boolean;
  width: number;
  butter?: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onQty: (qty: number) => void;
}) {
  const soon = item.shop === 'coming_soon';
  const price = item.price == null ? null : deal ? discounted(item.price, catalog.dealPct) : item.price;
  const clothes = item.category === 'clothes';
  return (
    <View style={[styles.cardSlot, { width }]}>
      <LedgeCard
        face={butter ? shop.butter : shop.surface}
        ledge={butter ? shop.butterLedge : shop.cardLedge}
        radius={shopRadius.card}
        style={[styles.card, butter && styles.cardCenter]}
      >
        {butter ? (
          <ItemArt itemId={item.id} catalog={catalog} size={64} soon={soon} />
        ) : (
          <View style={styles.well}>
            <ItemArt itemId={item.id} catalog={catalog} size={64} soon={soon} />
          </View>
        )}
        <Text style={[styles.name, butter && styles.centered]}>{item.name}</Text>
        {item.description && !butter ? <Text style={styles.desc}>{item.description}</Text> : null}
        {deal && item.price != null ? (
          <Text style={[styles.dealLine, butter && styles.centered]}>
            Deal of the day · <Text style={styles.struck}>{money(item.price)}</Text>
          </Text>
        ) : null}
        {!soon && !owned && price != null ? (
          <View style={[styles.priceRow, butter && styles.priceCenter]}>
            <StillCoin size={16} />
            <Text style={[styles.price, butter && styles.pricePick]}>{money(price)}</Text>
          </View>
        ) : null}
        <View style={styles.spacer} />
        <CardAction
          soon={soon}
          owned={owned}
          row={row}
          wearing={wearing}
          stackable={item.stackable}
          clothes={clothes}
          name={item.name}
          onAdd={onAdd}
          onRemove={onRemove}
          onQty={onQty}
        />
      </LedgeCard>
      {fresh ? (
        <View style={styles.newBadge}>
          <Text style={styles.newText}>NEW</Text>
        </View>
      ) : null}
      {deal && price != null ? (
        <View style={styles.dealBadge}>
          <Glossy variant="gold" ledge={2} style={styles.dealFace}>
            <Text style={styles.dealText}>DEAL −{catalog.dealPct}%</Text>
          </Glossy>
        </View>
      ) : null}
    </View>
  );
}

function CardAction({
  soon,
  owned,
  row,
  wearing,
  stackable,
  clothes,
  name,
  onAdd,
  onRemove,
  onQty,
}: {
  soon: boolean;
  owned: boolean;
  row: CartRow | null;
  wearing: boolean;
  stackable: boolean;
  clothes: boolean;
  name: string;
  onAdd: () => void;
  onRemove: () => void;
  onQty: (qty: number) => void;
}) {
  if (soon) {
    return (
      <View style={[styles.flatPill, { backgroundColor: shop.soonBg }]}>
        <Text style={[styles.flatText, { color: shop.soonText }]}>Coming soon</Text>
      </View>
    );
  }
  if (owned) {
    return (
      <View style={[styles.flatPill, { backgroundColor: shop.lavender }]}>
        <Check size={16} strokeWidth={3} color={shop.onLavender} />
        <Text style={[styles.flatText, { color: shop.onLavender }]}>Owned</Text>
      </View>
    );
  }
  if (row && stackable) {
    return <Stepper qty={row.qty} onChange={onQty} />;
  }
  if (row) {
    const label = wearing ? 'Wearing' : 'In cart';
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onRemove} style={styles.full}>
        {({ pressed }) => (
          <Glossy variant="pink" pressed={pressed} style={styles.action}>
            <Check size={16} strokeWidth={3} color={shop.onPink} />
            <Text style={[styles.button, { color: shop.onPink }]}>{label}</Text>
          </Glossy>
        )}
      </Pressable>
    );
  }
  const label = clothes ? 'Try on' : 'Add';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} ${name}`} onPress={onAdd} style={styles.full}>
      {({ pressed }) => (
        <Glossy variant="mint" pressed={pressed} style={styles.action}>
          <Text style={[styles.button, { color: shop.onMint }]}>{label}</Text>
        </Glossy>
      )}
    </Pressable>
  );
}

function BundleCard({
  name,
  description,
  price,
  was,
  percent,
  qty,
  catalog,
  onAdd,
  onQty,
}: {
  name: string;
  description?: string;
  price: number;
  was: number;
  percent: number;
  qty: number;
  catalog: ShopCatalog;
  onAdd: () => void;
  onQty: (qty: number) => void;
}) {
  return (
    <View style={styles.bundleWrap}>
      <LedgeCard face={shop.lavender} ledge={shop.lavenderLedge} radius={shopRadius.bundle} style={styles.bundle}>
        <View style={styles.bundleArt}>
          <ItemArt itemId="biscuit" catalog={catalog} size={68} />
        </View>
        <View style={styles.bundleText}>
          <Text style={styles.bundleLabel}>BUNDLE</Text>
          <Text style={styles.bundleName}>{name}</Text>
          {description ? <Text style={styles.bundleBody}>{description}</Text> : null}
          <View style={styles.bundleBottom}>
            <StillCoin size={18} />
            <Text style={styles.bundlePrice}>{money(price)}</Text>
            <Text style={styles.bundleWas}>{money(was)}</Text>
            <View style={styles.spacer} />
            {qty > 0 ? (
              <Stepper qty={qty} onChange={onQty} compact />
            ) : (
              <Pressable accessibilityRole="button" accessibilityLabel={`Add ${name}`} onPress={onAdd}>
                {({ pressed }) => (
                  <Glossy variant="mint" pressed={pressed} style={styles.bundleAdd}>
                    <Text style={[styles.button, { color: shop.onMint }]}>Add</Text>
                  </Glossy>
                )}
              </Pressable>
            )}
          </View>
        </View>
      </LedgeCard>
      <View style={styles.save}>
        <Text style={styles.saveText}>Save {percent}%</Text>
      </View>
    </View>
  );
}

function Stepper({ qty, onChange, compact }: { qty: number; onChange: (qty: number) => void; compact?: boolean }) {
  return (
    <View style={[styles.stepper, compact && styles.stepperCompact]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Less" onPress={() => onChange(qty - 1)}>
        {({ pressed }) => (
          <Glossy variant="white" pressed={pressed} style={styles.step}>
            <Minus size={18} strokeWidth={3} color={shop.inkStrong} />
          </Glossy>
        )}
      </Pressable>
      <Text style={styles.stepQty}>{qty}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="More" onPress={() => onChange(qty + 1)}>
        {({ pressed }) => (
          <Glossy variant="mint" pressed={pressed} style={styles.step}>
            <Plus size={18} strokeWidth={3} color={shop.onMint} />
          </Glossy>
        )}
      </Pressable>
    </View>
  );
}

function CartBar({
  count,
  charge,
  reducedMotion,
  onOpen,
}: {
  count: number;
  charge: number;
  reducedMotion: boolean;
  onOpen: () => void;
}) {
  const scale = useSharedValue(reducedMotion ? 1 : 0.6);
  const opacity = useSharedValue(reducedMotion ? 1 : 0);
  const bump = useSharedValue(1);
  const seen = useRef(count);
  useEffect(() => {
    opacity.value = withTiming(1, { duration: reducedMotion ? 180 : 200 });
    scale.value = reducedMotion
      ? 1
      : withSequence(
          withTiming(1.08, { duration: 220, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: 130, easing: Easing.out(Easing.cubic) }),
        );
  }, [opacity, reducedMotion, scale]);
  useEffect(() => {
    if (seen.current !== count && !reducedMotion) {
      bump.value = withSequence(withTiming(1.06, { duration: 90 }), withTiming(1, { duration: 90 }));
    }
    seen.current = count;
  }, [bump, count, reducedMotion]);
  const barStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value * bump.value }],
  }));
  return (
    <Animated.View style={[styles.cartBar, barStyle]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Open cart" onPress={onOpen}>
        {({ pressed }) => (
          <Glossy variant="pink" pressed={pressed} highlight ledge={4} style={styles.cartFace}>
            <ShoppingBag size={26} strokeWidth={2.4} color={shop.onPink} />
            <Text style={styles.cartCount}>
              {count} {count === 1 ? 'item' : 'items'}
            </Text>
            <View style={styles.spacer} />
            <Glossy variant="white" ledge={2} ledgeColor={shop.pinkLedge} style={styles.totalPill}>
              <StillCoin size={18} />
              <Text style={styles.totalText}>{money(charge)}</Text>
            </Glossy>
          </Glossy>
        )}
      </Pressable>
    </Animated.View>
  );
}

function CartSheet({
  catalog,
  quote,
  balance,
  short,
  note,
  busy,
  canBuy,
  petName,
  reducedMotion,
  maxHeight,
  onClose,
  onRemove,
  onQty,
  onBuy,
}: {
  catalog: ShopCatalog;
  quote: Extract<ReturnType<typeof priceCart>, { ok: true }>;
  balance: number;
  short: number;
  note: string | null;
  busy: boolean;
  canBuy: boolean;
  petName: string;
  reducedMotion: boolean;
  maxHeight: number;
  onClose: () => void;
  onRemove: (id: string, kind: CartRow['kind']) => void;
  onQty: (id: string, kind: CartRow['kind'], qty: number) => void;
  onBuy: () => void;
}) {
  const drag = useSharedValue(0);
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
  return (
    <View style={styles.sheetLayer}>
      <Pressable accessibilityLabel="Close cart" style={styles.dim} onPress={onClose} />
      <Animated.View
        entering={reducedMotion ? FadeIn.duration(180) : SlideInDown.duration(250)}
        style={[styles.sheet, { maxHeight }, sheetStyle]}
      >
        <GestureDetector gesture={pan}>
          <View>
            <View style={styles.handle} />
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Your cart</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose}>
                {({ pressed }) => (
                  <View style={[styles.close, pressed && styles.closePressed]}>
                    <X size={18} strokeWidth={3} color={shop.inkStrong} />
                  </View>
                )}
              </Pressable>
            </View>
          </View>
        </GestureDetector>
        <ScrollView contentContainerStyle={styles.sheetScroll} showsVerticalScrollIndicator={false}>
          {quote.lines.map((line) => (
            <View key={`${line.kind}${line.id}`} style={styles.line}>
              <View style={styles.lineArt}>
                <ItemArt itemId={line.kind === 'bundle' ? 'biscuit' : line.id} catalog={catalog} size={42} />
              </View>
              <View style={styles.lineText}>
                <Text style={styles.lineName}>{line.name}</Text>
                <Text style={styles.lineMeta}>{placeLine(line.place)}</Text>
              </View>
              {lineIsStackable(catalog, line) ? (
                <Stepper qty={line.qty} onChange={(qty) => onQty(line.id, line.kind, qty)} compact />
              ) : (
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${line.name}`} onPress={() => onRemove(line.id, line.kind)}>
                  <View style={styles.removePill}>
                    <Text style={styles.remove}>Remove</Text>
                  </View>
                </Pressable>
              )}
              <Text style={styles.lineTotal}>{money(line.lineTotal)}</Text>
            </View>
          ))}
          {note ? (
            <View style={styles.notePill}>
              <Text style={styles.note}>{note}</Text>
            </View>
          ) : null}
          <View style={styles.summary}>
            <Text style={styles.summaryTotal}>Total {money(quote.charge)} Boops</Text>
            <Text style={styles.summaryLine}>You have {money(balance)}</Text>
            <Text style={styles.summaryLine}>After checkout {money(Math.max(0, balance - quote.charge))}</Text>
          </View>
          {short > 0 ? (
            <View style={styles.warn}>
              <Text style={styles.warnText}>
                You need {money(short)} more Boops. Play with {petName} to earn more!
              </Text>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Buy for ${quote.charge} Boops`}
            disabled={!canBuy}
            onPress={onBuy}
            style={!canBuy && styles.dimBuy}
          >
            {({ pressed }) => (
              <Glossy variant="gold" pressed={pressed && canBuy} highlight ledge={4} style={styles.buy}>
                <Text style={styles.buyText}>{busy ? '...' : `Buy for ${money(quote.charge)} Boops`}</Text>
              </Glossy>
            )}
          </Pressable>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: shop.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  backHit: { width: 44, height: 44 },
  backFace: { width: 44, height: 44 },
  title: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 62,
    textAlign: 'center',
    fontFamily: fontFamily.fredokaBold,
    fontSize: 26,
    color: shop.inkStrong,
  },
  pill: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6, paddingRight: 14 },
  pillText: { fontFamily: fontFamily.black, fontSize: 16, color: shop.onGold },
  closed: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  closedTitle: { fontFamily: fontFamily.fredokaBold, fontSize: 26, color: shop.inkStrong, textAlign: 'center' },
  closedBody: { fontFamily: fontFamily.bold, fontSize: 16, color: shop.inkMuted, textAlign: 'center' },
  scroll: { paddingTop: 16, paddingBottom: 120, gap: 18 },
  picks: { gap: 0 },
  picksHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 8,
  },
  section: { fontFamily: fontFamily.fredokaSemibold, fontSize: 20, color: shop.inkStrong },
  countChip: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10 },
  countText: { fontFamily: fontFamily.extraBold, fontSize: 12, color: shop.inkAccent },
  pickRow: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  tabsSticky: { backgroundColor: shop.bg, paddingTop: 12, paddingBottom: 10, gap: 10 },
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  tabHit: { flex: 1 },
  tabFace: { minHeight: 44, width: '100%' },
  tabText: { fontFamily: fontFamily.black, fontSize: 14 },
  tabTitle: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 8,
  },
  tabNote: { fontFamily: fontFamily.extraBold, fontSize: 12, color: shop.inkMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, marginTop: 4 },
  cardSlot: { overflow: 'visible' },
  card: { padding: 12, gap: 6 },
  cardCenter: { alignItems: 'center' },
  well: {
    height: 76,
    borderRadius: shopRadius.well,
    backgroundColor: shop.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontFamily: fontFamily.extraBold, fontSize: 14, color: shop.ink },
  centered: { textAlign: 'center' },
  desc: { fontFamily: fontFamily.bold, fontSize: 12, lineHeight: 15, color: shop.inkMuted },
  dealLine: { fontFamily: fontFamily.extraBold, fontSize: 12, color: shop.butterInk },
  struck: { textDecorationLine: 'line-through' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  priceCenter: { alignSelf: 'center' },
  price: { fontFamily: fontFamily.black, fontSize: 15, color: shop.onGold },
  pricePick: { fontSize: 14 },
  spacer: { flex: 1 },
  action: { minHeight: 44, width: '100%', flexDirection: 'row', gap: 6, paddingHorizontal: 12 },
  button: { fontFamily: fontFamily.black, fontSize: 15 },
  full: { width: '100%' },
  flatPill: {
    width: '100%',
    minHeight: 44,
    borderRadius: shopRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  flatText: { fontFamily: fontFamily.extraBold, fontSize: 14 },
  newBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 2,
    backgroundColor: shop.pink,
    borderRadius: shopRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  newText: { fontFamily: fontFamily.black, fontSize: 10, letterSpacing: 0.6, color: shop.onPink },
  dealBadge: { position: 'absolute', top: -8, right: -4, zIndex: 3, transform: [{ rotate: '6deg' }] },
  dealFace: { paddingHorizontal: 10, paddingVertical: 5 },
  dealText: { fontFamily: fontFamily.black, fontSize: 11, letterSpacing: 0.4, color: shop.onGold },
  bundleWrap: { marginHorizontal: 16 },
  bundle: { flexDirection: 'row', gap: 12, padding: 14 },
  bundleArt: {
    width: 84,
    height: 84,
    borderRadius: 20,
    backgroundColor: shop.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bundleText: { flex: 1, gap: 2 },
  bundleLabel: { fontFamily: fontFamily.black, fontSize: 11, letterSpacing: 0.8, color: shop.bundleLabel },
  bundleName: { fontFamily: fontFamily.fredokaSemibold, fontSize: 19, color: shop.bundleTitle },
  bundleBody: { fontFamily: fontFamily.bold, fontSize: 13, color: shop.bundleBody },
  bundleBottom: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  bundlePrice: { fontFamily: fontFamily.black, fontSize: 16, color: shop.onGold },
  bundleWas: { fontFamily: fontFamily.extraBold, fontSize: 13, color: shop.struck, textDecorationLine: 'line-through' },
  bundleAdd: { minHeight: 44, paddingHorizontal: 18 },
  save: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    backgroundColor: shop.pink,
    borderRadius: shopRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  saveText: { fontFamily: fontFamily.black, fontSize: 11, color: shop.onPink },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepperCompact: { width: 'auto', gap: 4, justifyContent: 'center' },
  step: { width: 44, height: 44 },
  stepQty: { fontFamily: fontFamily.black, fontSize: 17, color: shop.inkStrong, minWidth: 18, textAlign: 'center' },
  cartBar: { position: 'absolute', left: 16, right: 16, bottom: 34 },
  cartFace: {
    minHeight: 62,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingLeft: 18,
    paddingRight: 10,
    gap: 8,
  },
  cartCount: { fontFamily: fontFamily.black, fontSize: 16, color: shop.onPink },
  totalPill: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12 },
  totalText: { fontFamily: fontFamily.black, fontSize: 16, color: shop.onGold },
  sheetLayer: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end', zIndex: 5 },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: shop.scrim },
  sheet: {
    backgroundColor: shop.surface,
    borderTopLeftRadius: shopRadius.sheet,
    borderTopRightRadius: shopRadius.sheet,
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 24,
    gap: 14,
  },
  sheetScroll: { gap: 14, paddingBottom: 12 },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: shop.pinkLine, marginBottom: 8 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontFamily: fontFamily.fredokaBold, fontSize: 22, color: shop.inkStrong },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: shop.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePressed: { opacity: 0.7 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: shop.bg,
    borderRadius: shopRadius.line,
    padding: 8,
  },
  lineArt: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: shop.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineText: { flex: 1, gap: 2 },
  lineName: { fontFamily: fontFamily.extraBold, fontSize: 14, color: shop.ink },
  lineMeta: { fontFamily: fontFamily.bold, fontSize: 12, color: shop.inkMuted },
  lineTotal: { width: 52, textAlign: 'right', fontFamily: fontFamily.black, fontSize: 14, color: shop.onGold },
  removePill: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  remove: { fontFamily: fontFamily.extraBold, fontSize: 13, color: shop.inkAccent },
  notePill: { alignSelf: 'flex-start', backgroundColor: shop.butter, borderRadius: shopRadius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  note: { fontFamily: fontFamily.bold, fontSize: 13, color: shop.butterInk },
  summary: { backgroundColor: shop.butter, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, gap: 6 },
  summaryTotal: { fontFamily: fontFamily.black, fontSize: 16, color: shop.onGold },
  summaryLine: { fontFamily: fontFamily.bold, fontSize: 13, color: shop.butterInk },
  warn: { backgroundColor: shop.warnBg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  warnText: { fontFamily: fontFamily.extraBold, fontSize: 13, color: shop.warnText, textAlign: 'center' },
  buy: { minHeight: 60, width: '100%' },
  buyText: { fontFamily: fontFamily.fredokaBold, fontSize: 20, color: shop.onGold },
  dimBuy: { opacity: 0.5 },
  celebrate: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,244,250,0.97)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 14,
    zIndex: 6,
  },
  yay: { fontFamily: fontFamily.fredokaBold, fontSize: 30, color: shop.inkStrong, textAlign: 'center' },
  debit: { fontFamily: fontFamily.black, fontSize: 16, color: shop.inkAccent },
  grantList: { gap: 6, maxWidth: 280, alignItems: 'center' },
  grantPill: { borderRadius: 14, backgroundColor: shop.surface, paddingBottom: 2 },
  grantLedge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 14,
    borderRadius: 14,
    backgroundColor: shop.pinkLine,
  },
  grant: { fontFamily: fontFamily.extraBold, fontSize: 14, color: shop.ink, paddingHorizontal: 14, paddingVertical: 10 },
  celebrateButtons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  celebrateHit: { flexGrow: 1 },
  celebrateFace: { minHeight: 52, paddingHorizontal: 28 },
  celebrateText: { fontFamily: fontFamily.black, fontSize: 16 },
});
