// Decodificador Base32 (RFC 4648) escrito a mano: la semilla del QR llega en Base32
// y HMAC necesita los bytes crudos K.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Decode(input: string): Uint8Array {
  const clean = input.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '');
  if (clean.length === 0) throw new Error('La clave está vacía');

  const bytes: number[] = [];
  let buffer = 0; // acumulador de bits pendientes
  let bits = 0; // cuántos bits válidos hay en el acumulador

  for (const char of clean) {
    const value = ALPHABET.indexOf(char);
    if (value === -1) throw new Error(`Carácter Base32 inválido: "${char}"`);
    // Cada carácter aporta 5 bits; cada vez que juntamos 8 sale un byte.
    buffer = ((buffer << 5) | value) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

export function isValidBase32(input: string): boolean {
  try {
    return base32Decode(input).length >= 10; // al menos 80 bits de secreto
  } catch {
    return false;
  }
}
