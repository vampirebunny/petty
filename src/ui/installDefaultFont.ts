// Text.js builds its default style the first time it loads. Import this file before that happens.
import { fontFamily } from './font';

type StyleMap = Record<string, Record<string, unknown>>;

type Sheet = {
  create: (styles: StyleMap) => StyleMap;
};

const loaded = (require as unknown as (id: string) => { default?: Sheet } & Partial<Sheet>)(
  'react-native/Libraries/StyleSheet/StyleSheet',
);
const sheet: Sheet = loaded.default?.create != null ? loaded.default : (loaded as Sheet);

if (typeof sheet.create === 'function') {
  const original = sheet.create.bind(sheet);
  sheet.create = (styles) => {
    const keys = Object.keys(styles);
    const only = styles.default;
    if (
      keys.length === 1 &&
      keys[0] === 'default' &&
      only != null &&
      Object.keys(only).length === 1 &&
      only.overflow === 'hidden'
    ) {
      return original({
        default: { ...only, fontFamily: fontFamily.regular },
      });
    }
    return original(styles);
  };
}
