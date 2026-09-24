import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { GymProfile, MuscleGroup, WorkoutLog } from '../../types';
import { MUSCLE_GROUP_CONFIG } from '../../config/constants';
import CountUp from '../hud/CountUp';
import { useInViewPause } from '../../hooks/useInViewPause';
import { prefersReducedMotion } from '../../hooks/usePresence';
import { liveWorkoutStreak } from '../../utils/liveStreak';
import {
  ECGLine, HeartFire, HF_BEAT, STREAK_TIERS, StreakTierId, nextTier, tierById, tierFromDays,
} from './HeartFire';

// ─────────────────────────────────────────────────────────────────────────
// Gym Analytics tab — Heart-Fire workout streak, volume/XP trend, muscle XP.
//
// The streak shown here is LIVE (computed from the workout log with
// freeze-token days counted), not `profile.currentStreak`, which is only
// refreshed on save/sync and kept burning an old number after a lapse.
// ─────────────────────────────────────────────────────────────────────────

type TrendRange = 'weekly' | 'monthly' | 'yearly';
// HUD micro-labels, kept in the design's English shorthand.
const RANGE_LABEL: Record<TrendRange, string> = { weekly: '7D', monthly: '30D', yearly: '12M' };
const RANGES: TrendRange[] = ['weekly', 'monthly', 'yearly'];

const volumeOf = (l: WorkoutLog) => (l.exercises || []).reduce((s, e) => s + e.sets * e.reps * e.weight, 0);
const dayKey = (d: Date) => d.toLocaleDateString('en-CA'); // local YYYY-MM-DD (matches WorkoutLog.date)
const shortUpper = (s: string) => s.replace('.', '').toUpperCase();

const buildTrend = (logs: WorkoutLog[], range: TrendRange) => {
  const now = new Date();
  if (range === 'weekly' || range === 'monthly') {
    const days = range === 'weekly' ? 7 : 30;
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (days - 1 - i));
      const key = dayKey(d);
      const dayLogs = logs.filter(l => l.date === key);
      return {
        date: range === 'weekly'
          ? d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' })
          : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
        volume: dayLogs.reduce((s, l) => s + volumeOf(l), 0),
        xp: dayLogs.reduce((s, l) => s + (l.xpEarned || 0), 0),
      };
    });
  }
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthLogs = logs.filter(l => (l.date || '').startsWith(monthKey));
    return {
      date: d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
      volume: monthLogs.reduce((s, l) => s + volumeOf(l), 0),
      xp: monthLogs.reduce((s, l) => s + (l.xpEarned || 0), 0),
    };
  });
};

/** Axis ticks for the empty-chart placeholder, matching the selected range. */
const emptyAxis = (range: TrendRange): string[] => {
  const now = new Date();
  if (range === 'weekly') {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now); d.setDate(d.getDate() - (6 - i));
      return shortUpper(d.toLocaleDateString('id-ID', { weekday: 'short' })).slice(0, 3);
    });
  }
  if (range === 'monthly') {
    return [29, 22, 15, 8, 0].map(back => {
      const d = new Date(now); d.setDate(d.getDate() - back);
      return shortUpper(d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
    });
  }
  return [10, 8, 6, 4, 2, 0].map(back =>
    shortUpper(new Date(now.getFullYear(), now.getMonth() - back, 1).toLocaleDateString('id-ID', { month: 'short' })));
};

const compactKg = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v));

