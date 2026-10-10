import { useState } from "react";
import { RefreshCw, Check, AlertCircle, ShieldAlert, Pill, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const MED_FORMS = ["أقراص", "كبسولات", "شراب", "حقن", "كريم", "قطرة", "بخاخ", "أخرى"];
const DOSAGE_UNITS = ["حبة", "ملغ", "مل", "قطرة", "بخة", "حقنة", "أخرى"];

// Display labels for form / dosage-unit option values (the values themselves
// stay as stored data — only the rendered label is localised).
const MED_FORM_LABEL_KEYS = {
  "أقراص": "scan.formTablets",
  "كبسولات": "scan.formCapsules",
  "شراب": "scan.formSyrup",
  "حقن": "scan.formInjection",
  "كريم": "scan.formCream",
  "قطرة": "scan.formDrops",
  "بخاخ": "scan.formInhaler",
  "أخرى": "scan.formOther",
};

const DOSAGE_UNIT_LABEL_KEYS = {
  "حبة": "scan.unitTablet",
  "ملغ": "scan.unitMg",
  "مل": "scan.unitMl",
  "قطرة": "scan.unitDrops",
  "بخة": "scan.unitPuff",
  "حقنة": "scan.unitSyringe",
  "أخرى": "scan.unitOther",
};

const formMap = {
  tablet: "أقراص", tablets: "أقراص", comprimé: "أقراص", comprimes: "أقراص",
  capsule: "كبسولات", capsules: "كبسولات", gelule: "كبسولات",
  syrup: "شراب", sirop: "شراب",
  injection: "حقن", injectable: "حقن", injection: "حقن",
  cream: "كريم",
  drops: "قطرة", drop: "قطرة", gouttes: "قطرة",
  inhaler: "بخاخ", spray: "بخاخ",
};

const unitMap = { mg: "ملغ", ml: "مل", mcg: "ملغ", iu: "حبة", units: "حبة", unit: "حبة", drops: "قطرة", drop: "قطرة" };

function mapForm(form) {
  if (!form) return "أقراص";
  const lower = form.toLowerCase().trim();
  return formMap[lower] || "أخرى";
}

function parseStrength(strength) {
  if (!strength) return { dosage: "", dosage_unit: "حبة" };
  const match = strength.match(/(\d+(?:\.\d+)?)\s*(mg|ml|mcg|units?|iu|drops?|g)?/i);
  if (!match) return { dosage: strength, dosage_unit: "أخرى" };
  const value = match[1];
  const unit = match[2]?.toLowerCase();
  return { dosage: value, dosage_unit: unitMap[unit] || "أخرى" };
}

function normalizeMed(raw) {
  const { dosage, dosage_unit } = parseStrength(raw.strength);
  return {
    name: raw.name || "",
    generic_name: "",
    form: mapForm(raw.form),
    dosage,
    dosage_unit,
    instructions: raw.instructions || "",
    notes: raw.manufacturer || "",
    frequency_per_day: 1,
    scheduled_times: ["08:00"],
  };
}

export default function ScanReview({ medications: rawMeds, confidence, scanType, onConfirm, onRetake, t }) {
  const [meds, setMeds] = useState(() => rawMeds.map(normalizeMed));

  const updateMed = (index, key, value) => {
    setMeds((prev) => prev.map((m, i) => (i === index ? { ...m, [key]: value } : m)));
  };

  const removeMed = (index) => {
    setMeds((prev) => prev.filter((_, i) => i !== index));
  };

  const confidenceConfig = {
    high: { label: t("scan.high"), color: "text-accent", bg: "bg-accent/10", dot: "bg-accent" },
    medium: { label: t("scan.medium"), color: "text-warning", bg: "bg-warning/10", dot: "bg-warning" },
    low: { label: t("scan.low"), color: "text-alert", bg: "bg-alert/10", dot: "bg-alert" },
  };
  const confCfg = confidenceConfig[confidence] || confidenceConfig.medium;

  return (
    <div className="space-y-5">
      {/* Confidence badge */}
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-bold text-lg text-foreground">{t("scan.detectedInfo")}</h2>
        <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium", confCfg.bg, confCfg.color)}>
          <div className={cn("w-2 h-2 rounded-full", confCfg.dot)} />
          {t("scan.confidence")}: {confCfg.label}
        </div>
      </div>

      {confidence === "low" && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 text-warning text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {t("scan.verifyInfo")}
        </div>
      )}

      {/* Medication cards */}
      <div className="space-y-4">
        {meds.map((med, idx) => (
          <div key={idx} className="bg-card rounded-2xl border-2 border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10 text-accent">
                <Pill className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold text-foreground">{t("scan.medication")} {meds.length > 1 ? idx + 1 : ""}</span>
              {meds.length > 1 && (
                <button onClick={() => removeMed(idx)} className="ms-auto flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-alert/10 hover:text-alert transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div>
              <Label className="mb-1.5 block text-xs">{t("scan.medication")} *</Label>
              <Input value={med.name} onChange={(e) => updateMed(idx, "name", e.target.value)} placeholder="..." className="h-11" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block text-xs">{t("scan.strength")}</Label>
                <Input value={med.dosage} onChange={(e) => updateMed(idx, "dosage", e.target.value)} placeholder="500" className="h-11" inputMode="decimal" />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">{t("common.all")}</Label>
                <Select value={med.dosage_unit} onValueChange={(v) => updateMed(idx, "dosage_unit", v)}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOSAGE_UNITS.map((u) => <SelectItem key={u} value={u}>{t(DOSAGE_UNIT_LABEL_KEYS[u] || "scan.unitOther")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block text-xs">{t("scan.form")}</Label>
              <Select value={med.form} onValueChange={(v) => updateMed(idx, "form", v)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MED_FORMS.map((f) => <SelectItem key={f} value={f}>{t(MED_FORM_LABEL_KEYS[f] || "scan.formOther")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5 block text-xs">{t("scan.instructions")}</Label>
              <Textarea value={med.instructions} onChange={(e) => updateMed(idx, "instructions", e.target.value)} placeholder="..." className="resize-none" rows={2} />
            </div>
          </div>
        ))}
      </div>

      {/* OCR safety disclaimer */}
      <div className="flex items-start gap-2 p-3.5 rounded-xl bg-secondary/50 border border-border">
        <ShieldAlert className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">{t("scan.ocrSafety")}</p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={onRetake}
          className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl border-2 border-border text-muted-foreground font-medium text-sm hover:bg-muted transition-colors touch-target"
        >
          <RefreshCw className="w-4 h-4" />
          {t("scan.retakePhoto")}
        </button>
        <button
          onClick={() => onConfirm(meds.filter((m) => m.name.trim()))}
          disabled={meds.every((m) => !m.name.trim())}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent/90 transition-colors disabled:opacity-50 touch-target"
        >
          <Check className="w-5 h-5" strokeWidth={2.5} />
          {t("scan.confirmAndCreate")}
        </button>
      </div>
    </div>
  );
}