import type { SupportedLanguage } from '../../i18n';

export function formatMonthYear(value: string, locale: string): string {
  const [year, month] = value.split('-').map(Number);
  const date = new Date(year, month - 1);
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(date);
}

// Inclusive month count, matching how LinkedIn-style tenure is usually reported:
// Sep 2021 – Sep 2026 is counted as 61 months (5y 1m), not 60.
export function formatDuration(startDate: string, endDate: string | null, lang: SupportedLanguage): string {
  const totalMonths = monthSpan(toMonthIndex(startDate), toMonthIndex(endDate));
  return formatYearsMonths(totalMonths, lang);
}

// Total tenure across all periods, with overlapping/adjacent jobs merged so
// concurrent or back-to-back roles aren't double-counted.
export function formatTotalDuration(
  periods: { startDate: string; endDate: string | null }[],
  lang: SupportedLanguage,
): string {
  const intervals = periods
    .map(({ startDate, endDate }): [number, number] => [toMonthIndex(startDate), toMonthIndex(endDate)])
    .sort((a, b) => a[0] - b[0]);

  const merged: [number, number][] = [];
  for (const [start, end] of intervals) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1] + 1) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  const totalMonths = merged.reduce((sum, [start, end]) => sum + monthSpan(start, end), 0);
  return formatYearsMonths(totalMonths, lang);
}

function toMonthIndex(value: string | null): number {
  if (!value) {
    const now = new Date();
    return now.getFullYear() * 12 + (now.getMonth() + 1);
  }
  const [year, month] = value.split('-').map(Number);
  return year * 12 + month;
}

function monthSpan(startIndex: number, endIndex: number): number {
  return endIndex - startIndex + 1;
}

function formatYearsMonths(totalMonths: number, lang: SupportedLanguage): string {
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${pluralize(years, lang, 'year')}`);
  if (months > 0) parts.push(`${months} ${pluralize(months, lang, 'month')}`);

  return lang === 'ru' ? parts.join(' и ') : parts.join(' ');
}

function pluralize(n: number, lang: SupportedLanguage, unit: 'year' | 'month'): string {
  if (lang === 'en') return unit === 'year' ? (n === 1 ? 'year' : 'years') : n === 1 ? 'month' : 'months';

  const forms = unit === 'year' ? (['год', 'года', 'лет'] as const) : (['месяц', 'месяца', 'месяцев'] as const);
  return ruPluralForm(n, forms);
}

function ruPluralForm(n: number, [one, few, many]: readonly [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;

  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
