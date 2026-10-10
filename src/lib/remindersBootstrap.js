// Reminder bootstrap.
//
// Reminders used to depend on two things that only happened if the user opened
// the Settings screen first: a `notification_settings` row existing, and the OS
// notification permission having been granted. On a fresh install neither was
// true, so the reminder pipeline silently did nothing. This makes the setup
// self-bootstrapping and idempotent.

import { api } from "@/api/supabaseClient";
import { notificationService } from "@/lib/notificationService";

export const DEFAULT_NOTIFICATION_SETTINGS = {
  dose_reminders: true,
  missed_dose_reminders: true,
  low_stock_alerts: true,
  family_notifications: true,
  daily_summary: false,
  notification_sound: true,
  reminder_lead_minutes: 0,
  missed_dose_delay_minutes: 30,
};

let _permissionAsked = false;
let _exactAsked = false;

/**
 * Guarantee the reminder pipeline is usable:
 *  • a notification_settings row exists (created with defaults if missing), and
 *  • the OS notification permission has been requested.
 * Safe to call on every app start.
 */
export async function ensureReminderReady() {
  let settings = null;
  try {
    const existing = await api.entities.NotificationSettings.list();
    if (existing.length > 0) {
      settings = existing[0];
    } else {
      settings = await api.entities.NotificationSettings.create(DEFAULT_NOTIFICATION_SETTINGS);
    }
  } catch (e) {
    console.error("[reminders] settings bootstrap failed:", e);
    settings = { ...DEFAULT_NOTIFICATION_SETTINGS, id: null };
  }

  let permission = await notificationService.getPermission();
  if (permission !== "granted" && permission !== "unsupported" && !_permissionAsked) {
    _permissionAsked = true;
    permission = await notificationService.requestPermission();
  }
  if (permission === "granted" && !_exactAsked) {
    _exactAsked = true;
    await notificationService.ensureExactAlarms();
  }

  return { settings, permission };
}