const StreakCard: React.FC<{ logs: WorkoutLog[]; profile: GymProfile }> = ({ logs, profile }) => {
  const streakDays = useMemo(() => liveWorkoutStreak(logs, profile), [logs, profile]);
  const longest = Math.max(profile.longestStreak ?? 0, streakDays);
  const current = tierFromDays(streakDays);
  const next = nextTier(current);

  // Tier preview (tap a roadmap mark to simulate its visuals). Follows the
  // real tier whenever that changes.
  const [previewTier, setPreviewTier] = useState<StreakTierId>(current.tier);
  useEffect(() => { setPreviewTier(current.tier); }, [current.tier]);
  const showTier = tierById(previewTier);

  // Pauses every infinite loop in the card (heart, ECG, roadmap glows) while
  // it is scrolled off screen — they were repainting at 60 fps unseen.
  const cardRef = useRef<HTMLElement>(null);
  useInViewPause(cardRef);

  return (
    <section ref={cardRef} className="card an-streak-card reveal" style={{ ['--reveal-i' as string]: 0 }}>
      <div className="an-streak-top">
        <div className="hud-label an-streak-label">WORKOUT STREAK</div>
        <div className="an-streak-tier-pill" style={{ borderColor: showTier.color, color: showTier.color }}>
          <span>TIER {showTier.tier}</span>
          <span className="an-streak-tier-name">{showTier.name}</span>
        </div>
      </div>

      <div className={`an-streak-stage ${showTier.tier === 0 ? 'is-padam' : ''}`.trim()}
        style={{ ['--hf-beat' as string]: HF_BEAT[showTier.tier] }}>
        <ECGLine />
        <HeartFire size={150} tier={showTier.tier} />
        {/* One-shot ring whenever the displayed tier changes (and on open). */}
        <span key={`burst-${showTier.tier}`} className="an-hf-burst" aria-hidden="true"
          style={{ ['--burst' as string]: showTier.color }} />
      </div>

      <div className="an-streak-day">
        <CountUp value={streakDays} duration={900} className="an-streak-num" />
        <span className="an-streak-unit">Hari</span>
      </div>
      <div className="an-streak-best">
        TERBAIK: <span className="fz-orange">{longest}H</span>
      </div>

      {next && (
        <div className="an-streak-next">
          <span className="an-streak-next-arrow">→</span>
          <span>{next.name} dalam</span>
          <strong style={{ color: next.color }}>{next.min - streakDays} hari</strong>
        </div>
      )}

      <div className="an-streak-roadmap">
        {STREAK_TIERS.map((t) => {
          const reached = streakDays >= t.min;
          const active = previewTier === t.tier;
          return (
            <button key={t.tier} type="button"
              className={`an-streak-rmark ${reached ? 'is-reached' : ''} ${active ? 'is-active' : ''}`}
              style={{ ['--rm-color' as string]: t.color }}
              onClick={() => setPreviewTier(t.tier)}
              aria-pressed={active}
              aria-label={`Pratinjau tier ${t.name}`}>
              <span className="an-streak-rmark-dot">
                <span className="an-streak-rmark-glow" />
              </span>
              <span className="an-streak-rmark-name">{t.name}</span>
              <span className="an-streak-rmark-day">
                {t.min >= 365 ? `${Math.floor(t.min / 365)}thn+`
                  : t.min >= 30 ? `${Math.floor(t.min / 30)}bln`
                  : `${t.min}h`}
              </span>
            </button>
          );
        })}
      </div>
      {previewTier !== current.tier && (
        <div className="an-streak-preview-hint">
          ⌬ PRATINJAU · ketuk tier untuk simulasi ·
          <button type="button" className="an-streak-preview-reset"
            onClick={() => setPreviewTier(current.tier)}>
            kembali ke tier kamu
          </button>
        </div>
      )}

      <p className="an-streak-quote">
        {streakDays > 0
          ? 'Jaga detak jantungmu menyala. Jangan biarkan rantai terputus.'
          : 'Mulai workout pertamamu untuk menyalakan bara.'}
      </p>
    </section>
  );
};

