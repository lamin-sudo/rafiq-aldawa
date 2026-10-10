import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { useTranslation } from "@/i18n";
import { todayStr, relationshipLabels } from "@/lib/medicationUtils";
import CameraCapture from "@/components/scan/CameraCapture";
import ScanReview from "@/components/scan/ScanReview";
import { ChevronRight, Loader2, AlertCircle, Plus, User } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ScanMedicine() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const t = useTranslation();
  const [recipients, setRecipients] = useState([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState("recipient");
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const recs = await api.entities.CareRecipient.list();
        setRecipients(recs);
        if (recs.length === 1) {
          setSelectedRecipientId(recs[0].id);
          setPhase("camera");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCapture = useCallback(async (file) => {
    setPhase("processing");
    setError("");
    try {
      const { file_uri } = await api.integrations.Core.UploadPrivateFile({ file });
      const { signed_url } = await api.integrations.Core.CreateFileSignedUrl({ file_uri });

      const response = await api.functions.invoke("extract-medication-from-image", {
        imageUrl: signed_url,
        scanType: "medicine",
      });

      const data = response.data;
      if (data.error) throw new Error(data.error);
      if (!data.medications || data.medications.length === 0) {
        setError(t("scan.noDataExtracted"));
        setPhase("camera");
        return;
      }

      setExtractedData(data);
      setPhase("review");
    } catch (err) {
      console.error("OCR error:", err);
      setError(t("scan.extractionFailed"));
      setPhase("camera");
    }
  }, [t]);

  const handleConfirm = async (meds) => {
    try {
      const recipient = recipients.find((r) => r.id === selectedRecipientId);
      for (const med of meds) {
        await api.entities.Medication.create({
          ...med,
          recipient_id: selectedRecipientId,
          recipient_name: recipient?.name || "",
          start_date: todayStr(),
          quantity: 30,
          remaining_quantity: 30,
          refill_threshold: 5,
          active: true,
          frequency_per_day: med.scheduled_times?.length || 1,
        });

        await api.entities.AuditLog.create({
          actor_id: user.id,
          actor_email: user.email,
          action: "medication_created_scan",
          target_type: "Medication",
          target_name: med.name,
          details: `Created via medicine scan: ${med.name}`,
        });
      }
      navigate("/medications");
    } catch (err) {
      console.error("Create medication error:", err);
      setError(err.message || t("scan.extractionFailed"));
    }
  };

  const handleRetake = () => {
    setExtractedData(null);
    setError("");
    setPhase("camera");
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
          <h2 className="font-heading font-bold text-lg text-foreground mb-2">{t("home.welcomeTitle")}</h2>
          <p className="text-sm text-muted-foreground mb-6">{t("home.welcomeDesc")}</p>
          <Link to="/profile" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent/90 transition-colors">
            <Plus className="w-5 h-5" />
            {t("home.addPerson")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center justify-center w-10 h-10 rounded-xl border-2 border-border text-muted-foreground hover:bg-muted transition-colors">
          <ChevronRight className="w-5 h-5 rtl:rotate-180" />
        </button>
        <div>
          <h1 className="font-heading font-extrabold text-xl text-foreground">{t("scan.medicineTitle")}</h1>
          <p className="text-xs text-muted-foreground">{t("scan.medicineDesc")}</p>
        </div>
      </div>

      {phase === "recipient" && recipients.length > 1 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">{t("scan.chooseMethod")}</p>
          {recipients.map((r) => (
            <button
              key={r.id}
              onClick={() => { setSelectedRecipientId(r.id); setPhase("camera"); }}
              className={cn(
                "flex items-center gap-3 p-4 rounded-xl border-2 transition-all w-full text-start",
                "border-border hover:border-accent hover:bg-accent/5"
              )}
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-secondary font-semibold text-sm">
                {r.name[0]}
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">{r.name}</p>
                <p className="text-xs text-muted-foreground">{relationshipLabels[r.relationship] ? t(relationshipLabels[r.relationship]) : ""}</p>
              </div>
            </button>
          ))}
        </div>
      )}

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
          <p className="text-sm font-medium text-foreground">{t("scan.extracting")}</p>
          <p className="text-xs text-muted-foreground">{t("scan.photoStoredPrivately")}</p>
        </div>
      )}

      {phase === "review" && extractedData && (
        <ScanReview
          medications={extractedData.medications}
          confidence={extractedData.confidence}
          scanType="medicine"
          onConfirm={handleConfirm}
          onRetake={handleRetake}
          t={t}
        />
      )}
    </div>
  );
}