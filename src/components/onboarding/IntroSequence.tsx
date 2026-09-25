import React, { useCallback, useEffect, useRef, useState } from 'react';
import SystemNotification from '../hud/SystemNotification';
import { AnatomicalHeart } from './AnatomicalHeart';
import { prefersReducedMotion } from '../../hooks/usePresence';

// ═══════════════════════════════════════════════════════════════
// IntroSequence — first-launch cinematic orchestration:
//   Step I  PlayerInvitation     SystemNotification with 60s timer
//   Step II HeartAwakening       Full-screen anatomical heart reveal
//   Step III PlayerWelcome       SystemNotification confirming Player
// Calls onComplete when Step III is acknowledged.
//
// Ported from prototype components/IntroSequence.jsx. Mounted by the
// onboarding gate (and the /intro replay route) in App.tsx, which also
// mount <SystemFrameDefs/> since this renders outside Layout.
//
// Motion: one persistent void layer (.intro-root) sits under every phase
// so nothing ever flashes the page body between them, and each phase plays
// its exit (frame dematerialize / heart fade) before the next one mounts.
// ═══════════════════════════════════════════════════════════════

interface IntroSequenceProps {
  onComplete: () => void;
}

type Phase = 'invite' | 'heart' | 'welcome';

// Longer than SystemNotification's exit (~200ms) and the heart fade-out.
const LEAVE_MS = 280;

const vibrate = (pattern: number | number[]) => {
  try { navigator.vibrate?.(pattern); } catch { /* unsupported (iOS) */ }
};

const PlayerInvitation: React.FC<{
  open: boolean;
  onAccept: () => void;
}> = ({ open, onAccept }) => {
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [denied, setDenied] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) {
      // Loop: brief pause then re-prompt (matches prototype behavior)
      const t = window.setTimeout(() => setSecondsLeft(60), 600);
      return () => window.clearTimeout(t);
    }
    const id = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [secondsLeft]);

  // Refusing is part of the story: the frame shakes, the timer re-arms and
  // the System answers — instead of a button that silently does nothing.
  const decline = () => {
    setDenied((d) => d + 1);
    setSecondsLeft(60);
    vibrate(40);
  };

  const C = 2 * Math.PI * 30;
  const dash = (secondsLeft / 60) * C;
  // Drain linearly across each whole second; refill quickly when re-armed.
  const ringTransition = secondsLeft === 60
    ? 'stroke-dashoffset 600ms var(--ease-out-expo)'
    : undefined;

  return (
    <SystemNotification
      open={open}
      closable={false}
      title="INFORMASI SISTEM"
      className={denied > 0 ? (denied % 2 ? 'is-deny-a' : 'is-deny-b') : ''}
      footer={
        <div className="sn-btn-row">
          <button type="button" className="sn-btn sn-btn-ghost" onClick={decline}>TIDAK</button>
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
            strokeDasharray={C}
            strokeDashoffset={C - dash}
            style={ringTransition ? { transition: ringTransition } : undefined} />
        </svg>
        <span className="sn-timer-num tnum">
          {secondsLeft}
          <span className="sn-timer-num-sub">DETIK</span>
        </span>
      </div>
      {denied > 0 ? (
        <div key={denied} className="sn-denied" role="status">
          System tidak menerima penolakan.
        </div>
      ) : (
        <div className="sn-timer-caption">
          WAKTU TERSISA · UNDANGAN AKAN BERULANG
        </div>
      )}
    </SystemNotification>
  );
};

// The heart builds up tier by tier (ember → flames → orbit → crown) instead
// of appearing fully formed, then holds on the awakened state.
const TIER_STEPS: { at: number; tier: 2 | 3 | 4 | 5 }[] = [
  { at: 450, tier: 2 },
  { at: 900, tier: 3 },
  { at: 1350, tier: 4 },
  { at: 1800, tier: 5 },
];
const HEART_HOLD_MS = 4200;
const HEART_SKIP_AFTER_MS = 1500;

const HeartAwakening: React.FC<{ leaving: boolean; onDone: () => void }> = ({ leaving, onDone }) => {
  const reduced = prefersReducedMotion();
  const [tier, setTier] = useState<1 | 2 | 3 | 4 | 5>(reduced ? 5 : 1);
  const [canSkip, setCanSkip] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const ids: number[] = [];
    if (!reduced) {
      TIER_STEPS.forEach(({ at, tier: next }) => {
        ids.push(window.setTimeout(() => {
          setTier(next);
          if (next === 5) vibrate([30, 70, 30]);
        }, at));
      });
    }
    ids.push(window.setTimeout(() => setCanSkip(true), HEART_SKIP_AFTER_MS));
    ids.push(window.setTimeout(() => onDoneRef.current(), HEART_HOLD_MS));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [reduced]);

  return (
    <div
      className={`ha-stage ${leaving ? 'is-leaving' : ''}`}
      onClick={() => { if (canSkip && !leaving) onDoneRef.current(); }}
    >
      <div className="ha-void" />
      <AnatomicalHeart size={220} tier={tier} />
      <div className="ha-caption">
        <span className="hud-label-sm fz-cyan" style={{ letterSpacing: '0.3em' }}>STATUS</span>
        <div className="ha-caption-text">
          Detak jantung <span className="fz-orange">Player</span> telah dinyalakan.
        </div>
      </div>
      {canSkip && <div className="ha-skip" aria-hidden="true">KETUK UNTUK LANJUT</div>}
    </div>
  );
};

const PlayerWelcome: React.FC<{ open: boolean; onContinue: () => void }> = ({ open, onContinue }) => (
  <SystemNotification
    open={open}
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
  const [phase, setPhase] = useState<Phase>('invite');
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  // Play the current phase's exit, then swap. The ref guards double taps
  // (and the heart's auto-advance racing a tap-to-skip).
  const go = useCallback((next: Phase | 'done') => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    timerRef.current = window.setTimeout(() => {
      leavingRef.current = false;
      if (next === 'done') {
        onCompleteRef.current();
        return;
      }
      setPhase(next);
      setLeaving(false);
    }, prefersReducedMotion() ? 0 : LEAVE_MS);
  }, []);

  return (
    <div className="intro-root">
      {phase === 'invite' && (
        <PlayerInvitation open={!leaving} onAccept={() => go('heart')} />
      )}
      {phase === 'heart' && (
        <HeartAwakening leaving={leaving} onDone={() => go('welcome')} />
      )}
      {phase === 'welcome' && (
        <PlayerWelcome open={!leaving} onContinue={() => go('done')} />
      )}
    </div>
  );
};
