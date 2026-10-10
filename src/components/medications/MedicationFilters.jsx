import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_FILTERS = [
  { key: "all", labelKey: "medications.filterAll" },
  { key: "active", labelKey: "medications.filterActive" },
  { key: "completed", labelKey: "medications.filterCompleted" },
  { key: "low", labelKey: "medications.filterLowStock" },
];

const PERIOD_FILTERS = [
  { key: "all", labelKey: "medications.filterAll" },
  { key: "morning", labelKey: "medications.periodMorning" },
  { key: "evening", labelKey: "medications.periodEvening" },
  { key: "night", labelKey: "medications.periodNight" },
];

const SORT_OPTIONS = [
  { key: "newest", labelKey: "medications.sortNewest" },
  { key: "upcoming", labelKey: "medications.sortUpcoming" },
  { key: "name_asc", labelKey: "medications.sortNameAsc" },
  { key: "name_desc", labelKey: "medications.sortNameDesc" },
  { key: "stock_asc", labelKey: "medications.sortStockAsc" },
];

function chipClass(active) {
  return cn(
    "px-3.5 py-1.5 rounded-full text-xs font-medium border-2 transition-colors",
    active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/30"
  );
}

export default function MedicationFilters({
  searchInput,
  onSearch,
  statusFilter,
  onStatus,
  periodFilter,
  onPeriod,
  sortKey,
  onSort,
  hasFilters,
  onClear,
  t,
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchInput}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t("medications.searchPlaceholder")}
            className="h-11 ps-9"
            aria-label={t("medications.searchPlaceholder")}
          />
        </div>
        <Select value={sortKey} onValueChange={onSort}>
          <SelectTrigger className="h-11 w-[170px] lg:w-[200px] shrink-0" aria-label={t("medications.sortLabel")}>
            <SelectValue placeholder={t("medications.sortLabel")} />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.key} value={o.key}>{t(o.labelKey)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <button key={`status_${f.key}`} onClick={() => onStatus(f.key)} className={chipClass(statusFilter === f.key)}>
            {t(f.labelKey)}
          </button>
        ))}
        <span className="w-px h-5 bg-border mx-1" aria-hidden="true" />
        {PERIOD_FILTERS.map((f) => (
          <button key={`period_${f.key}`} onClick={() => onPeriod(f.key)} className={chipClass(periodFilter === f.key)}>
            {t(f.labelKey)}
          </button>
        ))}
        {hasFilters && (
          <button
            onClick={onClear}
            className="ms-auto flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-alert hover:bg-alert/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            {t("medications.clearFilters")}
          </button>
        )}
      </div>
    </div>
  );
}