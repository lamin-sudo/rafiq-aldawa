import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import TopBar from "./TopBar";
import AppDrawer from "./AppDrawer";
import DoseReminders from "./DoseReminders";
import AppLockScreen from "./security/AppLockScreen";
import { useAuth } from "@/lib/AuthContext";
import { isSessionUnlocked, clearSessionUnlocked } from "@/lib/appLock";

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [locked, setLocked] = useState(false);

  const lockEnabled = !!user?.app_lock_enabled && !!user?.app_lock_pin_hash;

  // Lock on app open (once per browser session)
  useEffect(() => {
    if (!lockEnabled) {
      setLocked(false);
      return;
    }
    setLocked(!isSessionUnlocked());
  }, [lockEnabled, user?.id]);

  // Auto-lock after the configured idle timeout (0 = never)
  useEffect(() => {
    if (!lockEnabled || locked) return;
    const minutes = Number(user?.app_lock_timeout_minutes ?? 5);
    if (!minutes || minutes <= 0) return;

    let last = Date.now();
    const bump = () => {
      last = Date.now();
    };
    const events = ["click", "keydown", "touchstart", "mousemove"];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));

    const interval = setInterval(() => {
      if (Date.now() - last > minutes * 60000) {
        clearSessionUnlocked();
        setLocked(true);
      }
    }, 15000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(interval);
    };
  }, [lockEnabled, locked, user?.app_lock_timeout_minutes]);

  if (lockEnabled && locked) {
    return <AppLockScreen user={user} onUnlock={() => setLocked(false)} onForgot={() => logout(true)} />;
  }

  return (
    <div className="h-screen overflow-hidden bg-background flex">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <TopBar onMenuClick={() => setDrawerOpen(true)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
          <Outlet />
        </main>
        {/* P2-B: the floating add button belongs to Home only — on every other
            route it sat on top of the form/list and invited accidental taps. */}
        <BottomNav showFab={location.pathname === "/"} />
      </div>

      {/* Drawer */}
      <AppDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* In-app dose reminders (web — while the app is open) */}
      <DoseReminders />
    </div>
  );
}