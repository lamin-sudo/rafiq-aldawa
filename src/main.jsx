import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Register service worker for offline caching (web/PWA only — skipped inside Capacitor,
// where the app is served from the native bundle).
const isNative = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

if ('serviceWorker' in navigator && !isNative) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => console.log('[SW] Registered', reg.scope))
      .catch((err) => console.warn('[SW] Registration failed', err));
  });
}

// Initialize sync manager (syncs offline data when back online)
// Defer until after auth is ready to avoid syncing before user is authenticated
let syncInitialized = false;
const initSync = () => {
  if (syncInitialized || !navigator.onLine) return;
  syncInitialized = true;
  import('./lib/syncManager')
    .then(({ initSyncManager }) => {
      initSyncManager();
    })
    .catch(console.warn);
};

window.addEventListener('online', initSync);
// Also try after a short delay in case network already up
setTimeout(initSync, 2000);

// --- Native (Capacitor/Android) bootstrap -----------------------------------
// OAuth deep-link listener, splash hide, status bar + hardware back button.
if (isNative) {
  import('./lib/nativeAuth')
    .then(({ initNativeAuth }) => initNativeAuth())
    .catch(console.warn);

  import('@capacitor/splash-screen')
    .then(({ SplashScreen }) => SplashScreen.hide().catch(() => {}))
    .catch(console.warn);

  import('@capacitor/status-bar')
    .then(({ StatusBar, Style }) =>
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
    )
    .catch(console.warn);

  import('@capacitor/app')
    .then(({ App: CapApp }) =>
      CapApp.addListener('backButton', ({ canGoBack }) => {
        // Let the router handle in-app history; only exit at the root.
        if (canGoBack) {
          window.history.back();
        } else {
          CapApp.exitApp();
        }
      })
    )
    .catch(console.warn);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
