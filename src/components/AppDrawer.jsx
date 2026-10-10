import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Sun, Moon, Settings, Info, LogOut, PillBottle, Heart, ShieldAlert, UserCircle, Lightbulb, Share2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useTranslation } from "@/i18n";
import { useTheme } from "@/lib/ThemeContext";
import { cn } from "@/lib/utils";

export default function AppDrawer({ open, onClose }) {
  const { user, logout } = useAuth();
  const t = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [showAbout, setShowAbout] = useState(false);

  const handleNavigate = (path) => {
    onClose();
    navigate(path);
  };

  const handleLogout = () => {
    onClose();
    logout();
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/50 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-50 w-80 max-w-[85vw] bg-card shadow-2xl transition-transform duration-300 ease-out flex flex-col",
          open ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
        )}
      >
        {/* User Header */}
        <div
          className="shrink-0 p-5 text-white"
          style={{ background: "var(--gradient-header)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-white/20 text-xl font-bold">
              {user?.email?.[0]?.toUpperCase() || t("common.unknown")}
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-white/15 transition-colors"
              aria-label={t("common.close")}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="font-bold text-base leading-tight">
            {user?.full_name || user?.email?.split("@")[0] || t("common.user")}
          </p>
          <p className="text-sm text-white/80 truncate mt-0.5">{user?.email}</p>
        </div>

        {/* Menu Items */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-1">
          {/* P2-D: the drawer is quick-access to app utility pages — Settings,
              Suggest a feature, Share, and the theme toggle. App navigation
              (Home/Medications/History/Family/Profile) already lives in the
              BottomNav, so duplicating it here just made the drawer noisy. */}
          <DrawerItem
            icon={theme === "dark" ? Sun : Moon}
            label={theme === "dark" ? t("drawer.lightMode") : t("drawer.darkMode")}
            onClick={toggleTheme}
          />
          <DrawerItem
            icon={Settings}
            label={t("settings.title")}
            onClick={() => handleNavigate("/settings")}
          />
          <DrawerItem
            icon={UserCircle}
            label={t("nav.aboutDeveloper")}
            onClick={() => handleNavigate("/about-developer")}
          />
          <DrawerItem
            icon={Lightbulb}
            label={t("nav.suggestFeature")}
            onClick={() => handleNavigate("/suggest-feature")}
          />
          <DrawerItem
            icon={Share2}
            label={t("nav.shareApp")}
            onClick={() => handleNavigate("/share-app")}
          />
          <DrawerItem
            icon={Info}
            label={t("drawer.about")}
            onClick={() => setShowAbout(true)}
          />
        </div>

        {/* Logout */}
        <div className="shrink-0 p-3 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-alert hover:bg-alert/5 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">{t("settings.logout")}</span>
          </button>
        </div>
      </aside>

      {/* About Modal */}
      {showAbout && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowAbout(false)}
        >
          <div
            className="bg-card rounded-2xl border-2 border-border p-6 max-w-sm w-full space-y-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-bold text-lg text-foreground">{t("drawer.about")}</h2>
              <button
                onClick={() => setShowAbout(false)}
                className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-accent text-accent-foreground">
                <PillBottle className="w-6 h-6" strokeWidth={2.5} />
              </div>
              <div>
                <p className="font-heading font-bold text-base text-foreground">{t("app.name")}</p>
                <p className="text-xs text-muted-foreground">{t("settings.version")}</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">{t("settings.aboutDesc")}</p>

            <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary/50 border border-border">
              <ShieldAlert className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">{t("settings.disclaimerText")}</p>
            </div>

            <div className="flex items-center justify-center gap-1.5 pt-2 text-xs text-muted-foreground">
              {t("settings.madeWith")} <Heart className="w-3.5 h-3.5 text-alert fill-alert" /> {t("settings.forFamilies")}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DrawerItem({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-foreground hover:bg-secondary transition-colors"
    >
      <Icon className="w-5 h-5 text-muted-foreground" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}