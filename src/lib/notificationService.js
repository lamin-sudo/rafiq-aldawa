// Notification service — one API, two backends.
//
// • Native (Capacitor/Android): @capacitor/local-notifications → real OS
//   notifications; they fire even when the app is backgrounded or closed.
// • Web/PWA: the browser Notification API (+ setTimeout for scheduling);
//   those only fire while a tab is open, which is a platform limit.
//
// Local-only by design — this never claims push support that does not exist.

const isNative = () =>
  typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();

// Stable positive 32-bit id for the native scheduler (it rejects strings).
function hashId(input) {
  const s = String(input ?? "");
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 2147483647 || 1;
}

class NotificationService {
  constructor() {
    this._plugin = null;
    this._channelReady = false;
  }

  /**
   * Load and prepare the native plugin. Deliberately returns undefined and
   * stores the proxy on `this._plugin`: RETURNING a Capacitor plugin object
   * from an async function makes the promise machinery treat it as a thenable
   * and call `plugin.then()`, which Capacitor rejects with
   * `"LocalNotifications.then() is not implemented on android"`.
   */
  async _local() {
    if (!isNative()) return;
    if (!this._plugin) {
      const mod = await import("@capacitor/local-notifications");
      this._plugin = mod.LocalNotifications;
    }
    if (!this._channelReady) {
      // Android 8+ needs a channel; teal matches the app accent.
      try {
        await this._plugin.createChannel({
          id: "dose-reminders",
          name: "تذكير الجرعات",
          description: "تنبيهات مواعيد الأدوية",
          importance: 5,
          visibility: 1,
          vibration: true,
          lights: true,
          lightColor: "#0D9488",
        });
      } catch {
        /* channel creation is best-effort */
      }
      this._channelReady = true;
    }
  }

  isSupported() {
    if (isNative()) return true;
    return typeof window !== "undefined" && "Notification" in window;
  }

  async getPermission() {
    if (isNative()) {
      try {
        await this._local();
        const plugin = this._plugin;
        if (!plugin) return "denied";
        const res = await plugin.checkPermissions();
        return res.display === "granted" ? "granted" : res.display; // "denied" | "prompt"
      } catch {
        return "denied";
      }
    }
    if (!this.isSupported()) return "unsupported";
    return Notification.permission;
  }

  async requestPermission() {
    if (isNative()) {
      try {
        await this._local();
        const plugin = this._plugin;
        if (!plugin) return "denied";
        const res = await plugin.requestPermissions();
        return res.display === "granted" ? "granted" : res.display;
      } catch {
        return "denied";
      }
    }
    if (!this.isSupported()) return "unsupported";
    try {
      return await Notification.requestPermission();
    } catch {
      return "denied";
    }
  }

  // Android 12+ gates exact alarms behind a user consent screen; without it the
  // OS silently downgrades or drops `schedule.at` alarms. Ask once, tolerate
  // older Androids / web where the API does not exist.
  async ensureExactAlarms() {
    if (!isNative()) return "unsupported";
    try {
        await this._local();
        const plugin = this._plugin;
        if (!plugin) return "unsupported";
      if (typeof plugin.checkExactNotificationSetting !== "function") return "unsupported";
      const cur = await plugin.checkExactNotificationSetting();
      if (cur?.exact_alarm === "granted") return "granted";
      const res = await plugin.changeExactNotificationSetting();
      return res?.exact_alarm || "denied";
    } catch (e) {
      console.warn("Exact-alarm permission unavailable:", e?.message || e);
      return "unsupported";
    }
  }

  // Show a notification right now.
  async show(title, body, options = {}) {
    if (isNative()) {
      try {
        await this._local();
        const plugin = this._plugin;
        if (!plugin) return null;
        const id = hashId(options.tag || `${title}|${body}|${Date.now()}`);
        await plugin.schedule({
          notifications: [
            {
              id,
              title,
              body,
              channelId: "dose-reminders",
              smallIcon: "ic_stat_icon",
              iconColor: "#0D9488",
              extra: options.data || null,
            },
          ],
        });
        return id;
      } catch (e) {
        console.error("Native notification error:", e);
        return null;
      }
    }

    if (!this.isSupported() || Notification.permission !== "granted") return null;
    try {
      const notification = new Notification(title, {
        body,
        tag: options.tag,
        icon: options.icon,
        data: options.data,
        ...(options.actions ? { actions: options.actions } : {}),
      });
      if (options.onClick) notification.onclick = options.onClick;
      return notification;
    } catch (e) {
      console.error("Notification error:", e);
      return null;
    }
  }

  // Schedule a notification for a specific moment.
  // `options.id` (any string) keeps it cancellable and replaces any previous one.
  async scheduleAt(title, body, scheduledTime, options = {}) {
    const target = new Date(scheduledTime);

    if (isNative()) {
      if (Number.isNaN(target.getTime()) || target.getTime() <= Date.now()) return null;
      const id = options.id
        ? hashId(options.id)
        : hashId(`${title}|${body}|${target.getTime()}`);
      try {
        await this._local();
        const plugin = this._plugin;
        if (!plugin) return null;
        await plugin.schedule({
          notifications: [
            {
              id,
              title,
              body,
              channelId: "dose-reminders",
              smallIcon: "ic_stat_icon",
              iconColor: "#0D9488",
              schedule: { at: target, allowWhileIdle: true },
              extra: options.data || null,
            },
          ],
        });
        return id;
      } catch (e) {
        // Exact alarms need SCHEDULE_EXACT_ALARM on Android 12+ and that can be
        // denied; fall back to the inexact-but-still-native schedule instead of
        // silently dropping the reminder.
        try {
        await this._local();
        const plugin = this._plugin;
        if (!plugin) return null;
        await plugin.schedule({
            notifications: [
              { id, title, body, channelId: "dose-reminders", schedule: { at: target } },
            ],
          });
          return id;
        } catch (e2) {
          console.error("Schedule error:", e2);
          return null;
        }
      }
    }

    if (!this.isSupported() || Notification.permission !== "granted") return null;
    const delay = target.getTime() - Date.now();
    if (delay <= 0) return null;
    const id = setTimeout(() => {
      this.show(title, body, options);
    }, Math.min(delay, 2147483647));
    return id;
  }

  // Cancel one scheduled notification (native id or web timeout id).
  async cancelScheduled(id) {
    if (id == null) return;
    if (isNative() && typeof id === "number") {
      try {
        await this._local();
        const plugin = this._plugin;
        if (!plugin) return;
        await plugin.cancel({ notifications: [{ id }] });
      } catch (e) {
        console.error("Cancel error:", e);
      }
      return;
    }
    clearTimeout(id);
  }

  // Cancel every notification this app has pending.
  async cancelAll() {
    if (!isNative()) return;
    try {
        await this._local();
        const plugin = this._plugin;
        if (!plugin) return;
      const pending = await plugin.getPending();
      if (pending?.notifications?.length) {
        await plugin.cancel({
          notifications: pending.notifications.map((n) => ({ id: n.id })),
        });
      }
    } catch (e) {
      console.error("Cancel-all error:", e);
    }
  }
}

export const notificationService = new NotificationService();
export { hashId, isNative };
