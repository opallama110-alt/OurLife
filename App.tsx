import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Onboarding } from './components/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { GymTracker } from './pages/GymTracker';
import { HabitTracker } from './pages/HabitTracker';
import { Login } from './components/Login';
import { Settings } from './components/Settings';
import { AdminDashboard } from './components/AdminDashboard';
import { CalculatorSuite } from './pages/CalculatorSuite';
import { VerifyEmailGate } from './components/VerifyEmailGate';
import { TokenUsedModal } from './components/TokenUsedModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AchievementProvider, useAchievements } from './context/AchievementContext';
import { storageService } from './services/storageService';
import { migrationService } from './services/migrationService';
import { streakProtectionService, StreakProtectionResult } from './services/streakProtectionService';
import { achievementService } from './services/achievementService';

const OWNER_EMAILS = ['opallama110@gmail.com', 'opallama11@gmail.com'];

// Admin route guard — non-admins land on /settings instead of seeing AdminDashboard
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const profileRole = storageService.getUserProfile()?.role;
  const isAdmin = profileRole === 'admin' || OWNER_EMAILS.includes(user?.email || '');
  if (!isAdmin) return <Navigate to="/settings" replace />;
  return <>{children}</>;
};

// --- Protected Route Wrapper ---
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, hasProfile } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If user exists but hasn't completed onboarding/profile init natively on RTDB, force them there
  if (!hasProfile) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { user, hasProfile, emailVerified } = useAuth();
  const [tokenResult, setTokenResult] = useState<StreakProtectionResult | null>(null);
  const { addUnlocks } = useAchievements();

  useEffect(() => {
    if (user && hasProfile) {
      storageService.syncUser(user);
      // Streak Protection check runs once on auth-ready boot. Idempotent —
      // self-rate-limited via lastTokenUsed inside the service.
      const result = streakProtectionService.checkAndProtectStreak();
      if (result?.tokenUsed) setTokenResult(result);

      // Achievement boot check — picks up retroactively-met achievements on
      // first run (Option A path) and any milestones the streak-protection
      // step just crossed. checkAndGrant batches into one profile save.
      const unlocks = achievementService.checkAndGrant();
      if (unlocks.length > 0) addUnlocks(unlocks);
    }
    // addUnlocks is stable via useCallback in the provider; safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, hasProfile]);

  // Hard gate — any signed-in user with an unverified email is held at VerifyEmailGate
  // until they confirm. Google sign-ins are auto-verified so they sail through.
  if (user && !emailVerified) {
    return <VerifyEmailGate />;
  }

  return (
    <Router>
      <TokenUsedModal
        open={!!tokenResult}
        onClose={() => setTokenResult(null)}
        protectedDate={tokenResult?.protectedDate}
        tokensRemaining={tokenResult?.tokensRemaining ?? 0}
        streakSaved={tokenResult?.streakSaved}
      />
      <Routes>
        {/* Unprotected Auth Route */}
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

        {/* Semi-Protected Onboarding Route */}
        <Route path="/onboarding" element={
            (!user) ? <Navigate to="/login" replace /> :
            (hasProfile) ? <Navigate to="/" replace /> : <Onboarding onComplete={() => window.location.href = '/'} />
        } />

        {/* Protected Application Shell utilizing pure React Router matching to prevent Component Stacking */}
        <Route path="/*" element={
            <ProtectedRoute>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/gym" element={<GymTracker />} />
                  <Route path="/habits" element={<HabitTracker />} />
                  {/* /profile remains a Settings tab; /tools and /admin moved out of Settings */}
                  <Route path="/profile" element={<Navigate to="/settings?tab=profile" replace />} />
                  <Route path="/tools" element={<CalculatorSuite />} />
                  <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
};

const App: React.FC = () => {
  // One-shot legacy data migration (idempotent — safe on every boot).
  useEffect(() => {
    migrationService.migrateAgeToDateOfBirth();
  }, []);

  return (
    <AuthProvider>
      <AchievementProvider>
        <AppRoutes />
      </AchievementProvider>
    </AuthProvider>
  );
};

export default App;
