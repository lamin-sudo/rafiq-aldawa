import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { formatTime, doseStatusConfig, formatTimeRemaining, minutesUntil } from "@/lib/medicationUtils";
import { Check, SkipForward } from "lucide-react";

export default function DoseRow({ dose, medication, onTake, onSkip, disabled }) {
  const t = useTranslation();
  const status = dose.status || "pending";
  const statusCfg = doseStatusConfig[status];
  const isPending = status === "pending";
  // Compare against the clock rather than sniffing the rendered "late" text:
  // the label is now localized, so matching on its wording would break in en/fr.
  const isPast = isPending && minutesUntil(dose.scheduled_time) < 0;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl border-2 transition-all",
        statusCfg.bg,
        statusCfg.ring,
        isPast && "ring-2 ring-alert/40"
      )}
    >
      {/* Time + Status Ring */}
      <div className="flex flex-col items-center gap-1 shrink-0 w-16">
        <div className={cn("w-3 h-3 rounded-full", statusCfg.dot)} />
        <span className="text-xs font-semibold text-foreground tabular-nums">{formatTime(dose.scheduled_time, t)}</span>
      </div>

      {/* Medication Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground truncate">{medication?.name || dose.medication_name}</p>
        <p className="text-xs text-muted-foreground">
          {medication?.dosage} {medication?.dosage_unit}
          {isPending && !isPast && <span className="text-muted-foreground/70"> · {formatTimeRemaining(dose.scheduled_time, t)}</span>}
          {isPast && <span className="text-alert font-medium"> · {formatTimeRemaining(dose.scheduled_time, t)}</span>}
          {status === "taken" && dose.confirmed_by_name && <span className="text-accent">{" · "}{t("dose.confirmedBy", { name: dose.confirmed_by_name })}</span>}
        </p>
      </div>

      {/* Status Badge or Actions */}
      {isPending ? (
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onSkip(dose)}
            disabled={disabled}
            className="flex items-center justify-center w-10 h-10 rounded-xl border-2 border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50 touch-target"
            aria-label={t("dose.skipAria")}
          >
            <SkipForward className="w-4 h-4" />
          </button>
          <button
            onClick={() => onTake(dose)}
            disabled={disabled}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50 touch-target"
            aria-label={t("dose.takeAria")}
          >
            <Check className="w-5 h-5" strokeWidth={2.5} />
          </button>
        </div>
      ) : (
        <span className={cn("shrink-0 px-3 py-1.5 rounded-full text-xs font-medium", statusCfg.bg, statusCfg.text)}>
          {t(statusCfg.labelKey)}
        </span>
      )}
    </div>
  );
}
