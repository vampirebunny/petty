import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import type { WearItem } from '../actor/wardrobe';
import { explainRemoteRow, remoteWearItem, setRemotePreview, type RemoteDefRow } from '../economy/remoteDefs';
import type { ShopCatalog } from '../economy/shop';
import { ClosetTile } from '../ui/closet/ClosetTile';
import { OutfitPreview } from '../ui/OutfitPreview';
import { ItemArt } from '../ui/shop/ItemArt';

const look = { coat: '#E7C39A' };

const previews = [
  { label: 'Retriever pup', breedId: 'retriever', ageDays: 16 },
  { label: 'Retriever adult', breedId: 'retriever', ageDays: 400 },
  { label: 'Shorthair kit', breedId: 'domesticShorthair', ageDays: 16 },
  { label: 'Shorthair adult', breedId: 'domesticShorthair', ageDays: 400 },
];

function catalogFor(id: string, name: string, wear: WearItem | null): ShopCatalog {
  return {
    version: 0,
    items: [
      {
        id,
        name,
        category: wear ? 'clothes' : 'treats',
        shop: 'always',
        tier: 'standard',
        price: 10,
        sort: 0,
        stackable: !wear,
        slot: wear?.slot,
        wearId: wear?.id,
      },
    ],
    bundles: [],
    pickSlots: ['clothes', 'toys', 'treats_or_boosts'],
    noRepeatDays: 5,
    dealPct: 20,
  };
}

export function DefPreview() {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<RemoteDefRow | null>(null);

  const wear = row ? remoteWearItem(row.id.split(':')[0] as WearItem['slot'], row.id.split(':')[1] ?? '') : null;
  const catalog = useMemo(() => (row ? catalogFor(row.id, row.name ?? row.id, wear) : null), [row, wear]);

  const apply = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setRemotePreview(null);
      setRow(null);
      setError('Def preview: that is not JSON.');
      return;
    }
    const body = parsed as { id?: unknown; name?: unknown; species?: unknown; def?: unknown; min_app_version?: unknown };
    const next: RemoteDefRow = {
      id: typeof body.id === 'string' ? body.id : '',
      name: typeof body.name === 'string' ? body.name : undefined,
      species: Array.isArray(body.species) ? (body.species as RemoteDefRow['species']) : null,
      def: body.def ?? parsed,
      minAppVersion: typeof body.min_app_version === 'string' ? body.min_app_version : null,
    };
    if (!next.id && next.def && typeof next.def === 'object' && next.def && 'slot' in next.def) {
      setError('Def preview: add an id field, like neckwear:sky.');
      setRemotePreview(null);
      setRow(null);
      return;
    }
    const why = explainRemoteRow(next);
    if (why !== 'ok') {
      setRemotePreview(null);
      setRow(null);
      setError(`Def preview: ${why}.`);
      return;
    }
    setRemotePreview(next);
    setRow(next);
    setError(null);
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Def preview</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder='{"id":"neckwear:sky","def":{...}}'
        placeholderTextColor="#8AA"
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
      <Text style={styles.apply} onPress={apply}>
        Check def
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {row && catalog ? (
        <View style={styles.cards}>
          <ItemArt itemId={row.id} catalog={catalog} size={72} />
          {wear ? (
            <View style={styles.tile}>
              <ClosetTile slot={wear.slot} item={wear} worn={false} reducedMotion onPress={() => {}} />
            </View>
          ) : null}
        </View>
      ) : null}
      {wear ? (
        <View style={styles.pets}>
          {previews.map((pet) => (
            <View key={pet.label} style={styles.pet}>
              <Text style={styles.caption}>{pet.label}</Text>
              <OutfitPreview
                breedId={pet.breedId}
                ageDays={pet.ageDays}
                weight={0}
                vitality={1}
                look={look}
                equipped={{ [wear.slot]: wear.id }}
                wearDefs={{ [wear.slot]: wear }}
                width={120}
                height={140}
                t={0}
                bare
              />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 6, paddingVertical: 8 },
  title: { fontSize: 14, color: '#243044' },
  input: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: '#D5DCE6',
    borderRadius: 8,
    padding: 8,
    color: '#243044',
    fontSize: 12,
  },
  apply: { color: '#3A6FD8', fontSize: 14 },
  error: { color: '#A33B4A', fontSize: 12 },
  cards: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tile: { width: 88 },
  pets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pet: { width: 120 },
  caption: { fontSize: 11, color: '#5C6B80' },
});
