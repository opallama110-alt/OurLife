import React, { useEffect, useState } from 'react';
import { MailCheck, RefreshCcw, LogOut, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Holding screen for users who have authenticated but not yet clicked the
// verification link in their inbox. Polls Firebase every few seconds so the
// gate lifts automatically after the user clicks the link.
export const VerifyEmailGate: React.FC = () => {
    const { user, sendVerificationEmail, refreshEmailVerification, logout } = useAuth();
    const [resending, setResending] = useState(false);
    const [resent, setResent] = useState(false);
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Auto-poll every 5s while the user waits.
    useEffect(() => {
        const id = setInterval(() => {
            refreshEmailVerification().catch(() => { /* silent */ });
        }, 5000);
        return () => clearInterval(id);
    }, [refreshEmailVerification]);

    const handleResend = async () => {
        setError(null);
        setResending(true);
        try {
            await sendVerificationEmail();
            setResent(true);
            setTimeout(() => setResent(false), 4000);
        } catch (e: any) {
            setError(e?.message?.replace('Firebase: ', '') || 'Failed to resend verification email.');
        } finally {
            setResending(false);
        }
    };

    const handleCheck = async () => {
        setError(null);
        setChecking(true);
        try {
            const ok = await refreshEmailVerification();
            if (!ok) setError('Email still unverified — click the link in your inbox first.');
        } catch (e: any) {
            setError(e?.message || 'Could not refresh verification status.');
        } finally {
            setChecking(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
            <div className="bg-slate-900 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-cyan-500/30">
                <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                        <MailCheck className="w-8 h-8 text-cyan-400" />
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-white text-center mb-2">Verify Your Email</h1>
                <p className="text-slate-400 text-center text-sm mb-6">
                    We sent a verification link to{' '}
                    <span className="text-cyan-400 font-mono break-all">{user?.email}</span>.
                    Click the link to unlock OurLife.
                </p>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/40 text-red-400 p-3 rounded-lg mb-4 text-sm">
                        {error}
                    </div>
                )}
                {resent && (
                    <div className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 p-3 rounded-lg mb-4 text-sm flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> Verification email resent.
                    </div>
                )}

                <div className="space-y-3">
                    <button
                        onClick={handleCheck}
                        disabled={checking}
                        className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold py-3 rounded-xl hover:shadow-lg hover:shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                        I've verified — continue
                    </button>

                    <button
                        onClick={handleResend}
                        disabled={resending}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Resend verification email
                    </button>

                    <button
                        onClick={logout}
                        className="w-full text-red-400 hover:text-red-300 text-sm py-2 transition-colors flex items-center justify-center gap-1"
                    >
                        <LogOut className="w-4 h-4" /> Sign out
                    </button>
                </div>

                <p className="text-[10px] text-slate-500 text-center mt-6 font-mono">
                    Auto-checking every 5 seconds…
                </p>
            </div>
        </div>
    );
};
