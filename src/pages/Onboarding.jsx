import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/i18n";
import { Pill, Bell, Users, ScanLine, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const screens = [
  { icon: Pill, titleKey: "onboarding.screen1Title", descKey: "onboarding.screen1Desc", color: "bg-accent" },
  { icon: Bell, titleKey: "onboarding.screen2Title", descKey: "onboarding.screen2Desc", color: "bg-primary" },
  { icon: Users, titleKey: "onboarding.screen3Title", descKey: "onboarding.screen3Desc", color: "bg-accent" },
  { icon: ScanLine, titleKey: "onboarding.screen4Title", descKey: "onboarding.screen4Desc", color: "bg-primary" },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const t = useTranslation();
  const [current, setCurrent] = useState(0);

  const next = () => {
    if (current < screens.length - 1) setCurrent((c) => c + 1);
    else finish();
  };

  const prev = () => setCurrent((c) => Math.max(c - 1, 0));

  const finish = () => {
    localStorage.setItem("onboarding_completed", "true");
    navigate("/");
  };

  const skip = () => {
    localStorage.setItem("onboarding_completed", "true");
    navigate("/");
  };

  const screen = screens[current];
  const Icon = screen.icon;
  const isLast = current === screens.length - 1;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Skip button */}
      <div className="flex justify-end p-4">
        <button onClick={skip} className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5">
          {t("onboarding.skip")}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 max-w-md mx-auto w-full">
        <div className={cn("flex items-center justify-center w-24 h-24 rounded-3xl mb-8", screen.color, "text-white")}>
          <Icon className="w-12 h-12" strokeWidth={1.5} />
        </div>
        <h1 className="font-heading font-extrabold text-2xl text-center text-foreground mb-3 leading-tight">
          {t(screen.titleKey)}
        </h1>
        <p className="text-base text-muted-foreground text-center leading-relaxed mb-12">
          {t(screen.descKey)}
        </p>
      </div>

      {/* Dots */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {screens.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={cn(
              "h-2 rounded-full transition-all",
              i === current ? "w-8 bg-accent" : "w-2 bg-border"
            )}
            aria-label={`screen ${i + 1}`}
          />
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3 px-8 pb-10 max-w-md mx-auto w-full">
        {current > 0 && (
          <button
            onClick={prev}
            className="flex items-center justify-center w-12 h-12 rounded-xl border-2 border-border text-muted-foreground hover:bg-muted transition-colors touch-target"
            aria-label={t("common.previous")}
          >
            <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
          </button>
        )}
        <button
          onClick={next}
          className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent/90 transition-colors touch-target"
        >
          {isLast ? t("onboarding.getStarted") : t("common.next")}
          {!isLast && <ChevronRight className="w-4 h-4 rtl:rotate-180" />}
        </button>
      </div>
    </div>
  );
}