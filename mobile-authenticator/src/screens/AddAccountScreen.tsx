import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors, mono } from '../theme';
import { isValidBase32 } from '../totp/base32';
import { type Account, parseOtpauthUri } from '../totp/otpauth';

type Mode = 'scan' | 'manual';

interface Props {
  onAdd: (account: Omit<Account, 'id'>) => void;
  onCancel: () => void;
}

export function AddAccountScreen({ onAdd, onCancel }: Props) {
  const [mode, setMode] = useState<Mode>('scan');
  const [error, setError] = useState<string | null>(null);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topBar}>
        <Pressable onPress={onCancel} hitSlop={12}>
          <Text style={styles.link}>Cancelar</Text>
        </Pressable>
        <Text style={styles.title}>Agregar cuenta</Text>
        <View style={{ width: 64 }} />
      </View>

      <View style={styles.segment}>
        {(['scan', 'manual'] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => {
              setMode(m);
              setError(null);
            }}
            style={[styles.segmentItem, mode === m && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>
              {m === 'scan' ? 'Escanear QR' : 'Ingresar clave'}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode === 'scan' ? <Scanner onAdd={onAdd} onError={setError} /> : <ManualEntry onAdd={onAdd} onError={setError} />}

      {error && <Text style={styles.error}>{error}</Text>}
    </KeyboardAvoidingView>
  );
}

function Scanner({ onAdd, onError }: { onAdd: Props['onAdd']; onError: (e: string | null) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);

  if (!permission) return <View style={styles.flex} />;

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.body}>Se necesita la cámara para leer el código QR que muestra la web.</Text>
        <Pressable style={styles.primary} onPress={requestPermission}>
          <Text style={styles.primaryText}>Permitir cámara</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.cameraWrap}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (handled.current) return;
          try {
            const account = parseOtpauthUri(data);
            handled.current = true;
            onError(null);
            onAdd(account);
          } catch (e) {
            onError((e as Error).message);
          }
        }}
      />
      <View style={styles.frame} pointerEvents="none" />
      <Text style={styles.hint}>Apunta al QR de “Activar 2FA”</Text>
    </View>
  );
}

function ManualEntry({ onAdd, onError }: { onAdd: Props['onAdd']; onError: (e: string | null) => void }) {
  const [issuer, setIssuer] = useState('FastPay');
  const [account, setAccount] = useState('');
  const [secret, setSecret] = useState('');

  const submit = () => {
    const clean = secret.replace(/\s/g, '').toUpperCase();
    if (clean.startsWith('OTPAUTH://')) {
      try {
        onAdd(parseOtpauthUri(secret));
      } catch (e) {
        onError((e as Error).message);
      }
      return;
    }
    if (!isValidBase32(clean)) {
      onError('La clave no es Base32 válido (A–Z y 2–7, mínimo 16 caracteres)');
      return;
    }
    onAdd({ issuer: issuer.trim() || 'Sin emisor', account: account.trim() || 'cuenta', secret: clean });
  };

  return (
    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <Field label="Emisor" value={issuer} onChangeText={setIssuer} />
      <Field label="Cuenta" value={account} onChangeText={setAccount} placeholder="demo@fastpay.dev" />
      <Field
        label="Clave secreta (Base32) o URI otpauth://"
        value={secret}
        onChangeText={setSecret}
        placeholder="JBSWY3DPEHPK3PXP…"
        monospace
      />
      <Pressable style={styles.primary} onPress={submit}>
        <Text style={styles.primaryText}>Guardar</Text>
      </Pressable>
    </ScrollView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  monospace?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={colors.muted}
        autoCapitalize={props.monospace ? 'characters' : 'none'}
        autoCorrect={false}
        style={[styles.input, props.monospace && { fontFamily: mono }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: { fontSize: 17, fontWeight: '600', color: colors.ink },
  link: { fontSize: 16, color: colors.ink, width: 64 },
  segment: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: colors.line,
    borderRadius: 12,
    padding: 3,
  },
  segmentItem: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10 },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { fontSize: 14, color: colors.muted, fontWeight: '500' },
  segmentTextActive: { color: colors.ink },
  cameraWrap: {
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: { width: 220, height: 220, borderWidth: 2, borderColor: '#fff', borderRadius: 20 },
  hint: { position: 'absolute', bottom: 24, color: '#fff', fontSize: 14 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 20 },
  body: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 22 },
  form: { paddingHorizontal: 20, gap: 18, paddingBottom: 40 },
  label: { fontSize: 13, color: colors.muted },
  input: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  primary: {
    backgroundColor: colors.ink,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: colors.danger, textAlign: 'center', paddingHorizontal: 20, paddingBottom: 20, fontSize: 14 },
});
