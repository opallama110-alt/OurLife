import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User as UserIcon, MailCheck, ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';
import { notificationService } from '../services/notificationService';

// ═══════════════════════════════════════════════════════════════════════════
// Login — wholesale port to prototype .au-* styling.
// Three modes (login / register / forgot) all share the .au-card shell
// (gradient grid backdrop, corner filigree, ornate cyan-glow card).
// All auth handlers (signInWithEmail, signUpWithEmail, signInWithGoogle,
// sendPasswordReset, friendlyAuthError) are preserved end-to-end.
// ═══════════════════════════════════════════════════════════════════════════

type Mode = 'login' | 'register' | 'forgot';

const friendlyAuthError = (raw: string): string => {
  if (!raw) return 'Authentication failed. Please try again.';
  const code = raw.match(/auth\/[a-z-]+/i)?.[0] || '';
  switch (code) {
    case 'auth/invalid-email': return 'Format email tidak valid.';
    case 'auth/user-not-found': return 'Belum ada akun untuk email tersebut.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Email atau kata sandi salah.';
    case 'auth/email-already-in-use': return 'Email ini sudah terdaftar.';
    case 'auth/weak-password': return 'Kata sandi terlalu lemah — minimum 6 karakter.';
    case 'auth/too-many-requests': return 'Terlalu banyak percobaan. Coba lagi sebentar.';
    case 'auth/network-request-failed': return 'Koneksi gagal. Periksa jaringanmu.';
    default: return raw.replace('Firebase: ', '');
  }
};

const AuthCornerFiligree: React.FC = () => (
  <>
    <svg className="au-corner au-corner-tl" viewBox="0 0 36 36" width="36" height="36">
      <path d="M2 18 V2 H18 M6 18 Q6 14 10 12 M10 18 Q14 14 18 14 M14 4 Q14 8 18 8"
        stroke="rgba(34,211,238,0.4)" strokeWidth="1" fill="none" strokeLinecap="round" />
    </svg>
    <svg className="au-corner au-corner-br" viewBox="0 0 36 36" width="36" height="36">
      <path d="M34 18 V34 H18 M30 18 Q30 22 26 24 M26 18 Q22 22 18 22 M22 32 Q22 28 18 28"
        stroke="rgba(34,211,238,0.4)" strokeWidth="1" fill="none" strokeLinecap="round" />
    </svg>
  </>
);

const AuthLogo: React.FC<{ subtitle: string }> = ({ subtitle }) => (
  <div className="au-logo">
    <div className="au-logo-mark">
      <svg viewBox="0 0 28 28" width="40" height="40" fill="none">
        <path d="M4 18 C 4 12, 10 6, 14 14 C 18 22, 24 16, 24 10"
          stroke="url(#au-grad)" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <path d="M21.5 7 L24 10 L21 12" stroke="url(#au-grad)" strokeWidth="2.6"
          strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <defs>
          <linearGradient id="au-grad" x1="0" y1="0" x2="28" y2="28">
            <stop offset="0%" stopColor="#67E8F9" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
      </svg>
    </div>
    <div className="au-logo-name">OurLife</div>
    <div className="au-logo-tag">{subtitle}</div>
  </div>
);

