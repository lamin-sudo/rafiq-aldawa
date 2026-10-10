import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, MessageCircle, Send, Share2, Check, Copy } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useTranslation } from "@/i18n";

// The app's own Firebase Hosting site (landing + download), not a placeholder.
const APP_URL = "https://rafiq-aldawa.web.app";

const SHARE_ITEMS = [
  {
    id: "whatsapp",
    labelKey: "share.whatsapp",
    icon: MessageCircle,
    bgColor: "bg-[#25D366]/10 text-[#25D366]",
    borderColor: "border-[#25D366]/30",
    href: (url, t) => `https://wa.me/?text=${encodeURIComponent(t("share.whatsappText", { url }))}`,
  },
  {
    id: "telegram",
    labelKey: "share.telegram",
    icon: Send,
    bgColor: "bg-[#0088cc]/10 text-[#0088cc]",
    borderColor: "border-[#0088cc]/30",
    href: (url, t) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(t("share.telegramText"))}`,
  },
  {
    id: "facebook",
    labelKey: "share.facebook",
    icon: Share2,
    bgColor: "bg-[#1877F2]/10 text-[#1877F2]",
    borderColor: "border-[#1877F2]/30",
    href: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
];

export default function ShareApp() {
  const [copied, setCopied] = useState(false);
  const t = useTranslation();

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: t("share.nativeTitle"),
          text: t("share.nativeText"),
          url: APP_URL,
        });
      } catch {
        // User cancelled or error
      }
    }
  };

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(APP_URL);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = APP_URL;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      toast({
        description: t("share.copiedToast"),
        className: "bg-accent text-accent-foreground border-2 border-accent/20",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        description: t("share.copyFailed"),
        variant: "destructive",
      });
    }
  };

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
        <h1 className="font-heading font-extrabold text-2xl lg:text-3xl text-foreground">{t("share.title")}</h1>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed -mt-2">
        {t("share.subtitle")}
      </p>

      {/* Native Share Button */}
      {"share" in navigator && (
        <button
          onClick={handleNativeShare}
          className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-base hover:bg-primary/90 transition-colors"
        >
          <Share2 className="w-5 h-5" strokeWidth={2.5} />
          {t("share.shareVia")}
        </button>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">{t("share.orChoosePlatform")}</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Share Buttons Grid */}
      <div className="grid grid-cols-2 gap-3">
        {SHARE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.id}
              href={item.href(APP_URL, t)}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 ${item.borderColor} ${item.bgColor} hover:opacity-90 transition-opacity`}
            >
              <Icon className="w-8 h-8" strokeWidth={2} />
              <span className="text-sm font-semibold">{t(item.labelKey)}</span>
            </a>
          );
        })}
      </div>

      {/* Copy Link Button */}
      <button
        onClick={handleCopyLink}
        className={`flex items-center justify-center gap-3 w-full py-4 rounded-2xl border-2 border-border text-foreground font-semibold text-base hover:bg-muted transition-colors ${
          copied ? "border-accent bg-accent/5 text-accent" : ""
        }`}
      >
        {copied ? (
          <>
            <Check className="w-5 h-5" strokeWidth={2.5} />
            {t("share.copied")}
          </>
        ) : (
          <>
            <Copy className="w-5 h-5" strokeWidth={2} />
            {t("share.copyLink")}
          </>
        )}
      </button>
    </div>
  );
}
