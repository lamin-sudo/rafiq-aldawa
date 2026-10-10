import { useState, useEffect, useCallback } from "react";
import { api } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { useTranslation } from "@/i18n";
import { relationshipLabels } from "@/lib/medicationUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Plus, Pencil, Trash2, Check, X, LogOut, ShieldCheck } from "lucide-react";

export default function Profile() {
  const { user, logout } = useAuth();
  const t = useTranslation();
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: "", relationship: "self", date_of_birth: "", gender: "unspecified", notes: "" });
  const [saving, setSaving] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const recs = await api.entities.CareRecipient.list();
      setRecipients(recs);
    } catch (err) {
      console.error("Load recipients error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const resetForm = () => {
    setForm({ name: "", relationship: "self", date_of_birth: "", gender: "unspecified", notes: "" });
    setEditingId(null);
    setShowAdd(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await api.entities.CareRecipient.update(editingId, form);
        await api.entities.AuditLog.create({
          actor_id: user.id, actor_email: user.email,
          action: "recipient_updated", target_type: "CareRecipient",
          target_id: editingId, target_name: form.name,
          details: t("profile.auditUpdated"),
        });
      } else {
        const rec = await api.entities.CareRecipient.create(form);
        await api.entities.AuditLog.create({
          actor_id: user.id, actor_email: user.email,
          action: "recipient_created", target_type: "CareRecipient",
          target_id: rec.id, target_name: form.name,
          details: t("profile.auditCreated"),
        });
      }
      resetForm();
      await loadData();
    } catch (err) {
      console.error("Save recipient error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (rec) => {
    setForm({
      name: rec.name || "",
      relationship: rec.relationship || "self",
      date_of_birth: rec.date_of_birth || "",
      gender: rec.gender || "unspecified",
      notes: rec.notes || "",
    });
    setEditingId(rec.id);
    setShowAdd(true);
  };

  const handleDelete = async (rec) => {
    try {
      const meds = await api.entities.Medication.filter({ recipient_id: rec.id });
      for (const med of meds) {
        await api.entities.Medication.delete(med.id);
      }
      await api.entities.CareRecipient.delete(rec.id);
      await api.entities.AuditLog.create({
        actor_id: user.id, actor_email: user.email,
        action: "recipient_deleted", target_type: "CareRecipient",
        target_id: rec.id, target_name: rec.name,
        details: t("profile.auditDeleted"),
      });
      setConfirmingDeleteId(null);
      await loadData();
    } catch (err) {
      console.error("Delete recipient error:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-secondary border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-6">
      <h1 className="font-heading font-extrabold text-2xl lg:text-3xl text-foreground">{t("profile.title")}</h1>

      {/* User Info */}
      <div className="bg-card rounded-2xl border-2 border-border p-5">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground font-heading font-bold text-xl">
            {user?.email?.[0]?.toUpperCase() || t("profile.avatarFallback")}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-heading font-bold text-base text-foreground truncate">{user?.email || t("common.user")}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">
                <ShieldCheck className="w-3 h-3" />
                {user?.role === "admin" ? t("profile.admin") : t("common.activeAccount")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Care Recipients */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-bold text-lg text-foreground">{t("profile.followedPeople")}</h2>
          {!showAdd && (
            <Button onClick={() => { setEditingId(null); setForm({ name: "", relationship: "self", date_of_birth: "", gender: "unspecified", notes: "" }); setShowAdd(true); }} variant="outline" className="h-10 px-4">
              <Plus className="w-4 h-4 ml-1.5" />
              {t("profile.addPerson")}
            </Button>
          )}
        </div>

        {showAdd && (
          <div className="bg-card rounded-2xl border-2 border-border p-5 space-y-4 mb-3 animate-scale-in">
            <h3 className="font-heading font-bold text-base text-foreground">{editingId ? t("profile.editPerson") : t("profile.addNewPerson")}</h3>
            <div>
              <Label className="mb-1.5 block">{t("profile.name")} *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t("profile.namePlaceholder")} className="h-12" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">{t("profile.relationship")}</Label>
                <Select value={form.relationship} onValueChange={(v) => setForm((f) => ({ ...f, relationship: v }))}>
                  <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(relationshipLabels).map(([key, labelKey]) => (
                      <SelectItem key={key} value={key}>{t(labelKey)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">{t("profile.dob")}</Label>
                <Input type="date" value={form.date_of_birth} onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))} className="h-12" />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">{t("profile.gender")}</Label>
              <Select value={form.gender} onValueChange={(v) => setForm((f) => ({ ...f, gender: v }))}>
                <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unspecified">{t("profile.genderUnspecified")}</SelectItem>
                  <SelectItem value="male">{t("profile.genderMale")}</SelectItem>
                  <SelectItem value="female">{t("profile.genderFemale")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">{t("profile.notes")}</Label>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder={t("profile.notesPlaceholder")} className="h-12" />
            </div>
            <div className="flex gap-3">
              <Button onClick={resetForm} variant="outline" className="h-12 flex-1">
                <X className="w-4 h-4 ml-1.5" /> {t("common.cancel")}
              </Button>
              <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="h-12 flex-1 bg-accent hover:bg-accent/90">
                {saving ? t("profile.saving") : <><Check className="w-4 h-4 ml-1.5" strokeWidth={2.5} />{t("common.save")}</>}
              </Button>
            </div>
          </div>
        )}

        {recipients.length === 0 && !showAdd ? (
          <div className="bg-card rounded-2xl border-2 border-border p-8 text-center">
            <User className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t("profile.emptyDesc")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recipients.map((rec) => (
              <div key={rec.id} className="p-4 rounded-2xl bg-card border-2 border-border">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-11 h-11 rounded-full bg-secondary font-semibold text-sm shrink-0">
                    {rec.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{rec.name}</p>
                    <p className="text-xs text-muted-foreground">{t(relationshipLabels[rec.relationship] || "relationship.other")}{rec.date_of_birth && ` · ${rec.date_of_birth}`}</p>
                  </div>
                  <button onClick={() => handleEdit(rec)} className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-muted transition-colors" aria-label={t("common.edit")}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setConfirmingDeleteId(rec.id)} className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-alert/10 hover:text-alert transition-colors" aria-label={t("common.delete")}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {confirmingDeleteId === rec.id && (
                  <div className="mt-3 p-3 rounded-xl bg-alert/10 border-2 border-alert/30 animate-scale-in">
                    <p className="text-sm text-foreground mb-2.5">{t("profile.deleteConfirm", { name: rec.name })}</p>
                    <div className="flex gap-2">
                      <button onClick={() => handleDelete(rec)} className="flex-1 py-2 rounded-lg bg-alert text-alert-foreground text-sm font-medium hover:bg-alert/90 transition-colors">
                        {t("profile.yesDelete")}
                      </button>
                      <button onClick={() => setConfirmingDeleteId(null)} className="flex-1 py-2 rounded-lg border-2 border-border text-muted-foreground text-sm font-medium hover:bg-muted transition-colors">
                        {t("common.cancel")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* P2-F: the Settings quick link was a duplicate — Settings already lives
          in the app drawer. Profile now stays focused: user info, care
          recipients (followers), and logout. */}

      {/* Logout */}
      <button
        onClick={() => logout()}
        className="flex items-center gap-3 w-full p-4 rounded-2xl border-2 border-alert/20 text-alert hover:bg-alert/5 transition-colors"
      >
        <LogOut className="w-5 h-5" />
        <span className="flex-1 text-sm font-medium text-right">{t("profile.logout")}</span>
      </button>
    </div>
  );
}
