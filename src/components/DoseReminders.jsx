import { useEffect, useRef, useState } from "react";
import { api } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { useI18n } from "@/i18n";
import { todayStr } from "@/lib/medicationUtils";
import { scheduleDoseReminders, scheduleSnoozes, snoozeDose } from "@/lib/doseReminders";
import { ensureReminderReady } from "@/lib/remindersBootstrap";
import { BellRing, Clock, X } from "lucide-react";

export default function DoseReminders() {
  const { user } = useAuth();
  const { t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const onFire = ({ dose }) => setBanner({ dose });

    const run = async () => {
      try {
        // Creates the settings row and asks for the OS permission on first run,
        // so reminders work without the user having to visit Settings first.
        const [{ settings, permission }, recipients] = await Promise.all([
          ensureReminderReady(),
          api.entities.CareRecipient.list(),
        ]);
        if (cancelled) return;
        if (!settings?.dose_reminders) return;
        if (permission !== "granted") return;

        const [meds, logs] = await Promise.all([
          api.entities.Medication.filter({ active: true }),
          api.entities.DoseLog.filter({ scheduled_date: todayStr() }),
        ]);
        if (cancelled) return;

        const done = new Set(
          logs.filter((l) => l.status && l.status !== "pending").map((l) => `${l.medication_id}_${l.scheduled_time}`)
        );
        const doses = [];
        for (const r of recipients) {
          for (const m of meds.filter((x) => x.recipient_id === r.id)) {
            for (const time of m.scheduled_times || []) {
              if (done.has(`${m.id}_${time}`)) continue;
              doses.push({
                medication_id: m.id,
                medication_name: m.name,
                recipient_id: r.id,
                scheduled_time: time,
                status: "pending",
              });
            }
          }
        }

        await scheduleDoseReminders({ doses, settings, t: tRef.current, onFire });
        scheduleSnoozes({ t: tRef.current, onFire });
      } catch (e) {
        console.error("Reminder scheduling error:", e);
      }
    };

    run();
    const interval = setInterval(run, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  if (!banner) return null;

  return (
    <div className="fixed inset-x-3 bottom-24 lg:bottom-6 lg:inset-x-auto lg:end-6 z-40 max-w-md lg:w-96 animate-fade-in">
      <div className="bg-card rounded-2xl border-2 border-accent/40 shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent/10 text-accent shrink-0">
            <BellRing className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{t("notifications.doseTitle")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("notifications.doseBody", { med: banner.dose.medication_name, time: banner.dose.scheduled_time })}
            </p>
          </div>
          <button
            onClick={() => setBanner(null)}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors shrink-0"
            aria-label={t("common.cancel")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => {
              snoozeDose({ dose: banner.dose, t: tRef.current, onFire: () => {} });
              setBanner(null);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-border text-foreground text-xs font-semibold hover:bg-muted transition-colors"
          >
            <Clock className="w-3.5 h-3.5" />
            {t("notifications.snoozeButton")}
          </button>
          <button
            onClick={() => setBanner(null)}
            className="flex-1 py-2.5 rounded-xl bg-accent text-accent-foreground text-xs font-semibold hover:bg-accent/90 transition-colors"
          >
            {t("notifications.dismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}