const TrendCard: React.FC<{ logs: WorkoutLog[] }> = ({ logs }) => {
  const [range, setRange] = useState<TrendRange>('weekly');
  const data = useMemo(() => buildTrend(logs || [], range), [logs, range]);
  const hasData = data.some(d => d.volume > 0 || d.xp > 0);
  const idx = RANGES.indexOf(range);
  const animate = !prefersReducedMotion();

  return (
    <section className="card reveal" style={{ ['--reveal-i' as string]: 1 }}>
      <div className="card-head">
        <span className="hud-label">VOLUME &amp; XP TREND</span>
        <div className="an-range" role="group" aria-label="Rentang tren">
          {RANGES.map(r => (
            <button key={r} type="button"
              className={`an-range-opt ${range === r ? 'is-on' : ''}`}
              aria-pressed={range === r}
              onClick={() => setRange(r)}>
              {RANGE_LABEL[r]}
            </button>
          ))}
          <div className="an-range-indicator" style={{ transform: `translateX(${idx * 100}%)` }} />
        </div>
      </div>

      <div className="an-chart">
        {hasData ? (
          <div className="an-chart-recharts">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 4, left: -6, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(34,211,238,0.08)" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={12} />
                {/* Volume (thousands of kg) and XP (tens) on separate axes —
                    on one shared axis the XP line lay flat on zero. */}
                <YAxis yAxisId="vol" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={36} tickFormatter={compactKg} />
                <YAxis yAxisId="xp" orientation="right" tick={{ fill: '#FB923C', fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={{ background: 'rgba(7,12,24,0.95)', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                <Line yAxisId="vol" type="monotone" dataKey="volume" stroke="#22D3EE" strokeWidth={2}
                  dot={range === 'weekly' ? { r: 3 } : false} activeDot={{ r: 4 }}
                  name="Volume (kg)" isAnimationActive={animate} animationDuration={600} />
                <Line yAxisId="xp" type="monotone" dataKey="xp" stroke="#FB923C" strokeWidth={2}
                  dot={range === 'weekly' ? { r: 3 } : false} activeDot={{ r: 4 }}
                  name="XP" isAnimationActive={animate} animationDuration={600} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <>
            <div className="an-chart-grid">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="an-chart-grid-line" />)}
            </div>
            <div className="an-chart-empty">
              <div className="an-chart-empty-icon">⌬</div>
              <div>BELUM ADA DATA · {RANGE_LABEL[range]}</div>
              <div className="an-chart-empty-sub">Catat satu sesi untuk mulai mengisi tren.</div>
            </div>
            <div className="an-chart-axis">
              {emptyAxis(range).map((d, i) => <span key={`${d}-${i}`}>{d}</span>)}
            </div>
          </>
        )}
      </div>
    </section>
  );
};

const MuscleXPCard: React.FC<{ profile: GymProfile }> = ({ profile }) => {
  const muscleXPMap = (profile?.muscleXP || {}) as Record<MuscleGroup, number>;
  const maxMuscleXP = Math.max(...(Object.values(muscleXPMap) as number[]), 1);
  const rows = (Object.entries(muscleXPMap) as [MuscleGroup, number][])
    .filter(([, xp]) => xp > 0)
    .sort((a, b) => b[1] - a[1]);
  return (
    <section className="card reveal" style={{ ['--reveal-i' as string]: 2 }}>
      <div className="card-head">
        <span className="hud-label">MUSCLE XP DISTRIBUTION</span>
      </div>
      <div className="an-mx-grid">
        {rows.length === 0 && (
          <p className="g-empty">Selesaikan workout untuk melihat XP tiap otot.</p>
        )}
        {rows.map(([muscle, xp], i) => {
          const cfg = MUSCLE_GROUP_CONFIG[muscle];
          const p = xp / maxMuscleXP;
          return (
            <div key={muscle} className="an-mx-row">
              <div className="an-mx-row-l">
                <div className="an-puck">
                  <img src={`/assets/muscles/${muscle}.webp`} alt="" className="an-puck-img"
                    loading="lazy" decoding="async"
                    onError={e => { e.currentTarget.style.display = 'none'; }} />
                </div>
                <span className="an-mx-name">{cfg?.label || muscle}</span>
              </div>
              <div className="an-mx-row-r">
                <div className="an-mx-bar">
                  <div className="an-mx-bar-fill" style={{ ['--p' as string]: p, ['--reveal-i' as string]: i }} />
                </div>
                <span className="an-mx-val tnum">{xp.toLocaleString('id-ID')}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export const GymAnalytics = memo(function GymAnalytics({
  logs, profile, dir,
}: { logs: WorkoutLog[]; profile: GymProfile; dir: 'fwd' | 'back' }) {
  return (
    <div className="g-tabbody g-tab-pane" data-dir={dir}>
      <div className="an-title-row">
        <span className="an-title-ico"><TrendingUp size={14} /></span>
        <h2 className="an-title">Analytics</h2>
      </div>
      <StreakCard logs={logs} profile={profile} />
      <TrendCard logs={logs} />
      <MuscleXPCard profile={profile} />
    </div>
  );
});

export default GymAnalytics;
