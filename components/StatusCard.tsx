import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Swords, Sparkles, Activity, Crown, Flame, Radio } from 'lucide-react';
import {
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer,
} from 'recharts';
import { GymProfile, WorkoutLog } from '../types';
import { FatigueReport } from '../services/fatigueService';
import { getRankForLevel } from '../services/gamificationService';
import {
    calculateAttributes, getJobClass, getRankProgress,
} from '../services/attributeService';

// ═══════════════════════════════════════════════════════════════════════════
// STATUS CARD — replaces StatusWindowModal with an inline card on the
// Dashboard. Collapsed view keeps the highest-signal identity cues; expanded
// view (toggled by the chevron) reveals the full attributes / Power Signature
// radar / combat stats / rank progress migrated over from the old modal.
//
// Things deliberately NOT in this card (live elsewhere on the Dashboard or
// in Profile, surfaced once not twice):
//   - Lifetime XP shimmer bar  → existing streak/XP card on Dashboard
//   - Fatigue radar (per-muscle) → muscle recovery card on Dashboard
//   - Achievements snapshot     → Profile gallery
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
    gymProfile: GymProfile;
    workouts: WorkoutLog[];
    fatigue: FatigueReport;
    displayName?: string;
}

export const StatusCard: React.FC<Props> = ({ gymProfile, workouts, fatigue }) => {
    const [expanded, setExpanded] = useState(false);

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

    return (
        <div className="relative jarvis-card rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/40 overflow-hidden">
            {/* Ambient glow */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between px-4 pt-3 pb-2 border-b border-slate-800/60">
                <div className="flex items-center gap-2">
                    <Swords size={12} className="text-cyan-400" />
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-cyan-400/80">
                        Hunter Status
                    </span>
                </div>
                <button
                    onClick={() => setExpanded(e => !e)}
                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
                    aria-label={expanded ? 'Collapse' : 'Expand'}
                    aria-expanded={expanded}
                >
                    {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
            </div>

            {/* Always-visible body */}
            <div className="relative z-10 px-4 py-3 space-y-3">
                {/* Identity row */}
                <div className="flex items-center gap-3">
                    <div className={`text-3xl ${rank.color} drop-shadow-[0_0_6px_currentColor]`}>
                        {rank.emoji}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-base font-bold text-white font-mono">Lv.{level}</span>
                            <span className={`text-xs font-mono ${rank.color}`}>{rank.name}</span>
                        </div>
                        <p className="text-[11px] font-mono text-cyan-300 truncate">
                            {jobClass}
                        </p>
                    </div>
                </div>

                {/* Top 3 attributes */}
                <div className="space-y-1.5">
                    {topThree.map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-cyan-400/80 w-7">{key}</span>
                            <div className="flex-1 h-1.5 bg-slate-900 border border-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-700"
                                    style={{ width: `${value}%` }}
                                />
                            </div>
                            <span className="text-xs font-mono text-white w-7 text-right">{value}</span>
                        </div>
                    ))}
                </div>

                {/* Fatigue */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                        Fatigue
                    </span>
                    <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-bold font-mono ${fatigue.color}`}>
                            {fatigue.score}
                        </span>
                        <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: fatigue.accent, boxShadow: `0 0 6px ${fatigue.accent}` }}
                            aria-label={fatigue.label}
                        />
                    </div>
                </div>
            </div>

            {/* Expanded body */}
            {expanded && (
                <div className="relative z-10 px-4 pb-4 max-h-96 overflow-y-auto custom-scrollbar space-y-3 animate-slide-up">
                    {/* Full attribute grid */}
                    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
                        <div className="flex items-center gap-2 mb-2.5">
                            <Swords size={12} className="text-cyan-400" />
                            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                                Attributes
                            </span>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                            {(Object.entries(attributes) as [string, number][]).map(([key, value]) => (
                                <div key={key} className="bg-slate-900/60 border border-slate-800 rounded-lg py-2 text-center">
                                    <div className="text-[9px] font-mono uppercase tracking-wider text-cyan-400/80">{key}</div>
                                    <div className="text-base font-bold font-mono text-white mt-0.5">{value}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Power Signature radar */}
                    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles size={12} className="text-purple-400" />
                            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                                Power Signature
                            </span>
                        </div>
                        <ResponsiveContainer width="100%" height={200}>
                            <RadarChart data={radarData} outerRadius="75%">
                                <PolarGrid stroke="#1e293b" />
                                <PolarAngleAxis
                                    dataKey="stat"
                                    tick={{ fill: '#a78bfa', fontSize: 10, fontFamily: 'monospace' }}
                                />
                                <PolarRadiusAxis
                                    angle={90}
                                    domain={[0, 100]}
                                    tick={{ fill: '#475569', fontSize: 8 }}
                                    stroke="#1e293b"
                                />
                                <Radar
                                    name="Attribute"
                                    dataKey="value"
                                    stroke="#a78bfa"
                                    fill="#a78bfa"
                                    fillOpacity={0.35}
                                    strokeWidth={2}
                                />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Combat Stats */}
                    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
                        <div className="flex items-center gap-2 mb-2.5">
                            <Activity size={12} className="text-cyan-400" />
                            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                                Combat Stats
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <CombatStat label="Workouts" value={(gymProfile.workoutsCompleted || 0).toLocaleString()} />
                            <CombatStat label="Sets" value={(gymProfile.totalSetsCompleted || 0).toLocaleString()} />
                            <CombatStat label="XP" value={(gymProfile.totalXP || 0).toLocaleString()} accent="text-cyan-300" />
                            <CombatStat
                                label="Best Streak"
                                value={String(gymProfile.longestStreak ?? 0)}
                                accent="text-orange-300"
                                icon={<Flame size={11} className="text-orange-400" />}
                            />
                        </div>
                    </div>

                    {/* Rank Progress */}
                    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Crown size={12} className="text-amber-400" />
                            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                                Rank Progress
                            </span>
                        </div>
                        <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-xs font-mono font-bold ${rank.color}`}>{rankProgress.current}</span>
                            <span className="text-xs font-mono text-slate-500">{rankProgress.next}</span>
                        </div>
                        <div className="relative h-2 bg-slate-950 border border-slate-800 rounded-full overflow-hidden">
                            <div
                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-700"
                                style={{ width: `${rankProgress.progressPercent}%`, boxShadow: '0 0 10px rgba(139,92,246,0.5)' }}
                            />
                        </div>
                        <p className="text-[9px] font-mono text-slate-500 text-center mt-1.5">
                            {rankProgress.next === 'MAX'
                                ? 'MAX RANK ACHIEVED'
                                : `${rankProgress.levelsToNext} ${rankProgress.levelsToNext === 1 ? 'level' : 'levels'} to ${rankProgress.next}`}
                        </p>
                    </div>

                    {/* SYSTEM ONLINE • REC footer */}
                    <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 pt-1 px-1">
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
    );
};

const CombatStat: React.FC<{
    label: string;
    value: string;
    accent?: string;
    icon?: React.ReactNode;
}> = ({ label, value, accent = 'text-white', icon }) => (
    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2 text-center">
        <div className="text-[9px] font-mono uppercase tracking-wider text-slate-500">{label}</div>
        <div className={`text-sm font-bold font-mono flex items-center justify-center gap-1 ${accent}`}>
            {icon}
            {value}
        </div>
    </div>
);
