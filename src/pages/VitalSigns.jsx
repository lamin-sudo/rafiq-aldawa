import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/supabaseClient";
import { useTranslation } from "@/i18n";
import { logActivity } from "@/lib/logActivity";
import { ChevronRight, User, Loader2, Plus, Activity, Droplet, Scale, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import moment from "moment";

const VITAL_TYPES = [
  { key: "blood_pressure", labelKey: "vitals.bloodPressure", icon: Activity, color: "#0d9488" },
  { key: "blood_sugar", labelKey: "vitals.bloodSugar", icon: Droplet, color: "#e11d48" },
  { key: "weight", labelKey: "vitals.weight", icon: Scale, color: "#6366f1" },
];

export default function VitalSigns() {
  const navigate = useNavigate();
  const t = useTranslation();
  const [recipients, setRecipients] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: "blood_pressure", systolic: "", diastolic: "", value: "", weight: "", notes: "" });

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
        const data = await api.entities.VitalSigns.filter({ recipient_id: selectedId }, "-created_date", 100);
        setReadings(data);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [selectedId]);

  const chartData = useMemo(() => {
    const byType = { blood_pressure: [], blood_sugar: [], weight: [] };
    [...readings]
      .sort((a, b) => new Date(a.created_date) - new Date(b.created_date))
      .forEach((r) => {
        if (byType[r.type]) {
          const date = moment(r.created_date).format("MM/DD");
          if (r.type === "blood_pressure") {
            byType[r.type].push({ date, systolic: r.systolic, diastolic: r.diastolic });
          } else if (r.type === "blood_sugar") {
            byType[r.type].push({ date, value: r.value });
          } else if (r.type === "weight") {
            byType[r.type].push({ date, weight: r.weight });
          }
        }
      });
    return byType;
  }, [readings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const recipient = recipients.find((r) => r.id === selectedId);
      const payload = {
        recipient_id: selectedId,
        recipient_name: recipient?.name || "",
        type: form.type,
        recorded_at: new Date().toISOString(),
        notes: form.notes,
      };
      if (form.type === "blood_pressure") {
        payload.systolic = parseFloat(form.systolic) || 0;
        payload.diastolic = parseFloat(form.diastolic) || 0;
      } else if (form.type === "blood_sugar") {
        payload.value = parseFloat(form.value) || 0;
      } else if (form.type === "weight") {
        payload.weight = parseFloat(form.weight) || 0;
      }
      await api.entities.VitalSigns.create(payload);
      await logActivity("vital_recorded", { targetName: VITAL_TYPES.find((v) => v.key === form.type)?.labelKey ? t(VITAL_TYPES.find((v) => v.key === form.type).labelKey) : "", recipientName: recipient?.name || "" });
      setReadings((prev) => [...prev, payload]);
      setForm({ type: "blood_pressure", systolic: "", diastolic: "", value: "", weight: "", notes: "" });
      setShowForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.entities.VitalSigns.delete(id);
      setReadings((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error(err);
    }
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
          <p className="text-sm text-muted-foreground">{t("vitals.noRecipient")}</p>
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
          <h1 className="font-heading font-extrabold text-xl text-foreground">{t("vitals.title")}</h1>
          <p className="text-xs text-muted-foreground">{t("vitals.subtitle")}</p>
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

      {/* Charts */}
      <div className="space-y-4 mb-6">
        {VITAL_TYPES.map((vt) => {
          const data = chartData[vt.key];
          if (!data || data.length === 0) return null;
          const Icon = vt.icon;
          return (
            <div key={vt.key} className="bg-card rounded-2xl border-2 border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ backgroundColor: `${vt.color}15`, color: vt.color }}>
                  <Icon className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-sm text-foreground">{t(vt.labelKey)}</h3>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
                  {vt.key === "blood_pressure" ? (
                    <>
                      <Line type="monotone" dataKey="systolic" stroke={vt.color} strokeWidth={2} dot={{ r: 3 }} name={t("vitals.systolic")} />
                      <Line type="monotone" dataKey="diastolic" stroke="#94a3b8" strokeWidth={2} dot={{ r: 3 }} name={t("vitals.diastolic")} />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                    </>
                  ) : vt.key === "blood_sugar" ? (
                    <Line type="monotone" dataKey="value" stroke={vt.color} strokeWidth={2} dot={{ r: 3 }} name={t("vitals.bloodSugar")} />
                  ) : (
                    <Line type="monotone" dataKey="weight" stroke={vt.color} strokeWidth={2} dot={{ r: 3 }} name={t("vitals.weight")} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>

      {/* Add Reading Form */}
      {showForm ? (
        <div className="bg-card rounded-2xl border-2 border-border p-4 space-y-3 mb-4 animate-scale-in">
          <div>
            <Label className="mb-1.5 block text-xs">{t("vitals.type")}</Label>
            <Select value={form.type} onValueChange={(v) => setForm((prev) => ({ ...prev, type: v }))}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VITAL_TYPES.map((vt) => <SelectItem key={vt.key} value={vt.key}>{t(vt.labelKey)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {form.type === "blood_pressure" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block text-xs">{t("vitals.systolic")}</Label>
                <Input value={form.systolic} onChange={(e) => setForm((prev) => ({ ...prev, systolic: e.target.value }))} placeholder="120" className="h-11" inputMode="numeric" />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">{t("vitals.diastolic")}</Label>
                <Input value={form.diastolic} onChange={(e) => setForm((prev) => ({ ...prev, diastolic: e.target.value }))} placeholder="80" className="h-11" inputMode="numeric" />
              </div>
            </div>
          )}
          {form.type === "blood_sugar" && (
            <div>
              <Label className="mb-1.5 block text-xs">{t("vitals.bloodSugar")} (mg/dL)</Label>
              <Input value={form.value} onChange={(e) => setForm((prev) => ({ ...prev, value: e.target.value }))} placeholder="100" className="h-11" inputMode="decimal" />
            </div>
          )}
          {form.type === "weight" && (
            <div>
              <Label className="mb-1.5 block text-xs">{t("vitals.weight")} (kg)</Label>
              <Input value={form.weight} onChange={(e) => setForm((prev) => ({ ...prev, weight: e.target.value }))} placeholder="70" className="h-11" inputMode="decimal" />
            </div>
          )}
          <div>
            <Label className="mb-1.5 block text-xs">{t("vitals.notes")}</Label>
            <Input value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="..." className="h-11" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl border-2 border-border text-muted-foreground text-sm font-medium hover:bg-muted transition-colors touch-target">
              {t("common.cancel")}
            </button>
            <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 touch-target">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {t("common.save")}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl border-2 border-dashed border-accent/40 text-accent font-semibold text-sm hover:bg-accent/5 transition-colors touch-target mb-6"
        >
          <Plus className="w-5 h-5" />
          {t("vitals.addReading")}
        </button>
      )}

      {/* History */}
      <div>
        <h3 className="font-heading font-bold text-sm text-foreground mb-3">{t("vitals.history")}</h3>
        {readings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t("vitals.noReadings")}</p>
        ) : (
          <div className="space-y-2">
            {readings.map((r) => {
              const vt = VITAL_TYPES.find((v) => v.key === r.type);
              const Icon = vt?.icon || Activity;
              let display = "";
              if (r.type === "blood_pressure") display = `${r.systolic}/${r.diastolic}`;
              else if (r.type === "blood_sugar") display = `${r.value} mg/dL`;
              else if (r.type === "weight") display = `${r.weight} kg`;
              return (
                <div key={r.id} className="flex items-center gap-3 bg-card rounded-xl border border-border p-3">
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg" style={{ backgroundColor: `${vt?.color || "#94a3b8"}15`, color: vt?.color || "#94a3b8" }}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{display}</p>
                    <p className="text-xs text-muted-foreground">{moment(r.created_date).format("YYYY-MM-DD HH:mm")}</p>
                  </div>
                  <button onClick={() => handleDelete(r.id)} className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-alert/10 hover:text-alert transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}