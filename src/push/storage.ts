import * as SecureStore from "expo-secure-store";

export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  await SecureStore.setItemAsync(key, JSON.stringify(value));
}

export async function removeKey(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}
