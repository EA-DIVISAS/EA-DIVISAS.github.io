/**
 * Importe con letra al estilo de los comprobantes mexicanos:
 *   597419.8 → "QUINIENTOS NOVENTA Y SIETE MIL CUATROCIENTOS DIECINUEVE PESOS 80/100 M.N."
 * Soporta hasta 999,999,999,999.99.
 */
const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const ESPECIALES: Record<number, string> = {
  10: 'DIEZ', 11: 'ONCE', 12: 'DOCE', 13: 'TRECE', 14: 'CATORCE', 15: 'QUINCE',
  16: 'DIECISÉIS', 17: 'DIECISIETE', 18: 'DIECIOCHO', 19: 'DIECINUEVE',
  20: 'VEINTE', 21: 'VEINTIÚN', 22: 'VEINTIDÓS', 23: 'VEINTITRÉS', 24: 'VEINTICUATRO',
  25: 'VEINTICINCO', 26: 'VEINTISÉIS', 27: 'VEINTISIETE', 28: 'VEINTIOCHO', 29: 'VEINTINUEVE',
};
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function decenas(n: number): string {
  if (n < 10) return UNIDADES[n];
  if (ESPECIALES[n]) return ESPECIALES[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  return u ? `${DECENAS[d]} Y ${UNIDADES[u]}` : DECENAS[d];
}

function centenas(n: number): string {
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100);
  const rest = n % 100;
  return [CENTENAS[c], decenas(rest)].filter(Boolean).join(' ');
}

function miles(n: number): string {
  const m = Math.floor(n / 1000);
  const rest = n % 1000;
  const head = m === 0 ? '' : m === 1 ? 'MIL' : `${centenas(m)} MIL`;
  return [head, centenas(rest)].filter(Boolean).join(' ');
}

export function enteroALetras(n: number): string {
  if (n === 0) return 'CERO';
  const millones = Math.floor(n / 1_000_000);
  const rest = n % 1_000_000;
  const head = millones === 0 ? '' : millones === 1 ? 'UN MILLÓN' : `${miles(millones)} MILLONES`;
  // "UN MILLÓN DE PESOS" / "DOS MILLONES DE PESOS" cuando no hay resto.
  return [head, miles(rest)].filter(Boolean).join(' ');
}

export function importeConLetra(amount: number | string): string {
  const cents = Math.round(Math.abs(Number(amount ?? 0)) * 100);
  const entero = Math.floor(cents / 100);
  const centavos = String(cents % 100).padStart(2, '0');
  const letras = enteroALetras(entero);
  const de = entero >= 1_000_000 && entero % 1_000_000 === 0 ? ' DE' : '';
  const moneda = entero === 1 ? 'PESO' : 'PESOS';
  return `${letras}${de} ${moneda} ${centavos}/100 M.N.`;
}
