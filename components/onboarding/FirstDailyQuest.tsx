import React from 'react';
import SystemNotification from '../hud/SystemNotification';

// ═══════════════════════════════════════════════════════════════
// FirstDailyQuest — "Informasi Quest" SystemNotification shown
// after onboarding completes. Accepting it creates a starter habit
// via the provided onAccept callback.
//
// Ported from prototype components/FirstDailyQuest.jsx.
// ═══════════════════════════════════════════════════════════════

export type FirstQuestHabit = {
  title: string;
  description: string;
  category: string;
  frequency: string;
  days: number[];
  xpReward: number;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onAccept: (habit: FirstQuestHabit) => void;
}

const STARTER_QUEST: FirstQuestHabit = {
  title: 'Quest Harian — Persiapan Menjadi yang Terkuat',
  description: 'Push Up 100 · Sit Up 100 · Squat 100 · Lari 10 km',
  category: 'fitness',
  frequency: 'daily',
  days: [0, 1, 2, 3, 4, 5, 6],
  xpReward: 10,
};

export const FirstDailyQuest: React.FC<Props> = ({ open, onClose, onAccept }) => (
  <SystemNotification
    open={open}
    onClose={onClose}
    closable={true}
    title="Informasi Quest"
    subtitle="quest harian — persiapan menjadi yang terkuat"
    footer={
      <div className="sn-btn-row">
        <button type="button" className="sn-btn sn-btn-ghost" onClick={onClose}>Nanti</button>
        <button type="button" className="sn-btn sn-btn-primary"
          onClick={() => { onAccept(STARTER_QUEST); onClose(); }}>
          Terima Quest
        </button>
      </div>
    }
  >
    <div className="sn-target-label">Target</div>
    <div className="sn-target-list">
      - Push Up <span style={{ fontFamily: 'var(--font-mono)' }}>[0/100]</span><br />
      - Sit Up  <span style={{ fontFamily: 'var(--font-mono)' }}>[0/100]</span><br />
      - Squat   <span style={{ fontFamily: 'var(--font-mono)' }}>[0/100]</span><br />
      - Lari    <span style={{ fontFamily: 'var(--font-mono)' }}>[0/10 km]</span>
    </div>
    <div className="sn-warn">
      <b>Perhatian!</b> - Akan ada penalti setimpal jika tidak menyelesaikan Quest Harian.
    </div>
  </SystemNotification>
);
