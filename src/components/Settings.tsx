import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  User as UserIcon, Dumbbell, LogOut, Trash2, Save, Home, Building2,
  Loader2, Check, AlertTriangle, UserCircle, Settings as SettingsIcon, Target,
  Upload, ImagePlus, Bell, Lock, Mail, KeyRound, Shield, Palette, Languages,
  Type, Download, Database, Info, FileText, HelpCircle, MessageCircle,
  Sparkles, Clock, Smartphone, Film,
} from 'lucide-react';
import { db, storage } from '../../firebase-config';
import { useAuth } from '../context/AuthContext';
import { storageService } from '../services/storageService';
import { Profile } from '../pages/Profile';
import { ConfirmDialog } from './hud/HudDialog';
import { usePWAInstall } from '../hooks/usePWAInstall';

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS — 3-tab redesign on the ported .s-* design-system kit
// Tab 1: Profil    → Account (avatar/name) + <Profile /> + Security stubs
// Tab 2: Target    → Workout prefs (real) + Streak protection + Habit stubs
// Tab 3: Aplikasi  → Notifications/Appearance stubs + Data & Privacy (real
//                    delete, behind a ConfirmDialog) + intro replay + Session
//                    (real logout) + About
// Admin moved out of Settings — /admin is now its own gated route in App.tsx.
// Tools/Calculator likewise — /tools renders CalculatorSuite directly.
//
// Visited panes stay mounted (hidden) so switching tabs neither re-fetches
// preferences (spinner flash) nor throws away unsaved edits, and the heavy
// embedded <Profile/> doesn't remount on every return.
// ═══════════════════════════════════════════════════════════════════════════

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type TabKey = 'profile' | 'goals' | 'app';
type IconType = React.ComponentType<{ size?: number; className?: string }>;

const EQUIPMENT_OPTIONS = [
  'Barbell', 'Dumbbell', 'Cable', 'Machine',
  'Kettlebell', 'Bands', 'Smith Machine', 'Bodyweight',
];

const APP_VERSION = '1.0.0';
const MAX_FREEZE_TOKENS = 3;

const TABS: { key: TabKey; label: string; icon: IconType }[] = [
  { key: 'profile', label: 'Profil', icon: UserCircle },
  { key: 'goals', label: 'Target', icon: Target },
  { key: 'app', label: 'Aplikasi', icon: SettingsIcon },
];

