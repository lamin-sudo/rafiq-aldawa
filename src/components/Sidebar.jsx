import { NavLink, useLocation } from "react-router-dom";
import { Home, Pill, History, Users, User, Plus, PillBottle, Siren, HeartPulse, Activity, UserCircle, Lightbulb, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { useTranslation } from "@/i18n";

const navItems = [
  { to: "/", labelKey: "nav.home", icon: Home, end: true },
  { to: "/medications", labelKey: "nav.medications", icon: Pill },
  { to: "/history", labelKey: "nav.history", icon: History },
  { to: "/family", labelKey: "nav.family", icon: Users },
  { to: "/vitals", labelKey: "nav.vitalSigns", icon: HeartPulse },
  { to: "/activity", labelKey: "nav.activity", icon: Activity },
  { to: "/emergency", labelKey: "nav.emergency", icon: Siren },
  { to: "/profile", labelKey: "nav.profile", icon: User },
  { to: "/about-developer", labelKey: "nav.aboutDeveloper", icon: UserCircle },
  { to: "/suggest-feature", labelKey: "nav.suggestFeature", icon: Lightbulb },
  { to: "/share-app", labelKey: "nav.shareApp", icon: Share2 },
];

export default function Sidebar() {
  const location = useLocation();
  const { user } = useAuth();
  const t = useTranslation();

  return (
    <aside className="hidden lg:flex flex-col w-[260px] shrink-0 bg-card border-e border-border h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-border">
        <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-accent text-accent-foreground">
          <PillBottle className="w-6 h-6" strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="font-heading font-extrabold text-lg text-primary leading-tight">{t("app.name")}</h1>
          <p className="text-xs text-muted-foreground">{t("app.tagline")}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.end
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                isActive
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="w-5 h-5 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
              {t(item.labelKey)}
            </NavLink>
          );
        })}
      </nav>

      {/* Add Medication Button */}
      <div className="px-4 pb-4">
        <NavLink
          to="/medications/new"
          className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-5 h-5" strokeWidth={2.5} />
          {t("nav.addMedication")}
        </NavLink>
      </div>

      {/* User Info */}
      <div className="px-4 py-4 border-t border-border">
        <div className="flex items-center gap-3 px-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-secondary text-secondary-foreground font-semibold text-sm">
            {user?.email?.[0]?.toUpperCase() || t("common.unknown")}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user?.email || t("common.user")}</p>
            <p className="text-xs text-muted-foreground truncate">{t("common.activeAccount")}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}