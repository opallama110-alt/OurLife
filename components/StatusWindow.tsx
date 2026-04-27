import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, ChevronRight, Lock, Trophy } from 'lucide-react';
import { GymProfile, WorkoutLog } from '../types';
import {
    getRankForLevel,
    getTitleForLevel,
    getXPProgress,
    evaluateAchievements,
} from '../services/gamificationService';
import { FatigueReport } from '../services/fatigueService';
import { FatigueGauge } from './FatigueGauge';

interface StatusWindowProps {
    gymProfile: GymProfile;
    workouts: WorkoutLog[];
    fatigue: FatigueReport;
    displayName: string;
}

// Compact dashboard "Status Window" — Hunter Card + top badges + fatigue gauge.
// On desktop this lives in the right column; on mobile it sits at the top of
// the dashboard. Full badge grid + compare lives on the Profile tab.
export const StatusWindow: React.FC<StatusWindowProps> = ({
    gymProfile,
    workouts,
    fatigue,
    displayName,
}) => {
    const navigate = useNavigate();
    const totalXP = gymProfile.totalXP || 0;
    const level = gymProfile.level || 1;
    const rank = getRankForLevel(level);
    const title = getTitleForLevel(level);
    const progress = getXPProgress(totalXP);
    const streak = gymProfile.currentStreak ?? 0;

    const achievements = evaluateAchievements(workouts, gymProfile);
    const unlocked = achievements.filter(a => a.unlocked);
    const locked = achievements.filter(a => !a.unlocked);
    // Show 3 most recent unlocks then fill with the next 3 to-go.
    const featured = [...unlocked.slice(-3), ...locked.slice(0, 6 - unlocked.slice(-3).length)];

    return (
        <aside className="space-y-4">
            {/* ── Hunter Card (compact) ─────────────────────────────────── */}
            <div className="relative rounded-2xl overflow-hidden border border-cyan-500/25 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-5 shadow-2xl shadow-cyan-500/10">
                <div className="absolute -top-16 -right-16 w-44 h-44 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-16 -left-16 w-44 h-44 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10">
                    <div className="flex items-start justify-between mb-4">
                        <div className="min-w-0">
                            <div className="text-[9px] font-mono uppercase tracking-[0.25em] text-cyan-400/80">Status Window</div>
                            <h3 className="text-lg font-bold text-white mt-0.5 truncate">{displayName || 'Hunter'}</h3>
                            <p className={`text-xs font-mono mt-0.5 ${title.color} truncate`}>&ldquo;{title.title}&rdquo;</p>
                        </div>
                        <div className="flex flex-col items-center shrink-0 ml-2">
                            <div className={`text-3xl ${rank.color}`}>{rank.emoji}</div>
                            <div className={`text-[10px] font-mono font-bold mt-0.5 ${rank.color}`}>{rank.name}</div>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2 text-center">
                            <div className="text-[8px] font-mono uppercase tracking-wider text-slate-500">Lv</div>
                            <div className="text-lg font-bold text-white font-mono">{level}</div>
                        </div>
                        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2 text-center">
                            <div className="text-[8px] font-mono uppercase tracking-wider text-slate-500">XP</div>
                            <div className="text-lg font-bold text-cyan-300 font-mono">{totalXP.toLocaleString()}</div>
                        </div>
                        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2 text-center">
                            <div className="text-[8px] font-mono uppercase tracking-wider text-slate-500">🔥</div>
                            <div className="text-lg font-bold text-orange-300 font-mono flex items-center justify-center gap-1">
                                {streak}
                            </div>
                        </div>
                    </div>

                    {/* Lifetime XP progress bar with shimmer */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
                                Lv {level} → {level + 1}
                            </span>
                            <span className="text-[10px] font-mono text-cyan-300">
                                {progress.percent}%
                            </span>
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

                    {/* Streak quick badge */}
                    {streak > 0 && (
                        <div className="mt-3 flex items-center justify-center bg-orange-500/10 border border-orange-500/30 rounded-lg py-1.5">
                            <Flame size={12} className="text-orange-400 mr-1.5 animate-pulse" />
                            <span className="text-[10px] font-mono font-bold text-orange-300 uppercase tracking-wider">
                                {streak}-Day Streak
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Fatigue Gauge ─────────────────────────────────────────── */}
            <FatigueGauge report={fatigue} compact />

            {/* ── Top Achievements (compact preview) ────────────────────── */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                        <Trophy size={14} className="text-amber-400" />
                        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                            Achievements
                        </span>
                        <span className="text-[10px] font-mono text-amber-400">
                            {unlocked.length}/{achievements.length}
                        </span>
                    </div>
                    <button
                        onClick={() => navigate('/profile')}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono uppercase tracking-wider flex items-center"
                    >
                        All <ChevronRight size={12} />
                    </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {featured.map(a => (
                        <div
                            key={a.id}
                            title={a.unlocked ? `${a.label} — ${a.description}` : `${a.label} (Locked)`}
                            className={`badge-tier badge-${a.rarity} ${a.unlocked ? '' : 'badge-locked'} rounded-xl p-2 flex flex-col items-center text-center aspect-square justify-center relative`}
                        >
                            {!a.unlocked && (
                                <Lock size={10} className="absolute top-1 right-1 text-slate-500" />
                            )}
                            <div className={`text-2xl leading-none mb-0.5 ${a.unlocked ? '' : 'grayscale opacity-50'}`}>
                                {a.emoji}
                            </div>
                            <div className={`text-[8px] font-bold leading-tight ${a.unlocked ? 'text-white' : 'text-slate-500'} truncate w-full`}>
                                {a.label}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </aside>
    );
};
