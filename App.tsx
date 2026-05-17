import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Onboarding } from './components/Onboarding';
import { IntroSequence } from './components/onboarding/IntroSequence';
import { FirstDailyQuest, FirstQuestHabit } from './components/onboarding/FirstDailyQuest';
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

const INTRO_FLAG_KEY = 'ol_intro_done';
const FIRST_QUEST_FLAG_KEY = 'ol_first_quest_offered';

// Onboarding gate: shows the cinematic IntroSequence (Player Invitation →
// Heart Awakening → Welcome) before handing off to the practical Onboarding
// form. Flag `ol_intro_done` lives in localStorage so a refresh during the
// onboarding form doesn't replay the cinematic. Settings → App Settings
// exposes a "Replay Intro" button that clears the flag.
const OnboardingGate: React.FC = () => {
  const [introDone, setIntroDone] = useState(() => {
    try { return localStorage.getItem(INTRO_FLAG_KEY) === '1'; } catch { return false; }
  });

  if (!introDone) {
    return (
      <IntroSequence
        onComplete={() => {
          try { localStorage.setItem(INTRO_FLAG_KEY, '1'); } catch { /* private mode */ }
          setIntroDone(true);
        }}
      />
    );
  }

  return <Onboarding onComplete={() => {
    // Mark intent to offer the First Daily Quest after Dashboard mounts.
    try { localStorage.removeItem(FIRST_QUEST_FLAG_KEY); } catch { /* */ }
    window.location.href = '/';
  }} />;
};

// First-Daily-Quest popup wrapper. Mounts inside the protected app tree and
// fires once when the user lands after onboarding. Habit is appended via
// storageService so it lives alongside any habits the user creates later.
const FirstDailyQuestGate: React.FC = () => {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(FIRST_QUEST_FLAG_KEY) !== '1'; } catch { return false; }
  });
  const dismiss = () => {
    try { localStorage.setItem(FIRST_QUEST_FLAG_KEY, '1'); } catch { /* */ }
    setOpen(false);
  };
  const handleAccept = (quest: FirstQuestHabit) => {
    try {
      const existing = storageService.getHabits();
      // Carry quest sub-tasks (with user-adjusted targets) into the new
      // Habit shape so the user lands on the Habits page with per-task
      // ticking already wired up. completedSubTasks starts empty —
      // the user will tick them as they actually complete each step.
      const habit = {
        id: Date.now().toString(),
        name: quest.title,
        cue: quest.description || undefined,
        streak: 0,
        completedDates: [] as string[],
        subTasks: quest.subTasks.map(st => ({
          id: st.id,
          label: st.label,
          target: st.target,
        })),
        completedSubTasks: {} as Record<string, string[]>,
      };
      storageService.saveHabits([...existing, habit]);
    } catch (e) { console.error('[FirstDailyQuest] save habit:', e); }
  };
  return <FirstDailyQuest open={open} onClose={dismiss} onAccept={handleAccept} />;
};

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

        {/* Semi-Protected Onboarding Route — wraps the cinematic Intro first */}
        <Route path="/onboarding" element={
            (!user) ? <Navigate to="/login" replace /> :
            (hasProfile) ? <Navigate to="/" replace /> : <OnboardingGate />
        } />

        {/* Protected Application Shell utilizing pure React Router matching to prevent Component Stacking */}
        <Route path="/*" element={
            <ProtectedRoute>
              <>
                <FirstDailyQuestGate />
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
              </>
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
