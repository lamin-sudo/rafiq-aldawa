// Locale-aware "time ago" formatting.
//
// Intl.RelativeTimeFormat is built into the platform and carries ar/en/fr
// relative-time data, so it localizes correctly without shipping (or correctly
// bundling) a date library's locale files. moment's `fromNow()` was used here
// before and rendered English in the Arabic UI because the locale registered in
// another chunk did not reach the copy bundled into this one.
const LOCALES = { ar: "ar", en: "en", fr: "fr" };

const DIVISIONS = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

/** Format a timestamp as a localized "x ago" / "in x" string. */
export function formatRelativeTime(value, lang = "ar") {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const locale = LOCALES[lang] || "ar";
  let formatter;
  try {
    formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  } catch {
    formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  }

  let duration = (date.getTime() - Date.now()) / 1000; // negative = past
  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return "";
}
