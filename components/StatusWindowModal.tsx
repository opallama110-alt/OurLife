import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer,
} from 'recharts';
import { Sparkles, X, Flame, Activity, ChevronRight, Trophy } from 'lucide-react';
import { GymProfile, WorkoutLog } from '../types';
import { FatigueReport } from '../services/fatigueService';
import {
    getRankForLevel, getTitleForLevel, getXPProgress, evaluateAchievements,
} from '../services/gamificationService';
import { MUSCLE_GROUP_CONFIG } from '../config/constants';

interface Props {
    gymProfile: GymProfile;
    workouts: WorkoutLog[];
    fatigue: FatigueReport;
    displayName: string;
}

/**
 * Solo Leveling Status Window — compact in-flow trigger that expands to a
 * full modal. Modal hosts the Radar Chart driven by per-muscle fatigue from
 * fatigueService, the Lifetime XP shimmer bar, and a snapshot of unlocked
 * achievements. Deliberately minimal on the trigger so it doesn't disturb
 * the dashboard's main flow.
 */
export const StatusWindowModal: React.FC<Props> = ({
    gymProfile,
    workouts,
    fatigue,
    displayName,
}) => {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();

    const totalXP = gymProfile.totalXP || 0;
    const level = gymProfile.level || 1;
    const rank = getRankForLevel(level);
    const title = getTitleForLevel(level);
    const progress = getXPProgress(totalXP);
    const streak = gymProfile.currentStreak ?? 0;

    const achievements = evaluateAchievements(workouts, gymProfile);
    const unlockedCount = achievements.filter(a => a.unlocked).length;

    // Build radar dataset — one ring per muscle group, fatigue 0–100.
    // Hidden when no recent stimulus so the radar stays readable.
    const radarData = fatigue.perMuscle
        .filter(m => isFinite(m.hoursSinceStimulus))
        .map(m => ({
            muscle: MUSCLE_GROUP_CONFIG[m.muscle]?.label || m.muscle,
            fatigue: m.fatigue,
        }));

    return (
        <>
            {/* ── Compact in-flow trigger ─────────────────────────────────── */}
            <button
                onClick={() => setOpen(true)}
                className="w-full group relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-gradient-to-r from-slate-900/80 via-slate-900 to-blue-950/60 px-4 py-3 shadow-lg shadow-cyan-500/5 hover:border-cyan-400/50 hover:shadow-cyan-500/15 transition-all"
            >
                <div className="absolute -top-12 -right-12 w-36 h-36 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`shrink-0 text-2xl ${rank.color} drop-shadow-[0_0_6px_currentColor]`}>
                            {rank.emoji}
                        </div>
                        <div className="min-w-0 text-left">
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-mono uppercase tracking-[0.25em] text-cyan-400/80">
                                    Status Window
                                </span>
                                <span className="text-[9px] font-mono text-slate-500">
                                    Lv.{level} · {totalXP.toLocaleString()} XP
                                </span>
                            </div>
                            <p className={`text-xs font-mono truncate ${title.color}`}>&ldquo;{title.title}&rdquo;</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        {/* Mini fatigue ring */}
                        <FatigueRing score={fatigue.score} accent={fatigue.accent} />
                        <ChevronRight size={14} className="text-cyan-400/70 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                </div>
            </button>

            {/* ── Modal ─────────────────────────────────────────────────── */}
            {open && (
                <div
                    className="fixed inset-0 z-[80] flex items-end md:items-center justify-center md:p-4"
                    onClick={() => setOpen(false)}
                >
                    <div className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-fade-in" />
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full md:max-w-lg md:rounded-3xl rounded-t-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 border-t md:border border-cyan-500/30 shadow-[0_-10px_60px_rgba(6,182,212,0.25)] md:shadow-[0_0_60px_rgba(6,182,212,0.2)] flex flex-col max-h-[92vh] md:max-h-[85vh] animate-slide-up overflow-hidden"
                    >
                        {/* Ambient glow */}
                        <div className="absolute -top-24 -right-24 w-72 h-72 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                        {/* Corner crosshair ornaments */}
                        <div className="absolute top-3 left-3 w-3 h-3 border-t border-l border-cyan-500/40 pointer-events-none z-20" />
                        <div className="absolute top-3 right-3 w-3 h-3 border-t border-r border-cyan-500/40 pointer-events-none z-20" />
                        <div className="absolute bottom-3 left-3 w-3 h-3 border-b border-l border-cyan-500/40 pointer-events-none z-20" />
                        <div className="absolute bottom-3 right-3 w-3 h-3 border-b border-r border-cyan-500/40 pointer-events-none z-20" />

                        {/* Header */}
                        <div className="relative z-10 flex items-start justify-between px-5 pt-5 pb-3 border-b border-slate-800/80">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={`text-4xl ${rank.color} drop-shadow-[0_0_10px_currentColor]`}>
                                    {rank.emoji}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[9px] font-mono uppercase tracking-[0.3em] text-cyan-400/80">
                                        Status Window
                                    </div>
                                    <h2 className="text-lg font-bold text-white truncate">{displayName || 'Hunter'}</h2>
                                    <p className={`text-xs font-mono truncate ${title.color}`}>&ldquo;{title.title}&rdquo;</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setOpen(false)}
                                className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/80 transition-colors"
                                aria-label="Close Status Window"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="relative z-10 flex-1 overflow-y-auto px-5 py-4 space-y-4 custom-scrollbar">
                            {/* Stats row */}
                            <div className="grid grid-cols-3 gap-2">
                                <Stat label="Level" value={level} accent="text-white" />
                                <Stat label="Lifetime XP" value={totalXP.toLocaleString()} accent="text-cyan-300" />
                                <Stat
                                    label="Streak"
                                    value={streak}
                                    accent="text-orange-300"
                                    icon={streak > 0 ? <Flame size={12} className="text-orange-400" /> : null}
                                />
                            </div>

                            {/* Lifetime XP progress bar with shimmer */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                                        Lv {level} → {level + 1}
                                    </span>
                                    <span className="text-[10px] font-mono text-cyan-300">{progress.percent}%</span>
                                </div>
                                <div className="relative h-2.5 bg-slate-950 border border-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 rounded-full transition-all duration-700 ease-out"
                                        style={{ width: `${progress.percent}%`, boxShadow: '0 0 12px rgba(6,182,212,0.6)' }}
                                    />
                                    <div
                                        className="absolute inset-y-0 left-0 shimmer rounded-full"
                                        style={{ width: `${progress.percent}%` }}
                                    />
                                </div>
                                <div className="text-[9px] font-mono text-slate-500 mt-1 text-right">
                                    {progress.current.toLocaleString()} / {progress.needed.toLocaleString()} XP
                                </div>
                            </div>

                            {/* Fatigue Radar */}
                            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Activity size={12} className={fatigue.color} />
                                        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                                            Fatigue Radar
                                        </span>
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <span className={`text-xl font-bold font-mono ${fatigue.color}`}>{fatigue.score}</span>
                                        <span className="text-[9px] font-mono text-slate-500">/100</span>
                                        <span className={`text-[10px] font-mono uppercase tracking-widest ml-1 ${fatigue.color}`}>
                                            {fatigue.label}
                                        </span>
                                    </div>
                                </div>
                                {radarData.length > 2 ? (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <RadarChart data={radarData} outerRadius="75%">
                                            <PolarGrid stroke="#1e293b" />
                                            <PolarAngleAxis
                                                dataKey="muscle"
                                                tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'monospace' }}
                                            />
                                            <PolarRadiusAxis
                                                angle={90}
                                                domain={[0, 100]}
                                                tick={{ fill: '#475569', fontSize: 8 }}
                                                stroke="#1e293b"
                                            />
                                            <Radar
                                                name="Fatigue"
                                                dataKey="fatigue"
                                                stroke={fatigue.accent}
                                                fill={fatigue.accent}
                                                fillOpacity={0.35}
                                                strokeWidth={2}
                                            />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <p className="text-[10px] font-mono text-slate-500 text-center py-6">
                                        Log a workout to populate the fatigue radar.
                                    </p>
                                )}
                            </div>

                            {/* Achievements snapshot */}
                            <button
                                onClick={() => { setOpen(false); navigate('/profile'); }}
                                className="w-full flex items-center justify-between bg-slate-950/60 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-3 transition-all group"
                            >
                                <div className="flex items-center gap-2">
                                    <Trophy size={14} className="text-amber-400" />
                                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                                        Achievements
                                    </span>
                                    <span className="text-xs font-bold text-amber-400 font-mono">
                                        {unlockedCount}<span className="text-slate-500">/{achievements.length}</span>
                                    </span>
                                </div>
                                <ChevronRight size={14} className="text-slate-600 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// ── Sub-components ─────────────────────────────────────────────────────
const Stat: React.FC<{
    label: string; value: React.ReactNode; accent: string; icon?: React.ReactNode;
}> = ({ label, value, accent, icon }) => (
    <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5 text-center">
        <div className="text-[8px] font-mono uppercase tracking-wider text-slate-500">{label}</div>
        <div className={`text-base font-bold font-mono flex items-center justify-center gap-1 ${accent}`}>
            {icon}{value}
        </div>
    </div>
);

const FatigueRing: React.FC<{ score: number; accent: string }> = ({ score, accent }) => {
    const r = 14;
    const circ = 2 * Math.PI * r;
    const offset = circ - (Math.max(0, Math.min(100, score)) / 100) * circ;
    return (
        <div className="relative w-9 h-9 flex items-center justify-center">
            <svg width="36" height="36" className="-rotate-90 absolute inset-0">
                <circle cx="18" cy="18" r={r} stroke="#1e293b" strokeWidth="3" fill="none" />
                <circle
                    cx="18" cy="18" r={r}
                    stroke={accent} strokeWidth="3" fill="none"
                    strokeDasharray={circ} strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
            </svg>
            <span className="text-[10px] font-mono font-bold" style={{ color: accent }}>{score}</span>
        </div>
    );
};
