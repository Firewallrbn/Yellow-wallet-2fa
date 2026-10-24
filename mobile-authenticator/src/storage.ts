// Las semillas se guardan en el llavero del sistema (Keychain en iOS) con expo-secure-store.
// No hay red involucrada: todo funciona en modo avión.

import * as SecureStore from 'expo-secure-store';

import type { Account } from './totp/otpauth';

const KEY = 'totp_accounts_v1';

export async function loadAccounts(): Promise<Account[]> {
  const raw = await SecureStore.getItemAsync(KEY);
  return raw ? (JSON.parse(raw) as Account[]) : [];
}

export async function saveAccounts(accounts: Account[]): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(accounts), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}
