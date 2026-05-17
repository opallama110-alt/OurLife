import React, { useState } from 'react';
import type { AchievementCategory, AchievementRarity } from '../services/gamificationService';
import { AchievementEmblem, tierFromRarity, EmblemCategory } from './AchievementEmblem';
import { AchievementModal } from './AchievementModal';

// ═══════════════════════════════════════════════════════════════════════════
// ACHIEVEMENT CARD — single row in the gallery list (.s-ach pattern).
// Wholesale restyle: replaces the prior emoji tile with the crafted hex
// emblem, swaps tailwind glow utility classes for prototype .s-ach classes,
// and pops the prototype slide-up detail modal on tap.
// ═══════════════════════════════════════════════════════════════════════════

export type GalleryEntry = {
  id: string;
  label: string;
  description: string;
  emoji: string;
  rarity: AchievementRarity;
  category?: AchievementCategory;
  unlocked: boolean;
  progress: number;
  requirement?: number;
  xpReward: number;
  tokenReward: number;
};

interface Props {
  achievement: GalleryEntry;
  onClick?: () => void;
}

export const AchievementCard: React.FC<Props> = ({ achievement: a, onClick }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const hasProgress = typeof a.requirement === 'number' && a.requirement > 0;
  const pct = hasProgress
    ? Math.min(100, Math.round(((a.progress || 0) / (a.requirement as number)) * 100))
    : (a.unlocked ? 100 : 0);

  const tier = tierFromRarity(a.rarity);
  const category = (a.category || 'workout') as EmblemCategory;
  // currentTier index reflects whether unlocked at all (0..4 ladder slot derived
  // from rarity); locked entries pass -1.
  const tierIdx = a.unlocked ? ['bronze','silver','gold','platinum','mythic'].indexOf(tier) : -1;

  const handleOpen = () => {
    onClick?.();
    setModalOpen(true);
  };

  return (
    <>
      <button type="button" onClick={handleOpen}
        className={`s-ach ${a.unlocked ? 'is-done' : 'is-locked'}`}>
        <AchievementEmblem
          category={category}
          tier={tier}
          locked={!a.unlocked}
          size={42}
          currentTier={tierIdx}
        />
        <div className="s-ach-info">
          <div className="s-ach-name">{a.label}</div>
          <div className="s-ach-desc">{a.description}</div>
          {hasProgress && !a.unlocked && (
            <div className="s-ach-bar">
              <div className="s-ach-bar-fill" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
        <div className="s-ach-right">
          <span className="s-ach-xp">+{a.xpReward.toLocaleString()} XP</span>
          <span className={`s-ach-prog ${a.unlocked ? 'fz-green' : ''}`}>
            {a.unlocked
              ? 'UNLOCKED'
              : hasProgress
                ? `${(a.progress || 0).toLocaleString()}/${(a.requirement as number).toLocaleString()}`
                : 'LOCKED'}
          </span>
        </div>
      </button>

      <AchievementModal
        open={modalOpen}
        achievement={a}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
};
