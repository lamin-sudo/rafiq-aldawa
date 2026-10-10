import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/AppLayout';
import { I18nProvider, useTranslation } from '@/i18n';
import { ThemeProvider } from '@/lib/ThemeContext';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';

// Auth pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

// App pages
import Home from '@/pages/Home';
import Medications from '@/pages/Medications';
import AddMedication from '@/pages/AddMedication';
import MedicationDetail from '@/pages/MedicationDetail';
import History from '@/pages/History';
import Family from '@/pages/Family';
import Profile from '@/pages/Profile';
import Settings from '@/pages/Settings';
import Onboarding from '@/pages/Onboarding';
import ScanPrescription from '@/pages/ScanPrescription';
import ScanMedicine from '@/pages/ScanMedicine';
import Emergency from '@/pages/Emergency';
import VitalSigns from '@/pages/VitalSigns';
import ActivityFeed from '@/pages/ActivityFeed';
import Chatbot from '@/pages/Chatbot';
import PillIdentifier from '@/pages/PillIdentifier';
import NotificationHistory from '@/pages/NotificationHistory';
import AboutDeveloper from '@/pages/AboutDeveloper';
import SuggestFeature from '@/pages/SuggestFeature';
import ShareApp from '@/pages/ShareApp';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const t = useTranslation();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-secondary border-t-accent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      {/* Auth routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/medications" element={<Medications />} />
          <Route path="/medications/new" element={<AddMedication />} />
          <Route path="/medications/:id" element={<MedicationDetail />} />
          <Route path="/history" element={<History />} />
          <Route path="/family" element={<Family />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/notification-history" element={<NotificationHistory />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/scan/prescription" element={<ScanPrescription />} />
          <Route path="/scan/medicine" element={<ScanMedicine />} />
          <Route path="/emergency" element={<Emergency />} />
          <Route path="/vitals" element={<VitalSigns />} />
          <Route path="/activity" element={<ActivityFeed />} />
          <Route path="/chatbot" element={<Chatbot />} />
          <Route path="/scan/pill" element={<PillIdentifier />} />
          <Route path="/about-developer" element={<AboutDeveloper />} />
          <Route path="/suggest-feature" element={<SuggestFeature />} />
          <Route path="/share-app" element={<ShareApp />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <I18nProvider>
        <ThemeProvider>
          <Router>
            <ScrollToTop />
            <AuthenticatedApp />
          </Router>
          {/* Both consume the i18n context (PWAInstallPrompt renders t()), so they
              must sit INSIDE I18nProvider — outside it they throw
              "useI18n must be used within I18nProvider" and blank the whole app. */}
          <PWAInstallPrompt />
          <Toaster />
        </ThemeProvider>
        </I18nProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App