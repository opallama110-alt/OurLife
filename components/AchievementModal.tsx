import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { AchievementEmblem, TIER_THEMES, tierFromRarity, EmblemTier, EmblemCategory } from './AchievementEmblem';
import type { GalleryEntry } from './AchievementCard';

// ═══════════════════════════════════════════════════════════════
// AchievementModal — slide-up detail panel; shows current tier,
// progress to next, and a 5-cell tier grid.
//
// Our catalog only carries one rarity per entry (not a 5-tier
// ladder), so the "next tier" + tier-grid sections are derived:
// the existing rarity becomes the *current* tier, and the grid
// renders the canonical Bronze→Mythic ladder with everything past
// the entry's rarity rendered as locked.
// ═══════════════════════════════════════════════════════════════

const TIER_ORDER: EmblemTier[] = ['bronze', 'silver', 'gold', 'platinum', 'mythic'];

interface Props {
  open: boolean;
  achievement: GalleryEntry | null;
  onClose: () => void;
}

export const AchievementModal: React.FC<Props> = ({ open, achievement, onClose }) => {
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => setShow(true));
      return () => cancelAnimationFrame(id);
    }
    setShow(false);
    const t = window.setTimeout(() => setMounted(false), 320);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!mounted || !achievement) return null;

  const currentTier = tierFromRarity(achievement.rarity);
  const currentIdx = achievement.unlocked ? TIER_ORDER.indexOf(currentTier) : -1;
  const cat = (achievement.category || 'workout') as EmblemCategory;
  const theme = TIER_THEMES[currentTier];

  const hasProgress = typeof achievement.requirement === 'number' && achievement.requirement > 0;
  const progressPct = hasProgress && !achievement.unlocked
    ? Math.min(100, Math.round(((achievement.progress || 0) / (achievement.requirement as number)) * 100))
    : (achievement.unlocked ? 100 : 0);

  return (
    <div className={`am-root ${show ? 'is-open' : ''}`} role="dialog" aria-modal="true">
      <div className="am-backdrop" onClick={onClose} />
      <div className="am-panel">
        <button className="am-close" onClick={onClose} aria-label="Tutup" type="button">
          <X size={14} />
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
          <h2 className="am-title">{achievement.label}</h2>
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
              <span className="mono" style={{ color: 'var(--orange)' }}>+{achievement.xpReward.toLocaleString()} XP</span>
            </div>
            <div className="am-next-progress">
              <div className="am-next-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="am-next-meta">
              {(achievement.progress || 0).toLocaleString()} / {(achievement.requirement as number).toLocaleString()}
              {` · ${(achievement.requirement as number) - (achievement.progress || 0)} lagi`}
            </div>
          </div>
        )}

        <div className="am-tier-grid">
          {TIER_ORDER.map((t, i) => {
            const reached = i <= currentIdx;
            const tt = TIER_THEMES[t];
            return (
              <div key={t} className={`am-tier ${reached ? 'is-reached' : ''}`}>
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
    </div>
  );
};
