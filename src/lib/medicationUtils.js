// أدوات مساعدة لإدارة الأدوية والجرعات

// تنسيق الوقت بصيغة 12 ساعة بالعربية
// `t` is optional so plain (non-React) callers keep working; when supplied the
// AM/PM marker follows the active language instead of the hard-coded Arabic.
export function formatTime(timeStr, t) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const isPm = h >= 12;
  const period = isPm ? "م" : "ص";
  const label = typeof t === "function" ? t(isPm ? "common.pm" : "common.am") : period;
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, "0")} ${label}`;
}

// تنسيق التاريخ بالعربية
export function formatDate(dateStr, lang = "ar") {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(lang, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function formatDateShort(dateStr, lang = "ar") {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(lang, { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

// تاريخ اليوم بصيغة YYYY-MM-DD
export function todayStr() {
  return new Date().toISOString().split("T")[0];
}

// الوقت الحالي بصيغة HH:MM
export function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// مقارنة الوقت: يعيد -1 إذا كان a قبل b، 1 إذا بعده، 0 إذا نفسه
export function compareTime(a, b) {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  if (ah !== bh) return ah - bh;
  return am - bm;
}

// الفرق بالدقائق بين وقتين
export function minutesUntil(timeStr) {
  const now = new Date();
  const [h, m] = timeStr.split(":").map(Number);
  const target = new Date();
  target.setHours(h, m, 0, 0);
  const diff = (target - now) / 60000;
  return Math.round(diff);
}

// تنسيق الوقت المتبقي
// `t` is optional for backwards compatibility: when it is not provided (plain
// non-React callers such as DoseRow), the Arabic fallback below is used so
// existing call sites keep working unchanged.
export function formatTimeRemaining(timeStr, t) {
  const mins = minutesUntil(timeStr);
  const tr = (key, params) => (typeof t === "function" ? t(key, params) : "");
  if (mins < 0) {
    const absMins = Math.abs(mins);
    if (absMins < 60) return tr("dose.lateMinutes", { mins: absMins }) || `متأخر ${absMins} دقيقة`;
    const hours = Math.floor(absMins / 60);
    return tr("dose.lateHours", { hours }) || `متأخر ${hours} ساعة`;
  }
  if (mins < 60) return tr("dose.afterMinutes", { mins }) || `بعد ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  return tr("dose.afterHours", { hours }) || `بعد ${hours} ساعة`;
}

// حالة المخزون
export function getInventoryStatus(medication) {
  const remaining = medication.remaining_quantity ?? 0;
  const threshold = medication.refill_threshold ?? 0;
  if (remaining <= 0) return "empty";
  if (remaining <= threshold) return "low";
  return "normal";
}

// labelKey values are i18n keys — render them with t().
export const inventoryStatusConfig = {
  normal: { labelKey: "inventoryStatus.normal", color: "accent", bg: "bg-accent/10", text: "text-accent", dot: "bg-accent" },
  low: { labelKey: "inventoryStatus.low", color: "warning", bg: "bg-warning/10", text: "text-warning", dot: "bg-warning" },
  empty: { labelKey: "inventoryStatus.empty", color: "alert", bg: "bg-alert/10", text: "text-alert", dot: "bg-alert" },
};

// حالة الجرعة
// labelKey values are i18n keys — render them with t().
export const doseStatusConfig = {
  pending: { labelKey: "doseStatus.pending", color: "muted", ring: "ring-muted-foreground/30", bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground/40" },
  taken: { labelKey: "doseStatus.taken", color: "accent", ring: "ring-accent", bg: "bg-accent/10", text: "text-accent", dot: "bg-accent" },
  skipped: { labelKey: "doseStatus.skipped", color: "muted", ring: "ring-muted-foreground/40", bg: "bg-muted/50", text: "text-muted-foreground", dot: "bg-muted-foreground/50" },
  missed: { labelKey: "doseStatus.missed", color: "alert", ring: "ring-alert", bg: "bg-alert/10", text: "text-alert", dot: "bg-alert" },
};

// فترة اليوم بناءً على الوقت
export function getTimePeriod(timeStr) {
  const h = parseInt(timeStr.split(":")[0]);
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

// NOTE: label/range values are i18n keys — consumers must render them through t().
export const timePeriodConfig = {
  morning: { labelKey: "timePeriod.morning", icon: "Sunrise", rangeKey: "timePeriod.morningRange" },
  afternoon: { labelKey: "timePeriod.afternoon", icon: "Sun", rangeKey: "timePeriod.afternoonRange" },
  evening: { labelKey: "timePeriod.evening", icon: "Sunset", rangeKey: "timePeriod.eveningRange" },
  night: { labelKey: "timePeriod.night", icon: "Moon", rangeKey: "timePeriod.nightRange" },
};

// توليد أوقات افتراضية بناءً على عدد المرات يوميًا
export function generateDefaultTimes(frequency) {
  const presets = {
    1: ["08:00"],
    2: ["08:00", "20:00"],
    3: ["08:00", "14:00", "20:00"],
    4: ["08:00", "12:00", "16:00", "20:00"],
  };
  return presets[frequency] || ["08:00"];
}

// حساب نسبة الالتزام
export function calculateAdherence(logs) {
  if (!logs || logs.length === 0) return 0;
  const completed = logs.filter((l) => l.status === "taken").length;
  return Math.round((completed / logs.length) * 100);
}

// التحقق من صحة البريد الإلكتروني
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Relationship values → i18n keys (values are keys, not display text).
export const relationshipLabels = {
  self: "relationship.self",
  parent: "relationship.parent",
  spouse: "relationship.spouse",
  child: "relationship.child",
  sibling: "relationship.sibling",
  grandparent: "relationship.grandparent",
  other: "relationship.other",
};

// Permission values → i18n keys (values are keys, not display text).
export const permissionLabels = {
  view_only: "permission.viewOnly",
  view_and_confirm: "permission.viewAndConfirm",
  manage: "permission.manage",
};

// أشكال الدواء — values are i18n keys; consumers must render through t()
export const medicationFormLabels = {
  "أقراص": "medicationForm.tablet",
  "كبسولات": "medicationForm.capsule",
  "شراب": "medicationForm.syrup",
  "حقن": "medicationForm.injection",
  "كريم": "medicationForm.cream",
  "قطرة": "medicationForm.drop",
  "بخاخ": "medicationForm.spray",
  "أخرى": "medicationForm.other",
};