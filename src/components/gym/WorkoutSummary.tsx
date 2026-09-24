import React, { useEffect, useRef, useState } from 'react';
import { Dumbbell, Layers, Weight } from 'lucide-react';
import HudDialog from '../hud/HudDialog';
import CountUp from '../hud/CountUp';
import { StreakFlame, StreakNumber } from '../streak';
import { prefersReducedMotion } from '../../hooks/usePresence';

// ─────────────────────────────────────────────────────────────────────────
// WorkoutSummary — the reward moment after "Selesai".
//
// A bottom sheet (shared HudDialog) that counts the earned XP up, fills the
// level bar from where it was to where it is now — through a LEVEL UP flash
// when a level was crossed, instead of the header bar visibly shrinking —
// and rolls the workout streak forward with the shared flame burst.
//
// Pure presentation: every number is computed by GymTracker from values the
// save flow already produced; nothing here touches XP or storage. The
// animated parts are child components so they (re)mount with the sheet and
// start from the pre-workout values every time it opens.
// ─────────────────────────────────────────────────────────────────────────

export interface WorkoutSummaryData {
  xp: number;
  exercises: number;
  sets: number;
  volume: number;
  fromLevel: number;
  toLevel: number;
  /** Within-level progress, 0–1. */
  fromPct: number;
  toPct: number;
  /** Progress inside the new level, after this workout. */
  toCurrent: number;
  toNeeded: number;
  fromRank: string;
  toRank: string;
  fromStreak: number;
  toStreak: number;
}

const fmtID = (v: number) => Math.round(v).toLocaleString('id-ID');
const EASE_OUT_EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)';
const EASE_IN_OUT = 'cubic-bezier(0.65, 0, 0.35, 1)';

// ── Level bar: from → to, or from → full → LEVEL UP → 0 → to ──
const SummaryLevel: React.FC<{ data: WorkoutSummaryData }> = ({ data }) => {
  const barRef = useRef<HTMLDivElement>(null);
  const crossed = data.toLevel > data.fromLevel;
  const [leveled, setLeveled] = useState(false);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const setScale = (p: number) => { bar.style.transform = `scaleX(${p})`; };

    if (prefersReducedMotion() || typeof bar.animate !== 'function') {
      setScale(data.toPct);
      setLeveled(crossed);
      return;
    }

    const timers: number[] = [];
    const anims: Animation[] = [];
    let cancelled = false;
    // The inline style holds the end value; the WAAPI run plays over it, so
    // the bar keeps its final width without `fill: forwards`.
    const play = (from: number, to: number, duration: number, easing: string) =>
      new Promise<void>(resolve => {
        const a = bar.animate([{ transform: `scaleX(${from})` }, { transform: `scaleX(${to})` }], { duration, easing });
        anims.push(a);
        setScale(to);
        a.onfinish = () => resolve();
        a.oncancel = () => resolve();
      });
    const wait = (ms: number) => new Promise<void>(resolve => { timers.push(window.setTimeout(resolve, ms)); });

    setScale(data.fromPct);
    (async () => {
      await wait(320); // let the sheet land first
      if (cancelled) return;
      if (crossed) {
        await play(data.fromPct, 1, 620, EASE_IN_OUT);
        if (cancelled) return;
        setLeveled(true);
        try { navigator.vibrate?.([30, 50, 30]); } catch { /* unsupported */ }
        await wait(260);
        if (cancelled) return;
        await play(0, data.toPct, 760, EASE_OUT_EXPO);
      } else {
        await play(data.fromPct, data.toPct, 900, EASE_OUT_EXPO);
      }
    })();

    return () => {
      cancelled = true;
      timers.forEach(t => window.clearTimeout(t));
      anims.forEach(a => a.cancel());
    };
  }, [data, crossed]);

  const rankUp = data.toRank !== data.fromRank;
  return (
    <div className="ws-level">
      <div className="ws-level-row">
        <span className="ws-level-lv">
          Lv.<span key={leveled ? 'to' : 'from'} className="ws-level-val tnum">{leveled ? data.toLevel : data.fromLevel}</span>
        </span>
        {leveled && <span className="ws-lvup">LEVEL UP{rankUp ? ` · ${data.toRank.toUpperCase()}` : ''}</span>}
      </div>
      <div className="ws-bar"><div ref={barRef} className="ws-bar-fill" /></div>
      <div className="ws-level-meta tnum">
        {fmtID(data.toCurrent)} / {fmtID(data.toNeeded)} XP menuju Lv.{data.toLevel + 1}
      </div>
    </div>
  );
};

// ── Streak chip: mounts on the old streak, then rolls forward (burst) ──
const SummaryStreak: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? to : from));
  useEffect(() => {
    if (shown === to) return;
    const t = window.setTimeout(() => setShown(to), 900);
    return () => window.clearTimeout(t);
  }, [shown, to]);
  return (
    <div className="ws-streak reveal" style={{ ['--reveal-i' as string]: 5 }}>
      <StreakFlame streak={shown} size={22} />
      <span className="ws-streak-txt">
        <StreakNumber value={shown} className="ws-streak-num" /> hari berturut-turut
      </span>
    </div>
  );
};

export const WorkoutSummary: React.FC<{
  open: boolean;
  data: WorkoutSummaryData | null;
  onClose: () => void;
}> = ({ open, data, onClose }) => {
  useEffect(() => {
    if (!open) return;
    try { navigator.vibrate?.([20, 40, 20]); } catch { /* unsupported */ }
  }, [open]);

  if (!data) return null;

  return (
    <HudDialog
      open={open}
      onClose={onClose}
      variant="sheet"
      tone="green"
      title="Workout Selesai"
      subtitle={`Sesi tercatat · ${data.exercises} latihan`}
      className="ws-panel"
      footer={
        <button type="button" className="hd-btn hd-btn--primary" onClick={onClose}>
          Lanjut
        </button>
      }
    >
      <div className="ws-xp" aria-label={`${data.xp} XP didapat`}>
        <span className="ws-xp-plus">+</span>
        <CountUp value={data.xp} duration={1100} format={fmtID} className="ws-xp-num" />
        <span className="ws-xp-unit">XP</span>
      </div>

      <SummaryLevel data={data} />

      <div className="ws-stats">
        <div className="ws-stat reveal" style={{ ['--reveal-i' as string]: 2 }}>
          <Dumbbell size={14} className="ws-stat-ico" />
          <CountUp value={data.exercises} duration={600} className="ws-stat-val" />
          <span className="ws-stat-lbl">Latihan</span>
        </div>
        <div className="ws-stat reveal" style={{ ['--reveal-i' as string]: 3 }}>
          <Layers size={14} className="ws-stat-ico" />
          <CountUp value={data.sets} duration={700} className="ws-stat-val" />
          <span className="ws-stat-lbl">Set</span>
        </div>
        <div className="ws-stat reveal" style={{ ['--reveal-i' as string]: 4 }}>
          <Weight size={14} className="ws-stat-ico" />
          <CountUp value={data.volume} duration={900} format={fmtID} className="ws-stat-val" />
          <span className="ws-stat-lbl">Volume kg</span>
        </div>
      </div>

      {data.toStreak > 0 && <SummaryStreak from={data.fromStreak} to={data.toStreak} />}
    </HudDialog>
  );
};

export default WorkoutSummary;
