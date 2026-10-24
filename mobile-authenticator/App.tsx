import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AccountCard } from './src/components/AccountCard';
import { AddAccountScreen } from './src/screens/AddAccountScreen';
import { loadAccounts, saveAccounts } from './src/storage';
import { colors } from './src/theme';
import type { Account } from './src/totp/otpauth';

/** Reloj local: lo único que la app necesita para generar códigos. Cero red. */
function useUnixTime(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [adding, setAdding] = useState(false);
  const now = useUnixTime();

  useEffect(() => {
    loadAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, []);

  const persist = useCallback((next: Account[]) => {
    setAccounts(next);
    saveAccounts(next).catch((e) => Alert.alert('No se pudo guardar', String(e)));
  }, []);

  const add = (account: Omit<Account, 'id'>) => {
    // Re-escanear la misma cuenta (p. ej. tras regenerar el QR) reemplaza la semilla anterior.
    const rest = accounts.filter((a) => !(a.issuer === account.issuer && a.account === account.account));
    persist([...rest, { ...account, id: `${Date.now()}` }]);
    setAdding(false);
  };

  const confirmDelete = (account: Account) =>
    Alert.alert('Eliminar cuenta', `¿Eliminar ${account.issuer} (${account.account})?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => persist(accounts.filter((a) => a.id !== account.id)) },
    ]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        {adding ? (
          <AddAccountScreen onAdd={add} onCancel={() => setAdding(false)} />
        ) : (
          <>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Authenticator</Text>
                <Text style={styles.subtitle}>TOTP · RFC 6238 · funciona sin conexión</Text>
              </View>
              <Pressable style={styles.addButton} onPress={() => setAdding(true)} accessibilityLabel="Agregar cuenta">
                <Text style={styles.addText}>＋</Text>
              </Pressable>
            </View>

            <FlatList
              data={accounts}
              keyExtractor={(a) => a.id}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => <AccountCard account={item} now={now} onLongPress={() => confirmDelete(item)} />}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>Sin cuentas todavía</Text>
                  <Text style={styles.emptyBody}>
                    Toca ＋ y escanea el QR de “Activar 2FA” en FastPay, o pega la clave Base32.
                  </Text>
                </View>
              }
              ListFooterComponent={
                accounts.length > 0 ? (
                  <Text style={styles.footer}>Toca una tarjeta para ver el cálculo · mantén pulsado para eliminar</Text>
                ) : undefined
              }
            />
          </>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { color: '#fff', fontSize: 22, lineHeight: 24 },
  list: { paddingHorizontal: 20, paddingBottom: 32, gap: 12, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.ink },
  emptyBody: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  footer: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 8 },
});
