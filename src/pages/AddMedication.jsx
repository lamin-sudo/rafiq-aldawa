import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { generateDefaultTimes, formatTime, relationshipLabels, todayStr } from "@/lib/medicationUtils";
import { logActivity } from "@/lib/logActivity";
import { useTranslation } from "@/i18n";
import BarcodeScanner from "@/components/scan/BarcodeScanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Check, ChevronLeft, ChevronRight, Pill, Clock, Calendar, Package, FileCheck, User, Trash2, AlertCircle, Camera, FileText, Mic, MicOff, RotateCcw, ScanBarcode } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  { id: "person", labelKey: "addMedication.stepPerson", icon: User },
  { id: "name", labelKey: "addMedication.stepName", icon: Pill },
  { id: "dose", labelKey: "addMedication.stepDose", icon: Pill },
  { id: "schedule", labelKey: "addMedication.stepSchedule", icon: Clock },
  { id: "voice", labelKey: "addMedication.stepVoice", icon: Mic },
  { id: "duration", labelKey: "addMedication.stepDuration", icon: Calendar },
  { id: "inventory", labelKey: "addMedication.stepInventory", icon: Package },
  { id: "review", labelKey: "addMedication.stepReview", icon: FileCheck },
];

const dosageUnits = ["حبة", "ملغ", "مل", "قطرة", "بخة", "حقنة", "أخرى"];
const medForms = ["أقراص", "كبسولات", "شراب", "حقن", "كريم", "قطرة", "بخاخ", "أخرى"];

const dosageUnitKeys = {
  "حبة": "unitTablet",
  "ملغ": "unitMg",
  "مل": "unitMl",
  "قطرة": "unitDrop",
  "بخة": "unitPuff",
  "حقنة": "unitInjection",
  "أخرى": "unitOther",
};
const medFormKeys = {
  "أقراص": "formTablets",
  "كبسولات": "formCapsules",
  "شراب": "formSyrup",
  "حقن": "formInjections",
  "كريم": "formCream",
  "قطرة": "formDrops",
  "بخاخ": "formSpray",
  "أخرى": "formOther",
};
const dosageKey = (unit) => (dosageUnitKeys[unit] ? `addMedication.${dosageUnitKeys[unit]}` : unit);
const formKey = (form) => (medFormKeys[form] ? `addMedication.${medFormKeys[form]}` : form);

// The shared `medications_db` stores dosage forms in English; the form control
// here uses Arabic labels, so translate before contributing a barcode.
const FORM_TO_DB = {
  "أقراص": "Tablet",
  "كبسولات": "Capsule",
  "شراب": "Syrup",
  "حقن": "Injection",
  "كريم": "Cream",
  "قطرة": "Drops",
  "بخاخ": "Spray",
  "أخرى": "Other",
};

