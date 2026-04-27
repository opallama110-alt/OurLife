import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, LogIn, UserPlus, User as UserIcon, MailCheck, ArrowLeft, Loader2 } from 'lucide-react';
import { notificationService } from '../services/notificationService';

type Mode = 'login' | 'register' | 'forgot';

const friendlyAuthError = (raw: string): string => {
    if (!raw) return 'Authentication failed. Please try again.';
    const code = raw.match(/auth\/[a-z-]+/i)?.[0] || '';
    switch (code) {
        case 'auth/invalid-email': return 'That email address looks invalid.';
        case 'auth/user-not-found': return 'No account exists for that email.';
        case 'auth/wrong-password':
        case 'auth/invalid-credential': return 'Incorrect email or password.';
        case 'auth/email-already-in-use': return 'An account with that email already exists.';
        case 'auth/weak-password': return 'Password too weak — use at least 6 characters.';
        case 'auth/too-many-requests': return 'Too many attempts. Please wait a moment and try again.';
        case 'auth/network-request-failed': return 'Network error. Check your connection and retry.';
        default: return raw.replace('Firebase: ', '');
    }
};

export const Login: React.FC = () => {
    const { signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset } = useAuth();
    const [mode, setMode] = useState<Mode>('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
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
        } catch (err: any) {
            setError(friendlyAuthError(err?.message || ''));
        } finally {
            setLoading(false);
        }
    };

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email.trim()) { setError('Please enter your email.'); return; }
        if (mode !== 'forgot' && password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }
        if (mode === 'register' && password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
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
        } catch (err: any) {
            setError(friendlyAuthError(err?.message || ''));
        } finally {
            setLoading(false);
        }
    };

    // ── Post-registration verification screen ──
    if (postRegister) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
                <div className="bg-slate-900 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-cyan-500/30">
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 rounded-full bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                            <MailCheck className="w-8 h-8 text-cyan-400" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-white text-center mb-2">Check Your Inbox</h1>
                    <p className="text-slate-400 text-center text-sm mb-6">
                        We sent a verification link to <span className="text-cyan-400 font-mono">{email}</span>. Click the link to activate your account, then sign in.
                    </p>
                    <p className="text-xs text-slate-500 text-center mb-6">
                        Don't see it? Check your Spam/Promotions folder.
                    </p>
                    <button
                        onClick={() => { setPostRegister(false); setMode('login'); setPassword(''); setConfirmPassword(''); }}
                        className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold py-3 rounded-xl hover:shadow-lg hover:shadow-cyan-500/20 transition-all"
                    >
                        Continue to Sign In
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
            <div className="bg-slate-900 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-800">
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <img src="/ourlife-logo.png" alt="OurLife" className="w-14 h-14 rounded-2xl shadow-lg shadow-cyan-500/20 object-cover" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">
                        {mode === 'login' ? 'Welcome Back' : mode === 'register' ? 'Create Account' : 'Reset Password'}
                    </h1>
                    <p className="text-slate-400 text-sm">
                        {mode === 'login' && 'Sign in to continue your journey'}
                        {mode === 'register' && 'Begin your fitness journey today'}
                        {mode === 'forgot' && "We'll email you a reset link"}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/40 text-red-400 p-3 rounded-lg mb-4 text-sm">
                        {error}
                    </div>
                )}

                {resetSent && mode === 'forgot' && (
                    <div className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 p-3 rounded-lg mb-4 text-sm">
                        Reset link sent. Check your inbox.
                    </div>
                )}

                {mode !== 'forgot' && (
                    <>
                        <button
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="w-full bg-white hover:bg-gray-100 text-gray-900 font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 mb-6 disabled:opacity-60"
                        >
                            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                            {loading ? 'Connecting…' : `${mode === 'login' ? 'Sign in' : 'Sign up'} with Google`}
                        </button>

                        <div className="relative mb-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-700"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-slate-900 text-slate-400">Or continue with email</span>
                            </div>
                        </div>
                    </>
                )}

                <form className="space-y-4" onSubmit={handleEmailSubmit}>
                    {mode === 'register' && (
                        <div className="relative">
                            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Display name"
                                autoComplete="name"
                                className="w-full bg-slate-800/60 border border-slate-700 text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors placeholder-slate-500"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                        <input
                            type="email"
                            placeholder="Email address"
                            autoComplete="email"
                            required
                            className="w-full bg-slate-800/60 border border-slate-700 text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors placeholder-slate-500"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    {mode !== 'forgot' && (
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                            <input
                                type="password"
                                placeholder="Password"
                                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                                required
                                minLength={6}
                                className="w-full bg-slate-800/60 border border-slate-700 text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors placeholder-slate-500"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    )}

                    {mode === 'register' && (
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                            <input
                                type="password"
                                placeholder="Confirm password"
                                autoComplete="new-password"
                                required
                                minLength={6}
                                className="w-full bg-slate-800/60 border border-slate-700 text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors placeholder-slate-500"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : mode === 'register' ? (
                            <><UserPlus className="w-5 h-5" /> Create Account</>
                        ) : mode === 'forgot' ? (
                            <>Send Reset Link</>
                        ) : (
                            <><LogIn className="w-5 h-5" /> Sign in</>
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-slate-400 space-y-2">
                    {mode === 'login' && (
                        <>
                            <p>
                                Don't have an account?{' '}
                                <button onClick={() => { setMode('register'); setError(''); }} className="text-cyan-400 font-semibold hover:text-cyan-300">
                                    Sign up
                                </button>
                            </p>
                            <p>
                                <button onClick={() => { setMode('forgot'); setError(''); setResetSent(false); }} className="text-slate-500 hover:text-slate-300 text-xs">
                                    Forgot password?
                                </button>
                            </p>
                        </>
                    )}
                    {mode === 'register' && (
                        <p>
                            Already have an account?{' '}
                            <button onClick={() => { setMode('login'); setError(''); }} className="text-cyan-400 font-semibold hover:text-cyan-300">
                                Sign in
                            </button>
                        </p>
                    )}
                    {mode === 'forgot' && (
                        <button
                            onClick={() => { setMode('login'); setError(''); setResetSent(false); }}
                            className="inline-flex items-center gap-1 text-cyan-400 font-semibold hover:text-cyan-300"
                        >
                            <ArrowLeft className="w-4 h-4" /> Back to sign in
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
