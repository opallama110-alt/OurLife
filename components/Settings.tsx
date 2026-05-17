import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  User as UserIcon, Dumbbell, LogOut, Trash2, Save, Home, Building2,
  Loader2, Check, AlertTriangle, UserCircle, Settings as SettingsIcon, Target,
  Upload, ImagePlus, Bell, Lock, Mail, KeyRound, Shield, Palette, Languages,
  Type, Download, Database, Info, FileText, HelpCircle, MessageCircle,
  Sparkles, Clock, ChevronRight, Smartphone,
} from 'lucide-react';
import { db, storage } from '../firebase-config';
import { useAuth } from '../context/AuthContext';
import { storageService } from '../services/storageService';
import { Profile } from '../pages/Profile';
import { TokenDisplay } from './TokenDisplay';
import { usePWAInstall } from '../hooks/usePWAInstall';

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS — 3-tab redesign
// Tab 1: My Profile        → Account (avatar/name) + <Profile /> + Security stubs
// Tab 2: Goals & Tracking  → Workout prefs (real) + Habit tracking stubs
// Tab 3: App Settings      → Notifications stubs + Appearance stubs + Data &
//                            Privacy (real delete) + Session (real logout) + About
// Admin moved out of Settings — /admin is now its own gated route in App.tsx.
// Tools/Calculator likewise — /tools renders CalculatorSuite directly.
// ═══════════════════════════════════════════════════════════════════════════

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type TabKey = 'profile' | 'goals' | 'app';

const EQUIPMENT_OPTIONS = [
  'Barbell', 'Dumbbell', 'Cable', 'Machine',
  'Kettlebell', 'Bands', 'Smith Machine', 'Bodyweight',
];

const APP_VERSION = '1.0.0';

const SaveBadge: React.FC<{ state: SaveState }> = ({ state }) => {
  if (state === 'saving') return <span className="flex items-center text-xs text-cyan-400"><Loader2 size={12} className="animate-spin mr-1" />Saving…</span>;
  if (state === 'saved') return <span className="flex items-center text-xs text-emerald-400"><Check size={12} className="mr-1" />Saved</span>;
  if (state === 'error') return <span className="flex items-center text-xs text-rose-400"><AlertTriangle size={12} className="mr-1" />Failed</span>;
  return null;
};

const ComingSoonBadge: React.FC = () => (
  <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[9px] font-mono uppercase tracking-wider text-slate-500">
    Coming soon
  </span>
);

