import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/supabaseClient";
import { useTranslation } from "@/i18n";
import { getInventoryStatus, inventoryStatusConfig, formatTime, relationshipLabels, getTimePeriod } from "@/lib/medicationUtils";
import EmptyState from "@/components/EmptyState";
import MedicationFilters from "@/components/medications/MedicationFilters";
import { Pill, Plus, Package, Trash2, CheckCircle2, XCircle, ScanLine, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const primaryLink = "inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent/90 transition-colors";

function earliestMinutes(med) {
  const times = med.scheduled_times || [];
  if (times.length === 0) return Number.MAX_SAFE_INTEGER;
  return Math.min(
    ...times.map((tm) => {
      const [h, m] = String(tm).split(":").map(Number);
      return (h || 0) * 60 + (m || 0);
    })
  );
}

export default function Medications() {
  const t = useTranslation();
  const [recipients, setRecipients] = useState([]);
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [sortKey, setSortKey] = useState("newest");

  // Debounce the search box (300ms) before hitting the server
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const loadRecipients = useCallback(async () => {
    const recs = await api.entities.CareRecipient.list();
    setRecipients(recs);
  }, []);

  // Search + status filters run on the server; period / low-stock are derived
  // values so they are applied on the returned page.
  const loadMedications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = {};
      if (search) {
        const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        query.$or = [
          { name: { $regex: safe, $options: "i" } },
          { notes: { $regex: safe, $options: "i" } },
        ];
      }
      if (statusFilter === "active") query.active = true;
      if (statusFilter === "completed") query.active = false;

      let sort = "-created_date";
      if (sortKey === "name_asc") sort = "name";
      if (sortKey === "name_desc") sort = "-name";

      const page = await api.entities.Medication.filter(query, { sort, limit: 200 });
      setMedications(page.items || []);
    } catch (err) {
      console.error("Load medications error:", err);
      setError(t("medications.loadError"));
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sortKey, t]);

  useEffect(() => {
    loadRecipients().catch((e) => console.error(e));
  }, [loadRecipients]);

  useEffect(() => {
    loadMedications();
  }, [loadMedications]);

  const visible = useMemo(() => {
    let list = [...medications];
    if (statusFilter === "low") list = list.filter((m) => getInventoryStatus(m) !== "normal");
    if (periodFilter !== "all") {
      list = list.filter((m) => (m.scheduled_times || []).some((tm) => getTimePeriod(tm) === periodFilter));
    }
    if (sortKey === "upcoming") list.sort((a, b) => earliestMinutes(a) - earliestMinutes(b));
    else if (sortKey === "stock_asc") list.sort((a, b) => (a.remaining_quantity ?? 0) - (b.remaining_quantity ?? 0));
    return list;
  }, [medications, statusFilter, periodFilter, sortKey]);

  const hasFilters = Boolean(search) || statusFilter !== "all" || periodFilter !== "all";
  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatusFilter("all");
    setPeriodFilter("all");
  };

  const groups = recipients
    .map((r) => ({ recipient: r, meds: visible.filter((m) => m.recipient_id === r.id) }))
    .filter((g) => g.meds.length > 0);

  if (loading && recipients.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-secondary border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!loading && recipients.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <PageHeader t={t} showActions={false} />
        <EmptyState
          icon={Pill}
          title={t("medications.noRecipientTitle")}
          description={t("medications.noRecipientDesc")}
          action={<Link to="/profile" className={primaryLink}>{t("medications.addPerson")}</Link>}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-6">
      <PageHeader t={t} />

      <MedicationFilters
        searchInput={searchInput}
        onSearch={setSearchInput}
        statusFilter={statusFilter}
        onStatus={setStatusFilter}
        periodFilter={periodFilter}
        onPeriod={setPeriodFilter}
        sortKey={sortKey}
        onSort={setSortKey}
        hasFilters={hasFilters}
        onClear={clearFilters}
        t={t}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-secondary border-t-accent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-alert/10 border-2 border-alert/30 text-center">
          <AlertCircle className="w-8 h-8 text-alert mx-auto mb-3" />
          <p className="text-sm text-foreground mb-4">{error}</p>
          <button onClick={loadMedications} className="px-5 py-2.5 rounded-xl bg-alert text-alert-foreground text-sm font-semibold hover:bg-alert/90 transition-colors">
            {t("medications.retry")}
          </button>
        </div>
      ) : visible.length === 0 ? (
        hasFilters || medications.length > 0 ? (
          <EmptyState
            icon={Pill}
            title={t("medications.noResultsTitle")}
            description={t("medications.noResultsDesc")}
            action={
              <button onClick={clearFilters} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-border text-foreground font-semibold text-sm hover:bg-muted transition-colors">
                {t("medications.clearFilters")}
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={Pill}
            title={t("medications.emptyTitle")}
            description={t("medications.emptyDesc")}
            action={
              <Link to="/medications/new" className={primaryLink}>
                <Plus className="w-5 h-5" />
                {t("medications.addMedication")}
              </Link>
            }
          />
        )
      ) : (
        <div className="space-y-6">
          {groups.map(({ recipient, meds }) => (
            <div key={recipient.id}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="font-heading font-bold text-base text-foreground">{recipient.name}</h2>
                <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-secondary">
                  {t(relationshipLabels[recipient.relationship] || "relationship.other")}
                </span>
                <span className="text-xs text-muted-foreground ms-auto">{t("medications.medCount", { count: meds.length })}</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {meds.map((med) => (
                  <MedicationCard key={med.id} medication={med} onUpdate={loadMedications} t={t} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MedicationCard({ medication, onUpdate, t }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const invStatus = getInventoryStatus(medication);
  const invCfg = inventoryStatusConfig[invStatus];
  const times = medication.scheduled_times || [];

  const handleDelete = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleting(true);
    try {
      await api.entities.Medication.delete(medication.id);
      await onUpdate();
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <Link
      to={`/medications/${medication.id}`}
      className="block bg-card rounded-2xl border-2 border-border p-4 hover:border-primary/20 transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-heading font-bold text-base text-foreground truncate">{medication.name}</h3>
          {medication.generic_name && (
            <p className="text-xs text-muted-foreground truncate">{medication.generic_name}</p>
          )}
        </div>
        <span className={cn("shrink-0 px-2.5 py-1 rounded-full text-xs font-medium", invCfg.bg, invCfg.text)}>
          {t(invCfg.labelKey)}
        </span>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
        <Pill className="w-4 h-4 shrink-0" />
        <span>{medication.dosage} {medication.dosage_unit}</span>
        <span className="text-border">·</span>
        <span>{t("medications.perDay", { count: medication.frequency_per_day })}</span>
      </div>

      {times.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {times.map((time, i) => (
            <span key={i} className="px-2 py-0.5 rounded-lg bg-secondary text-xs font-medium text-muted-foreground tabular-nums">
              {formatTime(time, t)}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Package className="w-3.5 h-3.5" />
          <span>{t("medications.remaining")}: {medication.remaining_quantity} {medication.dosage_unit}</span>
        </div>
        <div className="flex items-center gap-2">
          {medication.active ? (
            <CheckCircle2 className="w-4 h-4 text-accent" />
          ) : (
            <XCircle className="w-4 h-4 text-muted-foreground" />
          )}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmingDelete(true); }}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-alert/10 hover:text-alert transition-colors"
            aria-label={t("medications.deleteAria")}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {confirmingDelete && (
        <div className="mt-3 p-3 rounded-xl bg-alert/10 border-2 border-alert/30 animate-scale-in" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
          <p className="text-sm text-foreground mb-2.5">{t("medications.deleteConfirm", { name: medication.name })}</p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 py-2 rounded-lg bg-alert text-alert-foreground text-sm font-medium hover:bg-alert/90 transition-colors disabled:opacity-50"
            >
              {deleting ? t("medications.deleting") : t("medications.confirmDelete")}
            </button>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmingDelete(false); }}
              className="flex-1 py-2 rounded-lg border-2 border-border text-muted-foreground text-sm font-medium hover:bg-muted transition-colors"
            >
              {t("medications.cancel")}
            </button>
          </div>
        </div>
      )}
    </Link>
  );
}

function PageHeader({ t, showActions = true }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-heading font-extrabold text-2xl lg:text-3xl text-foreground">{t("medications.title")}</h1>
      {showActions && (
        <div className="flex items-center gap-2">
          <Link
            to="/scan/pill"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-border text-foreground text-sm font-semibold hover:bg-muted transition-colors"
          >
            <ScanLine className="w-4 h-4" strokeWidth={2.5} />
            {t("medications.identifyPill")}
          </Link>
          <Link
            to="/medications/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            {t("medications.newMedication")}
          </Link>
        </div>
      )}
    </div>
  );
}