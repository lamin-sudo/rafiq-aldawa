import { useState } from "react";
import { api } from "@/api/supabaseClient";
import { useTranslation } from "@/i18n";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateSalt, hashPin, isValidPin, isStrongCryptoAvailable, setSessionUnlocked } from "@/lib/appLock";
import { Lock, Fingerprint, AlertCircle, Check } from "lucide-react";

const TIMEOUTS = [
  { value: 1, labelKey: "appLock.timeout1" },
  { value: 5, labelKey: "appLock.timeout5" },
  { value: 15, labelKey: "appLock.timeout15" },
  { value: 30, labelKey: "appLock.timeout30" },
  { value: 0, labelKey: "appLock.timeoutNever" },
];

export default function AppLockSettings({ user, onChanged }) {
  const t = useTranslation();
  const [setupStep, setSetupStep] = useState(null); // null | "enter" | "confirm"
  const [firstPin, setFirstPin] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const enabled = !!user?.app_lock_enabled;
  const timeout = user?.app_lock_timeout_minutes ?? 5;

  const savePin = async (pin) => {
    setBusy(true);
    setError("");
    try {
      const salt = generateSalt();
      const hash = await hashPin(pin, salt);
      const updated = await api.auth.updateMe({
        app_lock_enabled: true,
        app_lock_pin_hash: hash,
        app_lock_pin_salt: salt,
        app_lock_timeout_minutes: timeout,
      });
      setSessionUnlocked();
      setSetupStep(null);
      setFirstPin("");
      setPinInput("");
      if (onChanged) await onChanged(updated);
    } catch (err) {
      console.error("Enable app lock error:", err);
      setError(t("appLock.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (value) => {
    setError("");
    if (value) {
      if (!isStrongCryptoAvailable()) {
        setError(t("appLock.noCrypto"));
        return;
      }
      setSetupStep("enter");
      setPinInput("");
      setFirstPin("");
      return;
    }
    setBusy(true);
    try {
      const updated = await api.auth.updateMe({
        app_lock_enabled: false,
        app_lock_pin_hash: "",
        app_lock_pin_salt: "",
      });
      if (onChanged) await onChanged(updated);
    } catch (err) {
      console.error("Disable app lock error:", err);
      setError(t("appLock.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const handleTimeout = async (value) => {
    setBusy(true);
    try {
      const updated = await api.auth.updateMe({ app_lock_timeout_minutes: Number(value) });
      if (onChanged) await onChanged(updated);
    } catch (err) {
      console.error("Update timeout error:", err);
    } finally {
      setBusy(false);
    }
  };

  const confirmPin = () => {
    setError("");
    if (!isValidPin(pinInput)) {
      setError(t("appLock.pinRule"));
      return;
    }
    if (setupStep === "enter") {
      setFirstPin(pinInput);
      setPinInput("");
      setSetupStep("confirm");
      return;
    }
    if (pinInput !== firstPin) {
      setError(t("appLock.pinMismatch"));
      setPinInput("");
      return;
    }
    savePin(pinInput);
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent/10 text-accent shrink-0">
          <Lock className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">{t("appLock.enable")}</p>
          <p className="text-xs text-muted-foreground">{t("appLock.enableDesc")}</p>
        </div>
        <Switch checked={enabled} onCheckedChange={handleToggle} disabled={busy} />
      </div>

      {setupStep && (
        <div className="p-3 rounded-xl border-2 border-accent/30 bg-accent/5 space-y-3 animate-fade-in">
          <p className="text-sm font-medium text-foreground">
            {setupStep === "enter" ? t("appLock.createPin") : t("appLock.confirmPin")}
          </p>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="••••"
            className="w-full h-12 px-4 rounded-xl border-2 border-border bg-card text-center text-lg tracking-[0.5em] font-semibold text-foreground outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <button
              onClick={confirmPin}
              disabled={busy || pinInput.length < 4}
              className="flex-1 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {busy ? t("common.loading") : t("appLock.confirmAction")}
            </button>
            <button
              onClick={() => { setSetupStep(null); setPinInput(""); setFirstPin(""); setError(""); }}
              className="px-4 py-2.5 rounded-xl border-2 border-border text-muted-foreground text-sm font-medium hover:bg-muted transition-colors"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="flex items-center gap-2 text-xs text-alert">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </p>
      )}

      {enabled && !setupStep && (
        <>
          <div className="flex items-center gap-3 pt-3 border-t border-border">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{t("appLock.timeout")}</p>
              <p className="text-xs text-muted-foreground">{t("appLock.timeoutDesc")}</p>
            </div>
            <Select value={String(timeout)} onValueChange={handleTimeout} disabled={busy}>
              <SelectTrigger className="h-10 w-[130px] shrink-0" aria-label={t("appLock.timeout")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEOUTS.map((o) => (
                  <SelectItem key={o.value} value={String(o.value)}>{t(o.labelKey)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3 pt-3 border-t border-border">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-secondary text-muted-foreground shrink-0">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground">{t("appLock.biometric")}</p>
              <p className="text-xs text-muted-foreground">{t("appLock.biometricAvailableLater")}</p>
            </div>
            <Switch checked={false} disabled />
          </div>

          <p className="flex items-start gap-2 text-xs text-muted-foreground pt-1">
            <Check className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
            {t("appLock.hashNote")}
          </p>
        </>
      )}
    </div>
  );
}