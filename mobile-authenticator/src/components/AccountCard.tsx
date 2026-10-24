import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, mono } from '../theme';
import type { Account } from '../totp/otpauth';
import { PERIOD, totp } from '../totp/totp';

interface Props {
  account: Account;
  now: number; // segundos Unix con decimales, lo actualiza el reloj de App
  onLongPress: () => void;
}

export function AccountCard({ account, now, onLongPress }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const result = totp(account.secret, now);
  const progress = (now % PERIOD) / PERIOD; // 0 → 1 dentro de la ventana actual
  const urgent = result.secondsRemaining <= 5;

  return (
    <Pressable
      onPress={() => setShowDetails((v) => !v)}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.header}>
        <Text style={styles.issuer}>{account.issuer}</Text>
        <Text style={[styles.seconds, urgent && { color: colors.warn }]}>{result.secondsRemaining}s</Text>
      </View>
      <Text style={styles.account} numberOfLines={1}>
        {account.account}
      </Text>

      <Text style={[styles.code, urgent && { color: colors.warn }]} accessibilityLabel={`Código ${result.code}`}>
        {result.code.slice(0, 3)} {result.code.slice(3)}
      </Text>

      <View style={styles.track}>
        <View style={[styles.bar, { width: `${(1 - progress) * 100}%` }, urgent && { backgroundColor: colors.warn }]} />
      </View>

      {showDetails && (
        <View style={styles.details}>
          <Detail label="C = ⌊t/30⌋" value={String(result.counter)} />
          <Detail label="HMAC-SHA1" value={result.hmacHex} />
          <Detail label="offset" value={`${result.offset} (hash[19] & 0x0f)`} />
          <Detail
            label="bytes"
            value={result.hmacHex.slice(result.offset * 2, result.offset * 2 + 8)}
          />
        </View>
      )}
    </Pressable>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  issuer: { fontSize: 15, fontWeight: '600', color: colors.ink },
  seconds: { fontSize: 13, color: colors.muted, fontVariant: ['tabular-nums'] },
  account: { fontSize: 13, color: colors.muted, marginTop: 2 },
  code: {
    fontFamily: mono,
    fontSize: 46,
    letterSpacing: 4,
    color: colors.ink,
    marginTop: 14,
    marginBottom: 16,
    fontVariant: ['tabular-nums'],
  },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.line, overflow: 'hidden' },
  bar: { height: 4, borderRadius: 2, backgroundColor: colors.ink },
  details: { marginTop: 16, gap: 8 },
  detailRow: { gap: 2 },
  detailLabel: { fontSize: 11, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontFamily: mono, fontSize: 12, color: colors.ink },
});
