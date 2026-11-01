import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { ChevronLeft } from 'lucide-react-native';

import { emptyAwardsCache, readAwardsCache, refreshAwardsCache, type AwardsCache } from '../awards/cache';
import { isRacesEmpty } from '../awards/caseModel';
import { LOOKBOOK_THEMES } from '../awards/ids';
import type { PetState } from '../sim/types';
import { CandyShell, candyInk, tints } from '../ui/candy';
import { fontFamily } from '../ui/font';
import { PhoneColumn } from '../ui/PhoneColumn';
import { iconStroke } from '../ui/theme';
import { isLandscapeSplit, splitColumnWidth, trophyCaseMaxWidth } from '../ui/wideLayout';
import { useOpenedDuoTopInset } from '../ui/useDeviceOrientation';
import { BadgesTab } from '../ui/trophyCase/BadgesTab';
import { RacesTab } from '../ui/trophyCase/RacesTab';
import { RunwayTab } from '../ui/trophyCase/RunwayTab';
import { ThemePage } from '../ui/trophyCase/ThemePage';
import { caseTokens } from '../ui/trophyCase/tokens';

export type TrophyCaseTab = 'races' | 'runway' | 'badges';

type Props = {
  pet: PetState;
  onClose: () => void;
  onStadium: () => void;
  initialTab?: TrophyCaseTab;
};

export function TrophyCaseScreen({ pet, onClose, onStadium, initialTab = 'races' }: Props) {
  const { width, height } = useWindowDimensions();
  const split = isLandscapeSplit(width, height);
  const paneWidth = splitColumnWidth(width, height, trophyCaseMaxWidth) - (split ? 56 : 32);
  const duoTop = useOpenedDuoTopInset();
  const [tab, setTab] = useState<TrophyCaseTab>(initialTab);
  const [themeId, setThemeId] = useState<(typeof LOOKBOOK_THEMES)[number] | null>(null);
  const [cache, setCache] = useState<AwardsCache>(() => {
    try {
      return readAwardsCache(pet.id);
    } catch {
      return emptyAwardsCache();
    }
  });

  useEffect(() => {
    let cancelled = false;
    void refreshAwardsCache(pet.id)
      .then((next) => {
        if (!cancelled) {
          setCache(next);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pet.id]);

  const empty = isRacesEmpty(cache.awards, pet.ribbons);

  return (
    <PhoneColumn backgroundColor={caseTokens.cream} maxWidth={trophyCaseMaxWidth}>
      <View style={[styles.screen, { paddingTop: 64 + duoTop }]}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onClose} style={styles.backHit}>
            {({ pressed }) => (
              <CandyShell tint={tints.sky} radius={22} uid="trophy-case-back" pressed={pressed} style={styles.back}>
                <ChevronLeft color={candyInk(tints.sky)} size={22} strokeWidth={iconStroke} />
              </CandyShell>
            )}
          </Pressable>
          <Text style={styles.title}>Trophy Case</Text>
        </View>
        {themeId ? (
          <ThemePage
            themeId={themeId}
            awards={cache.awards}
            worn={cache.worn}
            themeRack={cache.themeRack}
            onBack={() => setThemeId(null)}
          />
        ) : (
          <>
            <View style={[styles.tabs, split && styles.tabsWide]}>
              {(
                [
                  ['races', 'Races'],
                  ['runway', 'Runway'],
                  ['badges', 'Badges'],
                ] as const
              ).map(([id, label]) => {
                const on = tab === id;
                return (
                  <Pressable
                    key={id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => setTab(id)}
                    style={[styles.tab, on && styles.tabOn]}
                  >
                    <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <ScrollView style={styles.scroll} contentContainerStyle={[styles.body, split && styles.bodyWide]}>
              {tab === 'races' ? (
                <RacesTab
                  petName={pet.name}
                  level={pet.level}
                  awards={cache.awards}
                  progress={cache.progress}
                  leftover={pet.ribbons ?? []}
                  empty={empty}
                  paneWidth={paneWidth}
                  onStadium={onStadium}
                />
              ) : null}
              {tab === 'runway' ? (
                <RunwayTab
                  awards={cache.awards}
                  progress={cache.progress}
                  worn={cache.worn}
                  themeRack={cache.themeRack}
                  paneWidth={paneWidth}
                  onTheme={(id) => setThemeId(id)}
                />
              ) : null}
              {tab === 'badges' ? <BadgesTab pet={pet} paneWidth={paneWidth} /> : null}
            </ScrollView>
          </>
        )}
      </View>
    </PhoneColumn>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: caseTokens.cream,
  },
  header: {
    height: 64,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  backHit: {
    position: 'absolute',
    left: 16,
    top: 10,
    zIndex: 1,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    fontFamily: fontFamily.fredokaBold,
    fontSize: 22,
    color: caseTokens.ink,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#F0E6D6',
    borderRadius: 22,
    padding: 4,
    gap: 4,
  },
  tabsWide: {
    marginHorizontal: 28,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabOn: {
    backgroundColor: caseTokens.purple,
  },
  tabLabel: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 14,
    color: caseTokens.muted,
  },
  tabLabelOn: {
    color: caseTokens.cream,
  },
  scroll: {
    flex: 1,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  bodyWide: {
    paddingHorizontal: 28,
  },
});
