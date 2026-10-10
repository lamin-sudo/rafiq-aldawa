import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { PillBottle, Loader2, AlertCircle } from "lucide-react";
import GoogleIcon from "@/components/GoogleIcon";
import { useTranslation } from "@/i18n";
import { safeReturnTo } from "@/lib/authReturnTo";
import { isNative, loginWithGoogleNative, AUTH_ERROR_EVENT } from "@/lib/nativeAuth";

export default function Login() {
  const t = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, isLoadingAuth, authChecked } = useAuth();
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState("");
  const returnTo = safeReturnTo();

  // A valid session must never leave the user parked on the login screen: the
  // OAuth callback can land here if the deep link arrived while /login was the
  // active route.
  useEffect(() => {
    if (authChecked && !isLoadingAuth && isAuthenticated) {
      navigate(returnTo || "/", { replace: true });
    }
  }, [authChecked, isLoadingAuth, isAuthenticated, navigate, returnTo]);

  // Surface OAuth redirect errors carried in the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errParam = params.get("error") || params.get("error_description");
    if (errParam) setError(t("login.googleFailed"));
  }, [t]);

  // The deep link is handled outside React (nativeAuth), so a failed exchange
  // would otherwise be invisible. Report it here and un-stick the button.
  useEffect(() => {
    const onAuthError = (e) => {
      setError(t("login.googleFailed"));
      setRedirecting(false);
      if (e?.detail?.message) console.warn("[login] auth error:", e.detail);
    };
    window.addEventListener(AUTH_ERROR_EVENT, onAuthError);
    return () => window.removeEventListener(AUTH_ERROR_EVENT, onAuthError);
  }, [t]);

  // Safety net: if the browser round-trip never comes back, un-stick the button
  // instead of leaving a spinner forever.
  useEffect(() => {
    if (!redirecting) return;
    const id = setTimeout(() => setRedirecting(false), 25000);
    return () => clearTimeout(id);
  }, [redirecting]);

  const handleGoogle = async () => {
    setError("");
    setRedirecting(true);
    try {
      if (isNative()) {
        // WebView origins (https://localhost) are unreachable by the system
        // browser, so the OAuth round-trip returns via a custom-scheme deep link.
        await loginWithGoogleNative(returnTo);
      } else {
        await api.auth.loginWithProvider("google", returnTo);
      }
    } catch (err) {
      console.error("[login] Google sign-in failed:", err);
      setError(t("login.googleFailed"));
      setRedirecting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="flex items-center justify-center w-16 h-16 rounded-3xl bg-accent text-accent-foreground mb-4 shadow-lg shadow-accent/30">
            <PillBottle className="w-8 h-8" strokeWidth={2.5} />
          </div>
          <h1 className="font-heading font-extrabold text-2xl text-foreground text-center">
            {t("login.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-2 text-center">{t("login.subtitle")}</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-alert/10 text-alert text-sm flex items-start gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Google Sign-In Button */}
        <button
          onClick={handleGoogle}
          disabled={redirecting}
          className="flex items-center justify-center gap-3 w-full h-14 rounded-2xl bg-card border-2 border-border hover:border-accent/40 hover:bg-secondary/50 transition-all font-semibold text-sm text-foreground disabled:opacity-60 touch-target"
        >
          {redirecting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">{t("login.redirecting")}</span>
            </>
          ) : (
            <>
              <GoogleIcon className="w-5 h-5" />
              {t("login.googleButton")}
            </>
          )}
        </button>

        {/* Note */}
        <p className="text-xs text-muted-foreground text-center mt-6 leading-relaxed">
          {t("login.googleNote")}
        </p>
      </div>
    </div>
  );
}