export default function AddMedication() {
  const navigate = useNavigate();
  const t = useTranslation();
  const { user } = useAuth();
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [scannerOpen, setScannerOpen] = useState(false);
  // Barcode scanned in this session, kept outside `form` because the medications
  // table has no barcode column; it is contributed to medications_db on save.
  const [scannedBarcode, setScannedBarcode] = useState(null);

  const [form, setForm] = useState({
    recipient_id: "",
    name: "",
    generic_name: "",
    form: "أقراص",
    dosage: "",
    dosage_unit: "حبة",
    frequency_per_day: 1,
    scheduled_times: ["08:00"],
    start_date: todayStr(),
    end_date: "",
    instructions: "",
    notes: "",
    quantity: 30,
    remaining_quantity: 30,
    refill_threshold: 5,
    active: true,
    voice_note_base64: "",
  });

  // Voice recording state
  const [voiceState, setVoiceState] = useState({
    recording: false,
    hasPermission: null,
    mediaRecorder: null,
    audioChunks: [],
    recordedBlob: null,
    recordedUrl: null,
    base64: "",
    error: "",
    duration: 0,
    maxDuration: 10,
  });
  const voiceIntervalRef = useRef(null);
  const mediaRecorderRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const recs = await api.entities.CareRecipient.list();
        setRecipients(recs);
        if (recs.length === 1) {
          setForm((f) => ({ ...f, recipient_id: recs[0].id }));
          setCurrentStep(1);
        }
      } catch (err) {
        console.error("Load recipients error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateForm = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleFrequencyChange = (freq) => {
    const num = parseInt(freq);
    updateForm("frequency_per_day", num);
    const defaultTimes = generateDefaultTimes(num);
    updateForm("scheduled_times", defaultTimes);
  };

  const updateTime = (index, value) => {
    const newTimes = [...form.scheduled_times];
    newTimes[index] = value;
    updateForm("scheduled_times", newTimes);
  };

  const addTime = () => {
    updateForm("scheduled_times", [...form.scheduled_times, "12:00"]);
    updateForm("frequency_per_day", form.scheduled_times.length + 1);
  };

  const removeTime = (index) => {
    if (form.scheduled_times.length <= 1) return;
    const newTimes = form.scheduled_times.filter((_, i) => i !== index);
    updateForm("scheduled_times", newTimes);
    updateForm("frequency_per_day", newTimes.length);
  };

  // --- Voice Recording Functions ---
  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setVoiceState((vs) => ({ ...vs, hasPermission: true, error: "" }));
      return true;
    } catch {
      setVoiceState((vs) => ({ ...vs, hasPermission: false, error: t("addMedication.microphonePermissionDenied") }));
      return false;
    }
  };

  const startRecording = async () => {
    const hasPerm = voiceState.hasPermission ?? (await requestMicrophonePermission());
    if (!hasPerm) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      const chunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
        );
        setVoiceState((vs) => ({
          ...vs,
          recordedBlob: blob,
          recordedUrl: url,
          base64,
          recording: false,
          duration: 0,
        }));
        updateForm("voice_note_base64", base64);
      };

      mediaRecorder.start();
      setVoiceState((vs) => ({ ...vs, recording: true, error: "", audioChunks: chunks, duration: 0 }));

      // Duration counter
      voiceIntervalRef.current = setInterval(() => {
        setVoiceState((vs) => {
          const newDur = vs.duration + 1;
          if (newDur >= vs.maxDuration) {
            stopRecording();
            return vs;
          }
          return { ...vs, duration: newDur };
        });
      }, 1000);
    } catch (err) {
      setVoiceState((vs) => ({ ...vs, recording: false, error: t("addMedication.recordingStartFailed") }));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && voiceState.recording) {
      mediaRecorderRef.current.stop();
      clearInterval(voiceIntervalRef.current);
    }
  };

  const resetRecording = () => {
    if (voiceState.recordedUrl) URL.revokeObjectURL(voiceState.recordedUrl);
    setVoiceState((vs) => ({
      ...vs,
      recordedBlob: null,
      recordedUrl: null,
      base64: "",
      duration: 0,
      recording: false,
    }));
    updateForm("voice_note_base64", "");
  };

  const validateStep = () => {
    setError("");
    const step = steps[currentStep].id;
    if (step === "person" && !form.recipient_id) { setError(t("addMedication.errorSelectPerson")); return false; }
    if (step === "name" && !form.name.trim()) { setError(t("addMedication.errorEnterMedicationName")); return false; }
    if (step === "dose" && !form.dosage.trim()) { setError(t("addMedication.errorEnterDose")); return false; }
    if (step === "schedule" && form.scheduled_times.length === 0) { setError(t("addMedication.errorAddAtLeastOneTime")); return false; }
    if (step === "duration" && form.end_date && form.end_date < form.start_date) { setError(t("addMedication.errorEndDateAfterStart")); return false; }
    if (step === "inventory" && form.remaining_quantity > form.quantity) { setError(t("addMedication.errorRemainingExceedsTotal")); return false; }
    return true;
  };

  const nextStep = () => {
    if (!validateStep()) return;
    setCurrentStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const prevStep = () => setCurrentStep((s) => Math.max(s - 1, 0));

  const handleBarcodeApply = (product, barcode) => {
    setScannerOpen(false);
    // Remember what was scanned (and whether it already came from our database)
    // so handleSave can contribute it to the shared database.
    if (barcode) {
      setScannedBarcode({
        code: String(barcode),
        fromLocal: product?.source === "rafiq_db",
        product: product || null,
      });
    }
    if (product?.name) {
      setForm((f) => ({
        ...f,
        name: product.name,
        generic_name: product.generic_name || f.generic_name,
      }));
    }
    setError("");
    setCurrentStep(1);
  };

  const handleSave = async () => {
    if (!validateStep()) return;
    setSaving(true);
    setError("");
    try {
      const recipient = recipients.find((r) => r.id === form.recipient_id);
      const med = await api.entities.Medication.create({
        ...form,
        recipient_name: recipient?.name || "",
        frequency_per_day: form.scheduled_times.length,
      });

      await api.entities.AuditLog.create({
        actor_id: user.id,
        actor_email: user.email,
        action: "medication_created",
        target_type: "Medication",
        target_id: med.id,
        target_name: med.name,
        details: t("addMedication.auditCreatedMedication", { name: med.name, recipient: recipient?.name || "" }),
      });

      logActivity("medication_added", { targetName: med.name, recipientName: recipient?.name || "" });

      // Contribute the scanned barcode to the shared Algerian medicines database
      // so the next person who scans this pack finds it locally. Skipped when the
      // record already came from there. Failure is non-fatal: the medication is
      // already saved.
      if (scannedBarcode?.code && !scannedBarcode.fromLocal) {
        api.functions
          .invoke("lookup-barcode", {
            action: "save",
            barcode: scannedBarcode.code,
            name: med.name,
            generic_name: med.generic_name || scannedBarcode.product?.generic_name || "",
            manufacturer: scannedBarcode.product?.manufacturer || "",
            strength: [med.dosage, med.dosage_unit].filter(Boolean).join(" "),
            form: FORM_TO_DB[med.form] || med.form || "",
          })
          .catch((e) => console.error("Barcode contribute error:", e));
      }

      // مزامنة الجرعات مع Google Calendar (في الخلفية)
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      api.functions.invoke("syncMedicationCalendar", { medicationId: med.id, timezone: tz })
        .catch((e) => console.error("Calendar sync error:", e));

      navigate(`/medications/${med.id}`);
    } catch (err) {
      setError(err.message || t("addMedication.errorSaving"));
      console.error("Save medication error:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-secondary border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (recipients.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-card rounded-2xl border-2 border-border p-8 text-center">
          <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-heading font-bold text-lg text-foreground mb-2">{t("addMedication.addPersonFirst")}</h2>
          <p className="text-sm text-muted-foreground mb-6">{t("addMedication.addPersonBeforeMedication")}</p>
          <Link to="/profile" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent/90 transition-colors">
            <Plus className="w-5 h-5" />
            {t("addMedication.addPerson")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center justify-center w-10 h-10 rounded-xl border-2 border-border text-muted-foreground hover:bg-muted transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
        <h1 className="font-heading font-extrabold text-2xl text-foreground">{t("addMedication.title")}</h1>
      </div>

      {/* Scan Entry Points */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Link to="/scan/prescription" className="flex flex-col items-center gap-2 p-3 rounded-2xl border-2 border-accent/30 bg-accent/5 hover:bg-accent/10 transition-colors">
          <FileText className="w-6 h-6 text-accent" />
          <span className="text-xs font-medium text-foreground text-center">{t("addMedication.scanPrescription")}</span>
        </Link>
        <Link to="/scan/medicine" className="flex flex-col items-center gap-2 p-3 rounded-2xl border-2 border-accent/30 bg-accent/5 hover:bg-accent/10 transition-colors">
          <Camera className="w-6 h-6 text-accent" />
          <span className="text-xs font-medium text-foreground text-center">{t("addMedication.scanMedicine")}</span>
        </Link>
        <button
          onClick={() => setScannerOpen(true)}
          className="flex flex-col items-center gap-2 p-3 rounded-2xl border-2 border-accent/30 bg-accent/5 hover:bg-accent/10 transition-colors"
        >
          <ScanBarcode className="w-6 h-6 text-accent" />
          <span className="text-xs font-medium text-foreground text-center">{t("barcode.button")}</span>
        </button>
      </div>

      {/* Step Progress */}
      <div className="flex items-center gap-1 mb-8 overflow-x-auto scrollbar-thin pb-1">
        {steps.map((step, idx) => {
          const StepIcon = step.icon;
          const isActive = idx === currentStep;
          const isDone = idx < currentStep;
          return (
            <div key={step.id} className="flex items-center shrink-0">
              <div
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all",
                  isActive ? "bg-accent text-accent-foreground" :
                  isDone ? "bg-accent/10 text-accent" :
                  "bg-secondary text-muted-foreground"
                )}
              >
                {isDone ? <Check className="w-3.5 h-3.5" /> : <StepIcon className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{t(step.labelKey)}</span>
              </div>
              {idx < steps.length - 1 && <div className={cn("w-4 h-0.5 mx-0.5", isDone ? "bg-accent/30" : "bg-border")} />}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="bg-card rounded-2xl border-2 border-border p-6 animate-fade-in">
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-alert/10 text-alert text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Step 0: Person */}
        {currentStep === 0 && (
          <div className="space-y-4">
            <h2 className="font-heading font-bold text-lg text-foreground">{t("addMedication.forWhom")}</h2>
            <p className="text-sm text-muted-foreground">{t("addMedication.selectPersonToTrack")}</p>
            <div className="grid gap-2">
              {recipients.map((r) => (
                <button
                  key={r.id}
                  onClick={() => updateForm("recipient_id", r.id)}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-right",
                    form.recipient_id === r.id ? "border-accent bg-accent/5" : "border-border hover:border-primary/20"
                  )}
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-secondary font-semibold text-sm">
                    {r.name[0]}
                  </div>
                  <div className="flex-1 text-right">
                    <p className="font-medium text-foreground">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{t(relationshipLabels[r.relationship] || "relationship.other")}</p>
                  </div>
                  {form.recipient_id === r.id && <Check className="w-5 h-5 text-accent" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Name */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="font-heading font-bold text-lg text-foreground">{t("addMedication.medicationInfo")}</h2>
            <div>
              <Label className="mb-1.5 block">{t("addMedication.medicationName")} *</Label>
              <Input
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
                placeholder={t("addMedication.medicationNameExample")}
                className="h-12"
                autoFocus
              />
            </div>
            <div>
              <Label className="mb-1.5 block">{t("addMedication.genericNameOptional")}</Label>
              <Input
                value={form.generic_name}
                onChange={(e) => updateForm("generic_name", e.target.value)}
                placeholder={t("addMedication.genericNameExample")}
                className="h-12"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">{t("addMedication.medicationForm")}</Label>
              <Select value={form.form} onValueChange={(v) => updateForm("form", v)}>
                <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {medForms.map((f) => <SelectItem key={f} value={f}>{t(formKey(f))}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Step 2: Dose */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <h2 className="font-heading font-bold text-lg text-foreground">{t("addMedication.dose")}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">{t("addMedication.doseAmount")} *</Label>
                <Input
                  value={form.dosage}
                  onChange={(e) => updateForm("dosage", e.target.value)}
                  placeholder="1"
                  className="h-12"
                  type="text"
                  inputMode="decimal"
                />
              </div>
              <div>
                <Label className="mb-1.5 block">{t("addMedication.unit")}</Label>
                <Select value={form.dosage_unit} onValueChange={(v) => updateForm("dosage_unit", v)}>
                  <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {dosageUnits.map((u) => <SelectItem key={u} value={u}>{t(dosageKey(u))}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">{t("addMedication.usageInstructionsOptional")}</Label>
              <Textarea
                value={form.instructions}
                onChange={(e) => updateForm("instructions", e.target.value)}
                placeholder={t("addMedication.usageInstructionsExample")}
                className="resize-none"
                rows={2}
              />
            </div>
          </div>
        )}

        {/* Step 3: Schedule */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <h2 className="font-heading font-bold text-lg text-foreground">{t("addMedication.doseSchedule")}</h2>
            <p className="text-sm text-muted-foreground">{t("addMedication.setDailyTimes")}</p>
            <div className="space-y-2">
              {form.scheduled_times.map((time, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex items-center gap-2 flex-1 p-3 rounded-xl border-2 border-border bg-secondary/30">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{t("addMedication.doseNumber", { n: idx + 1 })}</span>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => updateTime(idx, e.target.value)}
                      className="flex-1 bg-transparent text-sm font-medium text-foreground outline-none text-left tabular-nums"
                    />
                    <span className="text-sm text-muted-foreground">{formatTime(time, t)}</span>
                  </div>
                  {form.scheduled_times.length > 1 && (
                    <button
                      onClick={() => removeTime(idx)}
                      className="flex items-center justify-center w-10 h-10 rounded-xl text-muted-foreground hover:bg-alert/10 hover:text-alert transition-colors"
                      aria-label={t("addMedication.deleteTime")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addTime}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-accent hover:text-accent transition-colors text-sm font-medium w-full justify-center"
            >
              <Plus className="w-4 h-4" />
              {t("addMedication.addTime")}
            </button>
            {/* Jump to voice recording */}
            <button
              onClick={() => setCurrentStep(4)}
              className="flex items-center gap-2 p-2.5 rounded-xl border-2 border-border hover:border-accent/30 hover:bg-accent/5 transition-colors w-full"
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent/10">
                <Mic className="w-4 h-4 text-accent" />
              </div>
              <div className="flex-1 text-right">
                <p className="text-sm font-medium text-foreground">{t("addMedication.customVoiceRecording")}</p>
                <p className="text-xs text-muted-foreground">{form.voice_note_base64 ? t("addMedication.recorded") : t("addMedication.addVoiceForAlert")}</p>
              </div>
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        )}

        {/* Step 4: Voice Recording */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <h2 className="font-heading font-bold text-lg text-foreground">{t("addMedication.customVoiceRecording")}</h2>
            <p className="text-sm text-muted-foreground">{t("addMedication.recordVoiceUpTo10Seconds")}</p>

            {voiceState.error && (
              <div className="p-3 rounded-xl bg-alert/10 text-alert text-sm">{voiceState.error}</div>
            )}

            <div className="flex flex-col items-center gap-4 py-6">
              {/* Animated mic circle */}
              <div className={cn(
                "flex items-center justify-center w-24 h-24 rounded-full border-4 transition-all",
                voiceState.recording ? "border-alert bg-alert/10 animate-pulse" : "border-accent bg-accent/5"
              )}>
                {voiceState.recording ? (
                  <MicOff className="w-10 h-10 text-alert" />
                ) : voiceState.recordedUrl ? (
                  <Check className="w-10 h-10 text-accent" />
                ) : (
                  <Mic className="w-10 h-10 text-accent" />
                )}
              </div>

              {/* Duration */}
              <div className="text-center">
                {voiceState.recording ? (
                  <>
                    <p className="text-2xl font-bold text-alert font-mono">{voiceState.duration}s / {voiceState.maxDuration}s</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("addMedication.recordingInProgress")}</p>
                  </>
                ) : voiceState.recordedUrl ? (
                  <>
                    <p className="text-sm font-medium text-accent">{t("addMedication.recordedSuccessfully")}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("addMedication.listenToConfirm")}</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("addMedication.pressToStartRecording")}</p>
                )}
              </div>

              {/* Progress ring (when recording) */}
              {voiceState.recording && (
                <div className="relative w-32 h-1 bg-border rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-alert transition-all"
                    style={{ width: `${(voiceState.duration / voiceState.maxDuration) * 100}%` }}
                  />
                </div>
              )}

              {/* Controls */}
              <div className="flex items-center gap-3">
                {!voiceState.recordedUrl ? (
                  <button
                    onClick={voiceState.recording ? stopRecording : startRecording}
                    className={cn(
                      "flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all",
                      voiceState.recording
                        ? "bg-alert text-alert-foreground hover:bg-alert/90"
                        : "bg-accent text-accent-foreground hover:bg-accent/90"
                    )}
                  >
                    {voiceState.recording ? (
                      <><MicOff className="w-4 h-4" /> {t("addMedication.stop")}</>
                    ) : (
                      <><Mic className="w-4 h-4" /> {t("addMedication.startRecording")}</>
                    )}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={resetRecording}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-border text-muted-foreground hover:bg-muted transition-colors text-sm"
                    >
                      <RotateCcw className="w-4 h-4" />
                      {t("addMedication.retakeShort")}
                    </button>
                    <button
                      onClick={startRecording}
                      disabled={voiceState.recording}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-accent/30 text-accent hover:bg-accent/5 transition-colors text-sm disabled:opacity-50"
                    >
                      <Mic className="w-4 h-4" />
                      {t("addMedication.reRecord")}
                    </button>
                  </>
                )}
              </div>

              {/* Preview playback */}
              {voiceState.recordedUrl && (
                <div className="w-full max-w-xs">
                  <audio src={voiceState.recordedUrl} controls className="w-full h-10" />
                </div>
              )}
            </div>

            {form.voice_note_base64 && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-accent/10 border border-accent/20">
                <Check className="w-4 h-4 text-accent shrink-0" />
                <span className="text-sm text-accent font-medium">{t("addMedication.voiceWillBeUsedAsAlert")}</span>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Duration */}
        {currentStep === 5 && (
          <div className="space-y-4">
            <h2 className="font-heading font-bold text-lg text-foreground">{t("addMedication.treatmentDuration")}</h2>
            <div>
              <Label className="mb-1.5 block">{t("addMedication.startDate")} *</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => updateForm("start_date", e.target.value)}
                className="h-12"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">{t("addMedication.endDateOptional")}</Label>
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) => updateForm("end_date", e.target.value)}
                className="h-12"
              />
              <p className="text-xs text-muted-foreground mt-1.5">{t("addMedication.leaveEmptyIfOngoing")}</p>
            </div>
            <div>
              <Label className="mb-1.5 block">{t("addMedication.notesOptional")}</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => updateForm("notes", e.target.value)}
                placeholder={t("addMedication.notesExample")}
                className="resize-none"
                rows={2}
              />
            </div>
          </div>
        )}

        {/* Step 6: Inventory */}
        {currentStep === 6 && (
          <div className="space-y-4">
            <h2 className="font-heading font-bold text-lg text-foreground">{t("addMedication.inventoryInfo")}</h2>
            <p className="text-sm text-muted-foreground">{t("addMedication.trackRemainingAndRefill")}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">{t("addMedication.totalQuantity")}</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.quantity}
                  onChange={(e) => {
                    const q = parseInt(e.target.value) || 0;
                    updateForm("quantity", q);
                    updateForm("remaining_quantity", q);
                  }}
                  className="h-12"
                />
              </div>
              <div>
                <Label className="mb-1.5 block">{t("addMedication.currentlyRemaining")}</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.remaining_quantity}
                  onChange={(e) => updateForm("remaining_quantity", parseInt(e.target.value) || 0)}
                  className="h-12"
                />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">{t("addMedication.refillThreshold")}</Label>
              <Input
                type="number"
                min="0"
                value={form.refill_threshold}
                onChange={(e) => updateForm("refill_threshold", parseInt(e.target.value) || 0)}
                className="h-12"
              />
              <p className="text-xs text-muted-foreground mt-1.5">{t("addMedication.refillAlertNote")}</p>
            </div>
          </div>
        )}

        {/* Step 7: Review */}
                {currentStep === 7 && (
                  <div className="space-y-4">
                    <h2 className="font-heading font-bold text-lg text-foreground">{t("addMedication.reviewData")}</h2>
                    <p className="text-sm text-muted-foreground">{t("addMedication.verifyBeforeSaving")}</p>
                    <div className="space-y-3">
                      <ReviewItem label={t("addMedication.reviewPerson")} value={recipients.find((r) => r.id === form.recipient_id)?.name} />
                      <ReviewItem label={t("addMedication.reviewMedicationName")} value={form.name} />
                      {form.generic_name && <ReviewItem label={t("addMedication.reviewGenericName")} value={form.generic_name} />}
                      <ReviewItem label={t("addMedication.reviewDose")} value={`${form.dosage} ${t(dosageKey(form.dosage_unit))}`} />
                      <ReviewItem label={t("addMedication.reviewForm")} value={t(formKey(form.form))} />
                      <ReviewItem label={t("addMedication.reviewDailyDoses")} value={t("addMedication.timesCount", { n: form.scheduled_times.length })} />
                      <ReviewItem label={t("addMedication.reviewTimes")} value={form.scheduled_times.map(formatTime).join(" · ")} />
                      {form.voice_note_base64 && (
                        <div className="flex items-center gap-2 py-2 border-b border-border">
                          <span className="text-sm text-muted-foreground shrink-0">{t("addMedication.reviewVoiceAlert")}</span>
                          <div className="flex items-center gap-1.5 ml-auto">
                            <Mic className="w-3.5 h-3.5 text-accent" />
                            <span className="text-xs text-accent font-medium">{t("addMedication.recorded")}</span>
                            <audio src={voiceState.recordedUrl || `data:audio/webm;base64,${form.voice_note_base64}`} controls className="h-6 w-40" />
                          </div>
                        </div>
                      )}
                      <ReviewItem label={t("addMedication.reviewStartDate")} value={form.start_date} />
                      {form.end_date && <ReviewItem label={t("addMedication.reviewEndDate")} value={form.end_date} />}
                      <ReviewItem label={t("addMedication.reviewInventory")} value={t("addMedication.remainingOfStock", { remaining: form.remaining_quantity, quantity: form.quantity, unit: t(dosageKey(form.dosage_unit)) })} />
                      <ReviewItem label={t("addMedication.reviewRefillThreshold")} value={t("addMedication.refillThresholdValue", { value: form.refill_threshold, unit: t(dosageKey(form.dosage_unit)) })} />
                      {form.instructions && <ReviewItem label={t("addMedication.reviewInstructions")} value={form.instructions} />}
                      {form.notes && <ReviewItem label={t("addMedication.reviewNotes")} value={form.notes} />}
                    </div>
                  </div>
                )}

        {/* Navigation Buttons */}
        <div className="flex items-center gap-3 mt-6 pt-6 border-t border-border">
          {currentStep > 0 && (
            <Button variant="outline" onClick={prevStep} className="h-12 px-6" disabled={saving}>
              <ChevronRight className="w-4 h-4 ml-1" />
              {t("addMedication.previous")}
            </Button>
          )}
          {currentStep < steps.length - 1 ? (
            <Button onClick={nextStep} className="h-12 px-6 flex-1 mr-auto">
              {t("addMedication.next")}
              <ChevronLeft className="w-4 h-4 mr-1" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving} className="h-12 px-6 flex-1 mr-auto bg-accent hover:bg-accent/90">
              {saving ? (
                <><span className="w-4 h-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin ml-2" />{t("addMedication.saving")}</>
              ) : (
                <><Check className="w-4 h-4 ml-1.5" strokeWidth={2.5} />{t("addMedication.saveMedication")}</>
              )}
            </Button>
          )}
        </div>
      </div>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onApply={handleBarcodeApply}
        recipientId={form.recipient_id}
      />
    </div>
  );
}

function ReviewItem({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-foreground text-left">{value}</span>
    </div>
  );
}
