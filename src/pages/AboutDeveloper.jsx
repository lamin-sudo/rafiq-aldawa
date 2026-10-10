import { Link } from "react-router-dom";
import { ChevronLeft, Mail, Send, Github, Download, Globe } from "lucide-react";
import { useTranslation } from "@/i18n";

export default function AboutDeveloper() {
  const t = useTranslation();

  const CONTACTS = [
    {
      id: "email",
      icon: Mail,
      bgColor: "bg-accent/10 text-accent",
      label: t("settings.email"),
      value: "lamindzru@gmail.com",
      href: "mailto:lamindzru@gmail.com",
    },
    {
      id: "telegram",
      icon: Send,
      bgColor: "bg-sky-500/10 text-sky-500",
      label: t("share.telegram"),
      value: "@storagerta",
      href: "https://t.me/storagerta",
    },
    {
      id: "github",
      icon: Github,
      bgColor: "bg-foreground/10 text-foreground",
      label: "GitHub",
      value: "lamindzru",
      href: "https://github.com/lamindzru",
    },
    {
      id: "website",
      icon: Globe,
      bgColor: "bg-emerald-500/10 text-emerald-500",
      label: t("about.website"),
      value: "rafiq-aldawa.web.app",
      href: "https://rafiq-aldawa.web.app",
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-8 py-6 lg:py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/settings"
          className="flex items-center justify-center w-10 h-10 rounded-xl border-2 border-border text-muted-foreground hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
        </Link>
        <h1 className="font-heading font-extrabold text-2xl lg:text-3xl text-foreground">{t("about.title")}</h1>
      </div>

      {/* Developer Card */}
      <div className="bg-card rounded-2xl border-2 border-border overflow-hidden">
        <div className="flex flex-col items-center px-6 py-10 bg-gradient-to-b from-accent/10 to-transparent">
          {/* Avatar */}
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center mb-5 text-4xl font-extrabold text-accent-foreground shadow-lg shadow-accent/30">
            L
          </div>

          <h2 className="font-heading font-bold text-2xl text-foreground">Lamindzru</h2>

          <p className="text-sm text-accent font-medium mt-1">{t("about.role")}</p>

          <p className="text-sm text-muted-foreground text-center leading-relaxed mt-4 max-w-xs">
            {t("about.bio")}
          </p>
        </div>

        {/* Contact Buttons */}
        <div className="p-5 grid sm:grid-cols-2 gap-3">
          {CONTACTS.map((c) => {
            const Icon = c.icon;
            return (
              <a
                key={c.id}
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 rounded-xl border-2 border-border hover:border-accent/30 hover:bg-accent/5 transition-colors"
              >
                <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${c.bgColor}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 text-start min-w-0">
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="text-sm font-medium text-foreground truncate">{c.value}</p>
                </div>
              </a>
            );
          })}
        </div>

        {/* App CTA */}
        <div className="px-5 pb-5">
          <a
            href="https://github.com/lamindzru/rafiq-aldawa/releases/latest/download/app-release.apk"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-accent text-accent-foreground font-semibold text-base hover:bg-accent/90 transition-colors"
          >
            <Download className="w-5 h-5" strokeWidth={2.5} />
            {t("about.downloadApp")}
          </a>
        </div>
      </div>
    </div>
  );
}