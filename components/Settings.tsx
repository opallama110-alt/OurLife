import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  User as UserIcon, Dumbbell, LogOut, Trash2, Save, Home, Building2,
  Loader2, Check, AlertTriangle, UserCircle, Calculator, Shield, Cog, Upload, ImagePlus,
} from 'lucide-react';
import { db, storage } from '../firebase-config';
import { useAuth } from '../context/AuthContext';
import { storageService } from '../services/storageService';
import { Profile } from '../pages/Profile';
import { CalculatorSuite } from '../pages/CalculatorSuite';
import { AdminDashboard } from './AdminDashboard';

type Environment = 'Home' | 'Gym';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type TabKey = 'account' | 'profile' | 'tools' | 'admin';

const EQUIPMENT_OPTIONS = [
  'Barbell', 'Dumbbell', 'Cable', 'Machine',
  'Kettlebell', 'Bands', 'Smith Machine', 'Bodyweight',
];

const OWNER_EMAILS = ['opallama110@gmail.com', 'opallama11@gmail.com'];

export const Settings: React.FC = () => {
  const { user, logout, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const isAdmin = useMemo(() => {
    return storageService.getUserProfile().role === 'admin' || OWNER_EMAILS.includes(user?.email || '');
  }, [user]);

  const tabParam = searchParams.get('tab') as TabKey | null;
  const activeTab: TabKey =
    tabParam && ['account', 'profile', 'tools', 'admin'].includes(tabParam)
      ? (tabParam as TabKey)
      : 'account';

  const setActiveTab = (tab: TabKey) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'account') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  // Guard: if non-admin lands on admin tab via URL, bounce to account
  useEffect(() => {
    if (activeTab === 'admin' && !isAdmin) setActiveTab('account');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isAdmin]);

  const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; show: boolean }[] = [
    { key: 'account', label: 'Account', icon: Cog, show: true },
    { key: 'profile', label: 'Profile', icon: UserCircle, show: true },
    { key: 'tools', label: 'Tools', icon: Calculator, show: true },
    { key: 'admin', label: 'Admin', icon: Shield, show: isAdmin },
  ];

  return (
    <div className="space-y-6 pb-24 animate-slide-up">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-xs text-slate-500 font-mono mt-1">Account, Profile, Tools{isAdmin ? ', and Admin' : ''} — all in one place.</p>
      </div>

      {/* Tab Bar */}
      <div className="jarvis-card p-1.5 rounded-2xl border border-slate-800 flex gap-1 overflow-x-auto no-scrollbar">
        {TABS.filter(t => t.show).map(tab => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 min-w-[90px] flex items-center justify-center space-x-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${active
                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.15)] border border-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
                }`}
            >
              <tab.icon size={14} className="shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'account' && <AccountTab />}
        {activeTab === 'profile' && (
          <div className="animate-fade-in">
            <Profile />
          </div>
        )}
        {activeTab === 'tools' && (
          <div className="animate-fade-in">
            <CalculatorSuite />
          </div>
        )}
        {activeTab === 'admin' && isAdmin && (
          <div className="animate-fade-in">
            <AdminDashboard />
          </div>
        )}
      </div>
    </div>
  );

  // ════════════════════ ACCOUNT TAB (inner component so it shares nav/auth) ════════════════════
  function AccountTab() {
    // ── Profile section state ──
    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
    const [profileSave, setProfileSave] = useState<SaveState>('idle');
    const [profileError, setProfileError] = useState<string | null>(null);

    // ── Project Chimera Phase 4: Avatar file upload to Firebase Storage ──
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAvatarFile = async (file: File) => {
      if (!user) return;
      setProfileError(null);

      // Sanity checks — Firebase Storage charges by bytes; cap at ~5 MB and
      // reject non-images so the bucket never holds e.g. PDFs.
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

        // Mirror to Auth, Firestore, and the local userState so all surfaces
        // (Layout sidebar, Compare cards, Hunter Card) see the new avatar.
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

    // ── Workout Preferences state ──
    const [environment, setEnvironment] = useState<Environment>('Gym');
    const [equipment, setEquipment] = useState<string[]>(['Dumbbell', 'Bodyweight']);
    const [prefsSave, setPrefsSave] = useState<SaveState>('idle');
    const [prefsLoading, setPrefsLoading] = useState(true);

    // ── Account section state ──
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

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
    }, []);

    const saveProfile = async () => {
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
        console.error('[Settings] save profile:', e);
        setProfileError(e?.message || 'Failed to update profile.');
        setProfileSave('error');
      }
    };

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

    const SaveBadge: React.FC<{ state: SaveState }> = ({ state }) => {
      if (state === 'saving') return <span className="flex items-center text-xs text-cyan-400"><Loader2 size={12} className="animate-spin mr-1" />Saving…</span>;
      if (state === 'saved') return <span className="flex items-center text-xs text-emerald-400"><Check size={12} className="mr-1" />Saved</span>;
      if (state === 'error') return <span className="flex items-center text-xs text-rose-400"><AlertTriangle size={12} className="mr-1" />Failed</span>;
      return null;
    };

    return (
      <div className="space-y-6 max-w-2xl mx-auto animate-fade-in">
        {/* ═══════════ PROFILE ═══════════ */}
        <section className="jarvis-card p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white flex items-center">
              <UserIcon size={16} className="mr-2 text-cyan-400" />Account
            </h2>
            <SaveBadge state={profileSave} />
          </div>

          {/* Avatar block — file upload to Firebase Storage */}
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
                  // Reset so re-selecting the same file still triggers onChange.
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
              onClick={saveProfile}
              disabled={profileSave === 'saving'}
              className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl text-white font-bold shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 disabled:opacity-60"
            >
              <Save size={14} /><span className="text-sm">Save Account</span>
            </button>
          </div>
        </section>

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
                    { key: 'Home' as Environment, icon: Home, label: 'Home' },
                    { key: 'Gym' as Environment, icon: Building2, label: 'Gym' },
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

        {/* ═══════════ DANGER ZONE ═══════════ */}
        <section className="jarvis-card p-5 rounded-2xl border border-slate-800 space-y-3">
          <h2 className="text-sm font-bold text-white">Session</h2>

          <button
            onClick={handleLogout}
            className="w-full py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 hover:bg-slate-700 transition-all flex items-center justify-center space-x-2"
          >
            <LogOut size={16} /><span className="text-sm font-bold">Log Out</span>
          </button>

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
      </div>
    );
  }
};

export default Settings;
