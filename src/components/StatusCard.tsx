import React, { memo, useId, useMemo, useState } from 'react';
import { ChevronDown, Swords, Sparkles, Activity, Crown, Radio } from 'lucide-react';
import {
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer,
} from 'recharts';
import { GymProfile, WorkoutLog } from '../types';
import { FatigueReport } from '../services/fatigueService';
import { getRankForLevel } from '../services/gamificationService';
import {
    calculateAttributes, getJobClass, getRankProgress,
} from '../services/attributeService';
import { MUSCLE_GROUP_CONFIG } from '../config/constants';
import { RankBadge, rankFromTierName, CountUp } from './hud';
import { StreakFlame } from './streak/StreakFlame';
import { StreakNumber } from './streak/StreakNumber';
import { liveWorkoutStreak } from '../utils/liveStreak';
import { getTodayString } from '../utils/dateUtils';
import { prefersReducedMotion } from '../hooks/usePresence';

// ═══════════════════════════════════════════════════════════════════════════
// STATUS CARD — replaces StatusWindowModal with an inline card on the
// Dashboard. Collapsed view keeps the highest-signal identity cues (rank,
// level, live workout streak, top attributes, fatigue); the expanded view
// (whole header row is the toggle) reveals the full attributes / Power
// Signature radar / combat stats / rank progress.
//
// Things deliberately NOT in this card (live elsewhere on the Dashboard or
// in Profile, surfaced once not twice):
//   - Lifetime XP shimmer bar  → existing streak/XP card on Dashboard
//   - Fatigue radar (per-muscle) → muscle recovery card on Dashboard
//   - Achievements snapshot     → Profile gallery
//
// Performance: the Dashboard re-renders every second (clock tick) and
// recomputes `fatigue` into a fresh object each time, so the card is memoized
// on a fatigue *signature* — it only re-renders when something it shows
// actually changes. The expanded body mounts lazily on first open and then
// stays mounted, collapsing with a grid-rows transition instead of snapping.
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
    gymProfile: GymProfile;
    workouts: WorkoutLog[];
    fatigue: FatigueReport;
    displayName?: string;
    /**
     * Local 'YYYY-MM-DD' from the host's clock. The live streak and the
     * at-risk flame depend on today's date, and the memo below would
     * otherwise keep showing yesterday's values past midnight.
     */
    today?: string;
}

const fmtId = (v: number) => Math.round(v).toLocaleString('id-ID');

const topRecovering = (f: FatigueReport) =>
    [...f.perMuscle]
        .filter(m => m.fatigue > 5)
        .sort((a, b) => b.fatigue - a.fatigue)
        .slice(0, 3);

