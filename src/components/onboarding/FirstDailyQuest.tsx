import React, { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import SystemNotification from '../hud/SystemNotification';
import { prefersReducedMotion } from '../../hooks/usePresence';

// ═══════════════════════════════════════════════════════════════
// FirstDailyQuest — "Informasi Quest" popup shown once after
// onboarding completes. Body is an INTERACTIVE sub-task list:
// each row has an index badge, label + unit, and a − / number / +
// target control (user can adjust before accepting).
//
// "Terima Quest" then materializes a real Habit with subTasks =
// the accepted items, so the user goes straight into the per-task
// tick flow on the Habits page. "Nanti" dismisses without creating.
// ═══════════════════════════════════════════════════════════════

export type FirstQuestSubTask = {
  /** Stable id used in Habit.completedSubTasks[date]. */
  id: string;
  label: string;
  target: number;
  /** Display-only suffix ("reps", "km", "menit", …). Not persisted. */
  unit: string;
};

export type FirstQuestHabit = {
  title: string;
  description: string;
  category: string;
  frequency: string;
  days: number[];
  xpReward: number;
  /** Sub-tasks to attach to the resulting Habit. */
  subTasks: FirstQuestSubTask[];
};

interface Props {
  open: boolean;
  onClose: () => void;
  onAccept: (habit: FirstQuestHabit) => void;
}

const QUEST_TITLE = 'Quest Harian — Persiapan Menjadi yang Terkuat';
const QUEST_XP = 10;

// Default starter targets — mirror the prototype "Persiapan menjadi yang
// terkuat" routine (100/100/100/10km). User can edit each before accepting.
const DEFAULT_TARGETS: FirstQuestSubTask[] = [
  { id: 'pushup', label: 'Push Up', target: 100, unit: 'reps' },
  { id: 'situp',  label: 'Sit Up',  target: 100, unit: 'reps' },
  { id: 'squat',  label: 'Squat',   target: 100, unit: 'reps' },
  { id: 'lari',   label: 'Lari',    target: 10,  unit: 'km' },
];

// Stepper increment per unit — big enough that a couple of taps reach a
// sensible target without opening the keyboard.
const stepFor = (unit: string) => (unit === 'km' ? 1 : 10);

// How long the "QUEST DITERIMA" stamp holds before the frame dematerializes.
const ACCEPT_HOLD_MS = 700;

export const FirstDailyQuest: React.FC<Props> = ({ open, onClose, onAccept }) => {
  // Reset on (re-)open so a previous edit-then-cancel doesn't bleed into
  // the next time the popup is shown.
  const [items, setItems] = useState<FirstQuestSubTask[]>(DEFAULT_TARGETS);
  const [accepted, setAccepted] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (open) { setItems(DEFAULT_TARGETS); setAccepted(false); }
  }, [open]);
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const updateTarget = (id: string, raw: string) => {
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    setItems(prev => prev.map(it => it.id === id ? { ...it, target: Math.max(0, Math.round(n)) } : it));
  };

  const stepTarget = (id: string, dir: 1 | -1) => {
    setItems(prev => prev.map(it => it.id === id
      ? { ...it, target: Math.max(0, it.target + dir * stepFor(it.unit)) }
      : it));
  };

  const accept = () => {
    if (accepted) return;
    const description = items.map(it => `${it.label} ${it.target} ${it.unit}`).join(' · ');
    // Persist immediately; only the dismissal waits for the stamp beat.
    onAccept({
      title: QUEST_TITLE,
      description,
      category: 'fitness',
      frequency: 'daily',
      days: [0, 1, 2, 3, 4, 5, 6],
      xpReward: QUEST_XP,
      subTasks: items,
    });
    setAccepted(true);
    try { navigator.vibrate?.(20); } catch { /* unsupported */ }
    closeTimer.current = window.setTimeout(onClose, prefersReducedMotion() ? 0 : ACCEPT_HOLD_MS);
  };

  return (
    <SystemNotification
      open={open}
      onClose={onClose}
      closable={!accepted}
      title="Informasi Quest"
      subtitle="quest harian — persiapan menjadi yang terkuat"
      className="sys-frame-quest"
      footer={
        accepted ? (
          <div className="fdq-accepted" role="status">
            QUEST DITERIMA <span className="fdq-accepted-xp">+{QUEST_XP} XP</span>
          </div>
        ) : (
          <div className="sn-btn-row">
            <button type="button" className="sn-btn sn-btn-ghost" onClick={onClose}>Nanti</button>
            <button type="button" className="sn-btn sn-btn-primary" onClick={accept}>
              Terima Quest
            </button>
          </div>
        )
      }
    >
      <div className="sn-target-label">Target</div>
      <ul className={`fdq-list ${accepted ? 'is-accepted' : ''}`}>
        {items.map((it, i) => (
          <li key={it.id} className="fdq-row" style={{ '--i': i } as React.CSSProperties}>
            <span className="fdq-idx" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
            <span className="fdq-name">
              <span className="fdq-label">{it.label}</span>
              <span className="fdq-unit">{it.unit}</span>
            </span>
            <span className="fdq-stepper">
              <button
                type="button"
                className="fdq-step"
                onClick={() => stepTarget(it.id, -1)}
                disabled={accepted || it.target <= 0}
                aria-label={`Kurangi target ${it.label}`}
              >
                <Minus size={14} />
              </button>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                className="fdq-target tnum"
                min={0}
                value={it.target}
                onChange={(e) => updateTarget(it.id, e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                disabled={accepted}
                aria-label={`Target ${it.label} (${it.unit})`}
              />
              <button
                type="button"
                className="fdq-step"
                onClick={() => stepTarget(it.id, 1)}
                disabled={accepted}
                aria-label={`Tambah target ${it.label}`}
              >
                <Plus size={14} />
              </button>
            </span>
          </li>
        ))}
      </ul>
      <div className="sn-warn">
        <b>Perhatian!</b> - Akan ada penalti setimpal jika tidak menyelesaikan Quest Harian.
      </div>
    </SystemNotification>
  );
};