export const Settings: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab') as TabKey | null;
  const activeTab: TabKey =
    tabParam && ['profile', 'goals', 'app'].includes(tabParam)
      ? (tabParam as TabKey)
      : 'profile';

  const setActiveTab = (tab: TabKey) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'profile') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { key: 'profile', label: 'My Profile', icon: UserCircle },
    { key: 'goals', label: 'Goals & Tracking', icon: Target },
    { key: 'app', label: 'App Settings', icon: SettingsIcon },
  ];

  const tabIdx = TABS.findIndex(t => t.key === activeTab);

  return (
    <div className="pb-24">
      <header className="s-header">
        <h1 className="s-title">Settings</h1>
        <p className="s-subtitle">Profile, goals, and app preferences — all in one place.</p>
      </header>

      {/* Tab Bar (prototype settings.css .s-tabs port) */}
      <div className="s-tabs">
        <div className="s-tabs-indicator" style={{ transform: `translateX(${tabIdx * 100}%)` }} />
        {TABS.map(tab => {
          const active = activeTab === tab.key;
          return (
            <button key={tab.key} type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`s-tab ${active ? 'is-on' : ''}`}>
              <tab.icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="s-pane-wrap">
        {activeTab === 'profile' && <MyProfileTab />}
        {activeTab === 'goals' && <GoalsTrackingTab />}
        {activeTab === 'app' && <AppSettingsTab />}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1 — MY PROFILE
// Account (avatar/name) on top, then full <Profile /> (DOB/Identity/Penghargaan/
// Compare), then Account Security stubs. Email/password/2FA are placeholders
// until those flows are wired through Firebase Auth.
// ═══════════════════════════════════════════════════════════════════════════
const MyProfileTab: React.FC = () => {
  const { user } = useAuth();

  // UserState is the canonical in-app source (consumed by Profile, Compare,
  // Dashboard greeting). Firebase Auth's displayName is a write-through
  // replica for cross-app identity, not a read source. Fallback handles the
  // edge case where storage hasn't hydrated yet on a fresh account.
  const [displayName, setDisplayName] = useState(
    storageService.getUserState().name || user?.displayName || ''
  );
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [profileSave, setProfileSave] = useState<SaveState>('idle');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarFile = async (file: File) => {
    if (!user) return;
    setProfileError(null);

    if (!file.type.startsWith('image/')) {
      setProfileError('File must be an image (PNG, JPG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfileError('Image too large — keep it under 5 MB.');
      return;
    }

    setUploading(true);
    setUploadProgress(10);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `avatars/${user.uid}/avatar-${Date.now()}.${ext}`;
      const ref = storageRef(storage, path);
      setUploadProgress(40);
      await uploadBytes(ref, file, { contentType: file.type });
      setUploadProgress(80);
      const url = await getDownloadURL(ref);
      setUploadProgress(95);

      await updateProfile(user, { photoURL: url });
      await setDoc(doc(db, 'users', user.uid), { photoURL: url }, { merge: true });
      setPhotoURL(url);
      setUploadProgress(100);
    } catch (e: any) {
      console.error('[Settings] avatar upload:', e);
      setProfileError(e?.message || 'Failed to upload avatar.');
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1200);
    }
  };

  const saveAccount = async () => {
    if (!user) return;
    setProfileSave('saving');
    setProfileError(null);
    try {
      await updateProfile(user, { displayName, photoURL });
      await setDoc(doc(db, 'users', user.uid), { name: displayName, photoURL }, { merge: true });

      const state = storageService.getUserState();
      storageService.saveUserState({ ...state, name: displayName });

      setProfileSave('saved');
      setTimeout(() => setProfileSave('idle'), 1600);
    } catch (e: any) {
      console.error('[Settings] save account:', e);
      setProfileError(e?.message || 'Failed to update account.');
      setProfileSave('error');
    }
  };

  // Mask the email for the security card display: first 4 chars + *** + domain
  const maskedEmail = useMemo(() => {
    const e = user?.email || '';
    const [local, domain] = e.split('@');
    if (!local || !domain) return e;
    return `${local.slice(0, Math.min(4, local.length))}${'*'.repeat(Math.max(3, local.length - 4))}@${domain}`;
  }, [user?.email]);

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-fade-in">
      {/* ═══════════ ACCOUNT (avatar + display name) ═══════════ */}
      <section className="jarvis-card p-5 rounded-2xl border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white flex items-center">
            <UserIcon size={16} className="mr-2 text-cyan-400" />Account
          </h2>
          <SaveBadge state={profileSave} />
        </div>

        <div className="flex items-center space-x-4 mb-4">
          <div className="relative">
            {photoURL ? (
              <img src={photoURL} alt="Avatar" className="w-20 h-20 rounded-full border-2 border-slate-700 object-cover"
                onError={e => { e.currentTarget.style.display = 'none'; }} />
            ) : (
              <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center">
                <UserIcon size={32} className="text-slate-500" />
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 rounded-full bg-slate-950/70 backdrop-blur-sm flex items-center justify-center">
                <Loader2 size={22} className="text-cyan-400 animate-spin" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleAvatarFile(f);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-500/60 text-sm text-slate-200 hover:text-white transition-all disabled:opacity-60"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : photoURL ? <ImagePlus size={14} /> : <Upload size={14} />}
              <span>{uploading ? `Uploading… ${uploadProgress}%` : photoURL ? 'Change avatar' : 'Upload avatar'}</span>
            </button>
            {uploading && (
              <div className="h-1 bg-slate-800 rounded overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }} />
              </div>
            )}
            <div className="text-[10px] text-slate-500 font-mono truncate">{user?.email}</div>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-[11px] text-slate-400 font-mono uppercase tracking-wider">Display Name</span>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              placeholder="How you appear on leaderboards"
            />
          </label>

          {profileError && <p className="text-xs text-rose-400">{profileError}</p>}

          <button
            onClick={saveAccount}
            disabled={profileSave === 'saving'}
            className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl text-white font-bold shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 disabled:opacity-60"
          >
            <Save size={14} /><span className="text-sm">Save Account</span>
          </button>
        </div>
      </section>

      {/* ═══════════ EMBEDDED PROFILE (HunterCard / Penghargaan / Compare / Identity / DOB) ═══════════ */}
      <Profile />

      {/* ═══════════ ACCOUNT SECURITY (mostly stubs until wired through Firebase Auth) ═══════════ */}
      <section className="jarvis-card p-5 rounded-2xl border border-slate-800 space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center">
          <Shield size={16} className="mr-2 text-cyan-400" />Account Security
        </h2>

        <SecurityRow
          icon={Mail}
          label="Email Address"
          value={maskedEmail}
          actionLabel="Change Email"
          disabled
        />
        <SecurityRow
          icon={KeyRound}
          label="Password"
          value="••••••••••"
          actionLabel="Change Password"
          disabled
        />
        <SecurityRow
          icon={Lock}
          label="Two-Factor Authentication"
          value="Disabled"
          actionLabel="Enable 2FA"
          disabled
        />
      </section>
    </div>
  );
};

const SecurityRow: React.FC<{
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  actionLabel: string;
  disabled?: boolean;
  onClick?: () => void;
}> = ({ icon: Icon, label, value, actionLabel, disabled, onClick }) => (
  <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-800/60 last:border-b-0">
    <div className="flex items-center gap-3 min-w-0">
      <Icon size={14} className="text-slate-500 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-slate-400 font-mono uppercase tracking-wider">{label}</div>
        <div className="text-sm text-white truncate">{value}</div>
      </div>
    </div>
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 text-xs text-cyan-400 hover:text-cyan-300 disabled:text-slate-600 disabled:cursor-not-allowed flex items-center gap-1"
    >
      <span>{actionLabel}</span>
      {disabled && <ComingSoonBadge />}
    </button>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2 — GOALS & TRACKING
// Workout Preferences (real, persisted to Firestore.preferences) + Habit
// Tracking (stubs — Streak Protection lands in Phase 4).
// ═══════════════════════════════════════════════════════════════════════════
const GoalsTrackingTab: React.FC = () => {
  const { user } = useAuth();

  const [environment, setEnvironment] = useState<'Home' | 'Gym'>('Gym');
  const [equipment, setEquipment] = useState<string[]>(['Dumbbell', 'Bodyweight']);
  const [prefsSave, setPrefsSave] = useState<SaveState>('idle');
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [tokens, setTokens] = useState<number>(storageService.getGymProfile().streakFreezeTokens || 0);

  // Live-update token count when granted/used elsewhere.
  useEffect(() => {
    const unsub = storageService.subscribe(() => {
      setTokens(storageService.getGymProfile().streakFreezeTokens || 0);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          if (data.preferences?.environment) setEnvironment(data.preferences.environment);
          if (Array.isArray(data.preferences?.equipment)) setEquipment(data.preferences.equipment);
        }
      } catch (e) {
        console.error('[Settings] load prefs:', e);
      } finally {
        setPrefsLoading(false);
      }
    })();
  }, [user]);

  const savePrefs = async () => {
    if (!user) return;
    setPrefsSave('saving');
    try {
      await setDoc(doc(db, 'users', user.uid), {
        preferences: { environment, equipment },
      }, { merge: true });
      setPrefsSave('saved');
      setTimeout(() => setPrefsSave('idle'), 1600);
    } catch (e) {
      console.error('[Settings] save prefs:', e);
      setPrefsSave('error');
    }
  };

  const toggleEquipment = (item: string) => {
    setEquipment(prev => prev.includes(item) ? prev.filter(e => e !== item) : [...prev, item]);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-fade-in">
      {/* ═══════════ WORKOUT PREFERENCES ═══════════ */}
      <section className="jarvis-card p-5 rounded-2xl border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white flex items-center">
            <Dumbbell size={16} className="mr-2 text-cyan-400" />Workout Preferences
          </h2>
          <SaveBadge state={prefsSave} />
        </div>

        {prefsLoading ? (
          <div className="flex items-center justify-center py-6 text-slate-500 text-xs">
            <Loader2 size={14} className="animate-spin mr-2" />Loading preferences…
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <span className="text-[11px] text-slate-400 font-mono uppercase tracking-wider">Environment</span>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {([
                  { key: 'Home' as const, icon: Home, label: 'Home' },
                  { key: 'Gym' as const, icon: Building2, label: 'Gym' },
                ]).map(opt => {
                  const active = environment === opt.key;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => setEnvironment(opt.key)}
                      className={`flex items-center justify-center space-x-2 py-3 rounded-xl border transition-all ${active
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'}`}
                    >
                      <opt.icon size={16} /><span className="text-sm font-bold">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 font-mono uppercase tracking-wider">Available Equipment</span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                {EQUIPMENT_OPTIONS.map(item => {
                  const active = equipment.includes(item);
                  return (
                    <button
                      key={item}
                      onClick={() => toggleEquipment(item)}
                      className={`py-2 rounded-lg text-xs font-bold border transition-all ${active
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600'}`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={savePrefs}
              disabled={prefsSave === 'saving'}
              className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl text-white font-bold shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 disabled:opacity-60"
            >
              <Save size={14} /><span className="text-sm">Save Preferences</span>
            </button>
          </div>
        )}
      </section>

      {/* ═══════════ STREAK PROTECTION (Phase 4 — real) ═══════════ */}
      <section className="jarvis-card p-5 rounded-2xl border border-slate-800 space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center">
          <Shield size={16} className="mr-2 text-cyan-400" />Streak Protection
        </h2>

        <div className="flex items-center justify-between bg-slate-950/60 border border-slate-800 rounded-xl p-3">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1">
              Freeze Tokens
            </div>
            <div className="text-xs text-slate-400">{tokens}/3 available</div>
          </div>
          <TokenDisplay count={tokens} size="lg" />
        </div>

        <div className="text-xs text-slate-400 space-y-1.5">
          <p><span className="text-cyan-400 font-bold">How to earn:</span> Complete <span className="text-white">ALL</span> daily habits → +1 token (max 1/day, cap 3).</p>
          <p><span className="text-cyan-400 font-bold">How they work:</span> Auto-applied when you miss a day, bridging the gap so your streak survives.</p>
        </div>
      </section>

      {/* ═══════════ HABIT TRACKING (remaining stubs) ═══════════ */}
      <section className="jarvis-card p-5 rounded-2xl border border-slate-800 space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center">
          <Sparkles size={16} className="mr-2 text-cyan-400" />Habit Tracking
        </h2>

        <PrefRow
          icon={Clock}
          label="Daily Check-in Reminder"
          value="09:00 AM"
          disabled
        />
        <PrefRow
          icon={FileText}
          label="Progress Reports"
          value="Weekly digest"
          disabled
        />
      </section>
    </div>
  );
};

const PrefRow: React.FC<{
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  disabled?: boolean;
  onClick?: () => void;
}> = ({ icon: Icon, label, value, disabled, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="w-full flex items-center justify-between gap-3 py-2 border-b border-slate-800/60 last:border-b-0 disabled:cursor-not-allowed text-left"
  >
    <div className="flex items-center gap-3 min-w-0">
      <Icon size={14} className="text-slate-500 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-slate-400 font-mono uppercase tracking-wider flex items-center">
          {label}
          {disabled && <ComingSoonBadge />}
        </div>
        <div className="text-sm text-slate-300 truncate">{value}</div>
      </div>
    </div>
    {!disabled && <ChevronRight size={14} className="text-slate-500 shrink-0" />}
  </button>
);

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3 — APP SETTINGS
// Notifications + Appearance stubs, real Data & Privacy (delete account),
// real Session (logout), and About. Notification toggles are local-only stubs
// until notificationService.subscribeTopic() is wired.
// ═══════════════════════════════════════════════════════════════════════════
const AppSettingsTab: React.FC = () => {
  const { logout, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const { isInstallable, install } = usePWAInstall();

  const [notifs, setNotifs] = useState({
    workouts: true,
    streaks: true,
    achievements: true,
    motivation: false,
    habits: true,
  });

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // navigator.standalone exists on iOS Safari; otherwise display-mode media query
  const isInstalled = typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      'This will permanently delete your account and all associated data. This cannot be undone. Proceed?',
    );
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      navigate('/login', { replace: true });
    } catch (e: any) {
      console.error('[Settings] delete account:', e);
      if (e?.code === 'auth/requires-recent-login') {
        setDeleteError('For security, please sign out and sign back in, then try deleting your account again.');
      } else {
        setDeleteError(e?.message || 'Failed to delete account.');
      }
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-fade-in">
      {/* ═══════════ INSTALL APP (PWA) ═══════════ */}
      {(isInstallable || isInstalled) && (
        <section className="jarvis-card p-5 rounded-2xl border border-slate-800 space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center">
            <Smartphone size={16} className="mr-2 text-cyan-400" />Install App
          </h2>
          <div className="s-pwa-card">
            <div className="s-pwa-card-info">
              <div className="s-pwa-card-title">OurLife Hunter</div>
              <div className="s-pwa-card-sub">
                {isInstalled
                  ? 'Sudah terpasang — buka langsung dari home screen.'
                  : 'Pasang ke home screen untuk akses lebih cepat dan tampilan layar penuh.'}
              </div>
            </div>
            {isInstalled
              ? <span className="s-pwa-card-installed"><Check size={12} /> TERPASANG</span>
              : <button type="button" className="s-cta s-cta-cyan" style={{ width: 'auto', padding: '0 16px' }} onClick={install}>
                  <Smartphone size={14} /> Pasang
                </button>}
          </div>
        </section>
      )}

      {/* ═══════════ NOTIFICATIONS ═══════════ */}
      <section className="jarvis-card p-5 rounded-2xl border border-slate-800 space-y-2">
        <h2 className="text-sm font-bold text-white flex items-center mb-2">
          <Bell size={16} className="mr-2 text-cyan-400" />Notifications
          <ComingSoonBadge />
        </h2>

        <NotifToggle label="Workout Reminders" checked={notifs.workouts}
          onChange={(v) => setNotifs(p => ({ ...p, workouts: v }))} />
        <NotifToggle label="Streak Alerts" checked={notifs.streaks}
          onChange={(v) => setNotifs(p => ({ ...p, streaks: v }))} />
        <NotifToggle label="Achievement Unlocked" checked={notifs.achievements}
          onChange={(v) => setNotifs(p => ({ ...p, achievements: v }))} />
        <NotifToggle label="Daily Motivation Quote" checked={notifs.motivation}
          onChange={(v) => setNotifs(p => ({ ...p, motivation: v }))} />
        <NotifToggle label="Habit Check-in Reminder" checked={notifs.habits}
          onChange={(v) => setNotifs(p => ({ ...p, habits: v }))} />

        <p className="text-[10px] text-slate-600 font-mono pt-2">
          Toggles are local until notificationService FCM topic subscriptions ship.
        </p>
      </section>

      {/* ═══════════ APPEARANCE (stubs) ═══════════ */}
      <section className="jarvis-card p-5 rounded-2xl border border-slate-800 space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center">
          <Palette size={16} className="mr-2 text-cyan-400" />Appearance
        </h2>

        <PrefRow icon={Palette} label="Theme" value="Dark (system locked)" disabled />
        <PrefRow icon={Languages} label="Language" value="Bahasa Indonesia" disabled />
        <PrefRow icon={Type} label="Font Size" value="Medium" disabled />
      </section>

      {/* ═══════════ DATA & PRIVACY ═══════════ */}
      <section className="jarvis-card p-5 rounded-2xl border border-slate-800 space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center">
          <Database size={16} className="mr-2 text-cyan-400" />Data & Privacy
        </h2>

        <PrefRow icon={Download} label="Export My Data" value="JSON / CSV" disabled />
        <PrefRow icon={Database} label="Clear Cache" value="Free up local storage" disabled />

        <div className="pt-2 border-t border-slate-800/60">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-full py-3 bg-red-500/10 border border-red-500/40 rounded-xl text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-60"
          >
            {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            <span className="text-sm font-bold">{deleting ? 'Deleting…' : 'Delete Account'}</span>
          </button>
          {deleteError && <p className="text-[11px] text-rose-400 mt-2">{deleteError}</p>}
          <p className="text-[10px] text-slate-600 mt-2 font-mono">
            Deletes your Firestore profile, RTDB data, and Firebase Auth identity. This cannot be undone.
          </p>
        </div>
      </section>

      {/* ═══════════ SESSION ═══════════ */}
      <section className="jarvis-card p-5 rounded-2xl border border-slate-800 space-y-3">
        <h2 className="text-sm font-bold text-white">Session</h2>
        <button
          onClick={handleLogout}
          className="w-full py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 hover:bg-slate-700 transition-all flex items-center justify-center space-x-2"
        >
          <LogOut size={16} /><span className="text-sm font-bold">Log Out</span>
        </button>
      </section>

      {/* ═══════════ ABOUT ═══════════ */}
      <section className="jarvis-card p-5 rounded-2xl border border-slate-800 space-y-2">
        <h2 className="text-sm font-bold text-white flex items-center">
          <Info size={16} className="mr-2 text-cyan-400" />About
        </h2>
        <div className="text-xs text-slate-400 font-mono">Version: {APP_VERSION}</div>
        <div className="grid grid-cols-2 gap-2 pt-2">
          <AboutLink icon={FileText} label="Privacy Policy" />
          <AboutLink icon={FileText} label="Terms of Service" />
          <AboutLink icon={HelpCircle} label="Help Center" />
          <AboutLink icon={MessageCircle} label="Contact Support" />
        </div>
      </section>
    </div>
  );
};

const NotifToggle: React.FC<{
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className="w-full flex items-center justify-between gap-3 py-2 text-left"
  >
    <span className="text-sm text-slate-300">{label}</span>
    <span className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-cyan-500' : 'bg-slate-700'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </span>
  </button>
);

const AboutLink: React.FC<{
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
}> = ({ icon: Icon, label }) => (
  <button
    type="button"
    disabled
    className="flex items-center gap-2 py-2 px-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 cursor-not-allowed"
  >
    <Icon size={12} />
    <span className="truncate">{label}</span>
  </button>
);

export default Settings;
