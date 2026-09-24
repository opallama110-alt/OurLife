import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, X, Zap, Shield } from 'lucide-react';
import type { AchievementUnlock } from '../services/achievementService';
import { AchievementEmblem, tierFromRarity, EmblemCategory } from './AchievementEmblem';
import { prefersReducedMotion } from '../hooks/usePresence';

// ═══════════════════════════════════════════════════════════════════════════
// ACHIEVEMENT NOTIFICATION — single auto-dismissing toast for one unlock.
//
// The stack is ONE fixed flow container (not N fixed toasts at top+i*110px),
// so toasts keep their natural height and a leaving toast collapses its own
// slot (grid-template-rows 1fr → 0fr) while the ones below glide up instead
// of teleporting. Each toast drops in from the top edge it's pinned to, shows
// the same crafted emblem the gallery uses, and plays a short exit before the
// queue drops it. Pressing / hovering pauses the 5s countdown.
// ═══════════════════════════════════════════════════════════════════════════

const VISIBLE_MS = 5000;
/** Matches the `.ach-toast[data-state="exit"]` collapse (--dur-3 ≈ 260ms). */
const EXIT_MS = 240;
/** More unlocks wait in the queue and slide in as earlier ones leave. */
const MAX_VISIBLE = 3;

const TIER_INDEX = ['bronze', 'silver', 'gold', 'platinum', 'mythic'];

interface Props {
  unlock: AchievementUnlock;
  onDismiss: () => void;
}

export const AchievementNotification: React.FC<Props> = ({ unlock, onDismiss }) => {
  const a = unlock.achievement;
  const tier = tierFromRarity(a.rarity);
  const category = (a.category || 'workout') as EmblemCategory;

  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);

  // The parent passes a fresh `() => onDismiss(id)` every render; reading it
  // through a ref keeps the countdown from restarting on every queue change.
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  const remainingRef = useRef(VISIBLE_MS);

  // Countdown that survives re-renders and can be paused (press/hover).
  useEffect(() => {
    if (leaving || paused) return;
    const started = performance.now();
    const t = window.setTimeout(() => setLeaving(true), remainingRef.current);
    return () => {
      window.clearTimeout(t);
      remainingRef.current = Math.max(0, remainingRef.current - (performance.now() - started));
    };
  }, [leaving, paused]);

  // Play the exit, then let the queue drop it. Not driven by animationend:
  // under reduced motion keyframes run for 1ms and could fire it instantly
  // (fine) — but a backgrounded tab may never fire it at all.
  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => dismissRef.current(), prefersReducedMotion() ? 0 : EXIT_MS);
    return () => window.clearTimeout(t);
  }, [leaving]);

  return (
    <div
      className="ach-toast"
      data-state={leaving ? 'exit' : 'enter'}
      data-rarity={a.rarity}
      data-paused={paused ? '' : undefined}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onPointerCancel={() => setPaused(false)}
    >
      <div className="ach-toast-clip">
        <div className="ach-toast-card">
          <button
            type="button"
            onClick={() => setLeaving(true)}
            className="ach-toast-close"
            aria-label="Tutup notifikasi achievement"
          >
            <X size={14} />
          </button>

          <div className="ach-toast-body">
            <span className="ach-toast-emblem">
              <AchievementEmblem
                category={category}
                tier={tier}
                size={46}
                currentTier={TIER_INDEX.indexOf(tier)}
              />
            </span>

            <div className="ach-toast-info">
              <div className="ach-toast-kicker">
                <Sparkles size={10} aria-hidden="true" />
                <span>Achievement Terbuka</span>
                <span className="ach-toast-rarity">· {a.rarity}</span>
              </div>
              <h3 className="ach-toast-title">{a.label}</h3>
              <p className="ach-toast-desc">{a.description}</p>

              {(unlock.xpAwarded > 0 || unlock.tokensAwarded > 0) && (
                <div className="ach-toast-rewards">
                  {unlock.xpAwarded > 0 && (
                    <span className="ach-toast-reward">
                      <Zap size={10} aria-hidden="true" />+{unlock.xpAwarded.toLocaleString('id-ID')} XP
                    </span>
                  )}
                  {unlock.tokensAwarded > 0 && (
                    <span className="ach-toast-reward">
                      <Shield size={10} aria-hidden="true" />+{unlock.tokensAwarded} Token
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <span className="ach-toast-timer" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
};

// Stack renderer — one fixed flow container; the parent owns the queue.
export const AchievementNotificationStack: React.FC<{
  queue: AchievementUnlock[];
  onDismiss: (id: string) => void;
}> = ({ queue, onDismiss }) => (
  <div className="ach-stack" aria-live="polite" aria-relevant="additions">
    {queue.slice(0, MAX_VISIBLE).map(u => (
      <AchievementNotification
        key={u.achievement.id}
        unlock={u}
        onDismiss={() => onDismiss(u.achievement.id)}
      />
    ))}
  </div>
);
