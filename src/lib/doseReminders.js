// Dose reminder scheduling + snooze + notification logging.
// Runs while the app is open (web limits: no background notifications without a
// native layer). All timers are local; the snooze queue lives in localStorage.

import { api } from "@/api/supabaseClient";
import { notificationService, isNative } from "./notificationService";

const NOTIFIED_KEY = "dose_notified";
const SNOOZE_KEY = "dose_snoozes";
export const SNOOZE_MINUTES = 10;

function minutesOf(timeStr) {
  const [h, m] = String(timeStr || "").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

export function doseKey(dose) {
  return `${dose.medication_id}_${dose.scheduled_time}_${todayKey()}`;
}

export function isQuietHours(settings) {
  if (!settings?.quiet_hours_enabled) return false;
  const start = settings.quiet_hours_start || "22:00";
  const end = settings.quiet_hours_end || "07:00";
  const s = minutesOf(start);
  const e = minutesOf(end);
  const now = nowMinutes();
  if (s === e) return false;
  return s < e ? now >= s && now < e : now >= s || now < e;
}

// "Critical" = a dose that is already overdue and still pending. Only those
// break through quiet hours.
export function isCriticalDose(dose) {
  return dose.status === "pending" && minutesOf(dose.scheduled_time) < nowMinutes();
}

function readMap(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

function writeMap(key, map) {
  localStorage.setItem(key, JSON.stringify(map));
}

export function wasNotified(key) {
  return !!readMap(NOTIFIED_KEY)[key];
}

export function markNotified(key) {
  const map = readMap(NOTIFIED_KEY);
  map[key] = Date.now();
  writeMap(NOTIFIED_KEY, map);
}

export function clearNotified(key) {
  const map = readMap(NOTIFIED_KEY);
  delete map[key];
  writeMap(NOTIFIED_KEY, map);
}

export async function logNotification(payload) {
  try {
    await api.entities.NotificationLog.create(payload);
  } catch (e) {
    console.error("NotificationLog error:", e);
  }
}

const reminderTimers = [];
export function clearReminderTimers() {
  reminderTimers.forEach((id) => clearTimeout(id));
  reminderTimers.length = 0;
}

export async function scheduleDoseReminders({ doses, settings, t, onFire, recipientName }) {
  clearReminderTimers();
  const quiet = isQuietHours(settings);
  const now = nowMinutes();
  let scheduled = 0;

  for (const dose of doses) {
    const key = doseKey(dose);
    if (wasNotified(key)) continue;
    const critical = isCriticalDose(dose);
    if (quiet && !critical) continue; // suppressed during quiet hours

    const target = new Date();
    target.setHours(0, 0, 0, 0);
    target.setMinutes(minutesOf(dose.scheduled_time));
    if (target.getTime() <= Date.now()) {
      // Already due: fire immediately on web; on native skip past-time slots
      // (an OS notification for a moment that already passed is noise).
      if (isNative()) continue;
      target.setTime(Date.now());
    }

    if (isNative()) {
      // Hand the schedule to the OS so the reminder survives the app being
      // backgrounded or killed — the plain setTimeout path cannot do that.
      const id = await notificationService.scheduleAt(
        t("notifications.doseTitle"),
        t("notifications.doseBody", { med: dose.medication_name, time: dose.scheduled_time }),
        target,
        { id: key, tag: key, data: { doseKey: key } }
      );
      if (id != null) scheduled++;
      continue;
    }

    const delay = Math.max(0, target.getTime() - Date.now());
    reminderTimers.push(
      setTimeout(() => {
        fireDoseReminder({ dose, t, onFire, snoozed: false });
      }, Math.min(delay, 2147483647))
    );
    scheduled++;
  }
  return scheduled;
}

export async function fireDoseReminder({ dose, t, onFire, snoozed = false }) {
  const key = doseKey(dose);
  markNotified(key);

  const title = t("notifications.doseTitle");
  const body = t("notifications.doseBody", { med: dose.medication_name, time: dose.scheduled_time });

  notificationService.show(title, body, {
    tag: key,
    actions: [{ action: "snooze", title: t("notifications.snoozeAction") }],
    data: { doseKey: key },
    onClick: (event) => {
      if (event?.action === "snooze") {
        snoozeDose({ dose, t, onFire });
      } else if (typeof window !== "undefined") {
        window.focus();
      }
    },
  });

  await logNotification({
    type: "dose_due",
    title,
    body,
    medication_id: dose.medication_id,
    medication_name: dose.medication_name,
    scheduled_time: dose.scheduled_time,
    was_snoozed: snoozed,
  });

  if (onFire) onFire({ dose, key });
}

export function snoozeDose({ dose, t, onFire }) {
  const entry = {
    key: doseKey(dose),
    until: Date.now() + SNOOZE_MINUTES * 60000,
    medication_id: dose.medication_id,
    medication_name: dose.medication_name,
    recipient_id: dose.recipient_id,
    scheduled_time: dose.scheduled_time,
  };
  const map = readMap(SNOOZE_KEY);
  map[entry.key] = entry;
  writeMap(SNOOZE_KEY, map);

  const at = new Date(entry.until);
  if (isNative()) {
    notificationService.scheduleAt(
      t("notifications.doseTitle"),
      t("notifications.doseBody", { med: dose.medication_name, time: dose.scheduled_time }),
      at,
      { id: entry.key, tag: entry.key, data: { doseKey: entry.key } }
    );
  } else {
    reminderTimers.push(
      setTimeout(() => {
        const current = readMap(SNOOZE_KEY);
        delete current[entry.key];
        writeMap(SNOOZE_KEY, current);
        fireDoseReminder({ dose, t, onFire, snoozed: true });
      }, SNOOZE_MINUTES * 60000)
    );
  }

  return entry.until;
}

// Restore snoozes that survived a page reload.
export function scheduleSnoozes({ t, onFire }) {
  const map = readMap(SNOOZE_KEY);
  const now = Date.now();
  for (const entry of Object.values(map)) {
    const dose = {
      medication_id: entry.medication_id,
      medication_name: entry.medication_name,
      recipient_id: entry.recipient_id,
      scheduled_time: entry.scheduled_time,
      status: "pending",
    };
    const delay = Math.max(0, entry.until - now);
    if (delay === 0) {
      const current = readMap(SNOOZE_KEY);
      delete current[entry.key];
      writeMap(SNOOZE_KEY, current);
    }
    if (isNative()) {
      notificationService.scheduleAt(
        t("notifications.doseTitle"),
        t("notifications.doseBody", { med: dose.medication_name, time: dose.scheduled_time }),
        new Date(entry.until),
        { id: entry.key, tag: entry.key, data: { doseKey: entry.key } }
      );
    } else {
      reminderTimers.push(
        setTimeout(() => {
          const current = readMap(SNOOZE_KEY);
          delete current[entry.key];
          writeMap(SNOOZE_KEY, current);
          fireDoseReminder({ dose, t, onFire, snoozed: true });
        }, Math.min(delay, 2147483647))
      );
    }
  }
}