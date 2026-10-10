import { useEffect, useState } from "react";
import { useTranslation } from "@/i18n";
import { verifyPin, registerFailure, resetFailures, setSessionUnlocked, lockRemainingMs } from "@/lib/appLock";
import { Lock, Delete, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export default function AppLockScreen({ user, onUnlock, onForgot }) {
  const t = useTranslation();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [remainingMs, setRemainingMs] = useState(lockRemainingMs());

  useEffect(() => {
    const id = setInterval(() => setRemainingMs(lockRemainingMs()), 500);
    return () => clearInterval(id);
  }, []);

  const lockedOut = remainingMs > 0;

  const submit = async (value) => {
    setBusy(true);
    setError("");
    const ok = await verifyPin(value, user?.app_lock_pin_salt, user?.app_lock_pin_hash);
    setBusy(false);
    if (ok) {
      resetFailures();
      setSessionUnlocked();
      onUnlock();
      return;
    }
    const { failures, waitMs } = registerFailure();
    setPin("");
    setRemainingMs(lockRemainingMs());
    if (waitMs > 0) {
      setError(t("appLock.lockedOutSeconds", { seconds: Math.ceil(waitMs / 1000) }));
    } else {
      const left = failures < 3 ? 3 - failures : 5 - failures;
      setError(t("appLock.wrongPin", { attempts: left }));
    }
  };

  const press = (digit) => {
    if (busy || lockedOut) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 6) submit(next);
  };

  const backspace = () => {
    if (busy || lockedOut) return;
    setPin((p) => p.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center gap-2 mb-6">
        <div className="flex items-center justify-center w-16 h-16 rounded-3xl bg-accent/10 text-accent">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="font-heading font-bold text-lg text-foreground mt-2">{t("appLock.lockedTitle")}</h1>
        <p className="text-xs text-muted-foreground text-center max-w-xs">{t("appLock.lockedDesc")}</p>
      </div>

      {/* PIN dots */}
      <div className="flex items-center gap-3 mb-5" aria-label={t("appLock.pinLabel")}>
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "w-3.5 h-3.5 rounded-full transition-colors",
              i < pin.length ? "bg-accent" : "bg-border"
            )}
          />
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-alert/10 text-alert text-xs mb-4 max-w-xs text-center">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {lockedOut ? (
        <p className="text-sm font-semibold text-alert tabular-nums mb-4">
          {t("appLock.waitSeconds", { seconds: Math.ceil(remainingMs / 1000) })}
        </p>
      ) : null}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
        {KEYS.map((k) => (
          <button
            key={k}
            onClick={() => press(k)}
            disabled={busy || lockedOut}
            className="h-16 rounded-2xl border-2 border-border bg-card text-xl font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-40 touch-target"
          >
            {k}
          </button>
        ))}
        <div />
        <button
          onClick={() => press("0")}
          disabled={busy || lockedOut}
          className="h-16 rounded-2xl border-2 border-border bg-card text-xl font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-40 touch-target"
        >
          0
        </button>
        <button
          onClick={backspace}
          disabled={busy || lockedOut || pin.length === 0}
          className="h-16 rounded-2xl border-2 border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40 touch-target"
          aria-label={t("appLock.backspace")}
        >
          <Delete className="w-5 h-5" />
        </button>
      </div>

      <button
        onClick={() => pin.length >= 4 && submit(pin)}
        disabled={pin.length < 4 || busy || lockedOut}
        className="mt-4 w-full max-w-[280px] py-3 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent/90 transition-colors disabled:opacity-40 touch-target"
      >
        {t("appLock.unlock")}
      </button>

      <button onClick={onForgot} className="mt-6 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
        {t("appLock.forgotPin")}
      </button>
    </div>
  );
}