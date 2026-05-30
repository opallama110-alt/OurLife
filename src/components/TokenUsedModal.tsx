import React from 'react';
import { Shield, X } from 'lucide-react';
import { TokenDisplay } from './TokenDisplay';

interface TokenUsedModalProps {
  open: boolean;
  onClose: () => void;
  protectedDate?: string;
  tokensRemaining: number;
  streakSaved?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// TOKEN USED MODAL — shown once on the app boot where a Streak Freeze Token
// auto-applied to bridge a missed day. Surfaces the save so the protection
// doesn't feel invisible.
// ═══════════════════════════════════════════════════════════════════════════
export const TokenUsedModal: React.FC<TokenUsedModalProps> = ({
  open,
  onClose,
  protectedDate,
  tokensRemaining,
  streakSaved,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-fade-in" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 border border-cyan-500/40 shadow-[0_0_60px_rgba(6,182,212,0.3)] overflow-hidden animate-scale-in"
      >
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/80 transition-colors"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>

        <div className="relative z-10 px-6 pt-7 pb-6 text-center">
          <div className="inline-flex w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.6)] mb-4">
            <Shield size={30} className="text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.9)]" strokeWidth={2.4} />
          </div>

          <h2 className="text-xl font-bold text-white mb-1">Streak Protected</h2>
          <p className="text-xs font-mono text-cyan-400/80 uppercase tracking-widest mb-4">
            Streak Freeze Token used
          </p>

          <p className="text-sm text-slate-300 leading-relaxed mb-5">
            {protectedDate
              ? <>You missed <span className="font-mono text-white">{protectedDate}</span>, but a token bridged the gap.</>
              : 'A missed day was bridged automatically.'}
            {typeof streakSaved === 'number' && streakSaved > 0 && (
              <> Your <span className="text-orange-400 font-bold">{streakSaved}-day</span> streak is intact.</>
            )}
          </p>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 mb-4">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2">Tokens Remaining</p>
            <div className="flex justify-center">
              <TokenDisplay count={tokensRemaining} size="lg" />
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/40 active:scale-[0.98] transition-all"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
