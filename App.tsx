import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Onboarding } from './components/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { GymTracker } from './pages/GymTracker';
import { HabitTracker } from './pages/HabitTracker';
import { Login } from './components/Login';
import { Settings } from './components/Settings';
import { VerifyEmailGate } from './components/VerifyEmailGate';
import { AuthProvider, useAuth } from './context/AuthContext';
import { storageService } from './services/storageService';
import { migrationService } from './services/migrationService';

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

  useEffect(() => {
    if (user && hasProfile) {
      storageService.syncUser(user);
    }
  }, [user, hasProfile]);

  // Hard gate — any signed-in user with an unverified email is held at VerifyEmailGate
  // until they confirm. Google sign-ins are auto-verified so they sail through.
  if (user && !emailVerified) {
    return <VerifyEmailGate />;
  }

  return (
    <Router>
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
                  {/* Profile / Tools / Admin are now Settings tabs — preserve deep links via redirect */}
                  <Route path="/profile" element={<Navigate to="/settings?tab=profile" replace />} />
                  <Route path="/tools" element={<Navigate to="/settings?tab=tools" replace />} />
                  <Route path="/admin" element={<Navigate to="/settings?tab=admin" replace />} />
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
      <AppRoutes />
    </AuthProvider>
  );
};

export default App;
