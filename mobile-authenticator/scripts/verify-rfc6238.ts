// Verifica la implementación de la app contra los vectores oficiales del RFC 6238
// (Apéndice B, SHA-1). Se ejecuta en Node, sin teléfono:  npm run verify
import { base32Decode } from '../src/totp/base32';
import { parseOtpauthUri } from '../src/totp/otpauth';
import { counterToBytes, totp } from '../src/totp/totp';

// "12345678901234567890" en Base32
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const VECTORS: Array<[number, string]> = [
  [59, '94287082'],
  [1111111109, '07081804'],
  [1111111111, '14050471'],
  [1234567890, '89005924'],
  [2000000000, '69279037'],
  [20000000000, '65353130'],
];

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '✔' : '✘'} ${name}${detail ? `  ${detail}` : ''}`);
  if (!ok) failures++;
};

check('Base32 → bytes', new TextDecoder().decode(base32Decode(SECRET)) === '12345678901234567890');
check(
  'Contador 64 bits Big-Endian',
  // C = ⌊20000000000 / 30⌋ = 666666666 = 0x0000000027BC86AA
  Array.from(counterToBytes(Math.floor(20000000000 / 30))).join(',') === [0, 0, 0, 0, 0x27, 0xbc, 0x86, 0xaa].join(','),
);

for (const [t, expected8] of VECTORS) {
  const { code, counter } = totp(SECRET, t);
  // Nuestro código es de 6 dígitos: los últimos 6 del vector de 8 dígitos.
  check(`T=${t}`, code === expected8.slice(-6), `C=${counter} → ${code} (esperado ${expected8.slice(-6)})`);
}

const parsed = parseOtpauthUri(
  'otpauth://totp/FastPay%3Ademo%40fastpay.dev?secret=JBSWY3DPEHPK3PXP&issuer=FastPay&algorithm=SHA1&digits=6&period=30',
);
check('Parser otpauth://', parsed.issuer === 'FastPay' && parsed.account === 'demo@fastpay.dev' && parsed.secret === 'JBSWY3DPEHPK3PXP');

if (failures) {
  console.error(`\n${failures} verificación(es) fallaron`);
  process.exit(1);
}
console.log('\nTodas las verificaciones pasaron: la app implementa RFC 6238 correctamente.');
