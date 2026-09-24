import { memo, useEffect, useRef, useState } from 'react';
import { getRecoveryHours, MuscleGroup, WorkoutLog } from '../../types';
import { MUSCLE_GROUP_CONFIG } from '../../config/constants';
import { prefersReducedMotion } from '../../hooks/usePresence';

// ─────────────────────────────────────────────────────────────────────────
// RecoveryCountdown — the per-muscle "SEDANG PULIH" rows on the Dashboard.
//
// This is the only thing on the Dashboard that needs second resolution, so
// it owns the 1s tick itself (aligned to the wall-clock second, running only
// while something is recovering and the tab is visible). The page above it
// runs on a coarse minute clock and is told via `onSetChange` when a muscle
// leaves the recovering set, so the body map / ready chips flip in sync.
// Bars move with a 1s linear `transform` (compositor) instead of `width`.
// ─────────────────────────────────────────────────────────────────────────

export interface RecoveringMuscle {
  muscle: MuscleGroup;
  hoursLeft: number;
  minutesLeft: number;
  secondsLeft: number;
}

// Get muscles currently recovering based on workout history.
// Phase 9: gender modifier — Female users recover ~18% faster.
// (Moved verbatim from Dashboard.tsx so the countdown and the page share it.)
export function getRecoveringMuscles(
  workouts: WorkoutLog[],
  nowMs: number,
  gender?: 'Male' | 'Female',
): RecoveringMuscle[] {
  const recovering: RecoveringMuscle[] = [];
  const seen = new Set<MuscleGroup>();

  for (const w of workouts) {
    const workoutTime = w.timestamp
      ? new Date(w.timestamp).getTime()
      : new Date(w.date + 'T12:00:00').getTime();

    if (isNaN(workoutTime)) continue;

    const msSince = nowMs - workoutTime;
    if (msSince < 0) continue;

    const muscles: MuscleGroup[] = w.muscleGroups && w.muscleGroups?.length > 0
      ? w.muscleGroups
      : [];

    for (const m of muscles) {
      if (seen.has(m)) continue;
      const recoveryH = getRecoveryHours(m, gender);
      const recoveryMs = recoveryH * 60 * 60 * 1000;

      if (msSince < recoveryMs) {
        const msLeft = recoveryMs - msSince;
        const totalSecondsLeft = Math.floor(msLeft / 1000);
        const hoursLeft = Math.floor(totalSecondsLeft / 3600);
        const minutesLeft = Math.floor((totalSecondsLeft % 3600) / 60);
        const secondsLeft = totalSecondsLeft % 60;

        if (totalSecondsLeft > 0) {
          recovering.push({ muscle: m, hoursLeft, minutesLeft, secondsLeft });
          seen.add(m);
        }
      }
    }
  }
  return recovering;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const muscleLabel = (m: MuscleGroup) => MUSCLE_GROUP_CONFIG[m]?.label || m;

/** How long a just-recovered row lingers as "PULIH ✓" before collapsing. */
const DONE_HOLD_MS = 1600;

interface Props {
  workouts: WorkoutLog[];
  gender?: 'Male' | 'Female';
  /** A muscle left the recovering set — refresh anything derived from it. */
  onSetChange?: () => void;
}

export const RecoveryCountdown = memo(function RecoveryCountdown({ workouts, gender, onSetChange }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [done, setDone] = useState<MuscleGroup[]>([]);
  const onSetChangeRef = useRef(onSetChange);
  onSetChangeRef.current = onSetChange;

  const rows = getRecoveringMuscles(workouts, now, gender);
  const active = rows.length > 0;
  const muscleKey = rows.map(r => r.muscle).join('|');

  // New/removed workouts: re-read the clock so fresh sessions show up at once
  // (a stale `now` would treat a just-logged workout as "in the future").
  useEffect(() => { setNow(Date.now()); }, [workouts, gender]);

  // The 1s tick — second-aligned, only while counting, paused while hidden.
  useEffect(() => {
    if (!active) return;
    let t = 0;
    const schedule = () => {
      t = window.setTimeout(() => { setNow(Date.now()); schedule(); }, 1000 - (Date.now() % 1000) + 5);
    };
    const onVisibility = () => {
      window.clearTimeout(t);
      if (document.hidden) return;
      setNow(Date.now());
      schedule();
    };
    schedule();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [active]);

  // A muscle finished: tell the page, and hold its row briefly as "PULIH ✓".
  const prevMusclesRef = useRef<MuscleGroup[]>(rows.map(r => r.muscle));
  useEffect(() => {
    const current = muscleKey ? (muscleKey.split('|') as MuscleGroup[]) : [];
    const gone = prevMusclesRef.current.filter(m => !current.includes(m));
    prevMusclesRef.current = current;
    if (gone.length === 0) return;
    onSetChangeRef.current?.();
    if (prefersReducedMotion()) return;
    setDone(d => [...d.filter(m => !current.includes(m) && !gone.includes(m)), ...gone]);
  }, [muscleKey]);

  useEffect(() => {
    if (done.length === 0) return;
    const t = window.setTimeout(() => setDone([]), DONE_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [done]);

  // Stable display order: a finishing row stays where it was (same key)
  // while it turns green and collapses, instead of jumping to the end.
  const orderRef = useRef<MuscleGroup[]>([]);
  const rowByMuscle = new Map(rows.map(r => [r.muscle, r] as const));
  const doneVisible = done.filter(m => !rowByMuscle.has(m));
  const present = new Set<MuscleGroup>([...rowByMuscle.keys(), ...doneVisible]);
  const order = orderRef.current.filter(m => present.has(m));
  for (const m of present) if (!order.includes(m)) order.push(m);
  orderRef.current = order;

  if (order.length === 0) return null;

  return (
    <div className="d-rec">
      <div className="d-rec-head">
        <span className="d-rec-title">SEDANG PULIH</span>
        <span className="d-rec-count tnum">{rows.length} otot</span>
      </div>
      {order.map((m, idx) => {
        const d = rowByMuscle.get(m);
        if (!d) {
          return (
            <div key={m} className="d-rec-row is-near is-done" style={{ ['--p' as string]: 1, ['--i' as string]: idx }}>
              <span className="d-rec-name">{muscleLabel(m)}</span>
              <span className="d-rec-time">PULIH ✓</span>
              <span className="d-rec-track" aria-hidden="true"><span className="d-rec-fill" /></span>
            </div>
          );
        }
        const maxH = getRecoveryHours(d.muscle, gender);
        const totalSecsLeft = (d.hoursLeft * 3600) + (d.minutesLeft * 60) + (d.secondsLeft || 0);
        const pct = Math.max(0, Math.min(100, 100 - (totalSecsLeft / (maxH * 3600)) * 100));
        const nearlyDone = pct > 80;
        return (
          <div
            key={m}
            className={`d-rec-row${nearlyDone ? ' is-near' : ''}`}
            style={{ ['--p' as string]: (pct / 100).toFixed(4), ['--i' as string]: idx }}
          >
            <span className="d-rec-name">{muscleLabel(m)}</span>
            {/* Zero-padded HH:MM:SS so the right-aligned time never changes width. */}
            <span className="d-rec-time tnum" aria-label={`${d.hoursLeft} jam ${d.minutesLeft} menit lagi`}>
              {pad2(d.hoursLeft)}:{pad2(d.minutesLeft)}:{pad2(d.secondsLeft)}
            </span>
            <span className="d-rec-track" aria-hidden="true"><span className="d-rec-fill" /></span>
          </div>
        );
      })}
    </div>
  );
});

export default RecoveryCountdown;
