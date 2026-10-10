import { useState, useEffect, useCallback } from "react";
import { api } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { useTranslation } from "@/i18n";
import { permissionLabels, isValidEmail } from "@/lib/medicationUtils";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, UserPlus, Mail, Check, Clock, ShieldCheck, Eye, Hand, Settings2, AlertCircle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const permissionIcons = { view_only: Eye, view_and_confirm: Hand, manage: Settings2 };
const permissionDescriptionKeys = {
  view_only: "family.permViewOnlyDesc",
  view_and_confirm: "family.permViewConfirmDesc",
  manage: "family.permManageDesc",
};

export default function Family() {
  const { user } = useAuth();
  const t = useTranslation();
  const [recipients, setRecipients] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ invited_email: "", relationship: "", permission_level: "view_only", recipient_id: "" });
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [recs, mems] = await Promise.all([
        api.entities.CareRecipient.list(),
        api.entities.FamilyMember.list(),
      ]);
      setRecipients(recs);
      setMembers(mems);
      if (recs.length > 0 && !inviteForm.recipient_id) {
        setInviteForm((f) => ({ ...f, recipient_id: recs[0].id }));
      }
    } catch (err) {
      console.error("Load family error:", err);
    } finally {
      setLoading(false);
    }
  }, [inviteForm.recipient_id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleInvite = async () => {
    setError("");
    if (!inviteForm.invited_email.trim()) { setError(t("family.errEmailRequired")); return; }
    if (!isValidEmail(inviteForm.invited_email)) { setError(t("family.errEmailInvalid")); return; }
    if (inviteForm.invited_email === user?.email) { setError(t("family.errSelfInvite")); return; }
    if (!inviteForm.recipient_id) { setError(t("family.errSelectPerson")); return; }

    // التحقق من عدم وجود دعوة سابقة
    const existing = members.find((m) => m.invited_email === inviteForm.invited_email && m.recipient_id === inviteForm.recipient_id && m.status !== "revoked");
    if (existing) { setError(t("family.errAlreadyInvited")); return; }

    setInviting(true);
    try {
      const recipient = recipients.find((r) => r.id === inviteForm.recipient_id);
      await api.entities.FamilyMember.create({
        invited_email: inviteForm.invited_email,
        relationship: inviteForm.relationship,
        permission_level: inviteForm.permission_level,
        status: "pending",
        recipient_id: inviteForm.recipient_id,
        recipient_name: recipient?.name || "",
      });

      await api.entities.AuditLog.create({
        actor_id: user.id,
        actor_email: user.email,
        action: "family_member_invited",
        target_type: "FamilyMember",
        target_name: inviteForm.invited_email,
        details: t("family.auditInvite", { email: inviteForm.invited_email, permission: t(permissionLabels[inviteForm.permission_level]) }),
      });

      // إرسال دعوة بالبريد (يتم التقاطها في بيئة الاختبار، لا تصل لمستلم حقيقي)
      try {
        await api.integrations.Core.SendEmail({
          to: inviteForm.invited_email,
          subject: t("family.inviteEmailSubject"),
          body: t("family.inviteEmailBody", { name: recipient?.name || "", permission: t(permissionLabels[inviteForm.permission_level]) }),
        });
      } catch (emailErr) {
        console.error("Send invite email error:", emailErr);
      }

      setShowInvite(false);
      setInviteForm({ invited_email: "", relationship: "", permission_level: "view_only", recipient_id: recipients[0]?.id || "" });
      await loadData();
    } catch (err) {
      setError(err.message || t("family.errSendFailed"));
      console.error("Invite error:", err);
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = async (memberId, memberName) => {
    try {
      await api.entities.FamilyMember.update(memberId, { status: "revoked" });
      await api.entities.AuditLog.create({
        actor_id: user.id,
        actor_email: user.email,
        action: "permission_revoked",
        target_type: "FamilyMember",
        target_id: memberId,
        target_name: memberName,
        details: t("family.auditRevoked"),
      });
      await loadData();
    } catch (err) {
      console.error("Revoke error:", err);
    }
  };

  const handleUpdatePermission = async (memberId, newPermission, memberName) => {
    try {
      await api.entities.FamilyMember.update(memberId, { permission_level: newPermission });
      await api.entities.AuditLog.create({
        actor_id: user.id,
        actor_email: user.email,
        action: "permission_changed",
        target_type: "FamilyMember",
        target_id: memberId,
        target_name: memberName,
        details: t("family.auditPermissionChanged", { permission: t(permissionLabels[newPermission]) }),
      });
      await loadData();
    } catch (err) {
      console.error("Update permission error:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-secondary border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  const activeMembers = members.filter((m) => m.status !== "revoked");

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-heading font-extrabold text-2xl lg:text-3xl text-foreground">{t("family.title")}</h1>
        {recipients.length > 0 && (
          <Button onClick={() => setShowInvite(!showInvite)} className="h-11 px-4">
            <UserPlus className="w-4 h-4 ml-1.5" />
            {t("family.inviteMember")}
          </Button>
        )}
      </div>

      {/* Invite Form */}
      {showInvite && (
        <div className="bg-card rounded-2xl border-2 border-border p-5 space-y-4 animate-scale-in">
          <h3 className="font-heading font-bold text-base text-foreground">{t("family.inviteModalTitle")}</h3>
          {error && (
            <div className="p-3 rounded-xl bg-alert/10 text-alert text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          <div>
            <Label className="mb-1.5 block">{t("family.email")} *</Label>
            <Input
              type="email"
              value={inviteForm.invited_email}
              onChange={(e) => setInviteForm((f) => ({ ...f, invited_email: e.target.value }))}
              placeholder="family@example.com"
              className="h-12"
            />
          </div>
          <div>
            <Label className="mb-1.5 block">{t("family.relationship")}</Label>
            <Input
              value={inviteForm.relationship}
              onChange={(e) => setInviteForm((f) => ({ ...f, relationship: e.target.value }))}
              placeholder={t("family.relationshipPlaceholder")}
              className="h-12"
            />
          </div>
          {recipients.length > 1 && (
            <div>
              <Label className="mb-1.5 block">{t("family.sharedPerson")}</Label>
              <Select value={inviteForm.recipient_id} onValueChange={(v) => setInviteForm((f) => ({ ...f, recipient_id: v }))}>
                <SelectTrigger className="h-12"><SelectValue placeholder={t("family.selectPersonPlaceholder")} /></SelectTrigger>
                <SelectContent>
                  {recipients.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="mb-1.5 block">{t("family.permissionLevel")}</Label>
            <div className="space-y-2">
              {Object.entries(permissionLabels).slice(0, 2).map(([key, labelKey]) => {
                const PermIcon = permissionIcons[key];
                return (
                  <button
                    key={key}
                    onClick={() => setInviteForm((f) => ({ ...f, permission_level: key }))}
                    className={cn("flex items-start gap-3 p-3 rounded-xl border-2 transition-all text-right w-full", inviteForm.permission_level === key ? "border-accent bg-accent/5" : "border-border")}
                  >
                    <PermIcon className={cn("w-5 h-5 shrink-0 mt-0.5", inviteForm.permission_level === key ? "text-accent" : "text-muted-foreground")} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{t(labelKey)}</p>
                      <p className="text-xs text-muted-foreground">{t(permissionDescriptionKeys[key])}</p>
                    </div>
                    {inviteForm.permission_level === key && <Check className="w-5 h-5 text-accent shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setShowInvite(false)} variant="outline" className="h-12 flex-1">{t("common.cancel")}</Button>
            <Button onClick={handleInvite} disabled={inviting} className="h-12 flex-1 bg-accent hover:bg-accent/90">
              {inviting ? t("family.sending") : t("family.sendInvite")}
            </Button>
          </div>
        </div>
      )}

      {/* Members List */}
      {recipients.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("family.emptyAddPersonTitle")}
          description={t("family.emptyAddPersonDesc")}
        />
      ) : activeMembers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("family.emptyNoMembersTitle")}
          description={t("family.emptyNoMembersDesc")}
          action={
            <Button onClick={() => setShowInvite(true)} className="bg-accent hover:bg-accent/90">
              <UserPlus className="w-4 h-4 ml-1.5" />
              {t("family.inviteMember")}
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {activeMembers.map((member) => {
            const PermIcon = permissionIcons[member.permission_level] || Eye;
            const recipient = recipients.find((r) => r.id === member.recipient_id);
            return (
              <div key={member.id} className="bg-card rounded-2xl border-2 border-border p-4">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-11 h-11 rounded-full bg-secondary shrink-0">
                    <Mail className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground truncate">{member.invited_email}</p>
                      {member.status === "pending" && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">
                          <Clock className="w-3 h-3" />
                          {t("family.statusPending")}
                        </span>
                      )}
                      {member.status === "active" && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">
                          <Check className="w-3 h-3" />
                          {t("common.active")}
                        </span>
                      )}
                    </div>
                    {member.relationship && <p className="text-xs text-muted-foreground mt-0.5">{member.relationship}</p>}
                    {recipient && <p className="text-xs text-muted-foreground mt-0.5">{t("family.follows", { name: recipient.name })}</p>}
                  </div>
                </div>

                {/* Permission */}
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <PermIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{t("family.permissionLabel")}</span>
                    <select
                      value={member.permission_level}
                      onChange={(e) => handleUpdatePermission(member.id, e.target.value, member.invited_email)}
                      className="flex-1 h-9 px-2 rounded-lg border border-border bg-card text-xs text-foreground outline-none focus:border-accent"
                    >
                      <option value="view_only">{t(permissionLabels.view_only)}</option>
                      <option value="view_and_confirm">{t(permissionLabels.view_and_confirm)}</option>
                    </select>
                    <button
                      onClick={() => handleRevoke(member.id, member.invited_email)}
                      className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-alert/10 hover:text-alert transition-colors shrink-0"
                      aria-label={t("family.revokePermission")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info */}
      <div className="flex items-start gap-2 p-3.5 rounded-xl bg-secondary/50 border border-border">
        <ShieldCheck className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t("family.infoText")}
        </p>
      </div>
    </div>
  );
}
