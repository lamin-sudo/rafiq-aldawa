import { useState, useEffect } from 'react';
import { useTranslation } from "@/i18n";

/**
 * PWAInstallPrompt
 * Shows an install banner when the PWA is installable (not already installed).
 * Uses the beforeinstallprompt event to avoid browser's own install UI.
 */
export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const t = useTranslation();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect if already running as installed PWA
    const checkInstalled = () => {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
      }
    };
    checkInstalled();

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isInstalled && !dismissed) {
        setShowBanner(true);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowBanner(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isInstalled, dismissed]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowBanner(false);
  };

  if (!showBanner || isInstalled) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '12px 16px',
        background: '#0B1220',
        color: '#F8FAFC',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        zIndex: 9999,
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.15)',
        direction: 'rtl',
      }}
      role="banner"
    >
      <span style={{ flex: 1 }}>
        {t("pwa.installPrefix")} <strong>{t("app.name")}</strong> {t("pwa.installSuffix")}
      </span>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={handleInstall}
          style={{
            padding: '6px 16px',
            background: '#22C55E',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px',
          }}
        >
          {t("pwa.install")}
        </button>
        <button
          onClick={handleDismiss}
          style={{
            padding: '6px 12px',
            background: 'transparent',
            color: '#94A3B8',
            border: '1px solid #334155',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          {t("common.close")}
        </button>
      </div>
    </div>
  );
}

export default PWAInstallPrompt;