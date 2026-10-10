import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/supabaseClient";
import { useI18n } from "@/i18n";
import { ChevronRight, Loader2, Check, Pill, Activity, ShieldAlert, Users, Heart } from "lucide-react";
import { formatRelativeTime } from "@/lib/relativeTime";

const ACTION_CONFIG = {
  dose_taken: { icon: Check, color: "#0d9488", bg: "#0d948815" },
  dose_skipped: { icon: ChevronRight, color: "#e11d48", bg: "#e11d4815" },
  medication_added: { icon: Pill, color: "#6366f1", bg: "#6366f115" },
  vital_recorded: { icon: Activity, color: "#f59e0b", bg: "#f59e0b15" },
  emergency_updated: { icon: ShieldAlert, color: "#ef4444", bg: "#ef444415" },
  member_invited: { icon: Users, color: "#8b5cf6", bg: "#8b5cf615" },
};

export default function ActivityFeed() {
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.entities.ActivityFeed.list("-created_date", 50);
        setActivities(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const getActionText = (activity) => {
    const name = activity.actor_name || t("activity.someone");
    switch (activity.action) {
      case "dose_taken":
        return t("activity.doseTaken", { name, med: activity.target_name || "", person: activity.recipient_name || "" });
      case "dose_skipped":
        return t("activity.doseSkipped", { name, med: activity.target_name || "", person: activity.recipient_name || "" });
      case "medication_added":
        return t("activity.medAdded", { name, med: activity.target_name || "" });
      case "vital_recorded":
        return t("activity.vitalRecorded", { name, person: activity.recipient_name || "", type: activity.target_name || "" });
      case "emergency_updated":
        return t("activity.emergencyUpdated", { name, person: activity.recipient_name || "" });
      case "member_invited":
        return t("activity.memberInvited", { name, member: activity.target_name || "" });
      default:
        return activity.action;
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-8 py-6 lg:py-8 pb-32">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center justify-center w-10 h-10 rounded-xl border-2 border-border text-muted-foreground hover:bg-muted transition-colors">
          <ChevronRight className="w-5 h-5 rtl:rotate-180" />
        </button>
        <div>
          <h1 className="font-heading font-extrabold text-xl text-foreground">{t("activity.title")}</h1>
          <p className="text-xs text-muted-foreground">{t("activity.subtitle")}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
        </div>
      ) : activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center">
          <Heart className="w-12 h-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("activity.empty")}</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute top-0 bottom-0 start-[19px] w-0.5 bg-border" />
          <div className="space-y-1">
            {activities.map((activity, idx) => {
              const cfg = ACTION_CONFIG[activity.action] || { icon: Activity, color: "#94a3b8", bg: "#94a3b815" };
              const Icon = cfg.icon;
              return (
                <div key={activity.id || idx} className="relative flex items-start gap-3 p-3">
                  <div
                    className="relative z-10 flex items-center justify-center w-10 h-10 rounded-full shrink-0 ring-4 ring-background"
                    style={{ backgroundColor: cfg.bg, color: cfg.color }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <p className="text-sm text-foreground leading-relaxed">{getActionText(activity)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatRelativeTime(activity.created_date, lang)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}