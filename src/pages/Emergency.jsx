import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { useTranslation } from "@/i18n";
import { logActivity } from "@/lib/logActivity";
import { ChevronRight, User, Phone, MessageSquare, ShieldAlert, Loader2, Save, Siren } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"];

export default function Emergency() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const t = useTranslation();
  const [recipients, setRecipients] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [info, setInfo] = useState(null);
  const [existingId, setExistingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSOS, setShowSOS] = useState(false);
  const [location, setLocation] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const recs = await api.entities.CareRecipient.list();
        setRecipients(recs);
        if (recs.length > 0) setSelectedId(recs[0].id);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      try {
        const existing = await api.entities.EmergencyInfo.filter({ recipient_id: selectedId });
        if (existing.length > 0) {
          setInfo(existing[0]);
          setExistingId(existing[0].id);
        } else {
          setInfo({
            blood_type: "unknown",
            chronic_diseases: "",
            allergies: "",
            current_medications: "",
            emergency_contact_name: "",
            emergency_phone: "",
          });
          setExistingId(null);
        }
      } catch (err) {
        console.error(err);
      }
    })();
  }, [selectedId]);

  const update = (key, value) => setInfo((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!info) return;
    setSaving(true);
    try {
      const recipient = recipients.find((r) => r.id === selectedId);
      const payload = { ...info, recipient_id: selectedId, recipient_name: recipient?.name || "" };
      if (existingId) {
        await api.entities.EmergencyInfo.update(existingId, payload);
      } else {
        const created = await api.entities.EmergencyInfo.create(payload);
        setExistingId(created.id);
      }
      await logActivity("emergency_updated", { recipientName: recipient?.name || "" });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSOS = () => setShowSOS(true);

  const getLocation = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      setGettingLocation(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGettingLocation(false);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          setGettingLocation(false);
          resolve(null);
        },
        { timeout: 5000 }
      );
    });

  const callEmergency = () => {
    window.location.href = "tel:15";
  };

  const sendSMSToContact = async () => {
    const loc = location || (await getLocation());
    const phone = info?.emergency_phone;
    if (!phone) return;
    const msg = loc
      ? t("emergency.smsHelpWithLocation", { name: info.recipient_name || "", lat: loc.lat, lng: loc.lng })
      : t("emergency.smsHelp", { name: info.recipient_name || "" });
    window.location.href = `sms:${phone}?body=${encodeURIComponent(msg)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  if (recipients.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-card rounded-2xl border-2 border-border p-8 text-center">
          <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-sm text-muted-foreground mb-6">{t("emergency.noRecipient")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-8 py-6 lg:py-8 pb-32">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center justify-center w-10 h-10 rounded-xl border-2 border-border text-muted-foreground hover:bg-muted transition-colors">
          <ChevronRight className="w-5 h-5 rtl:rotate-180" />
        </button>
        <div>
          <h1 className="font-heading font-extrabold text-xl text-foreground">{t("emergency.title")}</h1>
          <p className="text-xs text-muted-foreground">{t("emergency.subtitle")}</p>
        </div>
      </div>

      {recipients.length > 1 && (
        <div className="mb-4">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {recipients.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {info && (
        <div className="space-y-4">
          <div className="bg-card rounded-2xl border-2 border-border p-4 space-y-4">
            <div>
              <Label className="mb-1.5 block text-xs">{t("emergency.bloodType")}</Label>
              <Select value={info.blood_type} onValueChange={(v) => update("blood_type", v)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BLOOD_TYPES.map((bt) => <SelectItem key={bt} value={bt}>{bt === "unknown" ? t("emergency.unknown") : bt}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">{t("emergency.chronicDiseases")}</Label>
              <Textarea value={info.chronic_diseases} onChange={(e) => update("chronic_diseases", e.target.value)} placeholder={t("emergency.chronicPlaceholder")} rows={2} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">{t("emergency.allergies")}</Label>
              <Textarea value={info.allergies} onChange={(e) => update("allergies", e.target.value)} placeholder={t("emergency.allergiesPlaceholder")} rows={2} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">{t("emergency.currentMeds")}</Label>
              <Textarea value={info.current_medications} onChange={(e) => update("current_medications", e.target.value)} placeholder="..." rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block text-xs">{t("emergency.contactName")}</Label>
                <Input value={info.emergency_contact_name} onChange={(e) => update("emergency_contact_name", e.target.value)} placeholder="..." className="h-11" />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">{t("emergency.contactPhone")}</Label>
                <Input value={info.emergency_phone} onChange={(e) => update("emergency_phone", e.target.value)} placeholder="06..." className="h-11" inputMode="tel" dir="ltr" />
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent/90 transition-colors disabled:opacity-50 touch-target"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {t("emergency.save")}
          </button>
        </div>
      )}

      {/* SOS Button */}
      <div className="flex flex-col items-center mt-10 mb-6">
        <button
          onClick={handleSOS}
          className="relative flex items-center justify-center w-36 h-36 rounded-full bg-alert text-white shadow-2xl shadow-alert/40 active:scale-95 transition-transform animate-pulse"
        >
          <span className="absolute inset-0 rounded-full bg-alert/30 animate-ping" />
          <div className="relative flex flex-col items-center gap-1">
            <Siren className="w-10 h-10" strokeWidth={2.5} />
            <span className="font-heading font-extrabold text-2xl tracking-wider">SOS</span>
          </div>
        </button>
        <p className="text-xs text-muted-foreground mt-4 text-center">{t("emergency.sosHint")}</p>
      </div>

      {/* SOS Confirmation Dialog */}
      {showSOS && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowSOS(false)}>
          <div className="bg-card rounded-2xl border-2 border-alert/30 p-6 max-w-sm w-full space-y-4 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-alert/10 text-alert">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-lg text-foreground">{t("emergency.sosConfirmTitle")}</h3>
                <p className="text-xs text-muted-foreground">{t("emergency.sosConfirmDesc")}</p>
              </div>
            </div>
            {gettingLocation && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("emergency.gettingLocation")}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={callEmergency}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-alert text-white font-semibold text-sm hover:bg-alert/90 transition-colors touch-target"
              >
                <Phone className="w-5 h-5" />
                {t("emergency.callServices")}
              </button>
              <button
                onClick={sendSMSToContact}
                disabled={!info?.emergency_phone}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-secondary text-secondary-foreground font-semibold text-sm hover:bg-muted transition-colors disabled:opacity-50 touch-target"
              >
                <MessageSquare className="w-5 h-5" />
                {t("emergency.smsContact")}
              </button>
            </div>
            <button onClick={() => setShowSOS(false)} className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}