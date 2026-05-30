import React, { useEffect, useState } from 'react';
import SystemNotification from '../hud/SystemNotification';
import { AnatomicalHeart } from './AnatomicalHeart';

// ═══════════════════════════════════════════════════════════════
// IntroSequence — first-launch cinematic orchestration:
//   Step I  PlayerInvitation     SystemNotification with 60s timer
//   Step II HeartAwakening       Full-screen anatomical heart reveal
//   Step III PlayerWelcome       SystemNotification confirming Player
// Calls onComplete when Step III is acknowledged.
//
// Ported from prototype components/IntroSequence.jsx. Designed to be
// mounted by the route guard when localStorage.ol_intro_done is missing.
// ═══════════════════════════════════════════════════════════════

interface IntroSequenceProps {
  onComplete: () => void;
}

const PlayerInvitation: React.FC<{
  onAccept: () => void;
  onDecline: () => void;
}> = ({ onAccept, onDecline }) => {
  const [secondsLeft, setSecondsLeft] = useState(60);

  useEffect(() => {
    if (secondsLeft <= 0) {
      // Loop: brief pause then re-prompt (matches prototype behavior)
      const t = window.setTimeout(() => setSecondsLeft(60), 600);
      return () => window.clearTimeout(t);
    }
    const id = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [secondsLeft]);

  const C = 2 * Math.PI * 30;
  const dash = (secondsLeft / 60) * C;

  return (
    <SystemNotification
      open
      closable={false}
      title="INFORMASI SISTEM"
      footer={
        <div className="sn-btn-row">
          <button type="button" className="sn-btn sn-btn-ghost" onClick={onDecline}>TIDAK</button>
          <button type="button" className="sn-btn sn-btn-primary" onClick={onAccept}>YA</button>
        </div>
      }
    >
      <p style={{ margin: 0 }}>
        Anda telah dipilih oleh <b style={{ color: '#A5F3FC' }}>System</b>.
      </p>
      <p style={{ margin: '8px 0 0' }}>
        Apakah anda ingin menjadi <b style={{ color: '#A5F3FC' }}>Player</b>?
      </p>

      <div className="sn-timer">
        <svg width="76" height="76" viewBox="0 0 76 76">
          <defs>
            <linearGradient id="sn-timer-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#67E8F9" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
          </defs>
          <circle cx="38" cy="38" r="30" fill="none" strokeWidth="4" className="sn-timer-track" />
          <circle cx="38" cy="38" r="30" fill="none" strokeWidth="4"
            className="sn-timer-bar"
            strokeDasharray={`${dash} ${C}`} />
        </svg>
        <span className="sn-timer-num">
          {secondsLeft}
          <span className="sn-timer-num-sub">SEC</span>
        </span>
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 10,
        letterSpacing: '0.22em', color: '#94A3B8', marginTop: 6,
        textAlign: 'center',
      }}>
        WAKTU TERSISA · UNDANGAN AKAN BERULANG
      </div>
    </SystemNotification>
  );
};

const HeartAwakening: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  useEffect(() => {
    const t = window.setTimeout(onDone, 4200);
    return () => window.clearTimeout(t);
  }, [onDone]);
  return (
    <div className="ha-stage">
      <div className="ha-void" />
      <AnatomicalHeart size={220} tier={5} />
      <div className="ha-caption">
        <span className="hud-label-sm fz-cyan" style={{ letterSpacing: '0.3em' }}>STATUS</span>
        <div className="ha-caption-text">
          Detak jantung <span className="fz-orange">Player</span> telah dinyalakan.
        </div>
      </div>
    </div>
  );
};

const PlayerWelcome: React.FC<{ onContinue: () => void }> = ({ onContinue }) => (
  <SystemNotification
    open
    closable={false}
    title="SELAMAT, PLAYER"
    footer={
      <button type="button" className="sn-btn sn-btn-primary" onClick={onContinue}>
        LANJUT
      </button>
    }
  >
    <p style={{ margin: 0 }}>
      Anda telah resmi menjadi <b style={{ color: '#A5F3FC' }}>Player</b>.
    </p>
    <p style={{ margin: '8px 0 0' }}>
      System memerlukan data untuk beroperasi. Jawab semua pertanyaan dengan jujur.
    </p>
  </SystemNotification>
);

export const IntroSequence: React.FC<IntroSequenceProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<'invite' | 'heart' | 'welcome'>('invite');

  if (phase === 'invite') return (
    <PlayerInvitation
      onAccept={() => setPhase('heart')}
      onDecline={() => setPhase('invite')}
    />
  );
  if (phase === 'heart')   return <HeartAwakening onDone={() => setPhase('welcome')} />;
  if (phase === 'welcome') return <PlayerWelcome onContinue={onComplete} />;
  return null;
};