const StatusCardImpl: React.FC<Props> = ({ gymProfile, workouts, fatigue, today: todayProp }) => {
    const [expanded, setExpanded] = useState(false);
    // Bumped on every open: lazily mounts the body the first time and keys
    // the radar so its grow animation replays once per open (not per tick).
    const [openCount, setOpenCount] = useState(0);
    const bodyId = useId();

    const toggle = () => {
        if (!expanded) setOpenCount(c => c + 1);
        setExpanded(e => !e);
    };

    const level = gymProfile.level || 1;
    const rank = getRankForLevel(level);

    const attributes = useMemo(
        () => calculateAttributes(gymProfile, workouts),
        [gymProfile, workouts],
    );
    const jobClass = useMemo(
        () => getJobClass(rank.name, attributes),
        [rank.name, attributes],
    );
    const rankProgress = useMemo(() => getRankProgress(level), [level]);

    const radarData = useMemo(
        () =>
            (Object.entries(attributes) as [keyof typeof attributes, number][]).map(
                ([stat, value]) => ({ stat, value }),
            ),
        [attributes],
    );

    // Top 3 attributes for the always-visible compact view (sorted by value).
    const topThree = useMemo(() => {
        const entries = Object.entries(attributes) as [string, number][];
        return entries.sort((a, b) => b[1] - a[1]).slice(0, 3);
    }, [attributes]);

    // Live workout streak (counts freeze-token days); the stored
    // profile.currentStreak goes stale after a lapse. Display-only.
    const liveStreak = useMemo(
        () => liveWorkoutStreak(workouts, gymProfile),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only the protected dates (and the day) matter
        [workouts, gymProfile.tokenProtectedDates, todayProp],
    );
    const today = todayProp ?? getTodayString();
    const trainedToday = useMemo(() => workouts.some(w => w.date === today), [workouts, today]);
    const bestStreak = Math.max(gymProfile.longestStreak ?? 0, liveStreak);

    const recovering = topRecovering(fatigue);

    return (
        <section className="card card-cyan stc">
            {/* Header — the whole row toggles (44px target, not a 22px chevron) */}
            <button
                type="button"
                className="stc-toggle"
                onClick={toggle}
                aria-expanded={expanded}
                aria-controls={bodyId}
            >
                <span className="card-head-icon"><Swords size={13} /></span>
                <span className="hud-label">Hunter Status</span>
                <span className="stc-toggle-hint">{expanded ? 'Tutup' : 'Detail'}</span>
                <ChevronDown size={16} className={`stc-chev ${expanded ? 'is-open' : ''}`} aria-hidden="true" />
            </button>

            {/* Always-visible body */}
            <div className="stc-main">
                {/* Identity row */}
                <div className="stc-identity">
                    <RankBadge
                        rank={rankFromTierName(rank.name)}
                        size="md"
                        variant="compact"
                        isCurrent
                    />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                            <span className="stc-level">Lv.<CountUp value={level} duration={700} /></span>
                            <span className={`text-xs font-mono ${rank.color}`}>{rank.name}</span>
                        </div>
                        <p className="stc-job">{jobClass}</p>
                    </div>
                    <div className={`stc-streak ${liveStreak > 0 ? '' : 'is-cold'}`}>
                        <span className="pf-sr">Streak latihan {liveStreak} hari</span>
                        {/* celebrate off: the Dashboard's own streak surfaces
                            play the burst; this compact chip only rolls. */}
                        <StreakFlame
                            streak={liveStreak}
                            size={18}
                            atRisk={liveStreak > 0 && !trainedToday}
                            celebrate={false}
                        />
                        <span className="stc-streak-num" aria-hidden="true">
                            <StreakNumber value={liveStreak} />
                            <span className="stc-streak-unit">hari</span>
                        </span>
                    </div>
                </div>

                {/* Top 3 attributes — bars charge on mount, staggered */}
                <div className="stc-attrs">
                    {topThree.map(([key, value], idx) => (
                        <div key={key} className="stc-attr">
                            <span className="stc-attr-key">{key}</span>
                            <div className="stc-attr-track">
                                <div
                                    className="stc-attr-fill pf-grow"
                                    style={{ width: `${value}%`, '--bar-delay': `${160 + idx * 70}ms` } as React.CSSProperties}
                                />
                            </div>
                            <CountUp value={value} duration={700} className="stc-attr-val" />
                        </div>
                    ))}
                </div>

                {/* Fatigue */}
                <div className="stc-fatigue">
                    <div className="flex items-center justify-between">
                        <span className="hud-label-sm">Fatigue</span>
                        <div className="flex items-center gap-1.5">
                            <span className={`text-sm font-bold font-mono tnum ${fatigue.color}`}>
                                {fatigue.score}
                            </span>
                            <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: fatigue.accent, boxShadow: `0 0 6px ${fatigue.accent}` }}
                                aria-label={fatigue.label}
                            />
                        </div>
                    </div>
                    {fatigue.recoveringCount > 0 && (
                        <p className="stc-fatigue-note">
                            {fatigue.recoveringCount} dari {fatigue.totalMuscles} otot sedang pulih · {fatigue.recoveringPercent}%
                        </p>
                    )}
                </div>
            </div>

            {/* Expanded body — grid-rows collapse; flows in the page scroller
                (no nested 384px scroll box). Inert while closed. */}
            <div id={bodyId} className="pf-collapse" data-open={expanded} inert={!expanded}>
                <div className="pf-collapse-inner">
                    {openCount > 0 && (
                        <div className="stc-body">
                            {/* Full attribute grid */}
                            <div className="stc-sub" style={{ '--i': 0 } as React.CSSProperties}>
                                <div className="stc-sub-head">
                                    <Swords size={12} className="text-cyan-400" />
                                    <span className="hud-label-sm">Attributes</span>
                                </div>
                                <div className="grid grid-cols-5 gap-2">
                                    {(Object.entries(attributes) as [string, number][]).map(([key, value]) => (
                                        <div key={key} className="stc-cell text-center">
                                            <div className="stc-cell-key">{key}</div>
                                            <CountUp value={value} duration={700} className="stc-cell-val" />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Power Signature radar */}
                            <div className="stc-sub" style={{ '--i': 1 } as React.CSSProperties}>
                                <div className="stc-sub-head">
                                    <Sparkles size={12} className="text-purple-400" />
                                    <span className="hud-label-sm">Power Signature</span>
                                </div>
                                <PowerSignature data={radarData} replayKey={openCount} />
                            </div>

                            {/* Combat Stats */}
                            <div className="stc-sub" style={{ '--i': 2 } as React.CSSProperties}>
                                <div className="stc-sub-head">
                                    <Activity size={12} className="text-cyan-400" />
                                    <span className="hud-label-sm">Combat Stats</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <CombatStat label="Workouts" value={gymProfile.workoutsCompleted || 0} />
                                    <CombatStat label="Sets" value={gymProfile.totalSetsCompleted || 0} />
                                    <CombatStat label="XP" value={gymProfile.totalXP || 0} accent="text-cyan-300" />
                                    <CombatStat
                                        label="Best Streak"
                                        value={bestStreak}
                                        accent="text-orange-300"
                                        icon={<StreakFlame streak={bestStreak} size={13} celebrate={false} />}
                                    />
                                </div>
                            </div>

                            {/* Recovering — top 3 most-fatigued muscles. Skipped
                                entirely when nothing is recovering (clean fresh state). */}
                            {recovering.length > 0 && (
                                <div className="stc-sub" style={{ '--i': 3 } as React.CSSProperties}>
                                    <div className="stc-sub-head">
                                        <Activity size={12} className="text-amber-400" />
                                        <span className="hud-label-sm">Recovering</span>
                                    </div>
                                    <div className="space-y-1.5">
                                        {recovering.map(m => (
                                            <div key={m.muscle} className="flex items-center justify-between text-xs font-mono">
                                                <span className="text-slate-300 capitalize">
                                                    {MUSCLE_GROUP_CONFIG[m.muscle]?.label || m.muscle}
                                                </span>
                                                <span className="text-amber-400 tnum">{Math.round(m.fatigue)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Rank Progress */}
                            <div className="stc-sub" style={{ '--i': 4 } as React.CSSProperties}>
                                <div className="stc-sub-head">
                                    <Crown size={12} className="text-amber-400" />
                                    <span className="hud-label-sm">Rank Progress</span>
                                </div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className={`text-xs font-mono font-bold ${rank.color}`}>{rankProgress.current}</span>
                                    <span className="text-xs font-mono text-slate-500">{rankProgress.next}</span>
                                </div>
                                <div className="stc-rank-track">
                                    <div
                                        className="stc-rank-fill pf-grow"
                                        style={{ width: `${rankProgress.progressPercent}%`, '--bar-delay': '360ms' } as React.CSSProperties}
                                    />
                                </div>
                                <p className="text-[9px] font-mono text-slate-500 text-center mt-1.5">
                                    {rankProgress.next === 'MAX'
                                        ? 'MAX RANK ACHIEVED'
                                        : `${rankProgress.levelsToNext} level lagi ke ${rankProgress.next}`}
                                </p>
                            </div>

                            {/* SYSTEM ONLINE • REC footer */}
                            <div className="stc-sub-foot" style={{ '--i': 5 } as React.CSSProperties}>
                                <span className="flex items-center gap-1.5">
                                    <Radio size={10} className="text-cyan-400" />
                                    <span className="tracking-widest uppercase">System Online</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                    <span className="tracking-widest uppercase">Rec</span>
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

// Radar in its own memo: only re-renders when the attribute data or the
// open count changes. `key={replayKey}` replays the grow once per open.
// recharts 3's `isAnimationActive: 'auto'` ignores prefers-reduced-motion,
// so it's checked explicitly.
const PowerSignature = memo(function PowerSignature({
    data, replayKey,
}: { data: { stat: string; value: number }[]; replayKey: number }) {
    return (
        <ResponsiveContainer width="100%" height={200}>
            <RadarChart key={replayKey} data={data} outerRadius="75%">
                <PolarGrid stroke="rgba(148, 163, 184, 0.14)" />
                <PolarAngleAxis
                    dataKey="stat"
                    tick={{ fill: '#a78bfa', fontSize: 10, fontFamily: 'monospace' }}
                />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                    name="Attribute"
                    dataKey="value"
                    stroke="#a78bfa"
                    fill="#a78bfa"
                    fillOpacity={0.35}
                    strokeWidth={2}
                    isAnimationActive={!prefersReducedMotion()}
                    animationBegin={140}
                    animationDuration={750}
                    animationEasing="ease-out"
                />
            </RadarChart>
        </ResponsiveContainer>
    );
});

const CombatStat: React.FC<{
    label: string;
    value: number;
    accent?: string;
    icon?: React.ReactNode;
}> = ({ label, value, accent = 'text-white', icon }) => (
    <div className="stc-cell p-2 text-center">
        <div className="stc-cell-label">{label}</div>
        <div className={`text-sm font-bold font-mono flex items-center justify-center gap-1 ${accent}`}>
            {icon}
            <CountUp value={value} duration={800} format={fmtId} />
        </div>
    </div>
);

// What the card actually shows from the (per-second) fatigue report.
const fatigueSignature = (f: FatigueReport): string =>
    `${f.score}|${f.label}|${f.recoveringCount}|${f.totalMuscles}|${f.recoveringPercent}|` +
    topRecovering(f).map(m => `${m.muscle}:${Math.round(m.fatigue)}`).join(',');

export const StatusCard = memo(
    StatusCardImpl,
    (prev, next) =>
        prev.gymProfile === next.gymProfile &&
        prev.workouts === next.workouts &&
        prev.displayName === next.displayName &&
        prev.today === next.today &&
        fatigueSignature(prev.fatigue) === fatigueSignature(next.fatigue),
);
