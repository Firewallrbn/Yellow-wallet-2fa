// Parser de otpauth://totp/Issuer:cuenta?secret=...&issuer=...
// Escrito a mano porque URL.searchParams no está completo en todos los motores de RN.

import { isValidBase32 } from './base32';
import { DIGITS, PERIOD } from './totp';

export interface Account {
  id: string;
  issuer: string;
  account: string;
  secret: string;
}

function decode(value: string): string {
  return decodeURIComponent(value.replace(/\+/g, ' '));
}

export function parseOtpauthUri(uri: string): Omit<Account, 'id'> {
  const match = /^otpauth:\/\/totp\/([^?]*)\?(.*)$/i.exec(uri.trim());
  if (!match) throw new Error('El QR no es un enlace otpauth://totp/');

  const params: Record<string, string> = {};
  for (const pair of match[2].split('&')) {
    const [key, value = ''] = pair.split('=');
    if (key) params[key.toLowerCase()] = decode(value);
  }

  const label = decode(match[1]);
  const [labelIssuer, ...rest] = label.includes(':') ? label.split(':') : ['', label];
  const secret = (params.secret ?? '').toUpperCase();

  if (!isValidBase32(secret)) throw new Error('El QR no trae un secret Base32 válido');
  // Esta app implementa el perfil estándar (el mismo que Google Authenticator por defecto).
  if (params.algorithm && params.algorithm.toUpperCase() !== 'SHA1') throw new Error('Solo se soporta SHA1');
  if (params.digits && Number(params.digits) !== DIGITS) throw new Error(`Solo se soportan ${DIGITS} dígitos`);
  if (params.period && Number(params.period) !== PERIOD) throw new Error(`Solo se soporta un periodo de ${PERIOD} s`);

  return {
    issuer: params.issuer || labelIssuer || 'Sin emisor',
    account: rest.join(':').trim() || label,
    secret,
  };
}
