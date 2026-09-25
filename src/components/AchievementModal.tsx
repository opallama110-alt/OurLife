import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { AchievementEmblem, TIER_THEMES, tierFromRarity, EmblemTier, EmblemCategory } from './AchievementEmblem';
import type { GalleryEntry } from './AchievementCard';
import { usePresence } from '../hooks/usePresence';

// ═══════════════════════════════════════════════════════════════
// AchievementModal — slide-up detail panel; shows current tier,
// progress to next, and a 5-cell tier grid.
//
// Our catalog only carries one rarity per entry (not a 5-tier
// ladder), so the "next tier" + tier-grid sections are derived:
// the existing rarity becomes the *current* tier, and the grid
// renders the canonical Bronze→Mythic ladder with everything past
// the entry's rarity rendered as locked.
//
// Portaled to <body>: the sheet is opened from a gallery row deep inside
// Profile, and any ancestor carrying a transform (page reveal, card enter)
// would otherwise become the containing block for this position:fixed
// overlay — anchoring the sheet to the bottom of the ~3000px Profile block
// instead of the viewport, under the bottom nav.
// ═══════════════════════════════════════════════════════════════

const TIER_ORDER: EmblemTier[] = ['bronze', 'silver', 'gold', 'platinum', 'mythic'];

/** Must match the `.am-root[data-state="exit"]` animation duration (--dur-2). */
const EXIT_MS = 200;

interface Props {
  open: boolean;
  achievement: GalleryEntry | null;
  onClose: () => void;
}

export const AchievementModal: React.FC<Props> = ({ open, achievement, onClose }) => {
  const { mounted, state } = usePresence(open, EXIT_MS);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Esc closes; focus moves into the sheet on open and back to the row that
  // opened it on close (keyboard / switch users keep their place).
  useEffect(() => {
    if (!open) return;
    const restore = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    const raf = window.requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
    return () => {
      window.removeEventListener('keydown', onKey);
      window.cancelAnimationFrame(raf);
      restore?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!mounted || !achievement || typeof document === 'undefined') return null;

  const currentTier = tierFromRarity(achievement.rarity);
  const currentIdx = achievement.unlocked ? TIER_ORDER.indexOf(currentTier) : -1;
  const cat = (achievement.category || 'workout') as EmblemCategory;
  const theme = TIER_THEMES[currentTier];

  const hasProgress = typeof achievement.requirement === 'number' && achievement.requirement > 0;
  const progressPct = hasProgress && !achievement.unlocked
    ? Math.min(100, Math.round(((achievement.progress || 0) / (achievement.requirement as number)) * 100))
    : (achievement.unlocked ? 100 : 0);
  const remaining = hasProgress
    ? Math.max(0, (achievement.requirement as number) - (achievement.progress || 0))
    : 0;

  return createPortal(
    <div className="am-root" data-state={state}>
      <div className="am-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="am-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <span className="am-grabber" aria-hidden="true" />
        <button className="am-close" onClick={onClose} aria-label="Tutup" type="button">
          <X size={16} />
        </button>

        <div className="am-header">
          <div className="am-emblem-wrap">
            <AchievementEmblem
              category={cat}
              tier={currentTier}
              locked={!achievement.unlocked}
              size={92}
              currentTier={currentIdx}
            />
          </div>
          <div className="hud-label-sm fz-cyan">
            {(achievement.category || 'workout').toUpperCase()} · ACHIEVEMENT
          </div>
          <h2 className="am-title" id={titleId}>{achievement.label}</h2>
          <p className="am-desc">{achievement.description}</p>
        </div>

        <div className="am-tier-row">
          <span className="hud-label-sm">TIER SAAT INI</span>
          <span className="am-current-tier"
            style={{ color: achievement.unlocked ? theme.primary : 'var(--t-mute)' }}>
            {achievement.unlocked ? theme.name.toUpperCase() : 'BELUM TERBUKA'}
          </span>
        </div>

        {hasProgress && !achievement.unlocked && (
          <div className="am-next">
            <div className="am-next-head">
              <span className="hud-label-sm">PROGRES BERIKUTNYA</span>
              <span className="mono" style={{ color: 'var(--orange)' }}>+{achievement.xpReward.toLocaleString('id-ID')} XP</span>
            </div>
            <div className="am-next-progress">
              <div className="am-next-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="am-next-meta">
              {(achievement.progress || 0).toLocaleString('id-ID')} / {(achievement.requirement as number).toLocaleString('id-ID')}
              {` · ${remaining.toLocaleString('id-ID')} lagi`}
            </div>
          </div>
        )}

        <div className="am-tier-grid">
          {TIER_ORDER.map((t, i) => {
            const reached = i <= currentIdx;
            const tt = TIER_THEMES[t];
            return (
              <div
                key={t}
                className={`am-tier ${reached ? 'is-reached' : ''}`}
                style={{ '--i': i } as React.CSSProperties}
              >
                <AchievementEmblem
                  category={cat}
                  tier={t}
                  locked={!reached}
                  size={42}
                  currentTier={reached ? i : -1}
                />
                <div className="am-tier-name" style={{ color: reached ? tt.primary : 'var(--t-mute)' }}>
                  {tt.name}
                </div>
                <div className="am-tier-req">×{tt.xpMult}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
};
