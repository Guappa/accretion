const UNITS = ['', 'K', 'M', 'B', 'T'];

export function formatAmount(value: number): string {
  if (value < 1000) return value.toString();
  let scaled = value;
  let unitIndex = 0;
  while (scaled >= 1000 && unitIndex < UNITS.length - 1) {
    scaled /= 1000;
    unitIndex++;
  }
  return `${scaled.toFixed(1)}${UNITS[unitIndex]}`;
}
