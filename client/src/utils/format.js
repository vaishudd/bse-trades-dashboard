const numberFormat = new Intl.NumberFormat('en-IN');
const priceFormat = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatNumber = (n) => numberFormat.format(n ?? 0);
export const formatPrice = (n) => priceFormat.format(n ?? 0);

export function formatDateTime(value, fallback = 'Never') {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString('en-IN');
}
