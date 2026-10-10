import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useI18n, LANGUAGES } from "@/i18n";
import { api } from "@/api/supabaseClient";
import { Switch } from "@/components/ui/switch";
import { Bell, Globe, Info, ShieldAlert, PillBottle, ChevronLeft, Heart, Check, Download, Trash2, AlertCircle, Lock, User, LogOut, FileText, Share2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { notificationService } from "@/lib/notificationService";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/lib/remindersBootstrap";
import { generateWeeklyReport, downloadPdf, sharePdf, getWhatsAppShareUrl, getEmailShareUrl } from "@/lib/pdfGenerator";
import { toast } from "@/components/ui/use-toast";
import AppLockSettings from "@/components/security/AppLockSettings";

export default function Settings() {
  const { user, checkUserAuth } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [sharingReport, setSharingReport] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const existing = await api.entities.NotificationSettings.list();
      if (existing.length > 0) {
        setSettings(existing[0]);
      } else {
        const created = await api.entities.NotificationSettings.create(DEFAULT_NOTIFICATION_SETTINGS);
        setSettings(created);
      }
    } catch (err) {
      console.error("Load settings error:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSetting = async (key, value) => {
    if (!settings) return;
    const prev = settings;
    setSettings({ ...settings, [key]: value });
    try {
      await api.entities.NotificationSettings.update(settings.id, { [key]: value });
      if (key === "dose_reminders" && value) {
        const perm = await notificationService.requestPermission();
        if (perm !== "granted") {
          setMessage(t("notifications.permissionDenied"));
        }
      }
    } catch (err) {
      console.error("Update setting error:", err);
      setSettings(prev);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setMessage("");
    try {
      const [meds, logs, recipients, family, notifs, notifSettings] = await Promise.all([
        api.entities.Medication.filter({}),
        api.entities.DoseLog.filter({}),
        api.entities.CareRecipient.filter({}),
        api.entities.FamilyMember.filter({}),
        api.entities.Notification.filter({}),
        api.entities.NotificationSettings.filter({}),
      ]);
      const data = {
        exported_at: new Date().toISOString(),
        user: { email: user?.email },
        medications: meds,
        dose_logs: logs,
        care_recipients: recipients,
        family_members: family,
        notifications: notifs,
        notification_settings: notifSettings,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `medi_companion_export_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage(t("settings.exportReady"));
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteData = async () => {
    setDeleting(true);
    try {
      const uid = user.id;
      await api.entities.Medication.deleteMany({ created_by_id: uid });
      await api.entities.DoseLog.deleteMany({ created_by_id: uid });
      await api.entities.Notification.deleteMany({ created_by_id: uid });
      await api.entities.CareRecipient.deleteMany({ created_by_id: uid });
      await api.entities.FamilyMember.deleteMany({ created_by_id: uid });
      await api.entities.NotificationSettings.deleteMany({ created_by_id: uid });
      setShowDeleteConfirm(false);
      setMessage(t("settings.deleteConfirmTitle"));
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setDeleting(false);
    }
  };

  const handleGenerateWeeklyReport = async () => {
    setGeneratingReport(true);
    setMessage("");
    try {
      // Determine date range: past 7 days
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7);
      const startStr = start.toISOString().split("T")[0];
      const endStr = end.toISOString().split("T")[0];

      // Fetch recipients
      const recipients = await api.entities.CareRecipient.list();
      if (recipients.length === 0) {
        setMessage(t("settings.noRecipients"));
        return;
      }

      // Fetch dose logs for past 7 days
      const allLogs = [];
      for (const recipient of recipients) {
        const logs = await api.entities.DoseLog.filter({ recipient_id: recipient.id });
        const filtered = logs.filter((l) => {
          const d = l.scheduled_date || "";
          return d >= startStr && d <= endStr;
        });
        filtered.forEach((l) => allLogs.push(l));
      }

      // Fetch vital signs for past 7 days
      const allVitals = [];
      for (const recipient of recipients) {
        try {
          const vitals = await api.entities.VitalSigns.filter({ recipient_id: recipient.id }, "-created_date", 100);
          const filtered = vitals.filter((v) => {
            const d = (v.recorded_at || v.created_date || "").split("T")[0];
            return d >= startStr && d <= endStr;
          });
          filtered.forEach((v) => allVitals.push(v));
        } catch {}
      }

      const recipientName = recipients[0]?.name || "";

      const doc = await generateWeeklyReport({
        doseLogs: allLogs,
        vitalSigns: allVitals,
        recipientName,
        weekStart: start,
        weekEnd: end,
        // The report mirrors the active UI language instead of being Arabic-only.
        labels: {
          title: t("report.title"),
          adherenceTitle: t("report.adherenceTitle"),
          taken: t("report.taken"),
          skipped: t("report.skipped"),
          missed: t("report.missed"),
          pending: t("report.pending"),
          legendTaken: t("report.legendTaken"),
          legendSkipped: t("report.legendSkipped"),
          legendMissed: t("report.legendMissed"),
          legendPending: t("report.legendPending"),
          adherenceRate: t("report.adherenceRate"),
          rateExcellent: t("report.rateExcellent"),
          rateGood: t("report.rateGood"),
          ratePoor: t("report.ratePoor"),
          vitalsTitle: t("report.vitalsTitle"),
          vitalsNone: t("report.vitalsNone"),
          bloodPressure: t("report.bloodPressure"),
          bloodSugar: t("report.bloodSugar"),
          weight: t("report.weight"),
          lastReading: t("report.lastReading"),
          average: t("report.average"),
          detailTitle: t("report.detailTitle"),
          colDate: t("report.colDate"),
          colTime: t("report.colTime"),
          colMedication: t("report.colMedication"),
          colStatus: t("report.colStatus"),
          colNote: t("report.colNote"),
          statusTaken: t("report.statusTaken"),
          statusSkipped: t("report.statusSkipped"),
          statusMissed: t("report.statusMissed"),
          statusPending: t("report.statusPending"),
          emptyLogs: t("report.emptyLogs"),
          noRecipient: t("report.noRecipient"),
          moreEntries: (n) => t("report.moreEntries", { n }),
          footer: (when) => t("report.footer", { when }),
        },
      });

      setGeneratedDoc(doc);
      setReportGenerated(true);
      setMessage(t("settings.reportReady"));
    } catch (err) {
      console.error("Report generation error:", err);
      setMessage(t("settings.reportFailed"));
      toast({ title: t("settings.reportFailed"), description: String(err?.message || err), variant: "destructive" });
    } finally {
      setGeneratingReport(false);
    }
  };

  // Latin filename: Arabic filenames round-trip badly through Filesystem/MediaStore
  // on some Android builds, and the name is only a label the user sees in Files.
  const reportFilename = () => `${t("common.weeklyReport").replace(/[^\p{L}\p{N}]+/gu, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;

  const handleDownloadReport = async () => {
    if (!generatedDoc) return;
    const filename = reportFilename();
    setSharingReport(true);
    try {
      if (window.Capacitor?.isNativePlatform?.()) {
        // Inside the Android WebView there is no download manager wired up, so
        // jsPDF's doc.save() (a blob download) is silently dropped. Write the
        // file to public Documents -- on API 29+ Capacitor routes this through
        // MediaStore, so it lands in the user's Downloads/Files with no storage
        // permission required -- then confirm with a toast.
        const { Filesystem, Directory } = await import("@capacitor/filesystem");
        const base64 = generatedDoc.output("datauristring").split(",")[1];
        await Filesystem.writeFile({
          path: filename,
          data: base64,
          directory: Directory.Documents,
          recursive: true,
        });
        setMessage(t("settings.reportSaved"));
        toast({ title: t("settings.reportSaved"), description: filename });
      } else {
        downloadPdf(generatedDoc, filename);
        setMessage(t("settings.reportSaved"));
      }
    } catch (e) {
      console.error("Report save failed:", e);
      // Fall back to the share sheet, which can still save the file.
      try {
        const { Share } = await import("@capacitor/share");
        const { Filesystem, Directory } = await import("@capacitor/filesystem");
        const base64 = generatedDoc.output("datauristring").split(",")[1];
        const written = await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
        await Share.share({ title: t("settings.weeklyReport"), url: written.uri, dialogTitle: t("settings.downloadReport") });
      } catch (e2) {
        console.error("Report share fallback failed:", e2);
        toast({ title: t("settings.reportFailed"), description: String(e2?.message || e2), variant: "destructive" });
      }
    } finally {
      setSharingReport(false);
    }
  };

  // Prefer the OS share sheet on native (Capacitor Share), fall back to the
  // web share/download path so the button works in the PWA too.
  const handleSharePdf = async () => {
    if (!generatedDoc) return;
    setSharingReport(true);
    try {
      const filename = reportFilename();
      if (window.Capacitor?.isNativePlatform?.()) {
        try {
          const [{ Share }, { Filesystem, Directory }] = await Promise.all([
            import("@capacitor/share"),
            import("@capacitor/filesystem"),
          ]);
          const dataUri = generatedDoc.output("datauristring");
          const base64 = dataUri.split(",")[1];
          const written = await Filesystem.writeFile({
            path: filename,
            data: base64,
            directory: Directory.Cache,
          });
          await Share.share({
            title: t("settings.weeklyReport"),
            text: t("settings.shareReportText"),
            url: written.uri,
            dialogTitle: t("settings.shareReport"),
          });
          return;
        } catch (e) {
          console.warn("Native share failed, falling back to download:", e);
        }
      }
      await sharePdf(generatedDoc, filename);
    } finally {
      setSharingReport(false);
    }
  };

  // Share the generated PDF through the OS share sheet with the file attached.
  // A mailto:/wa.me link cannot carry an attachment, which is exactly why the
  // report arrived looking wrong (or not at all) -- handing the actual .pdf file
  // to Share lets Gmail/WhatsApp/etc. attach it properly.
  const shareReportFile = async (dialogTitle) => {
    if (!generatedDoc) return false;
    const filename = `تقرير_الأسبوع_${new Date().toISOString().split("T")[0]}.pdf`;
    try {
      const [{ Share }, { Filesystem, Directory }] = await Promise.all([
        import("@capacitor/share"),
        import("@capacitor/filesystem"),
      ]);
      const base64 = generatedDoc.output("datauristring").split(",")[1];
      const written = await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
      await Share.share({
        title: t("settings.weeklyReport"),
        text: t("settings.shareReportText"),
        url: written.uri,
        dialogTitle: dialogTitle || t("settings.shareReport"),
      });
      return true;
    } catch (e) {
      console.warn("Report file share failed:", e);
      return false;
    }
  };

  const handleWhatsApp = async () => {
    if (await shareReportFile(t("settings.shareVia"))) return;
    window.open(getWhatsAppShareUrl(null, t("settings.shareReportText")), "_blank");
  };

  const handleEmailShare = async () => {
    if (await shareReportFile(t("settings.shareReport"))) return;
    window.open(getEmailShareUrl(t("settings.reportSectionTitle"), t("settings.shareReportText")), "_blank");
  };

  const toggleConfigs = [
    { key: "dose_reminders", label: t("settings.doseReminders"), desc: t("settings.doseRemindersDesc") },
    { key: "missed_dose_reminders", label: t("settings.missedDoseReminders"), desc: t("settings.missedDoseDesc") },
    { key: "low_stock_alerts", label: t("settings.lowStock"), desc: t("settings.lowStockDesc") },
    { key: "family_notifications", label: t("settings.familyActivity"), desc: t("settings.familyActivityDesc") },
    { key: "daily_summary", label: t("settings.dailySummary"), desc: t("settings.dailySummaryDesc") },
    { key: "notification_sound", label: t("settings.notificationSound"), desc: "" },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/profile" className="flex items-center justify-center w-10 h-10 rounded-xl border-2 border-border text-muted-foreground hover:bg-muted transition-colors">
          <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
        </Link>
        <h1 className="font-heading font-extrabold text-2xl lg:text-3xl text-foreground">{t("settings.title")}</h1>
      </div>

      {message && (
        <div className="p-3 rounded-xl bg-accent/10 text-accent text-sm flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 shrink-0" />
          {message}
        </div>
      )}

      {/* Notifications */}
      <Section icon={Bell} title={t("settings.notifications")}>
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">{t("common.loading")}</div>
        ) : settings ? (
          <div className="divide-y divide-border">
            {toggleConfigs.map((cfg) => (
              <ToggleRow
                key={cfg.key}
                label={cfg.label}
                description={cfg.desc}
                checked={!!settings[cfg.key]}
                onToggle={(v) => toggleSetting(cfg.key, v)}
              />
            ))}

            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{t("settings.quietHours")}</p>
                  <p className="text-xs text-muted-foreground">{t("settings.quietHoursDesc")}</p>
                </div>
                <Switch
                  checked={!!settings.quiet_hours_enabled}
                  onCheckedChange={(v) => toggleSetting("quiet_hours_enabled", v)}
                />
              </div>
              {settings.quiet_hours_enabled && (
                <>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={settings.quiet_hours_start || "22:00"}
                      onChange={(e) => toggleSetting("quiet_hours_start", e.target.value)}
                      className="flex-1 h-11 px-3 rounded-xl border-2 border-border bg-card text-sm text-foreground outline-none focus:border-accent tabular-nums"
                      aria-label={t("settings.quietFrom")}
                    />
                    <span className="text-xs text-muted-foreground">{t("settings.quietTo")}</span>
                    <input
                      type="time"
                      value={settings.quiet_hours_end || "07:00"}
                      onChange={(e) => toggleSetting("quiet_hours_end", e.target.value)}
                      className="flex-1 h-11 px-3 rounded-xl border-2 border-border bg-card text-sm text-foreground outline-none focus:border-accent tabular-nums"
                      aria-label={t("settings.quietTo")}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{t("settings.quietHoursNote")}</p>
                </>
              )}
            </div>
          </div>
        ) : null}

        <div className="p-4 border-t border-border">
          <Link
            to="/notification-history"
            className="flex items-center gap-3 p-3 rounded-xl border-2 border-border hover:border-accent/30 transition-colors"
          >
            <Bell className="w-5 h-5 text-accent shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{t("notifications.historyTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("notifications.historyDesc")}</p>
            </div>
          </Link>
        </div>
      </Section>

      {/* Language */}
      <Section icon={Globe} title={t("settings.language")}>
        <div className="p-4">
          <div className="flex flex-wrap gap-2 mb-3">
            {LANGUAGES.map((l) => {
              const active = l.code === lang;
              return (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-colors",
                    active ? "border-accent bg-accent/5 text-accent" : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {active && <Check className="w-3.5 h-3.5" />}
                  {l.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {LANGUAGES.find((l) => l.code === lang)?.label} — {t("settings.languageDesc")}
          </p>
        </div>
      </Section>

      {/* Privacy & Data */}
      <Section icon={Lock} title={t("settings.privacySection")}>
        <div className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">{t("settings.privacyDesc")}</p>
          <div className="rounded-2xl border-2 border-border">
            <AppLockSettings user={user} onChanged={checkUserAuth} />
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-3 w-full p-3 rounded-xl border-2 border-border hover:border-accent/30 transition-colors text-start disabled:opacity-50"
          >
            <Download className="w-5 h-5 text-accent shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{t("settings.exportData")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.exportDataDesc")}</p>
            </div>
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-3 w-full p-3 rounded-xl border-2 border-alert/30 hover:bg-alert/5 transition-colors text-start"
          >
            <Trash2 className="w-5 h-5 text-alert shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{t("settings.deleteData")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.deleteDataDesc")}</p>
            </div>
          </button>
        </div>
      </Section>

      {/* Weekly Report Section */}
      <div className="bg-card rounded-2xl border-2 border-border overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/30">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-heading font-bold text-sm text-foreground">{t("settings.reportSectionTitle")}</h2>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">{t("settings.reportSectionDesc")}</p>
          <button
            onClick={handleGenerateWeeklyReport}
            disabled={generatingReport}
            className="flex items-center gap-3 w-full p-3 rounded-xl border-2 border-accent/30 hover:bg-accent/5 transition-colors text-start disabled:opacity-50"
          >
            {generatingReport ? (
              <Loader2 className="w-5 h-5 text-accent shrink-0 animate-spin" />
            ) : (
              <FileText className="w-5 h-5 text-accent shrink-0" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{generatingReport ? t("settings.generatingReport") : t("settings.generateReport")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.generateReportHint")}</p>
            </div>
          </button>

          {reportGenerated && (
            <div className="flex flex-col gap-2 animate-fade-in">
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadReport}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent/90 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {t("settings.downloadReport")}
                </button>
                <div className="relative flex-1">
                  <button
                    onClick={handleSharePdf}
                    disabled={sharingReport}
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-border text-muted-foreground font-medium text-sm hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    {sharingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                    {t("settings.share")}
                  </button>
                  {showShareMenu && (
                    <div className="absolute bottom-full mb-1 left-0 right-0 bg-card rounded-xl border-2 border-border shadow-lg overflow-hidden z-10">
                      <button
                        onClick={() => { handleWhatsApp(); setShowShareMenu(false); }}
                        className="flex items-center gap-2 w-full px-4 py-3 text-sm hover:bg-muted transition-colors text-start"
                      >
                        <span className="text-base">💬</span>
                        <span>WhatsApp</span>
                      </button>
                      <button
                        onClick={() => { handleEmailShare(); setShowShareMenu(false); }}
                        className="flex items-center gap-2 w-full px-4 py-3 text-sm hover:bg-muted transition-colors text-start"
                      >
                        <span className="text-base">✉️</span>
                        <span>البريد الإلكتروني</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Account */}
      <Section icon={User} title={t("settings.account")}>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-secondary font-semibold text-sm">
              {user?.email?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
              <p className="text-xs text-muted-foreground">{t("settings.accountEmail")}</p>
            </div>
          </div>
          <button
            onClick={() => api.auth.logout()}
            className="flex items-center gap-2 w-full p-3 rounded-xl border-2 border-border hover:bg-muted transition-colors text-start"
          >
            <LogOut className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{t("settings.logout")}</span>
          </button>
        </div>
      </Section>

      {/* About */}
      <Section icon={Info} title={t("settings.about")}>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-accent text-accent-foreground">
              <PillBottle className="w-6 h-6" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-heading font-bold text-base text-foreground">{t("app.name")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.version")}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{t("settings.aboutDesc")}</p>
        </div>
      </Section>

      {/* Medical Disclaimer */}
      <Section icon={ShieldAlert} title={t("settings.medicalDisclaimer")}>
        <div className="p-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{t("settings.disclaimerText")}</p>
        </div>
      </Section>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-2xl border-2 border-border p-6 max-w-sm w-full space-y-4 animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-alert" />
              <h2 className="font-heading font-bold text-lg text-foreground">{t("settings.deleteConfirmTitle")}</h2>
            </div>
            <p className="text-sm text-muted-foreground">{t("settings.deleteConfirmMsg")}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl border-2 border-border text-muted-foreground font-medium text-sm hover:bg-muted transition-colors disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleDeleteData}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl bg-alert text-alert-foreground font-semibold text-sm hover:bg-alert/90 transition-colors disabled:opacity-50"
              >
                {deleting ? t("common.loading") : t("settings.deleteData")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-1.5 py-4 text-xs text-muted-foreground">
        {t("settings.madeWith")} <Heart className="w-3.5 h-3.5 text-alert fill-alert" /> {t("settings.forFamilies")}
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="bg-card rounded-2xl border-2 border-border overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/30">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h2 className="font-heading font-bold text-sm text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function ToggleRow({ label, description, checked, onToggle }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onToggle} />
    </div>
  );
}