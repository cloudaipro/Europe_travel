// Keychain-backed SecureStore adapter for iOS.
// Wraps `capacitor-secure-storage-plugin` (Cap 6 compatible, v0.10.0)
// which stores values in the iOS Keychain under the bundle's access group.
// `get`/`remove` throw when the key does not exist — caller treats those as
// soft misses to keep the SecureStore contract null-safe.

import type { SecureStore } from "@tourcompanion/core";
import { SecureStoragePlugin } from "capacitor-secure-storage-plugin";

export const keychainStore: SecureStore = {
  async get(key) {
    try {
      const res = await SecureStoragePlugin.get({ key });
      return res?.value ?? null;
    } catch {
      // Plugin throws on missing key — treat as null.
      return null;
    }
  },
  async set(key, value) {
    await SecureStoragePlugin.set({ key, value });
  },
  async remove(key) {
    try {
      await SecureStoragePlugin.remove({ key });
    } catch {
      // Removing a non-existent key is a no-op for us.
    }
  },
  async clear() {
    try {
      await SecureStoragePlugin.clear();
    } catch {
      // Clearing an empty keychain group throws on some plugin versions.
    }
  },
};
