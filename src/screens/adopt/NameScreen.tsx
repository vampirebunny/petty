import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { nameLimit, nameRejectMessage, validateName } from '../../adopt/name';
import type { Breed } from '../../actor/types';
import { archetypeNames } from '../../sim';
import type { Archetype, Look } from '../../sim';
import { PetPreview } from '../../ui/PetPreview';
import { BackButton } from './BackButton';
import { StepIndicator } from './StepIndicator';

type Props = {
  breed: Breed;
  look: Look;
  archetype: Archetype;
  name: string;
  onChangeName: (name: string) => void;
  onBack: () => void;
  onMeet: (name: string) => void;
};

// Step 3: name the pet. The Meet button is the only place the pet is created.
export function NameScreen({ breed, look, archetype, name, onChangeName, onBack, onMeet }: Props) {
  const result = validateName(name);
  const ready = result.ok ? result.name : null;
  const hint =
    name.trim().length > 0 && !result.ok ? nameRejectMessage(result.reason) : null;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <BackButton label="Back to pups" onPress={onBack} />
          <StepIndicator step={3} />
        </View>
        <View style={styles.titles}>
          <Text style={styles.title}>Name your {breed.species === 'cat' ? 'kitten' : 'pup'}</Text>
          <Text style={styles.body}>
            {breed.name} · {archetypeNames[archetype]}
          </Text>
        </View>
        <PetPreview species={breed.species} breedId={breed.id} look={look} height={240} />
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Name</Text>
          <TextInput
            value={name}
            onChangeText={(value) => onChangeName(value.slice(0, nameLimit))}
            maxLength={nameLimit}
            style={styles.input}
            autoCorrect={false}
            autoFocus
            accessibilityLabel="Name"
          />
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          style={[styles.choice, ready == null && styles.disabled]}
          disabled={ready == null}
          onPress={() => {
            if (ready) {
              onMeet(ready);
            }
          }}
          accessibilityRole="button"
        >
          <Text style={styles.choiceLabel}>Meet {ready ?? ''}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F4F7FB',
    paddingTop: 56,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titles: {
    gap: 4,
  },
  title: {
    fontSize: 32,
    color: '#243044',
  },
  body: {
    fontSize: 15,
    color: '#5C6B80',
  },
  group: {
    gap: 8,
  },
  groupTitle: {
    fontSize: 13,
    color: '#5C6B80',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#243044',
  },
  hint: {
    fontSize: 13,
    color: '#B45309',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  choice: {
    backgroundColor: '#243044',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  choiceLabel: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
});
