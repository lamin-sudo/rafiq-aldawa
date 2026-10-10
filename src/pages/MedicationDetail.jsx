import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { useI18n, useTranslation } from "@/i18n";
import { buildTodaySchedule, takeDose, skipDose, groupByPeriod } from "@/lib/doseOperations";
import { formatTime, formatDate, getInventoryStatus, inventoryStatusConfig, relationshipLabels } from "@/lib/medicationUtils";
import DoseRow from "@/components/DoseRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, Pencil, Trash2, Package, Calendar, Clock, Pill, Check, X, AlertCircle, Plus, Minus, ShieldAlert, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const dosageUnits = ["حبة", "ملغ", "مل", "قطرة", "بخة", "حقنة", "أخرى"];
const medForms = ["أقراص", "كبسولات", "شراب", "حقن", "كريم", "قطرة", "بخاخ", "أخرى"];
const periodIcons = { morning: "Sunrise", afternoon: "Sun", evening: "Sunset", night: "Moon" };

export default function MedicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [medication, setMedication] = useState(null);
  const [recipient, setRecipient] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const med = await api.entities.Medication.get(id);
      setMedication(med);
      setEditForm({
        name: med.name || "",
        generic_name: med.generic_name || "",
        form: med.form || "أقراص",
        dosage: med.dosage || "",
        dosage_unit: med.dosage_unit || "حبة",
        scheduled_times: med.scheduled_times || [],
        start_date: med.start_date || "",
        end_date: med.end_date || "",
        instructions: med.instructions || "",
        notes: med.notes || "",
        quantity: med.quantity || 0,
        remaining_quantity: med.remaining_quantity || 0,
        refill_threshold: med.refill_threshold || 0,
        active: med.active !== false,
      });
      if (med.recipient_id) {
        try {
          const rec = await api.entities.CareRecipient.get(med.recipient_id);
          setRecipient(rec);
          const sched = await buildTodaySchedule([med], med.recipient_id);
          setSchedule(sched);
        } catch (e) {
          console.error("Load recipient error:", e);
        }
      }
    } catch (err) {
      console.error("Load medication error:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleTake = async (dose) => {
    setActionLoading(`${dose.medication_id}_${dose.scheduled_time}`);
    try {
      await takeDose(dose, user);
      await loadData();
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
      await loadData();
    } catch (err) {
      console.error("Skip dose error:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await api.entities.Medication.update(id, editForm);
      await api.entities.AuditLog.create({
        actor_id: user.id,
        actor_email: user.email,
        action: "medication_updated",
        target_type: "Medication",
        target_id: id,
        target_name: editForm.name,
        details: t("medicationDetail.auditUpdated"),
      });

      // إعادة مزامنة التقويم عند تغيّر الجدول أو تفاصيل الجرعة
      const scheduleFields = ["name", "dosage", "dosage_unit", "instructions", "notes", "start_date", "end_date"];
      const scheduleChanged = scheduleFields.some(
        (f) => (medication[f] || "") !== (editForm[f] || "")
      ) || JSON.stringify(medication.scheduled_times || []) !== JSON.stringify(editForm.scheduled_times || []);
      if (scheduleChanged) {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        api.functions.invoke("syncMedicationCalendar", { medicationId: id, timezone: tz })
          .catch((e) => console.error("Calendar sync error:", e));
      }

      setEditing(false);
      await loadData();
    } catch (err) {
      console.error("Save edit error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      // حذف أحدث التقويم المرتبطة قبل حذف الدواء
      const eventIds = Array.isArray(medication.calendar_event_ids) ? medication.calendar_event_ids.filter(Boolean) : [];
      if (eventIds.length > 0) {
        await api.functions.invoke("removeMedicationCalendarEvents", { eventIds })
          .catch((e) => console.error("Calendar cleanup error:", e));
      }
      await api.entities.Medication.delete(id);
      await api.entities.AuditLog.create({
        actor_id: user.id,
        actor_email: user.email,
        action: "medication_deleted",
        target_type: "Medication",
        target_id: id,
        target_name: medication.name,
        details: t("medicationDetail.auditDeleted"),
      });
      navigate("/medications");
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const adjustInventory = async (delta) => {
    const newQty = Math.max(0, (medication.remaining_quantity || 0) + delta);
    await api.entities.Medication.update(id, { remaining_quantity: newQty });
    await loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-secondary border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!medication) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="font-heading font-bold text-lg text-foreground mb-2">{t("medicationDetail.notFound")}</h2>
        <Link to="/medications" className="text-accent text-sm font-medium hover:underline">{t("medicationDetail.backToList")}</Link>
      </div>
    );
  }

  const invStatus = getInventoryStatus(medication);
  const invCfg = inventoryStatusConfig[invStatus];
  const grouped = groupByPeriod(schedule);

  if (editing) {
    return <EditView editForm={editForm} setEditForm={setEditForm} onSave={handleSaveEdit} onCancel={() => setEditing(false)} saving={saving} />;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="flex items-center justify-center w-10 h-10 rounded-xl border-2 border-border text-muted-foreground hover:bg-muted transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-heading font-extrabold text-2xl text-foreground truncate">{medication.name}</h1>
          {medication.generic_name && <p className="text-sm text-muted-foreground">{medication.generic_name}</p>}
        </div>
        <button onClick={() => setEditing(true)} className="flex items-center justify-center w-10 h-10 rounded-xl border-2 border-border text-muted-foreground hover:bg-muted transition-colors" aria-label={t("medicationDetail.editAria")}>
          <Pencil className="w-4 h-4" />
        </button>
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-2">
        <span className={cn("px-3 py-1.5 rounded-full text-xs font-medium", invCfg.bg, invCfg.text)}>
          <Package className="w-3.5 h-3.5 inline ml-1" />
          {t(invCfg.labelKey)} · {medication.remaining_quantity} {medication.dosage_unit}
        </span>
        <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-secondary text-muted-foreground">
          {medication.form}
        </span>
        <span className={cn("px-3 py-1.5 rounded-full text-xs font-medium", medication.active ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground")}>
          {medication.active ? t("medicationDetail.active") : t("medicationDetail.stopped")}
        </span>
      </div>

      {/* Info Grid */}
      <div className="bg-card rounded-2xl border-2 border-border p-5 space-y-4">
        <InfoRow icon={Pill} label={t("medicationDetail.doseLabel")} value={`${medication.dosage} ${medication.dosage_unit}`} />
        <InfoRow icon={Clock} label={t("medicationDetail.timesPerDayLabel")} value={t("medicationDetail.timesPerDay", { count: medication.scheduled_times?.length || 0 })} />
        {medication.scheduled_times?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {medication.scheduled_times.map((time, i) => (
              <span key={i} className="px-2.5 py-1 rounded-lg bg-secondary text-xs font-medium tabular-nums">{formatTime(time, t)}</span>
            ))}
          </div>
        )}
        <InfoRow icon={Calendar} label={t("medicationDetail.startDate")} value={formatDate(medication.start_date, lang)} />
        {medication.end_date && <InfoRow icon={Calendar} label={t("medicationDetail.endDate")} value={formatDate(medication.end_date, lang)} />}
        {medication.instructions && <InfoRow label={t("medicationDetail.instructions")} value={medication.instructions} />}
        {medication.notes && <InfoRow label={t("medicationDetail.notes")} value={medication.notes} />}
        {recipient && <InfoRow label={t("medicationDetail.person")} value={`${recipient.name} (${t(relationshipLabels[recipient.relationship] || "relationship.other")})`} />}
        {medication.calendar_event_ids?.length > 0 && (
          <InfoRow icon={CalendarCheck} label={t("medicationDetail.calendar")} value={t("medicationDetail.calendarSynced")} />
        )}
      </div>

      {/* Inventory Management */}
      <div className="bg-card rounded-2xl border-2 border-border p-5">
        <h3 className="font-heading font-bold text-base text-foreground mb-3">{t("medicationDetail.inventory")}</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-heading font-extrabold text-foreground tabular-nums">{medication.remaining_quantity}</p>
            <p className="text-xs text-muted-foreground">{t("medicationDetail.remainingOf", { unit: medication.dosage_unit })}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => adjustInventory(-1)} className="flex items-center justify-center w-11 h-11 rounded-xl border-2 border-border text-muted-foreground hover:bg-muted transition-colors touch-target" aria-label={t("medicationDetail.decreaseAria")}>
              <Minus className="w-5 h-5" />
            </button>
            <button onClick={() => adjustInventory(1)} className="flex items-center justify-center w-11 h-11 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 transition-colors touch-target" aria-label={t("medicationDetail.increaseAria")}>
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>{t("medicationDetail.threshold", { n: medication.refill_threshold, unit: medication.dosage_unit })}</span>
          <span>{t("medicationDetail.totalQuantity", { n: medication.quantity, unit: medication.dosage_unit })}</span>
        </div>
      </div>

      {/* Today's Doses */}
      {schedule.length > 0 && (
        <div>
          <h3 className="font-heading font-bold text-base text-foreground mb-3">{t("medicationDetail.todayDoses")}</h3>
          <div className="space-y-2">
            {schedule.map((dose, idx) => (
              <DoseRow
                key={`${dose.medication_id}_${dose.scheduled_time}_${idx}`}
                dose={dose}
                medication={medication}
                onTake={handleTake}
                onSkip={handleSkip}
                disabled={actionLoading === `${dose.medication_id}_${dose.scheduled_time}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-2 p-3.5 rounded-xl bg-secondary/50 border border-border">
        <ShieldAlert className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t("medicationDetail.disclaimer")}
        </p>
      </div>

      {/* Delete */}
      {confirmingDelete ? (
        <div className="p-4 rounded-xl bg-alert/10 border-2 border-alert/30">
          <p className="text-sm text-foreground mb-3">{t("medicationDetail.deleteConfirm", { name: medication.name })}</p>
          <div className="flex gap-2">
            <Button onClick={handleDelete} variant="destructive" className="flex-1 h-11">{t("medicationDetail.confirmDelete")}</Button>
            <Button onClick={() => setConfirmingDelete(false)} variant="outline" className="flex-1 h-11">{t("medicationDetail.cancel")}</Button>
          </div>
        </div>
      ) : (
        <button onClick={() => setConfirmingDelete(true)} className="flex items-center gap-2 text-sm text-alert hover:underline">
          <Trash2 className="w-4 h-4" />
          {t("medicationDetail.deleteMedication")}
        </button>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      {Icon && <Icon className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
      <div className="flex-1">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function EditView({ editForm, setEditForm, onSave, onCancel, saving }) {
  const t = useTranslation();
  const update = (key, value) => setEditForm((f) => ({ ...f, [key]: value }));

  const updateTime = (index, value) => {
    const newTimes = [...editForm.scheduled_times];
    newTimes[index] = value;
    update("scheduled_times", newTimes);
  };
  const addTime = () => update("scheduled_times", [...editForm.scheduled_times, "12:00"]);
  const removeTime = (index) => {
    if (editForm.scheduled_times.length <= 1) return;
    update("scheduled_times", editForm.scheduled_times.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="flex items-center justify-center w-10 h-10 rounded-xl border-2 border-border text-muted-foreground hover:bg-muted transition-colors">
          <X className="w-5 h-5" />
        </button>
        <h1 className="font-heading font-extrabold text-2xl text-foreground">{t("medicationDetail.editTitle")}</h1>
      </div>

      <div className="bg-card rounded-2xl border-2 border-border p-5 space-y-4">
        <div>
          <Label className="mb-1.5 block">{t("medicationDetail.nameLabel")}</Label>
          <Input value={editForm.name} onChange={(e) => update("name", e.target.value)} className="h-12" />
        </div>
        <div>
          <Label className="mb-1.5 block">{t("medicationDetail.genericNameLabel")}</Label>
          <Input value={editForm.generic_name} onChange={(e) => update("generic_name", e.target.value)} className="h-12" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-1.5 block">{t("medicationDetail.doseLabel")}</Label>
            <Input value={editForm.dosage} onChange={(e) => update("dosage", e.target.value)} className="h-12" />
          </div>
          <div>
            <Label className="mb-1.5 block">{t("medicationDetail.unitLabel")}</Label>
            <Select value={editForm.dosage_unit} onValueChange={(v) => update("dosage_unit", v)}>
              <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
              <SelectContent>{dosageUnits.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="mb-1.5 block">{t("medicationDetail.formLabel")}</Label>
          <Select value={editForm.form} onValueChange={(v) => update("form", v)}>
            <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
            <SelectContent>{medForms.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block">{t("medicationDetail.timesLabel")}</Label>
          <div className="space-y-2">
            {editForm.scheduled_times.map((time, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => updateTime(idx, e.target.value)}
                  className="flex-1 h-12 px-3 rounded-xl border-2 border-border bg-transparent text-sm font-medium text-foreground outline-none focus:border-accent tabular-nums"
                />
                <span className="text-sm text-muted-foreground w-20">{formatTime(time, t)}</span>
                {editForm.scheduled_times.length > 1 && (
                  <button onClick={() => removeTime(idx)} className="p-2.5 rounded-xl text-muted-foreground hover:bg-alert/10 hover:text-alert transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button onClick={addTime} className="mt-2 flex items-center gap-2 text-sm text-accent font-medium hover:underline">
            <Plus className="w-4 h-4" /> {t("medicationDetail.addTime")}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-1.5 block">{t("medicationDetail.startDate")}</Label>
            <Input type="date" value={editForm.start_date} onChange={(e) => update("start_date", e.target.value)} className="h-12" />
          </div>
          <div>
            <Label className="mb-1.5 block">{t("medicationDetail.endDate")}</Label>
            <Input type="date" value={editForm.end_date} onChange={(e) => update("end_date", e.target.value)} className="h-12" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="mb-1.5 block">{t("medicationDetail.quantityLabel")}</Label>
            <Input type="number" min="0" value={editForm.quantity} onChange={(e) => update("quantity", parseInt(e.target.value) || 0)} className="h-12" />
          </div>
          <div>
            <Label className="mb-1.5 block">{t("medicationDetail.remainingLabel")}</Label>
            <Input type="number" min="0" value={editForm.remaining_quantity} onChange={(e) => update("remaining_quantity", parseInt(e.target.value) || 0)} className="h-12" />
          </div>
          <div>
            <Label className="mb-1.5 block">{t("medicationDetail.refillThresholdLabel")}</Label>
            <Input type="number" min="0" value={editForm.refill_threshold} onChange={(e) => update("refill_threshold", parseInt(e.target.value) || 0)} className="h-12" />
          </div>
        </div>
        <div>
          <Label className="mb-1.5 block">{t("medicationDetail.instructions")}</Label>
          <Textarea value={editForm.instructions} onChange={(e) => update("instructions", e.target.value)} rows={2} className="resize-none" />
        </div>
        <div>
          <Label className="mb-1.5 block">{t("medicationDetail.notes")}</Label>
          <Textarea value={editForm.notes} onChange={(e) => update("notes", e.target.value)} rows={2} className="resize-none" />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={editForm.active} onChange={(e) => update("active", e.target.checked)} className="w-5 h-5 rounded accent-accent" />
          <span className="text-sm font-medium text-foreground">{t("medicationDetail.activeMedication")}</span>
        </label>
      </div>

      <div className="flex gap-3">
        <Button onClick={onCancel} variant="outline" className="h-12 px-6 flex-1">{t("medicationDetail.cancel")}</Button>
        <Button onClick={onSave} disabled={saving} className="h-12 px-6 flex-1 bg-accent hover:bg-accent/90">
          {saving ? t("medicationDetail.saving") : <><Check className="w-4 h-4 ml-1.5" strokeWidth={2.5} />{t("medicationDetail.save")}</>}
        </Button>
      </div>
    </div>
  );
}
