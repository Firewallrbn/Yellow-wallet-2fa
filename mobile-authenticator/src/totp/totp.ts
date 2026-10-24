// TOTP (RFC 6238) desde cero. De @noble/hashes solo se usa la primitiva HMAC-SHA1;
// el contador, el empaquetado Big-Endian y el truncamiento dinámico están aquí.

import { hmac } from '@noble/hashes/hmac.js';
import { sha1 } from '@noble/hashes/legacy.js';

import { base32Decode } from './base32';

export const PERIOD = 30;
export const DIGITS = 6;

export interface TotpResult {
  code: string;
  counter: number; // C = floor(UnixTime / 30)
  secondsRemaining: number;
  hmacHex: string; // los 20 bytes de HMAC-SHA1(K, C), para mostrarlos en la sustentación
  offset: number;
}

/** Paso 2: C = ⌊UnixTime / 30⌋ */
export function counterAt(unixSeconds: number): number {
  return Math.floor(unixSeconds / PERIOD);
}

/** Paso 3: C como entero de 8 bytes (64 bits) Big-Endian.
 *  Los operadores de bits de JS son de 32 bits, así que se escribe en dos mitades. */
export function counterToBytes(counter: number): Uint8Array {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, Math.floor(counter / 2 ** 32), false);
  view.setUint32(4, counter >>> 0, false);
  return bytes;
}

/** Pasos 4 y 5: HMAC-SHA1 + truncamiento dinámico. */
export function hotp(key: Uint8Array, counter: number): Omit<TotpResult, 'counter' | 'secondsRemaining'> {
  const hash = hmac(sha1, key, counterToBytes(counter)); // 20 bytes

  const offset = hash[19] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) | // sin el bit de signo -> entero positivo de 31 bits
    (hash[offset + 1] << 16) |
    (hash[offset + 2] << 8) |
    hash[offset + 3];

  const code = (binary % 10 ** DIGITS).toString().padStart(DIGITS, '0');
  const hmacHex = Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('');
  return { code, hmacHex, offset };
}

export function totp(secretBase32: string, unixSeconds = Date.now() / 1000): TotpResult {
  const key = base32Decode(secretBase32); // Paso 1
  const counter = counterAt(unixSeconds);
  return {
    ...hotp(key, counter),
    counter,
    secondsRemaining: PERIOD - Math.floor(unixSeconds % PERIOD),
  };
}
