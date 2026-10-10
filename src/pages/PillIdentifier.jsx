import { useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "@/api/supabaseClient";
import { useTranslation } from "@/i18n";
import CameraCapture from "@/components/scan/CameraCapture";
import { ChevronRight, Loader2, AlertCircle, ShieldAlert, Save, Plus, RefreshCw, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const CONFIDENCE_CFG = {
  high: "bg-accent/10 text-accent",
  medium: "bg-warning/10 text-warning",
  low: "bg-alert/10 text-alert",
};

export default function PillIdentifier() {
  const navigate = useNavigate();
  const t = useTranslation();
  const [phase, setPhase] = useState("camera"); // camera | processing | result
  const [result, setResult] = useState(null);
  const [fileUri, setFileUri] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleCapture = useCallback(
    async (file) => {
      setPhase("processing");
      setError("");
      setSaved(false);
      try {
        const { file_uri } = await api.integrations.Core.UploadPrivateFile({ file });
        const { signed_url } = await api.integrations.Core.CreateFileSignedUrl({ file_uri });

        const response = await api.functions.invoke("identify-pill", { imageUrl: signed_url });
        const data = response.data;
        if (!data || data.error) throw new Error(data?.error || "identify failed");

        setFileUri(file_uri);
        setResult(data);
        setPhase("result");
      } catch (err) {
        console.error("Pill identify error:", err);
        setError(t("pillScan.error"));
        setPhase("camera");
      }
    },
    [t]
  );

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await api.entities.PillScan.create({
        image_url: fileUri,
        shape: result?.shape || "",
        color: result?.color || "",
        imprint: result?.imprint || "",
        confidence: result?.confidence || "low",
        possible_matches: (result?.possible_matches || []).map((m) => ({
          name: m.name || "",
          confidence: Number(m.confidence) || 0,
          reason: m.reason || "",
        })),
      });
      setSaved(true);
    } catch (err) {
      console.error("Save pill scan error:", err);
      setError(t("pillScan.error"));
    } finally {
      setSaving(false);
    }
  };

  const retake = () => {
    setResult(null);
    setFileUri("");
    setSaved(false);
    setError("");
    setPhase("camera");
  };

  const confidenceLabel = (c) =>
    c === "high" ? t("pillScan.confidenceHigh") : c === "medium" ? t("pillScan.confidenceMedium") : t("pillScan.confidenceLow");

  const matches = result?.possible_matches || [];

  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center w-10 h-10 rounded-xl border-2 border-border text-muted-foreground hover:bg-muted transition-colors"
          aria-label={t("common.cancel")}
        >
          <ChevronRight className="w-5 h-5 rtl:rotate-180" />
        </button>
        <div>
          <h1 className="font-heading font-extrabold text-xl text-foreground">{t("pillScan.title")}</h1>
          <p className="text-xs text-muted-foreground">{t("pillScan.subtitle")}</p>
        </div>
      </div>

      {phase === "camera" && (
        <>
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-alert/10 text-alert text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          <CameraCapture onCapture={handleCapture} onCancel={() => navigate(-1)} t={t} />
        </>
      )}

      {phase === "processing" && (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <Loader2 className="w-10 h-10 text-accent animate-spin" />
          <p className="text-sm font-medium text-foreground">{t("pillScan.analyzing")}</p>
        </div>
      )}

      {phase === "result" && result && (
        <div className="space-y-4">
          <div className="bg-card rounded-2xl border-2 border-border p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="font-heading font-bold text-base text-foreground">{t("pillScan.possibleMatches")}</h2>
              <span className={cn("shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold", CONFIDENCE_CFG[result.confidence] || CONFIDENCE_CFG.low)}>
                {t("pillScan.confidence")}: {confidenceLabel(result.confidence)}
              </span>
            </div>

            {matches.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("pillScan.noMatch")}</p>
            ) : (
              <div className="space-y-3">
                {matches.map((m, i) => {
                  const pct = Math.round((Number(m.confidence) || 0) * 100);
                  return (
                    <div key={i} className="p-3 rounded-xl bg-secondary/50">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <p className="font-medium text-sm text-foreground">{m.name}</p>
                        <span className="shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">
                          {t("pillScan.matchConfidence", { percent: pct })}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-border overflow-hidden mb-2">
                        <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      {m.reason && <p className="text-xs text-muted-foreground leading-relaxed">{m.reason}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {(result.shape || result.color || result.imprint) && (
            <div className="flex flex-wrap gap-2">
              {result.shape && <FeatureChip label={t("pillScan.shape")} value={result.shape} />}
              {result.color && <FeatureChip label={t("pillScan.color")} value={result.color} />}
              {result.imprint && <FeatureChip label={t("pillScan.imprint")} value={result.imprint} />}
            </div>
          )}

          <div className="flex items-start gap-2 p-3.5 rounded-xl bg-warning/10 border-2 border-warning/30">
            <ShieldAlert className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs text-foreground leading-relaxed">{t("pillScan.disclaimer")}</p>
              {result.confidence === "low" && <p className="text-xs font-semibold text-warning">{t("pillScan.lowConfidence")}</p>}
            </div>
          </div>

          {saved && (
            <p className="flex items-center gap-2 text-sm font-medium text-accent">
              <Check className="w-4 h-4" />
              {t("pillScan.savedNote")}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 touch-target"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t("pillScan.saveDraft")}
            </button>
            <Link
              to="/medications/new"
              className="flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-border text-foreground font-semibold text-sm hover:bg-muted transition-colors touch-target"
            >
              <Plus className="w-4 h-4" />
              {t("pillScan.addManually")}
            </Link>
          </div>

          <button
            onClick={retake}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-border text-muted-foreground font-medium text-sm hover:bg-muted transition-colors touch-target"
          >
            <RefreshCw className="w-4 h-4" />
            {t("pillScan.retake")}
          </button>
        </div>
      )}
    </div>
  );
}

function FeatureChip({ label, value }) {
  return (
    <span className="px-3 py-1.5 rounded-full bg-secondary text-xs text-foreground">
      <span className="text-muted-foreground">{label}: </span>
      {value}
    </span>
  );
}