export const Login: React.FC = () => {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [postRegister, setPostRegister] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setError('');
      setLoading(true);
      await signInWithGoogle();
      await notificationService.requestPermission();
    } catch (err) {
      setError(friendlyAuthError((err as Error)?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Mohon isi emailmu.'); return; }
    if (mode !== 'forgot' && password.length < 6) {
      setError('Kata sandi minimum 6 karakter.');
      return;
    }
    if (mode === 'register') {
      if (password !== confirmPassword) {
        setError('Kata sandi tidak cocok.');
        return;
      }
      if (!agree) {
        setError('Setujui Syarat & Ketentuan terlebih dahulu.');
        return;
      }
    }

    try {
      setLoading(true);
      if (mode === 'login') {
        await signInWithEmail(email, password);
        await notificationService.requestPermission();
      } else if (mode === 'register') {
        await signUpWithEmail(email, password, name);
        setPostRegister(true);
      } else if (mode === 'forgot') {
        await sendPasswordReset(email);
        setResetSent(true);
      }
    } catch (err) {
      setError(friendlyAuthError((err as Error)?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  // ── Post-registration verification screen ──
  if (postRegister) {
    return (
      <div className="au-screen">
        <div className="au-bg-grid" />
        <div className="au-bg-glow" />
        <AuthCornerFiligree />
        <div className="au-card" style={{ textAlign: 'center' }}>
          <div className="au-logo">
            <div className="au-logo-mark" style={{ background: 'rgba(34, 211, 238, 0.12)' }}>
              <MailCheck size={32} color="#67E8F9" />
            </div>
          </div>
          <h1 className="au-title">Cek Inbox Email</h1>
          <p className="au-sub" style={{ marginBottom: 14 }}>
            Link verifikasi sudah dikirim ke{' '}
            <span style={{ color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}>{email}</span>.
            Klik link untuk mengaktifkan akun, lalu masuk.
          </p>
          <p className="au-sub" style={{ color: 'var(--t-mute)', fontSize: 11, marginBottom: 14 }}>
            Tidak terlihat? Cek folder Spam/Promosi.
          </p>
          <button type="button" className="au-cta"
            onClick={() => { setPostRegister(false); setMode('login'); setPassword(''); setConfirmPassword(''); }}>
            <span>Lanjut ke Sign In</span>
            <span className="au-cta-arr">→</span>
          </button>
        </div>
      </div>
    );
  }

  const isRegister = mode === 'register';
  const isForgot = mode === 'forgot';
  const ready = isForgot
    ? email.trim().length > 3
    : isRegister
      ? name.trim().length > 0 && email.includes('@') && password.length >= 6 && password === confirmPassword && agree
      : email.trim().length > 3 && password.length > 0;

  return (
    <div className="au-screen">
      <div className="au-bg-grid" />
      <div className="au-bg-glow" />
      <AuthCornerFiligree />

      <div className="au-card">
        <AuthLogo subtitle="SOLO GROWTH PROTOCOL · v1.0" />
        <div className="au-hero">
          <h1 className="au-title">
            {mode === 'login' ? 'Selamat Datang Kembali' : isRegister ? 'Daftar Sebagai Hunter' : 'Reset Kata Sandi'}
          </h1>
          <p className="au-sub">
            {mode === 'login' && 'Masuk untuk lanjutkan perjalananmu, Hunter.'}
            {isRegister && 'System sedang menunggu Player baru.'}
            {isForgot && 'Kami akan kirim link reset ke emailmu.'}
          </p>
        </div>

        {error && <div className="au-alert au-alert-err">{error}</div>}
        {resetSent && isForgot && (
          <div className="au-alert au-alert-ok">Link reset sudah dikirim. Cek inbox.</div>
        )}

        <form className="au-form" onSubmit={handleEmailSubmit}>
          {isRegister && (
            <label className="au-field">
              <span className="au-field-ico"><UserIcon size={16} /></span>
              <input className="au-input" type="text" placeholder="Nama Panggilan"
                autoComplete="name"
                value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          )}

          <label className="au-field">
            <span className="au-field-ico"><Mail size={16} /></span>
            <input className="au-input" type="email" placeholder="Email"
              autoComplete="email" required
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>

          {!isForgot && (
            <label className="au-field">
              <span className="au-field-ico"><Lock size={16} /></span>
              <input className="au-input"
                type={showPwd ? 'text' : 'password'}
                placeholder="Kata Sandi"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required minLength={6}
                value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="au-field-toggle"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}>
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </label>
          )}

          {isRegister && (
            <label className="au-field">
              <span className="au-field-ico"><Lock size={16} /></span>
              <input className="au-input" type="password" placeholder="Konfirmasi Kata Sandi"
                autoComplete="new-password" required minLength={6}
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </label>
          )}

          {isRegister && password && password !== confirmPassword && (
            <div className="au-err">! KATA SANDI TIDAK COCOK</div>
          )}

          {isRegister && (
            <label className="au-check">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span className="au-check-box">
                {agree && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12 L10 17 L19 8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span>Saya setuju dengan <a>Syarat &amp; Ketentuan</a></span>
            </label>
          )}

          {mode === 'login' && (
            <button type="button" className="au-forgot"
              onClick={() => { setMode('forgot'); setError(''); setResetSent(false); }}>
              Lupa kata sandi?
            </button>
          )}

          <button type="submit"
            className={`au-cta ${ready ? '' : 'is-disabled'}`}
            disabled={!ready || loading}>
            {loading
              ? <Loader2 size={16} className="animate-spin" />
              : <>
                  <span>{isForgot ? 'Kirim Link Reset' : isRegister ? 'Buat Akun' : 'Masuk'}</span>
                  <span className="au-cta-arr">→</span>
                </>}
          </button>
        </form>

        {!isForgot && (
          <>
            <div className="au-divider"><span>atau</span></div>
            <button type="button" className="au-google" onClick={handleGoogleLogin} disabled={loading}>
              {/* Inline Google "G" mark — avoids an external favicon request
                  (blur/blocking) and keeps to the local-assets-first rule. */}
              <svg viewBox="0 0 48 48" width="16" height="16" aria-hidden="true">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
              </svg>
              <span>{loading ? 'Connecting…' : `Lanjut dengan Google`}</span>
            </button>
          </>
        )}

        <div className="au-foot">
          {mode === 'login' && (
            <>Belum punya akun? <button type="button" onClick={() => { setMode('register'); setError(''); }}>Daftar di sini</button></>
          )}
          {isRegister && (
            <>Sudah punya akun? <button type="button" onClick={() => { setMode('login'); setError(''); }}>Masuk</button></>
          )}
          {isForgot && (
            <button type="button"
              onClick={() => { setMode('login'); setError(''); setResetSent(false); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ArrowLeft size={14} /> Kembali ke Sign In
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
