import { NavLink, useLocation } from "react-router-dom";
import { Home, Pill, History, Users, User, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";

const navItems = [
  { to: "/", labelKey: "nav.home", icon: Home, end: true },
  { to: "/medications", labelKey: "nav.medications", icon: Pill },
  { to: "/history", labelKey: "nav.history", icon: History },
  { to: "/family", labelKey: "nav.family", icon: Users },
  { to: "/profile", labelKey: "nav.profile", icon: User },
];

export default function BottomNav({ showFab = false }) {
  const location = useLocation();
  const t = useTranslation();

  return (
    <>
      {/* Bottom Navigation - Mobile */}
      <nav className="shrink-0 lg:hidden bg-card/95 backdrop-blur-md border-t border-border">
        <div className="flex items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
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
                className="flex flex-col items-center justify-center gap-1 py-2 px-2 min-w-[56px] min-h-[56px] transition-colors"
              >
                <Icon
                  className={cn(
                    "w-5 h-5 transition-colors",
                    isActive ? "text-accent" : "text-muted-foreground"
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span
                  className={cn(
                    "text-[11px] font-medium transition-colors",
                    isActive ? "text-accent" : "text-muted-foreground"
                  )}
                >
                  {t(item.labelKey)}
                </span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Floating Add Button - Mobile (Home only; gated by AppLayout) */}
      {showFab && (
        <NavLink
          to="/medications/new"
          className="lg:hidden fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center w-14 h-14 rounded-full text-white shadow-lg shadow-indigo-500/40 active:scale-95 transition-transform"
          style={{ background: "var(--gradient-fab)" }}
          aria-label={t("nav.addMedication")}
        >
          <Plus className="w-6 h-6" strokeWidth={2.5} />
        </NavLink>
      )}
    </>
  );
}