// Nearest scrolling ancestor (Layout's main column today; window-level
// scrolling as a fallback) so a tab switch can bring the new pane's top
// into view without hard-coding the shell's class names.
const getScrollParent = (el: HTMLElement | null): HTMLElement => {
  let node = el?.parentElement ?? null;
  while (node) {
    const oy = getComputedStyle(node).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return (document.scrollingElement as HTMLElement) || document.documentElement;
};

const SoonTag: React.FC = () => <span className="s-soon">SEGERA</span>;

// Save CTA that carries its own state (spinner → check → idle) so the
// feedback lands where the user tapped, not in an off-screen header badge.
const SaveButton: React.FC<{ state: SaveState; label: string; onClick: () => void }> = ({ state, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={state === 'saving'}
    className={`s-cta s-cta-cyan s-save${state === 'saved' ? ' is-saved' : ''}${state === 'error' ? ' is-error' : ''}`}
    aria-live="polite"
  >
    <span className="s-save-icon" key={state}>
      {state === 'saving' ? <Loader2 size={15} className="animate-spin" />
        : state === 'saved' ? <Check size={15} />
          : state === 'error' ? <AlertTriangle size={15} />
            : <Save size={15} />}
    </span>
    <span>
      {state === 'saving' ? 'Menyimpan…'
        : state === 'saved' ? 'Tersimpan'
          : state === 'error' ? 'Gagal — coba lagi'
            : label}
    </span>
  </button>
);

// Unified section wrapper — design-system .s-section. Header: icon chip +
// title; `titleAfter` (e.g. a SEGERA tag) sits beside the title.
const Section: React.FC<{
  icon?: IconType;
  title: string;
  color?: 'orange' | 'gold' | 'red';
  titleAfter?: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon: Icon, title, color, titleAfter, children }) => (
  <section className="s-section">
    <div className="s-section-head">
      {Icon && (
        <span className={`s-section-icon${color ? ` s-icon-${color}` : ''}`}>
          <Icon size={16} />
        </span>
      )}
      <h2 className="s-section-title">{title}</h2>
      {titleAfter}
    </div>
    <div className="s-section-body">{children}</div>
  </section>
);

export const Settings: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab') as TabKey | null;
  const activeTab: TabKey =
    tabParam && ['profile', 'goals', 'app'].includes(tabParam)
      ? (tabParam as TabKey)
      : 'profile';
  const tabIdx = TABS.findIndex(t => t.key === activeTab);

  // Direction of the last switch (null until the first one, so the initial
  // pane rides the route reveal instead of also sliding in sideways).
  const [dir, setDir] = useState<1 | -1 | null>(null);
  const [visited, setVisited] = useState<Set<TabKey>>(() => new Set([activeTab]));
  const tabsSentinelRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    setVisited(v => (v.has(activeTab) ? v : new Set(v).add(activeTab)));
  }, [activeTab]);

  // Tabs are sticky; after a switch from deep inside a long pane, bring the
  // new pane's top to the tab bar instead of leaving the user wherever the
  // shorter pane clamps the scroll.
  useLayoutEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const sentinel = tabsSentinelRef.current;
    if (!sentinel) return;
    const scroller = getScrollParent(sentinel);
    const isRoot = scroller === document.scrollingElement || scroller === document.documentElement;
    const scrollerTop = isRoot ? 0 : scroller.getBoundingClientRect().top;
    const offset = sentinel.getBoundingClientRect().top - scrollerTop;
    if (offset < 0) scroller.scrollTop += offset;
  }, [activeTab]);

  const setActiveTab = (tab: TabKey) => {
    if (tab === activeTab) return;
    const nextIdx = TABS.findIndex(t => t.key === tab);
    setDir(nextIdx > tabIdx ? 1 : -1);
    const next = new URLSearchParams(searchParams);
    if (tab === 'profile') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="s-screen">
      <header className="s-header">
        <h1 className="s-title">Pengaturan</h1>
        <p className="s-subtitle">Profil, target, dan preferensi aplikasi — semua di satu tempat.</p>
      </header>

      <div ref={tabsSentinelRef} className="s-tabs-sentinel" aria-hidden="true" />
      {/* Tab Bar (prototype settings.css .s-tabs port) — sticky */}
      <div className="s-tabs" role="tablist" aria-label="Bagian pengaturan">
        <div className="s-tabs-indicator" style={{ transform: `translateX(${tabIdx * 100}%)` }} />
        {TABS.map(tab => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`s-tab-${tab.key}`}
              aria-selected={active}
              aria-controls={`s-pane-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`s-tab ${active ? 'is-on' : ''}`}
            >
              <tab.icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="s-pane-wrap">
        {TABS.map(t => (visited.has(t.key) || t.key === activeTab) && (
          <div
            key={t.key}
            id={`s-pane-${t.key}`}
            role="tabpanel"
            aria-labelledby={`s-tab-${t.key}`}
            className="s-pane-slot"
            data-dir={t.key === activeTab && dir !== null ? String(dir) : undefined}
            hidden={t.key !== activeTab}
          >
            {t.key === 'profile' ? <MyProfileTab />
              : t.key === 'goals' ? <GoalsTrackingTab />
                : <AppSettingsTab />}
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1 — PROFIL
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
  // Display-only: a dead avatar URL falls back to the letter badge without
  // clearing photoURL (which saveAccount would then write back to Auth).
  const [photoBroken, setPhotoBroken] = useState(false);
  const [profileSave, setProfileSave] = useState<SaveState>('idle');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setPhotoBroken(false); }, [photoURL]);

  const handleAvatarFile = async (file: File) => {
    if (!user) return;
    setProfileError(null);

    if (!file.type.startsWith('image/')) {
      setProfileError('File harus berupa gambar (PNG, JPG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfileError('Gambar terlalu besar — maksimal 5 MB.');
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
      await storageService.savePublicIdentity(displayName, url);
      setPhotoURL(url);
      setUploadProgress(100);
    } catch (e: any) {
      console.error('[Settings] avatar upload:', e);
      setProfileError(e?.message || 'Gagal mengunggah avatar.');
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
      await storageService.savePublicIdentity(displayName, photoURL);

      const state = storageService.getUserState();
      storageService.saveUserState({ ...state, name: displayName });

      setProfileSave('saved');
      setTimeout(() => setProfileSave('idle'), 1600);
    } catch (e: any) {
      console.error('[Settings] save account:', e);
      setProfileError(e?.message || 'Gagal memperbarui akun.');
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

  const initial = (displayName || user?.email || 'H').trim().charAt(0).toUpperCase();
  const showPhoto = !!photoURL && !photoBroken;

  return (
    <div className="s-pane">
      {/* ═══════════ ACCOUNT (avatar + display name) ═══════════ */}
      <Section icon={UserIcon} title="Akun">
        <div className="s-account-top">
          <div className={`s-avatar-img${uploading ? ' is-busy' : ''}`}>
            {showPhoto ? (
              <img src={photoURL} alt="Avatar" onError={() => setPhotoBroken(true)} />
            ) : (
              <span className="s-avatar-letter">{initial}</span>
            )}
            {uploading && (
              <span className="s-avatar-busy" aria-hidden="true">
                <Loader2 size={20} className="animate-spin" />
              </span>
            )}
          </div>
          <div className="s-account-meta">
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
              className="s-avatar-edit"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : photoURL ? <ImagePlus size={14} /> : <Upload size={14} />}
              <span>{uploading ? `Mengunggah… ${uploadProgress}%` : photoURL ? 'Ganti avatar' : 'Unggah avatar'}</span>
            </button>
            {uploadProgress > 0 && (
              <div className="s-upload-bar" aria-hidden="true">
                <div className="s-upload-fill" style={{ transform: `scaleX(${uploadProgress / 100})` }} />
              </div>
            )}
            <div className="s-account-email">{user?.email}</div>
          </div>
        </div>

        <label className="s-field">
          <span className="hud-label-sm">Nama Tampilan</span>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Nama yang tampil di leaderboard"
            enterKeyHint="done"
            autoComplete="nickname"
          />
        </label>

        {profileError && <p className="s-error" role="alert">{profileError}</p>}

        <SaveButton state={profileSave} label="Simpan Akun" onClick={saveAccount} />
      </Section>

      {/* ═══════════ EMBEDDED PROFILE (HunterCard / Penghargaan / Compare / Identity / DOB) ═══════════ */}
      <Profile achievementsDefaultExpanded={false} />

      {/* ═══════════ ACCOUNT SECURITY (stubs until wired through Firebase Auth) ═══════════ */}
      <Section icon={Shield} title="Keamanan Akun">
        <SecurityRow icon={Mail} label="Email" value={maskedEmail} />
        <SecurityRow icon={KeyRound} label="Kata Sandi" value="••••••••••" />
        <SecurityRow icon={Lock} label="Autentikasi 2 Langkah" value="Nonaktif" />
      </Section>
    </div>
  );
};

const SecurityRow: React.FC<{ icon: IconType; label: string; value: string }> = ({ icon: Icon, label, value }) => (
  <div className="s-account-row">
    <div className="s-row-main">
      <Icon size={14} className="s-row-icon" />
      <div className="s-row-text">
        <div className="s-acc-label">{label}</div>
        <div className="s-acc-val">{value}</div>
      </div>
    </div>
    <SoonTag />
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2 — TARGET
// Workout Preferences (real, persisted to Firestore.preferences) + Streak
// Protection (read-only token count) + Habit Tracking stubs.
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

  const safeTokens = Math.max(0, Math.min(MAX_FREEZE_TOKENS, tokens));

  return (
    <div className="s-pane">
      {/* ═══════════ WORKOUT PREFERENCES ═══════════ */}
      <Section icon={Dumbbell} title="Preferensi Latihan">
        {prefsLoading ? (
          <div className="s-prefs-skeleton" aria-busy="true" aria-label="Memuat preferensi">
            <div className="s-skel s-skel-label" />
            <div className="s-env-grid">
              <div className="s-skel s-skel-env" />
              <div className="s-skel s-skel-env" />
            </div>
            <div className="s-skel s-skel-label" />
            <div className="s-equip-grid">
              {EQUIPMENT_OPTIONS.map(i => <div key={i} className="s-skel s-skel-chip" />)}
            </div>
          </div>
        ) : (
          <div className="s-prefs">
            <span className="hud-label-sm">Lokasi Latihan</span>
            <div className="s-env-grid">
              {([
                { key: 'Home' as const, icon: Home, label: 'Rumah' },
                { key: 'Gym' as const, icon: Building2, label: 'Gym' },
              ]).map(opt => {
                const active = environment === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setEnvironment(opt.key)}
                    className={`s-env ${active ? 'is-on' : ''}`}
                  >
                    <opt.icon size={22} /><span>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            <span className="hud-label-sm s-label-gap">
              Peralatan Tersedia <span className="fz-cyan mono">{equipment.length} dipilih</span>
            </span>
            <div className="s-equip-grid">
              {EQUIPMENT_OPTIONS.map(item => {
                const active = equipment.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleEquipment(item)}
                    className={`s-equip ${active ? 'is-on' : ''}`}
                  >
                    {active && <Check size={13} className="s-equip-check" />}
                    <span>{item}</span>
                  </button>
                );
              })}
            </div>

            <SaveButton state={prefsSave} label="Simpan Preferensi" onClick={savePrefs} />
          </div>
        )}
      </Section>

      {/* ═══════════ STREAK PROTECTION (Phase 4 — real) ═══════════ */}
      <Section icon={Shield} title="Proteksi Streak">
        <div className="s-freeze-card">
          <div>
            <div className="hud-label-sm">Freeze Token</div>
            <div className="s-freeze-val tnum">{safeTokens}/{MAX_FREEZE_TOKENS} tersedia</div>
          </div>
          <div className="s-freeze-slots" role="img" aria-label={`${safeTokens} dari ${MAX_FREEZE_TOKENS} freeze token tersedia`}>
            {Array.from({ length: MAX_FREEZE_TOKENS }).map((_, i) => (
              <span key={i} className={`s-freeze-slot${i < safeTokens ? ' is-filled' : ''}`}>
                <Shield size={16} strokeWidth={i < safeTokens ? 2.2 : 1.6} />
              </span>
            ))}
          </div>
        </div>

        <p className="s-helper">
          <strong className="fz-cyan">Cara dapat:</strong> Selesaikan <strong>SEMUA</strong> habit harian → +1 token (maks 1/hari, kapasitas 3).
        </p>
        <p className="s-helper">
          <strong className="fz-cyan">Cara kerja:</strong> Otomatis aktif saat kamu melewatkan satu hari, jadi streak tetap bertahan.
        </p>
      </Section>

      {/* ═══════════ HABIT TRACKING (remaining stubs) ═══════════ */}
      <Section icon={Sparkles} title="Pelacakan Habit">
        <PrefRow icon={Clock} label="Pengingat Check-in Harian" value="09:00" />
        <PrefRow icon={FileText} label="Laporan Progres" value="Ringkasan mingguan" />
      </Section>
    </div>
  );
};

// Read-only "coming soon" preference row.
const PrefRow: React.FC<{ icon: IconType; label: string; value: string }> = ({ icon: Icon, label, value }) => (
  <div className="s-pref-row">
    <div className="s-row-main">
      <Icon size={14} className="s-row-icon" />
      <div className="s-row-text">
        <div className="s-pref-lbl">{label}</div>
        <div className="s-pref-val">{value}</div>
      </div>
    </div>
    <SoonTag />
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3 — APLIKASI
// Notifications + Appearance stubs, real Data & Privacy (delete account),
// intro replay, real Session (logout), and About. Notification switches are
// shown disabled until notificationService FCM topic subscriptions ship —
// a working-looking switch whose state silently resets would be a lie.
// ═══════════════════════════════════════════════════════════════════════════
const NOTIF_DEFAULTS: { label: string; on: boolean }[] = [
  { label: 'Pengingat Latihan', on: true },
  { label: 'Peringatan Streak', on: true },
  { label: 'Achievement Terbuka', on: true },
  { label: 'Kutipan Motivasi Harian', on: false },
  { label: 'Pengingat Check-in Habit', on: true },
];

const AppSettingsTab: React.FC = () => {
  const { logout, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const { isInstallable, install } = usePWAInstall();

  const [confirmDelete, setConfirmDelete] = useState(false);
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

  // Confirmation now comes from the HUD ConfirmDialog (Tier 0.6) instead of
  // the unstyled English window.confirm; the deletion itself is unchanged.
  const runDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      navigate('/login', { replace: true });
    } catch (e: any) {
      console.error('[Settings] delete account:', e);
      if (e?.code === 'auth/requires-recent-login') {
        setDeleteError('Demi keamanan, keluar lalu masuk lagi, kemudian coba hapus akun sekali lagi.');
      } else {
        setDeleteError(e?.message || 'Gagal menghapus akun.');
      }
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="s-pane">
      {/* ═══════════ INSTALL APP (PWA) ═══════════ */}
      {(isInstallable || isInstalled) && (
        <Section icon={Smartphone} title="Pasang Aplikasi">
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
              : <button type="button" className="s-cta s-cta-cyan s-cta-inline" onClick={install}>
                  <Smartphone size={14} /> Pasang
                </button>}
          </div>
        </Section>
      )}

      {/* ═══════════ NOTIFICATIONS ═══════════ */}
      <Section icon={Bell} title="Notifikasi" titleAfter={<SoonTag />}>
        {NOTIF_DEFAULTS.map(n => (
          <div key={n.label} className="s-toggle-row is-disabled">
            <span>{n.label}</span>
            <span
              role="switch"
              aria-checked={n.on}
              aria-disabled="true"
              aria-label={n.label}
              className={`s-toggle is-disabled${n.on ? ' is-on' : ''}`}
            >
              <span className="s-toggle-knob" />
            </span>
          </div>
        ))}
        <p className="s-helper-foot">Aktif setelah notifikasi push (FCM) rilis.</p>
      </Section>

      {/* ═══════════ APPEARANCE (stubs) ═══════════ */}
      <Section icon={Palette} title="Tampilan">
        <PrefRow icon={Palette} label="Tema" value="Gelap (terkunci)" />
        <PrefRow icon={Languages} label="Bahasa" value="Bahasa Indonesia" />
        <PrefRow icon={Type} label="Ukuran Font" value="Sedang" />
      </Section>

      {/* ═══════════ DATA & PRIVACY ═══════════ */}
      <Section icon={Database} title="Data & Privasi" color="red">
        <PrefRow icon={Download} label="Ekspor Data" value="JSON / CSV" />
        <PrefRow icon={Database} label="Bersihkan Cache" value="Kosongkan penyimpanan lokal" />

        <button
          type="button"
          onClick={() => { setDeleteError(null); setConfirmDelete(true); }}
          disabled={deleting}
          className="s-cta s-cta-danger"
        >
          {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          <span>{deleting ? 'Menghapus…' : 'Hapus Akun'}</span>
        </button>
        {deleteError && <p className="s-error" role="alert">{deleteError}</p>}
        <p className="s-helper-foot">
          Menghapus profil Firestore, data RTDB, dan identitas Firebase Auth. Tidak bisa dibatalkan.
        </p>
      </Section>

      {/* ═══════════ EXPERIENCE ═══════════ */}
      <Section icon={Sparkles} title="Pengalaman">
        <button
          type="button"
          // /intro plays the cinematic outside the onboarding gate (which
          // redirects anyone with a profile) and returns here afterwards.
          onClick={() => navigate('/intro')}
          className="s-cta s-cta-outline s-cta-glow"
        >
          <Film size={15} /><span>Putar Ulang Intro</span>
        </button>
        <p className="s-helper-foot">
          Informasi Sistem · Heart Awakening · Player Welcome
        </p>
      </Section>

      {/* ═══════════ SESSION ═══════════ */}
      <Section icon={LogOut} title="Sesi" color="red">
        <button type="button" onClick={handleLogout} className="s-cta s-cta-outline">
          <LogOut size={16} /><span>Keluar</span>
        </button>
      </Section>

      {/* ═══════════ ABOUT ═══════════ */}
      <Section icon={Info} title="Tentang">
        <div className="s-about-version">Versi: <span className="fz-cyan">{APP_VERSION}</span></div>
        <div className="s-about-grid">
          <AboutLink icon={FileText} label="Kebijakan Privasi" />
          <AboutLink icon={FileText} label="Ketentuan Layanan" />
          <AboutLink icon={HelpCircle} label="Pusat Bantuan" />
          <AboutLink icon={MessageCircle} label="Hubungi Dukungan" />
        </div>
      </Section>

      <ConfirmDialog
        open={confirmDelete}
        title="Hapus akun?"
        message="Semua data profil, latihan, dan habit akan dihapus permanen. Tindakan ini tidak bisa dibatalkan."
        confirmLabel={deleting ? 'Menghapus…' : 'Hapus Permanen'}
        busy={deleting}
        onConfirm={() => { void runDelete(); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
};

const AboutLink: React.FC<{ icon: IconType; label: string }> = ({ icon: Icon, label }) => (
  <button type="button" disabled className="s-about-link" title="Segera hadir">
    <Icon size={13} />
    <span>{label}</span>
  </button>
);

export default Settings;
