import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { Video, X } from 'lucide-react-native';

import { CandyShell, tints } from '../ui/candy';
import { fontFamily } from '../ui/font';

import { track, trackScreen } from '../analytics/analytics';
import { durationOf } from './clips';
import { ClipPlayer } from './ClipPlayer';
import { camReady, dismissCam, markOverlayShown, onPetCam, pendingCam } from './session';
import { markCamSeen, pushCamHistory } from './store';
import type { ClipRecord, RoomId } from './types';

const rooms: Record<RoomId, string> = {
  livingroom: 'LIVING ROOM',
  bedroom: 'BEDROOM',
  catio: 'CATIO',
};

function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function PetCamOverlay() {
  const [record, setRecord] = useState<ClipRecord | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [rise] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(1));
  const [recOn, setRecOn] = useState(true);

  useEffect(() => onPetCam(() => {
    if (!camReady()) {
      if (!pendingCam()) {
        setRecord(null);
        setPlaying(false);
        setEnded(false);
        setElapsed(0);
      }
      return;
    }
    const next = pendingCam();
    setRecord((current) => current ?? next);
  }), []);

  useEffect(() => {
    if (!record) {
      return;
    }
    markOverlayShown();
    markCamSeen();
    pushCamHistory(record);
    trackScreen('petCam');
    track('pet_cam_shown', { clip_id: record.clipId, night: record.isNight ? 1 : 0 });
    rise.setValue(0);
    Animated.spring(rise, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8 }).start();
  }, [record, rise]);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (reduced || !record || playing || ended) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.07, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [ended, playing, pulse, record, reduced]);

  useEffect(() => {
    if (!playing || !record) {
      return;
    }
    let raf = 0;
    let last = Date.now();
    const duration = durationOf(record.clipId);
    const tick = () => {
      const now = Date.now();
      const step = Math.min(0.05, (now - last) / 1000);
      last = now;
      setElapsed((value) => {
        const next = value + step;
        if (next >= duration) {
          setPlaying(false);
          setEnded(true);
          return duration;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, record]);

  useEffect(() => {
    if (!record) {
      return;
    }
    const timer = setInterval(() => setRecOn((value) => !value), 1000);
    return () => clearInterval(timer);
  }, [record]);

  useEffect(() => {
    if (!record) {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      dismissCam();
      setRecord(null);
      return true;
    });
    return () => sub.remove();
  }, [record]);

  if (!record) {
    return null;
  }

  const duration = durationOf(record.clipId);
  const shown = playing ? elapsed : ended ? duration : 0;
  const when = new Date(record.recordedAt + shown * 1000);
  const hud = record.isNight ? '#d8ffd8' : '#ffffff';
  const close = () => {
    dismissCam();
    setRecord(null);
    setPlaying(false);
    setEnded(false);
    setElapsed(0);
  };

  return (
    <View style={styles.scrim}>
      <Animated.View
        style={[
          styles.card,
          {
            opacity: rise,
            transform: [
              { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
              { scale: rise.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
            ],
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.icon}>
            <Video color="#ffffff" size={20} />
          </View>
          <View style={styles.titles}>
            <Text style={styles.title}>Check out your Pet Cam</Text>
            <Text style={styles.subtitle}>while you were away</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} style={styles.close}>
            <X color="#d9c8e4" size={18} />
          </Pressable>
        </View>
        <View style={styles.player}>
          <ClipPlayer record={record} elapsed={shown} reducedMotion={reduced} dimmed={!playing && !ended} />
          <View pointerEvents="none" style={styles.hud}>
            <Text style={[styles.hudText, { color: hud }]}>{`CAM 1 · ${rooms[record.roomId]}`}</Text>
            <View style={styles.recRow}>
              <View style={[styles.dot, { opacity: recOn ? 1 : 0.25 }]} />
              <Text style={[styles.recText, { color: hud }]}>{record.isNight ? 'IR · REC' : 'REC'}</Text>
            </View>
            <Text style={[styles.hudText, styles.hudBottomLeft, { color: hud }]}>{when.toLocaleDateString()}</Text>
            <Text style={[styles.hudText, styles.hudBottomRight, { color: hud }]}>{when.toLocaleTimeString()}</Text>
            <View style={[styles.bracket, styles.bracketNW, { borderColor: hud }]} />
            <View style={[styles.bracket, styles.bracketNE, { borderColor: hud }]} />
            <View style={[styles.bracket, styles.bracketSW, { borderColor: hud }]} />
            <View style={[styles.bracket, styles.bracketSE, { borderColor: hud }]} />
          </View>
          {playing || ended ? null : (
            <Animated.View style={[styles.playWrap, { transform: [{ scale: pulse }] }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Play clip"
                onPress={() => {
                  track('pet_cam_played', { clip_id: record.clipId, night: record.isNight ? 1 : 0 });
                  setElapsed(0);
                  setEnded(false);
                  setPlaying(true);
                }}
                style={styles.play}
              >
                <View style={styles.playTriangle} />
              </Pressable>
            </Animated.View>
          )}
        </View>
        {playing ? (
          <View style={styles.barRow}>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.min(100, (elapsed / duration) * 100)}%` }]} />
            </View>
            <Text style={styles.time}>{`${clock(elapsed)} / ${clock(duration)}`}</Text>
          </View>
        ) : null}
        {ended ? (
          <View style={styles.endRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Watch again"
              onPress={() => {
                setElapsed(0);
                setEnded(false);
                setPlaying(true);
              }}
              style={styles.endHit}
            >
              {({ pressed }) => (
                <CandyShell tint={tints.lilac} radius={18} uid="petcam-again" pressed={pressed} style={styles.endButton}>
                  <Text style={[styles.endLabel, { color: tints.lilac.ink }]}>Watch again</Text>
                </CandyShell>
              )}
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Done" onPress={close} style={styles.endHit}>
              {({ pressed }) => (
                <CandyShell tint={tints.pink} radius={18} uid="petcam-done" pressed={pressed} style={styles.endButton}>
                  <Text style={[styles.endLabel, { color: tints.pink.ink }]}>Done</Text>
                </CandyShell>
              )}
            </Pressable>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(40, 16, 50, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 40,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#211b27',
    borderRadius: 26,
    padding: 14,
    borderWidth: 3,
    borderColor: '#3a2f45',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#e8559f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: {
    flex: 1,
  },
  title: {
    color: '#ffffff',
    fontFamily: fontFamily.fredokaBold,
    fontSize: 19,
  },
  subtitle: {
    color: '#ffaad3',
    fontFamily: fontFamily.bold,
    fontSize: 13,
    marginTop: 2,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3a3043',
    alignItems: 'center',
    justifyContent: 'center',
  },
  player: {
    position: 'relative',
  },
  hud: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  hudText: {
    position: 'absolute',
    top: 8,
    left: 10,
    fontFamily: fontFamily.mono,
    fontSize: 11,
  },
  recRow: {
    position: 'absolute',
    top: 8,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recText: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff3b30',
  },
  hudBottomLeft: {
    top: undefined,
    bottom: 8,
    left: 10,
  },
  hudBottomRight: {
    top: undefined,
    left: undefined,
    bottom: 8,
    right: 10,
  },
  bracket: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderColor: '#fff',
  },
  bracketNW: { top: 6, left: 6, borderTopWidth: 1, borderLeftWidth: 1 },
  bracketNE: { top: 6, right: 6, borderTopWidth: 1, borderRightWidth: 1 },
  bracketSW: { bottom: 6, left: 6, borderBottomWidth: 1, borderLeftWidth: 1 },
  bracketSE: { bottom: 6, right: 6, borderBottomWidth: 1, borderRightWidth: 1 },
  playWrap: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -38,
    marginTop: -38,
  },
  play: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#ff7fbd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playTriangle: {
    width: 0,
    height: 0,
    marginLeft: 6,
    borderTopWidth: 12,
    borderBottomWidth: 12,
    borderLeftWidth: 20,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#ffffff',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 4,
    backgroundColor: '#3a3043',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#b8a2ff',
  },
  time: {
    color: '#bfaeca',
    fontFamily: fontFamily.mono,
    fontSize: 13,
  },
  endRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  endHit: {
    flex: 1,
  },
  endButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endLabel: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 16,
  },
});
