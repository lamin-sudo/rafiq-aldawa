import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Bug, Lightbulb, TrendingUp, Check } from "lucide-react";
import emailjs from "@emailjs/browser";
import { api } from "@/api/supabaseClient";
import { toast } from "@/components/ui/use-toast";
import { useTranslation } from "@/i18n";

// EmailJS (user-approved client-safe IDs — SERVICE/TEMPLATE/PUBLIC are public
// identifiers; the private key stays server-side and never reaches the code or
// the APK).
const EMAILJS_SERVICE_ID = "service_46we5hd";
const EMAILJS_TEMPLATE_ID = "template_jd9t94f";
const EMAILJS_PUBLIC_KEY = "MFDfCbhgJpJCwu8KL";

const CATEGORIES = [
  { value: "bug", labelKey: "suggest.categoryBug", icon: Bug },
  { value: "feature", labelKey: "suggest.categoryFeature", icon: Lightbulb },
  { value: "improvement", labelKey: "suggest.categoryImprovement", icon: TrendingUp },
];

export default function SuggestFeature() {
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const t = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!category || !description.trim()) return;

    setSubmitting(true);
    try {
      // Primary: EmailJS — delivers straight to the developer's inbox.
      const emailSent = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          category,
          description: description.trim(),
          from_email: fromEmail.trim(),
          date: new Date().toLocaleDateString("en-CA"), // YYYY-MM-DD, locale-neutral
        },
        EMAILJS_PUBLIC_KEY
      );

      // Backup: persist to Supabase feature_requests so nothing is lost if the
      // email transport is down.
      try {
        await api.entities.FeatureRequest.create({
          category,
          description: description.trim(),
          contact_email: fromEmail.trim() || null,
        });
      } catch (dbErr) {
        // DB is a fallback only — an email that went out is still a success.
        console.error("FeatureRequest fallback write error:", dbErr);
      }

      toast({
        description: emailSent ? t("suggest.successToast") : t("suggest.errorToast"),
        className: "bg-accent text-accent-foreground border-2 border-accent/20",
      });
      setCategory("");
      setDescription("");
      setFromEmail("");
    } catch (err) {
      console.error("Submit feature request error:", err);
      toast({
        description: t("suggest.errorToast"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
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
        <h1 className="font-heading font-extrabold text-2xl lg:text-3xl text-foreground">{t("suggest.title")}</h1>
      </div>

      {/* Info Banner */}
      <div className="p-4 rounded-xl bg-accent/5 border border-accent/20 text-sm text-muted-foreground leading-relaxed">
        {t("suggest.infoBanner")}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-card rounded-2xl border-2 border-border overflow-hidden space-y-5 p-5">
        {/* Category */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-foreground">{t("suggest.category")}</label>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const selected = category === cat.value;
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    selected
                      ? "border-accent bg-accent/5 text-accent"
                      : "border-border text-muted-foreground hover:border-accent/30 hover:bg-muted"
                  }`}
                >
                  <Icon className="w-5 h-5" strokeWidth={selected ? 2.5 : 2} />
                  <span className="text-xs font-medium">{t(cat.labelKey)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Contact email (optional — used by the EmailJS template's from_email) */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-foreground">{t("suggest.email")}</label>
          <input
            type="email"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder={t("suggest.emailPlaceholder")}
            dir="ltr"
            className="w-full px-4 py-3 rounded-xl border-2 border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        {/* Description */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-foreground">{t("suggest.description")}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("suggest.descriptionPlaceholder")}
            rows={5}
            className="w-full px-4 py-3 rounded-xl border-2 border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent resize-none transition-colors"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!category || !description.trim() || submitting}
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              {t("suggest.submitting")}
            </>
          ) : (
            <>
              <Check className="w-4 h-4" strokeWidth={2.5} />
              {t("suggest.submit")}
            </>
          )}
        </button>
      </form>
    </div>
  );
}