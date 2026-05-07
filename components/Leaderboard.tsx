import React, { useEffect, useState } from 'react';
import { Crown, Loader2 } from 'lucide-react';
import { RANK_TIERS, getRankForLevel, generateLeaderboard } from '../services/gamificationService';
import { GymProfile } from '../types';
import { storageService } from '../services/storageService';

interface LeaderboardProps {
    profile: GymProfile;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ profile }) => {
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const user = storageService.getUserState();

    useEffect(() => {
        const unsubscribe = storageService.subscribeToLeaderboard((data) => {
            const processed = data.map(u => {
                const rank = getRankForLevel(u.level || 1);
                return {
                    ...u,
                    explicitRankColor: rank.color,
                    explicitRankName: rank.name,
                    explicitRankEmoji: rank.emoji,
                };
            });

            processed.sort((a, b) => b.xp - a.xp);
            setEntries(processed);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const displayEntries = entries?.length > 0
        ? entries
        : generateLeaderboard(profile.totalXP, user?.name || 'User').map(e => {
            const rank = getRankForLevel(e.level || 1);
            return {
                ...e,
                explicitRankColor: rank.color,
                explicitRankName: rank.name,
                explicitRankEmoji: rank.emoji,
            };
        });

    return (
        <div className="space-y-4 animate-slide-up">
            <div className="flex items-center space-x-2 mb-1">
                <Crown size={18} className="text-amber-400" />
                <h3 className="text-lg font-bold text-white">Hunter Ranking Board</h3>
            </div>

            <div className="space-y-2">
                {loading ? (
                    <div className="flex justify-center py-8 text-cyan-500">
                        <Loader2 size={24} className="animate-spin" />
                    </div>
                ) : displayEntries?.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-sm font-mono">No Hunters located.</div>
                ) : (
                    displayEntries?.map((e, i) => {
                        const isPlayer = user?.name === e.name || e.isPlayer;
                        return (
                            <div key={e.name + i}
                                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isPlayer
                                    ? 'bg-gradient-to-r from-cyan-900/40 to-blue-900/20 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                                    : 'bg-slate-900/60 border-slate-800/80'
                                    }`}>
                                <div className="flex items-center space-x-3">
                                    <span className={`text-lg font-bold font-mono w-6 text-center ${i === 0 ? 'text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.8)]' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-700' : 'text-slate-600'
                                        }`}>#{i + 1}</span>
                                    <span className="text-lg">{e.emoji}</span>
                                    <div>
                                        <span className={`text-sm font-bold ${isPlayer ? 'text-cyan-300' : 'text-slate-200'}`}>
                                            {e.name} {isPlayer && <span className="text-[10px] text-cyan-500 ml-1">(YOU)</span>}
                                        </span>
                                        <div className="flex items-center space-x-1.5 mt-0.5">
                                            <span className="text-[10px] text-slate-500 font-mono">Lv.{e.level || 1}</span>
                                            <span className="text-[10px] text-slate-600">•</span>
                                            <span className={`text-[10px] font-bold font-mono ${e.explicitRankColor}`}>
                                                {e.explicitRankEmoji} {e.explicitRankName}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`text-sm font-bold font-mono ${e.explicitRankColor}`}>{(e.xp || 0).toLocaleString()}</span>
                                    <span className="text-[10px] text-slate-500 ml-1">XP</span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Rank Legend */}
            <div className="jarvis-card p-3 rounded-xl mt-4 border border-slate-800" style={{ transform: 'none' }}>
                <div className="text-[10px] text-slate-500 font-mono uppercase mb-2 tracking-widest">Rank Boundaries</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {RANK_TIERS.map(r => (
                        <div key={r.name} className="flex flex-col text-[10px] bg-slate-900/50 p-2 rounded-lg border border-slate-800/80 hover:border-slate-700 transition-colors">
                            <span className={`font-bold ${r.color} text-xs mb-0.5`}>{r.emoji} {r.name}</span>
                            <span className="text-slate-500 font-mono tracking-tight">Lv.{r.minLevel} - {r.maxLevel === Infinity ? '∞' : `Lv.${r.maxLevel}`}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="text-center text-[10px] text-slate-600 font-mono italic pt-1">
                View the full Hall of Titles inside your Profile.
            </div>
        </div>
    );
};
