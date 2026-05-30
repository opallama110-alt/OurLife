import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import SystemNotification from '../hud/SystemNotification';

// ═══════════════════════════════════════════════════════════════
// FirstDailyQuest — "Informasi Quest" popup shown once after
// onboarding completes. Body is an INTERACTIVE sub-task list:
// each row has a decorative checkbox, label, numeric target input
// (user can adjust before accepting), and a unit suffix.
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

// Default starter targets — mirror the prototype "Persiapan menjadi yang
// terkuat" routine (100/100/100/10km). User can edit each before accepting.
const DEFAULT_TARGETS: FirstQuestSubTask[] = [
  { id: 'pushup', label: 'Push Up', target: 100, unit: 'reps' },
  { id: 'situp',  label: 'Sit Up',  target: 100, unit: 'reps' },
  { id: 'squat',  label: 'Squat',   target: 100, unit: 'reps' },
  { id: 'lari',   label: 'Lari',    target: 10,  unit: 'km' },
];

export const FirstDailyQuest: React.FC<Props> = ({ open, onClose, onAccept }) => {
  // Reset on (re-)open so a previous edit-then-cancel doesn't bleed into
  // the next time the popup is shown.
  const [items, setItems] = useState<FirstQuestSubTask[]>(DEFAULT_TARGETS);
  useEffect(() => { if (open) setItems(DEFAULT_TARGETS); }, [open]);

  const updateTarget = (id: string, raw: string) => {
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    setItems(prev => prev.map(it => it.id === id ? { ...it, target: Math.max(0, n) } : it));
  };

  const accept = () => {
    const description = items.map(it => `${it.label} ${it.target} ${it.unit}`).join(' · ');
    onAccept({
      title: QUEST_TITLE,
      description,
      category: 'fitness',
      frequency: 'daily',
      days: [0, 1, 2, 3, 4, 5, 6],
      xpReward: 10,
      subTasks: items,
    });
    onClose();
  };

  return (
    <SystemNotification
      open={open}
      onClose={onClose}
      closable={true}
      title="Informasi Quest"
      subtitle="quest harian — persiapan menjadi yang terkuat"
      className="sys-frame-quest"
      footer={
        <div className="sn-btn-row">
          <button type="button" className="sn-btn sn-btn-ghost" onClick={onClose}>Nanti</button>
          <button type="button" className="sn-btn sn-btn-primary" onClick={accept}>
            Terima Quest
          </button>
        </div>
      }
    >
      <div className="sn-target-label">Target</div>
      <ul className="fdq-list">
        {items.map(it => (
          <li key={it.id} className="fdq-row">
            <span className="fdq-check" aria-hidden="true">
              <Check size={12} />
            </span>
            <span className="fdq-label">{it.label}</span>
            <input
              type="number"
              className="fdq-target"
              min={0}
              value={it.target}
              onChange={(e) => updateTarget(it.id, e.target.value)}
              aria-label={`Target ${it.label}`}
            />
            <span className="fdq-unit">{it.unit}</span>
          </li>
        ))}
      </ul>
      <div className="sn-warn">
        <b>Perhatian!</b> - Akan ada penalti setimpal jika tidak menyelesaikan Quest Harian.
      </div>
    </SystemNotification>
  );
};
