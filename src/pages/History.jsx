import { useState, useEffect, useCallback } from "react";
import { api } from "@/api/supabaseClient";
import { useI18n } from "@/i18n";
import { formatTime, formatDate, doseStatusConfig } from "@/lib/medicationUtils";
import EmptyState from "@/components/EmptyState";
import { History as HistoryIcon, Filter, CheckCircle2, SkipForward, AlertCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function History() {
  const { t, lang } = useI18n();
  const [logs, setLogs] = useState([]);
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMed, setFilterMed] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allLogs, meds] = await Promise.all([
        api.entities.DoseLog.list("-scheduled_date", 200),
        api.entities.Medication.list(),
      ]);
      // فقط السجلات غير المعلقة (لها حالة نهائية)
      const finalLogs = allLogs.filter((l) => l.status !== "pending");
      setLogs(finalLogs);
      setMedications(meds);
    } catch (err) {
      console.error("Load history error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = logs.filter((log) => {
    if (filterMed !== "all" && log.medication_id !== filterMed) return false;
    if (filterStatus !== "all" && log.status !== filterStatus) return false;
    return true;
  });

  // تجميع حسب التاريخ
  const grouped = {};
  for (const log of filtered) {
    const date = log.scheduled_date;
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(log);
  }
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const stats = {
    taken: filtered.filter((l) => l.status === "taken").length,
    skipped: filtered.filter((l) => l.status === "skipped").length,
    missed: filtered.filter((l) => l.status === "missed").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-secondary border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-heading font-extrabold text-2xl lg:text-3xl text-foreground">{t("history.title")}</h1>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-colors", showFilters ? "border-accent text-accent bg-accent/5" : "border-border text-muted-foreground")}
        >
          <Filter className="w-4 h-4" />
          {t("history.filter")}
          <ChevronDown className={cn("w-4 h-4 transition-transform", showFilters && "rotate-180")} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={CheckCircle2} label={t("history.statTaken")} value={stats.taken} color="accent" />
        <StatCard icon={SkipForward} label={t("history.statSkipped")} value={stats.skipped} color="muted" />
        <StatCard icon={AlertCircle} label={t("history.statMissed")} value={stats.missed} color="alert" />
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-card rounded-2xl border-2 border-border p-4 space-y-3 animate-scale-in">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t("history.medicationLabel")}</label>
            <select
              value={filterMed}
              onChange={(e) => setFilterMed(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border-2 border-border bg-card text-sm text-foreground outline-none focus:border-accent"
            >
              <option value="all">{t("history.allMedications")}</option>
              {medications.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t("history.statusLabel")}</label>
            <div className="flex gap-2">
              {["all", "taken", "skipped", "missed"].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={cn("px-3 py-2 rounded-xl text-sm font-medium border-2 transition-all", filterStatus === s ? "border-accent bg-accent/5 text-accent" : "border-border text-muted-foreground")}
                >
                  {s === "all" ? t("history.all") : t(doseStatusConfig[s]?.labelKey || "doseStatus.pending")}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* History List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title={t("history.emptyTitle")}
          description={t("history.emptyDesc")}
        />
      ) : (
        <div className="space-y-5">
          {sortedDates.map((date) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2 sticky top-0 bg-background/80 backdrop-blur-sm py-1">
                {formatDate(date, lang)}
              </h3>
              <div className="space-y-2">
                {grouped[date].map((log) => {
                  const cfg = doseStatusConfig[log.status] || doseStatusConfig.pending;
                  const StatusIcon = log.status === "taken" ? CheckCircle2 : log.status === "skipped" ? SkipForward : AlertCircle;
                  return (
                    <div key={log.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border-2 border-border">
                      <div className={cn("flex items-center justify-center w-10 h-10 rounded-full shrink-0", cfg.bg)}>
                        <StatusIcon className={cn("w-5 h-5", cfg.text)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{log.medication_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(log.scheduled_time, t)}
                          {log.confirmed_by_name && ` · ${log.confirmed_by_name}`}
                        </p>
                      </div>
                      <span className={cn("shrink-0 px-2.5 py-1 rounded-full text-xs font-medium", cfg.bg, cfg.text)}>
                        {t(cfg.labelKey)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    accent: "bg-accent/10 text-accent",
    muted: "bg-secondary text-muted-foreground",
    alert: "bg-alert/10 text-alert",
  };
  return (
    <div className="bg-card rounded-2xl border-2 border-border p-4 text-center">
      <div className={cn("flex items-center justify-center w-10 h-10 rounded-full mx-auto mb-2", colors[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="font-heading font-extrabold text-xl text-foreground tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
