import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { useI18n } from "@/i18n";
import { buildTodaySchedule, takeDose, skipDose, groupByPeriod } from "@/lib/doseOperations";
import { formatTime, formatTimeRemaining, getInventoryStatus, inventoryStatusConfig, timePeriodConfig, compareTime, nowTimeStr, relationshipLabels } from "@/lib/medicationUtils";
import AdherenceRing from "@/components/AdherenceRing";
import DoseRow from "@/components/DoseRow";
import EmptyState from "@/components/EmptyState";
import { Pill, Plus, AlertTriangle, Sunrise, Sun, Sunset, Moon, ShieldAlert, Users, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { logActivity } from "@/lib/logActivity";

const periodIcons = { morning: Sunrise, afternoon: Sun, evening: Sunset, night: Moon };

export default function Home() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [recipients, setRecipients] = useState([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState(null);
  const [medications, setMedications] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const loadRecipients = useCallback(async () => {
    const recs = await api.entities.CareRecipient.list();
    setRecipients(recs);
    if (recs.length > 0 && !selectedRecipientId) {
      setSelectedRecipientId(recs[0].id);
    }
  }, [selectedRecipientId]);

  const loadMedications = useCallback(async () => {
    if (!selectedRecipientId) { setMedications([]); return; }
    const meds = await api.entities.Medication.filter({ recipient_id: selectedRecipientId, active: true });
    setMedications(meds);
  }, [selectedRecipientId]);

  const loadSchedule = useCallback(async () => {
    if (!selectedRecipientId || medications.length === 0) { setSchedule([]); return; }
    const sched = await buildTodaySchedule(medications, selectedRecipientId);
    setSchedule(sched);
  }, [selectedRecipientId, medications]);

  useEffect(() => {
    if (!localStorage.getItem("onboarding_completed")) {
      navigate("/onboarding");
      return;
    }
    (async () => {
      setLoading(true);
      await loadRecipients();
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    loadMedications();
  }, [loadMedications]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const handleTake = async (dose) => {
    setActionLoading(`${dose.medication_id}_${dose.scheduled_time}`);
    try {
      await takeDose(dose, user);
      await loadMedications();
      await loadSchedule();
      logActivity("dose_taken", { targetName: dose.medication_name, recipientName: selectedRecipient?.name || "" });
    } catch (err) {
      console.error("Take dose error:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSkip = async (dose) => {
    setActionLoading(`${dose.medication_id}_${dose.scheduled_time}`);
    try {
      await skipDose(dose, user);
      await loadSchedule();
      logActivity("dose_skipped", { targetName: dose.medication_name, recipientName: selectedRecipient?.name || "" });
    } catch (err) {
      console.error("Skip dose error:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const completedCount = schedule.filter((d) => d.status === "taken").length;
  const totalCount = schedule.length;
  const selectedRecipient = recipients.find((r) => r.id === selectedRecipientId);
  const greeting = t(getGreeting());

  // Next urgent dose
  const now = nowTimeStr();
  const nextDose = schedule.find((d) => d.status === "pending" && compareTime(d.scheduled_time, now) >= 0) ||
    schedule.find((d) => d.status === "pending");

  // Low stock medications
  const lowStockMeds = medications.filter((m) => {
    const status = getInventoryStatus(m);
    return status !== "normal";
  });

  const grouped = groupByPeriod(schedule);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-secondary border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  // No recipients yet
  if (recipients.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Header greeting={greeting} userName={user?.email} />
        <EmptyState
          icon={Users}
          title={t("home.welcomeTitle")}
          description={t("home.welcomeDesc")}
          action={
            <Link to="/profile" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent/90 transition-colors">
              <Plus className="w-5 h-5" />
              {t("home.addPerson")}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-6 relative">
      {/* Header */}
      <Header greeting={greeting} userName={user?.email} />

      {/* Chatbot Floating Button */}
      <Link
        to="/chatbot"
        className="fixed bottom-24 lg:bottom-6 start-4 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 active:scale-95 transition-transform"
        aria-label={t("chatbot.title")}
      >
        <Bot className="w-6 h-6" />
      </Link>

      {/* Recipient Selector */}
      {recipients.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
          {recipients.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRecipientId(r.id)}
              className={cn(
                "shrink-0 px-4 py-2 rounded-full text-sm font-medium border-2 transition-all",
                r.id === selectedRecipientId
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/30"
              )}
            >
              {r.name} · {t(relationshipLabels[r.relationship] || "relationship.other")}
            </button>
          ))}
        </div>
      )}

      {/* Two-column layout on desktop */}
      <div className="grid lg:grid-cols-[340px_1fr] gap-6">
        {/* Left Rail */}
        <div className="space-y-4">
          {/* Adherence Summary */}
          <div className="bg-card rounded-2xl border-2 border-border p-6 text-center">
            <AdherenceRing completed={completedCount} total={totalCount} size={140} />
            <p className="text-sm text-muted-foreground mt-3">
              {totalCount === 0 ? t("home.noDoses") : t("home.dosesCompleted", { done: completedCount, total: totalCount })}
            </p>
          </div>

          {/* Next Urgent Dose */}
          {nextDose && (
            <div className="bg-card rounded-2xl border-2 border-accent/30 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <span className="text-xs font-semibold text-accent uppercase tracking-wide">{t("home.nextDose")}</span>
              </div>
              <h3 className="font-heading font-bold text-xl text-foreground mb-1">{nextDose.medication_name}</h3>
              <p className="text-3xl font-heading font-extrabold text-primary tabular-nums mb-2">{formatTime(nextDose.scheduled_time, t)}</p>
              <p className="text-sm text-muted-foreground mb-4">{formatTimeRemaining(nextDose.scheduled_time, t)}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSkip(nextDose)}
                  disabled={actionLoading === `${nextDose.medication_id}_${nextDose.scheduled_time}`}
                  className="flex-1 py-3 rounded-xl border-2 border-border text-muted-foreground font-medium text-sm hover:bg-muted transition-colors disabled:opacity-50 touch-target"
                >
                  {t("common.skip")}
                </button>
                <button
                  onClick={() => handleTake(nextDose)}
                  disabled={actionLoading === `${nextDose.medication_id}_${nextDose.scheduled_time}`}
                  className="flex-1 py-3 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent/90 transition-colors disabled:opacity-50 touch-target"
                >
                  {t("home.taken")}
                </button>
              </div>
            </div>
          )}

          {/* Low Stock Alerts */}
          {lowStockMeds.length > 0 && (
            <div className="bg-card rounded-2xl border-2 border-warning/30 p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <span className="text-xs font-semibold text-warning uppercase tracking-wide">{t("home.lowStockAlerts")}</span>
              </div>
              <div className="space-y-2">
                {lowStockMeds.map((med) => {
                  const status = getInventoryStatus(med);
                  const cfg = inventoryStatusConfig[status];
                  return (
                    <Link
                      key={med.id}
                      to={`/medications/${med.id}`}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{med.name}</p>
                        <p className="text-xs text-muted-foreground">{t("home.remaining")}: {med.remaining_quantity} {med.dosage_unit}</p>
                      </div>
                      <span className={cn("shrink-0 px-2.5 py-1 rounded-full text-xs font-medium", cfg.bg, cfg.text)}>
                        {t(cfg.labelKey)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Medical Disclaimer */}
          <DisclaimerCard />
        </div>

        {/* Right Main Stage - Today's Schedule */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-bold text-lg text-foreground">{t("home.todaySchedule")}</h2>
            <Link to="/medications/new" className="text-sm text-accent font-medium hover:underline">{t("home.addMedication")}</Link>
          </div>

          {schedule.length === 0 ? (
            <EmptyState
              icon={Pill}
              title={t("home.noScheduledDoses")}
              description={t("home.noScheduledDosesDesc")}
              action={
                <Link to="/medications/new" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent/90 transition-colors">
                  <Plus className="w-5 h-5" />
                  {t("home.addMedication")}
                </Link>
              }
            />
          ) : (
            <div className="space-y-6">
              {["morning", "afternoon", "evening", "night"].map((period) => {
                const doses = grouped[period];
                if (!doses || doses.length === 0) return null;
                const PeriodIcon = periodIcons[period];
                const cfg = timePeriodConfig[period];
                return (
                  <div key={period} className="animate-fade-in">
                    <div className="flex items-center gap-2 mb-3">
                      <PeriodIcon className="w-5 h-5 text-muted-foreground" />
                      <h3 className="font-heading font-bold text-base text-foreground">{t(cfg.labelKey)}</h3>
                      <span className="text-xs text-muted-foreground">{t(cfg.rangeKey)}</span>
                      <span className="text-xs text-muted-foreground mr-auto">{t("home.doseCount", { count: doses.length })}</span>
                    </div>
                    <div className="space-y-2">
                      {doses.map((dose, idx) => (
                        <DoseRow
                          key={`${dose.medication_id}_${dose.scheduled_time}_${idx}`}
                          dose={dose}
                          medication={dose.medication}
                          onTake={handleTake}
                          onSkip={handleSkip}
                          disabled={actionLoading === `${dose.medication_id}_${dose.scheduled_time}`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Header({ greeting, userName }) {
  const { t, lang } = useI18n();
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{greeting}</p>
        <h1 className="font-heading font-extrabold text-2xl lg:text-3xl text-foreground mt-1">
          {userName ? userName.split("@")[0] : t("common.welcome")}
        </h1>
      </div>
      <Link to="/medications/new" className="hidden lg:flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
        <Plus className="w-4 h-4" strokeWidth={2.5} />
        {t("home.newMedication")}
      </Link>
    </div>
  );
}

function DisclaimerCard() {
  const { t, lang } = useI18n();
  return (
    <div className="flex items-start gap-2 p-3.5 rounded-xl bg-secondary/50 border border-border">
      <ShieldAlert className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
      <p className="text-xs text-muted-foreground leading-relaxed">
        {t("home.disclaimer")}
      </p>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "greeting.morning";
  if (h >= 12 && h < 17) return "greeting.noon";
  if (h >= 17 && h < 21) return "greeting.evening";
  return "greeting.night";
}