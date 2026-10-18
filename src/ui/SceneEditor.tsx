import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

type Props = {
  // The scene as JSON text. When it changes, the editor starts over from it.
  source: string;
  // Returns a plain-language error, or an empty string when the scene loaded.
  onApply: (text: string) => string;
  onReset: () => void;
};

// A scene is plain data. Edit the JSON, apply it, and a mistake is named by the part that needs fixing.
export function SceneEditor({ source, onApply, onReset }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(source);
  const [error, setError] = useState('');

  const [seen, setSeen] = useState(source);
  if (seen !== source) {
    setSeen(source);
    setText(source);
    setError('');
  }

  return (
    <View style={styles.panel}>
      <Pressable onPress={() => setOpen((current) => !current)}>
        <Text style={styles.toggle}>{open ? 'Hide scene data' : 'Scene data'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.body}>
          <Text style={styles.hint}>
            A backdrop, a walkable floor, props, and spots the pet can use (food, water, bed, home). Edit the JSON and
            apply it to try a new scene.
          </Text>
          <TextInput
            style={styles.input}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            value={text}
            onChangeText={setText}
            accessibilityLabel="Scene JSON"
          />
          <View style={styles.actions}>
            <Pressable style={[styles.button, styles.primary]} onPress={() => setError(onApply(text))}>
              <Text style={[styles.buttonLabel, styles.primaryLabel]}>Apply scene</Text>
            </Pressable>
            <Pressable
              style={styles.button}
              onPress={() => {
                setError('');
                onReset();
              }}
            >
              <Text style={styles.buttonLabel}>Reset to preset</Text>
            </Pressable>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderTopWidth: 1,
    borderTopColor: '#E4E8EF',
    paddingTop: 8,
    gap: 4,
  },
  toggle: {
    color: '#5C6B80',
    fontSize: 14,
  },
  body: {
    gap: 8,
  },
  hint: {
    fontSize: 12.5,
    color: '#5C6B80',
  },
  input: {
    minHeight: 220,
    borderWidth: 1,
    borderColor: '#D8DEE4',
    borderRadius: 6,
    padding: 8,
    fontFamily: 'Menlo',
    fontSize: 11,
    color: '#243044',
    backgroundColor: '#fff',
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    backgroundColor: '#E4E8EF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  primary: {
    backgroundColor: '#2f7d5b',
  },
  buttonLabel: {
    fontSize: 13,
    color: '#243044',
  },
  primaryLabel: {
    color: '#fff',
  },
  error: {
    fontSize: 13,
    color: '#B3402F',
  },
});
