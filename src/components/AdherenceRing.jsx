import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

export default function AdherenceRing({ completed, total, size = 120, strokeWidth = 10, className }) {
  const t = useTranslation();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = total > 0 ? (completed / total) * 100 : 0;
  const offset = circumference - (percentage / 100) * circumference;
  const color = percentage >= 75 ? "hsl(var(--accent))" : percentage >= 50 ? "hsl(var(--warning))" : "hsl(var(--alert))";

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading font-extrabold text-2xl text-foreground leading-none">
          {completed}<span className="text-muted-foreground font-medium text-base">/{total}</span>
        </span>
        <span className="text-[11px] text-muted-foreground mt-1">{t("adherence.todayDose")}</span>
      </div>
    </div>
  );
}
