import { cn } from "@/lib/utils";

export default function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-16 px-6", className)}>
      {Icon && (
        <div className="flex items-center justify-center w-20 h-20 rounded-full bg-secondary mb-5">
          <Icon className="w-10 h-10 text-muted-foreground" strokeWidth={1.5} />
        </div>
      )}
      <h3 className="font-heading font-bold text-lg text-foreground mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed mb-6">{description}</p>
      )}
      {action}
    </div>
  );
}