import { Menu, PillBottle } from "lucide-react";
import { useTranslation } from "@/i18n";

export default function TopBar({ onMenuClick }) {
  const t = useTranslation();

  return (
    <header className="shrink-0 flex items-center gap-3 px-4 h-16 text-white border-b border-border z-30" style={{ background: "var(--gradient-header)" }}>
      <button
        onClick={onMenuClick}
        className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-white/15 transition-colors touch-target"
        aria-label={t("drawer.menu")}
      >
        <Menu className="w-6 h-6 text-white" />
      </button>
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/15 text-white">
          <PillBottle className="w-5 h-5" strokeWidth={2.5} />
        </div>
        <span className="font-heading font-bold text-lg text-white">{t("app.name")}</span>
      </div>
    </header>
  );
}