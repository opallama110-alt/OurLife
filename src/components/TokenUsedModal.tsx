import React, { useRef } from 'react';
import { Shield } from 'lucide-react';
import { HudDialog } from './hud';
import { StreakFlame } from './streak/StreakFlame';
import { TokenDisplay } from './TokenDisplay';

interface TokenUsedModalProps {
  open: boolean;
  onClose: () => void;
  protectedDate?: string;
  tokensRemaining: number;
  streakSaved?: number;
}

/** Spent-slot shatter waits for the dialog + shield stamp to land. */
const SPEND_DELAY_MS = 950;

/** 'YYYY-MM-DD' → "Senin, 22 September". Falls back to the raw string. */
const formatProtectedDate = (iso?: string): string | null => {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
};

// ═══════════════════════════════════════════════════════════════════════════
// TOKEN USED MODAL — shown once on the app boot where a Streak Freeze Token
// auto-applied to bridge a missed day. This is the one moment the streak
// system visibly rescues the user, so it's staged: the frozen flame sits in
// an ice ring, the shield stamps down on it, the surviving streak count pops,
// then the token that paid for it shatters out of its slot.
//
// Built on HudDialog (portaled, real enter/exit, Esc/backdrop, focus
// management). Props and the App.tsx contract are unchanged.
// ═══════════════════════════════════════════════════════════════════════════
export const TokenUsedModal: React.FC<TokenUsedModalProps> = ({
  open,
  onClose,
  protectedDate,
  tokensRemaining,
  streakSaved,
}) => {
  // App.tsx clears the result on close, but the dialog stays mounted for its
  // exit animation — keep showing what was on screen while it fades out
  // instead of repainting with empty props (fallback copy, 0 tokens).
  const lastRef = useRef({ protectedDate, tokensRemaining, streakSaved });
  if (open) lastRef.current = { protectedDate, tokensRemaining, streakSaved };
  const shown = lastRef.current;

  const dateLabel = formatProtectedDate(shown.protectedDate);
  const saved = typeof shown.streakSaved === 'number' && shown.streakSaved > 0 ? shown.streakSaved : 0;

  return (
    <HudDialog
      open={open}
      onClose={onClose}
      title="Streak Terlindungi"
      subtitle="token streak freeze terpakai otomatis"
      tone="cyan"
      className="tok-dialog"
      footer={
        <button type="button" className="hd-btn hd-btn--primary" onClick={onClose} data-autofocus>
          Siap, lanjut
        </button>
      }
    >
      <div className="tok-hero" aria-hidden="true">
        <span className="tok-ice" />
        <StreakFlame streak={Math.max(1, saved)} size={52} frozen celebrate={false} />
        <span className="tok-stamp">
          <Shield size={16} strokeWidth={2.4} />
          <span className="tok-stamp-ring" />
        </span>
      </div>

      <p className="tok-copy">
        {dateLabel
          ? <>Kamu melewatkan <b>{dateLabel}</b>, tapi token menjembatani celahnya.</>
          : 'Satu hari yang terlewat dijembatani otomatis.'}
      </p>

      {saved > 0 && (
        <div className="tok-saved">
          <StreakFlame streak={saved} size={16} celebrate={false} />
          <span className="tok-saved-num tnum">{saved}</span>
          <span>hari streak tetap menyala</span>
        </div>
      )}

      <div className="tok-remaining">
        <span className="hud-label-sm">Sisa token</span>
        <TokenDisplay
          count={shown.tokensRemaining}
          animateFrom={shown.tokensRemaining + 1}
          fxDelay={SPEND_DELAY_MS}
          size="lg"
        />
      </div>
    </HudDialog>
  );
};
