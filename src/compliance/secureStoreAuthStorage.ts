import * as SecureStore from 'expo-secure-store';

const chunkSize = 1800;

const memory = new Map<string, string>();

function safeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

async function secureAvailable(): Promise<boolean> {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

async function readRaw(key: string): Promise<string | null> {
  const storedKey = safeKey(key);
  try {
    if (await secureAvailable()) {
      return await SecureStore.getItemAsync(storedKey);
    }
  } catch {
    return null;
  }
  return memory.get(storedKey) ?? null;
}

async function writeRaw(key: string, value: string): Promise<void> {
  const storedKey = safeKey(key);
  try {
    if (await secureAvailable()) {
      await SecureStore.setItemAsync(storedKey, value);
      return;
    }
  } catch {
    // Fall through to memory when the keychain rejects the write.
  }
  memory.set(storedKey, value);
}

async function deleteRaw(key: string): Promise<void> {
  const storedKey = safeKey(key);
  try {
    if (await secureAvailable()) {
      await SecureStore.deleteItemAsync(storedKey);
    }
  } catch {
    // Already absent.
  }
  memory.delete(storedKey);
}

export const secureStoreAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const countRaw = await readRaw(`${key}.n`);
      const count = countRaw == null ? 0 : Number(countRaw);
      if (!Number.isInteger(count) || count <= 0) {
        return null;
      }
      const parts: string[] = [];
      for (let index = 0; index < count; index += 1) {
        const part = await readRaw(`${key}.${index}`);
        if (part == null) {
          return null;
        }
        parts.push(part);
      }
      return parts.join('');
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    const count = Math.ceil(value.length / chunkSize) || 1;
    const previous = Number((await readRaw(`${key}.n`)) ?? '0');
    await writeRaw(`${key}.n`, String(count));
    for (let index = 0; index < count; index += 1) {
      await writeRaw(`${key}.${index}`, value.slice(index * chunkSize, (index + 1) * chunkSize));
    }
    for (let index = count; index < previous; index += 1) {
      await deleteRaw(`${key}.${index}`);
    }
  },

  async removeItem(key: string): Promise<void> {
    const previous = Number((await readRaw(`${key}.n`)) ?? '0');
    await deleteRaw(`${key}.n`);
    for (let index = 0; index < previous; index += 1) {
      await deleteRaw(`${key}.${index}`);
    }
  },
};
