import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/supabaseClient";
import { useTranslation } from "@/i18n";
import { useI18n } from "@/i18n";
import { ChevronLeft, Bell, Pill, Package, Users, Info, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_ICONS = {
  dose_due: Pill,
  dose_overdue: AlertCircle,
  low_stock: Package,
  refill_reminder: Package,
  family_activity: Users,
  system: Info,
};

export default function NotificationHistory() {
  const t = useTranslation();
  const { lang } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const page = await api.entities.NotificationLog.filter({}, { sort: "-created_date", limit: 50 });
        setItems(page.items || []);
      } catch (err) {
        console.error("Load notification log error:", err);
        setError(t("notifications.historyError"));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const formatDate = (value) => {
    if (!value) return "";
    try {
      return new Date(value).toLocaleString(lang === "ar" ? "ar" : lang, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return value;
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/settings"
          className="flex items-center justify-center w-10 h-10 rounded-xl border-2 border-border text-muted-foreground hover:bg-muted transition-colors"
          aria-label={t("common.cancel")}
        >
          <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
        </Link>
        <div>
          <h1 className="font-heading font-extrabold text-2xl lg:text-3xl text-foreground">{t("notifications.historyTitle")}</h1>
          <p className="text-xs text-muted-foreground">{t("notifications.historyDesc")}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-secondary border-t-accent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="p-4 rounded-2xl bg-alert/10 border-2 border-alert/30 text-sm text-alert flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-card rounded-2xl border-2 border-border p-10 text-center">
          <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-heading font-bold text-sm text-foreground mb-1">{t("notifications.historyEmpty")}</p>
          <p className="text-xs text-muted-foreground">{t("notifications.historyEmptyDesc")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const Icon = TYPE_ICONS[item.type] || Bell;
            return (
              <div key={item.id} className="flex items-start gap-3 p-4 rounded-2xl bg-card border-2 border-border">
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-secondary text-muted-foreground shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  {item.body && <p className="text-xs text-muted-foreground mt-0.5">{item.body}</p>}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-muted-foreground tabular-nums">{formatDate(item.created_date, lang)}</span>
                    {item.was_snoozed && (
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning")}>
                        {t("notifications.snoozedTag")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}