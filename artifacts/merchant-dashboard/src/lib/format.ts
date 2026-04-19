export function formatArabicNumber(num: number | string | null | undefined): string {
  if (num === null || num === undefined) return "";
  const numStr = num.toString();
  const arabicNumbers = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return numStr.replace(/[0-9]/g, (w) => arabicNumbers[+w]);
}

export function formatCurrency(num: number | null | undefined): string {
  if (num === null || num === undefined) return "";
  const formatted = new Intl.NumberFormat('en-US').format(num);
  return `${formatArabicNumber(formatted)} ر.س`;
}

export function formatPercentage(num: number | null | undefined): string {
  if (num === null || num === undefined) return "";
  return `${formatArabicNumber(num)}٪`;
}
