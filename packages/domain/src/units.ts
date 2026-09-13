/** Exact base-unit formatting shared by receipts and browser-safe presentation. */
export function formatUnits(raw: string, decimals: number): string {
  if (decimals === 0) return raw;
  const padded = raw.padStart(decimals + 1, '0');
  const fraction = padded.slice(-decimals).replace(/0+$/, '');
  return padded.slice(0, -decimals) + (fraction ? `.${fraction}` : '');
}
