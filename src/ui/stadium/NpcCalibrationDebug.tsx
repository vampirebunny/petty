import { isRunningInExpoGo } from 'expo';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getSupabase } from '../../compliance/supabase';

type Sample = { skill: number; metric: number | null };

type Cell = {
  event: string;
  classId: string;
  configVersion: string;
  status: string;
  nRuns: number;
  nPlayers: number;
  metricKind: 'time' | 'distance';
  curve: number[];
  offset: number;
  frozen: boolean;
  manual: boolean;
  soloWinRate: number | null;
  soloCount: number;
  samples: Sample[];
};

function inExpoGo(): boolean {
  try {
    return isRunningInExpoGo();
  } catch {
    return false;
  }
}

function formatMetric(kind: Cell['metricKind'], metric: number | null): string {
  if (metric == null || !Number.isFinite(metric)) return '—';
  if (kind === 'time') return `${(metric / 1000).toFixed(2)}s`;
  return `${(metric / 10).toFixed(1)}m`;
}

function formatRate(rate: number | null, count: number): string {
  if (count === 0 || rate == null) return `${count} solos`;
  return `${Math.round(rate * 100)}% of ${count}`;
}

async function callCalibration(body: Record<string, unknown>): Promise<Cell[]> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }
  const { data, error } = await supabase.functions.invoke('npc_calibrate', { body });
  if (error) {
    const context = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
    const payload = context?.json ? await context.json().catch(() => null) : null;
    throw new Error(payload?.error ?? error.message);
  }
  const payload = data as { cells?: Cell[]; error?: string } | null;
  if (payload?.error) {
    throw new Error(payload.error);
  }
  return payload?.cells ?? [];
}

export function NpcCalibrationDebug() {
  const [open, setOpen] = useState(false);
  const [cells, setCells] = useState<Cell[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    setNote('');
    try {
      setCells(await callCalibration({ action: 'snapshot' }));
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Calibration could not load');
    } finally {
      setBusy(false);
    }
  };

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setNote('');
    try {
      setCells(await callCalibration(body));
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Calibration could not update');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => {
          const next = !open;
          setOpen(next);
          if (next && cells.length === 0) void load();
        }}
      >
        <Text style={styles.toggle}>{open ? 'Hide NPC calibration' : 'NPC calibration'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.body}>
          <Pressable style={styles.button} disabled={busy} onPress={() => void load()}>
            <Text style={styles.buttonLabel}>{busy ? 'Working…' : 'Refresh'}</Text>
          </Pressable>
          {note ? <Text style={styles.note}>{note}</Text> : null}
          {cells.length === 0 && !note ? <Text style={styles.line}>No calibration yet. The nightly job seeds this.</Text> : null}
          <ScrollView style={styles.scroll} nestedScrollEnabled>
            {cells.map((cell) => {
              const id = `${cell.event}|${cell.classId}|${cell.configVersion}`;
              const shown = expanded === id;
              return (
                <View key={id} style={styles.cell}>
                  <Pressable onPress={() => setExpanded(shown ? null : id)}>
                    <Text style={styles.line}>
                      {cell.event} · {cell.classId} · {cell.configVersion}
                    </Text>
                    <Text style={styles.line}>
                      {cell.status} · {cell.nRuns} runs · {cell.nPlayers} players · offset {cell.offset.toFixed(2)}
                      {cell.frozen ? ' · frozen' : ''}
                      {cell.manual ? ' · manual' : ''}
                    </Text>
                    <Text style={styles.line}>solo wins {formatRate(cell.soloWinRate, cell.soloCount)}</Text>
                  </Pressable>
                  {shown ? (
                    <View>
                      <Text style={styles.line}>
                        {cell.samples.map((sample) => `${sample.skill} ${formatMetric(cell.metricKind, sample.metric)}`).join('  ·  ')}
                      </Text>
                      <Text style={styles.curve}>{cell.curve.map((point) => formatMetric(cell.metricKind, point)).join(' ')}</Text>
                      <View style={styles.actions}>
                        <Pressable
                          style={styles.button}
                          disabled={busy}
                          onPress={() =>
                            void act({
                              action: 'freeze',
                              event: cell.event,
                              classId: cell.classId,
                              configVersion: cell.configVersion,
                              frozen: !cell.frozen,
                            })
                          }
                        >
                          <Text style={styles.buttonLabel}>{cell.frozen ? 'Unfreeze' : 'Freeze'}</Text>
                        </Pressable>
                        <Pressable
                          style={styles.button}
                          disabled={busy}
                          onPress={() =>
                            void act({
                              action: 'reset',
                              event: cell.event,
                              classId: cell.classId,
                              configVersion: cell.configVersion,
                            })
                          }
                        >
                          <Text style={styles.buttonLabel}>Reset</Text>
                        </Pressable>
                        <Pressable
                          style={styles.button}
                          disabled={busy}
                          onPress={() =>
                            void act({
                              action: 'offset',
                              event: cell.event,
                              classId: cell.classId,
                              configVersion: cell.configVersion,
                              offset: Math.round((cell.offset - 0.02) * 100) / 100,
                            })
                          }
                        >
                          <Text style={styles.buttonLabel}>Offset −</Text>
                        </Pressable>
                        <Pressable
                          style={styles.button}
                          disabled={busy}
                          onPress={() =>
                            void act({
                              action: 'offset',
                              event: cell.event,
                              classId: cell.classId,
                              configVersion: cell.configVersion,
                              offset: Math.round((cell.offset + 0.02) * 100) / 100,
                            })
                          }
                        >
                          <Text style={styles.buttonLabel}>Offset +</Text>
                        </Pressable>
                        <Pressable
                          style={styles.button}
                          disabled={busy}
                          onPress={() =>
                            void act({
                              action: 'auto',
                              event: cell.event,
                              classId: cell.classId,
                              configVersion: cell.configVersion,
                            })
                          }
                        >
                          <Text style={styles.buttonLabel}>Auto</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

/** The home debug panel is development-only. Stadium shows this inspector in a development build outside Expo Go. */
export function NpcCalibrationStadium() {
  if (typeof __DEV__ === 'undefined' || !__DEV__ || inExpoGo()) return null;
  return <NpcCalibrationDebug />;
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    gap: 4,
  },
  toggle: {
    color: '#5C6B80',
    fontSize: 14,
  },
  body: {
    gap: 6,
  },
  scroll: {
    maxHeight: 360,
  },
  cell: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#E4E8EF',
    gap: 2,
  },
  line: {
    fontSize: 13,
    color: '#243044',
  },
  curve: {
    fontSize: 11,
    color: '#5C6B80',
  },
  note: {
    fontSize: 13,
    color: '#9B3A4A',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  button: {
    backgroundColor: '#E4E8EF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 13,
    color: '#243044',
  },
});
