import React, { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw, Timer } from 'lucide-react';
import { usePresence } from '../../hooks/usePresence';

// ─────────────────────────────────────────────────────────────────────────
// RestTimerRing — circular rest countdown for the active session.
//
// • The ring is painted from a ref (strokeDashoffset) every frame; React only
//   re-renders when the whole-second number changes (1 Hz), not 60×/s.
// • Time is wall-clock based (an end timestamp), so a throttled / background
//   tab can't make the countdown drift.
// • The timer usually sits below the fold, so while it runs off-screen a
//   floating pill shows the countdown (tap → scroll back to the ring).
// • The end is loud on every channel: beep + vibration + a ring flash and
//   a "WAKTUNYA SET BERIKUTNYA" label — a silent phone still notices.
// ─────────────────────────────────────────────────────────────────────────

export interface RestTimerRingProps {
  /** Flipping true starts a fresh countdown (used by "Log & Next"). */
  trigger?: boolean;
  defaultTime?: number;
  onTimerEnd?: () => void;
  /** Hide the off-screen pill (e.g. while another tab or sheet covers the session). */
  suppressPill?: boolean;
}

const SIZE = 110;
const R = 47;
const C = 2 * Math.PI * R;
const PRESETS = [30, 60, 90, 120];

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

// Memoised: the active session re-renders on every stepper drag event.
export const RestTimerRing = memo(function RestTimerRing({
  trigger = false, defaultTime = 60, onTimerEnd, suppressPill = false,
}: RestTimerRingProps) {
  const [target, setTarget] = useState(defaultTime);
  const [displaySec, setDisplaySec] = useState(defaultTime);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  // Brief "time's up" window in which the off-screen pill stays up to say so.
  const [justEnded, setJustEnded] = useState(false);
  const [inView, setInView] = useState(true);

  const rootRef = useRef<HTMLElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const remainingRef = useRef(defaultTime);
  const targetRef = useRef(defaultTime);
  const endAtRef = useRef(0);
  const audioCtx = useRef<AudioContext | null>(null);
  const onTimerEndRef = useRef(onTimerEnd);
  onTimerEndRef.current = onTimerEnd;

  const paint = useCallback(() => {
    const el = ringRef.current;
    if (!el) return;
    const t = targetRef.current;
    const pct = t > 0 ? Math.max(0, Math.min(1, remainingRef.current / t)) : 0;
    el.style.strokeDashoffset = String(C * (1 - pct));
  }, []);

  const beep = useCallback(() => {
    try {
      if (!audioCtx.current) audioCtx.current = new AudioContext();
      const ctx = audioCtx.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880; gain.gain.value = 0.3;
      osc.start(); osc.stop(ctx.currentTime + 0.2);
    } catch { /* AudioContext may be blocked before a user gesture */ }
  }, []);

  const start = useCallback((seconds: number, newTarget = seconds) => {
    targetRef.current = newTarget;
    remainingRef.current = seconds;
    endAtRef.current = performance.now() + seconds * 1000;
    setTarget(newTarget);
    setDisplaySec(Math.ceil(seconds));
    setDone(false);
    setJustEnded(false);
    setRunning(true);
    paint();
  }, [paint]);

  // Auto-start when the trigger flips true.
  useEffect(() => {
    if (trigger) start(defaultTime);
  }, [trigger, defaultTime, start]);

  useLayoutEffect(() => { paint(); }, [paint]);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const tick = (now: number) => {
      const next = Math.max(0, (endAtRef.current - now) / 1000);
      remainingRef.current = next;
      paint();
      const sec = Math.ceil(next);
      setDisplaySec(s => (s === sec ? s : sec));
      if (next <= 0) {
        // Side effects live here, never inside a state updater (StrictMode
        // double-invokes updaters, which used to double-beep).
        setRunning(false);
        setDone(true);
        setJustEnded(true);
        beep();
        try { navigator.vibrate?.([90, 60, 90]); } catch { /* unsupported */ }
        onTimerEndRef.current?.();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, paint, beep]);

  // Track whether the ring is on screen (drives the floating pill).
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!justEnded) return;
    const t = window.setTimeout(() => setJustEnded(false), 4000);
    return () => window.clearTimeout(t);
  }, [justEnded]);

  useEffect(() => () => { audioCtx.current?.close?.().catch(() => undefined); }, []);

  const setPreset = (sec: number) => start(sec);
  const addTen = () => {
    if (running) {
      endAtRef.current += 10_000;
      targetRef.current += 10;
      setTarget(t => t + 10);
      remainingRef.current += 10;
      setDisplaySec(Math.ceil(remainingRef.current));
      paint();
    } else {
      start(remainingRef.current + 10, targetRef.current + 10);
    }
  };
  const reset = () => {
    setRunning(false);
    setDone(false);
    setJustEnded(false);
    remainingRef.current = targetRef.current;
    setDisplaySec(targetRef.current);
    paint();
  };

  const scrollToRing = () => {
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const pill = usePresence((running || justEnded) && !inView && !suppressPill, 180);

  return (
    <section ref={rootRef} className={`ae-timer ${running ? 'is-running' : ''} ${done ? 'is-done' : ''}`.trim()}>
      <div className="ae-timer-head">
        <span className="ae-step-label">
          <Timer size={11} className="ae-timer-head-ico" />
          {done ? 'WAKTUNYA SET BERIKUTNYA' : 'REST TIMER'}
        </span>
        <button className="ae-timer-close" onClick={reset} aria-label="Reset timer" type="button">
          <RotateCcw size={13} />
        </button>
      </div>
      <div className="ae-timer-body">
        <div className="ae-timer-ring">
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
            <defs>
              <linearGradient id="rt-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#67E8F9" />
                <stop offset="100%" stopColor="#3B82F6" />
              </linearGradient>
            </defs>
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="rgba(34, 211, 238, 0.1)" strokeWidth="6" />
            {/* Static glow underlay instead of a per-frame drop-shadow filter. */}
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="rgba(34, 211, 238, 0.14)" strokeWidth="11" />
            <circle ref={ringRef} className="ae-timer-arc" cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none"
              stroke="url(#rt-grad)" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={C}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`} />
          </svg>
          <div className="ae-timer-center" role="timer" aria-live="off">
            <div className="ae-timer-sec tnum">{displaySec}</div>
            <div className="ae-timer-unit">DETIK</div>
          </div>
          {running && <div className="ae-timer-pulse" />}
        </div>
        <div className="ae-timer-presets">
          {PRESETS.map((s) => (
            <button key={s} type="button"
              className={`ae-timer-preset ${target === s ? 'is-on' : ''}`}
              onClick={() => setPreset(s)}>{s}s</button>
          ))}
          <button type="button" className="ae-timer-preset ae-timer-add" onClick={addTen}>+10s</button>
        </div>
      </div>

      {pill.mounted && typeof document !== 'undefined' && createPortal(
        <button type="button" className={`ae-rest-pill ${running ? '' : 'is-done'}`.trim()}
          data-state={pill.state} onClick={scrollToRing}
          aria-label={running ? `Istirahat ${fmt(displaySec)} tersisa — lihat timer` : 'Waktu istirahat habis — lihat timer'}>
          <Timer size={13} />
          {running
            ? <><span className="tnum">{fmt(displaySec)}</span><span className="ae-rest-pill-lbl">ISTIRAHAT</span></>
            : <span className="ae-rest-pill-lbl">WAKTUNYA SET!</span>}
        </button>,
        document.body,
      )}
    </section>
  );
});

export default RestTimerRing;
