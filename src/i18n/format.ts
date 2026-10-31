/** Locale-aware number formatting (decimal separator, digits) via Intl. */
export function formatNumber(value: number, locale: string, fractionDigits = 0): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(value);
}

/** "m:ss.d" with the locale's digits and decimal separator, e.g. 1:05.3 (en) or 1:05,3 (pt-PT). */
export function formatDuration(seconds: number, locale: string): string {
  const tenths = Math.max(0, Math.floor(seconds * 10));
  const minutes = Math.floor(tenths / 600);
  const secs = (tenths % 600) / 10;
  const secText = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(secs);
  return `${new Intl.NumberFormat(locale).format(minutes)}:${secText}`;
}
