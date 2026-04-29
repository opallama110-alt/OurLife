import React, { useEffect, useMemo, useState } from 'react';
import { UserState, GymProfile, WorkoutLog } from '../types';
import { storageService } from '../services/storageService';
import {
    Save, User, UserCircle, Ruler, Weight, Activity, CheckSquare, Calendar, Sparkles,
    Flame, Trophy, Crown, Shield, Sword, Swords, Skull, Zap, Lock, BarChart3, Users as UsersIcon, Loader2, Award,
} from 'lucide-react';
import {
    TITLE_TIERS,
    STREAK_TITLE_TIERS,
    getLevelFromXP,
    getRankForLevel,
    getXPProgress,
    getTitleForLevel,
    evaluateAchievements,
} from '../services/gamificationService';
import { calcBMI, bmiSliderStyle } from '../utils/bmi';

type CompareUser = {
    id: string;
    name: string;
    monthlyXP: number;
    monthlyWorkouts: number;
    currentStreak: number;
    rank: string;
    rankEmoji: string;
    photoURL?: string;
};

// Badge rarity mapping — keyed by TITLE_TIERS minLevel
type BadgeStyle = { icon: React.ComponentType<{ size?: number; className?: string }>; rarity: string; label: string };
const BADGE_STYLE: Record<number, BadgeStyle> = {
    1: { icon: Shield, rarity: 'badge-iron', label: 'Iron' },
    5: { icon: Swords, rarity: 'badge-iron', label: 'Iron' },
    10: { icon: Sword, rarity: 'badge-silver', label: 'Silver' },
    15: { icon: Flame, rarity: 'badge-bronze', label: 'Bronze' },
    20: { icon: Skull, rarity: 'badge-purple', label: 'Epic' },
    30: { icon: Trophy, rarity: 'badge-gold', label: 'Gold' },
    50: { icon: Crown, rarity: 'badge-gold', label: 'Gold' },
    75: { icon: Zap, rarity: 'badge-legendary', label: 'Legendary' },
    100: { icon: Sparkles, rarity: 'badge-mythic', label: 'Mythic' },
};

export const Profile: React.FC = () => {
    const [user, setUser] = useState<UserState & { gymSchedule?: any }>(() => ({
        ...storageService.getUserState(),
        gymSchedule: storageService.getGymSchedule()
    }));
    const [gymProfile, setGymProfile] = useState<GymProfile>(() => storageService.getGymProfile());
    const [workouts, setWorkouts] = useState<WorkoutLog[]>(() => storageService.getWorkouts());
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    // Keep gym profile + user state in sync with RTDB-backed cache
    useEffect(() => {
        const unsub = storageService.subscribe(() => {
            setGymProfile(storageService.getGymProfile());
            setWorkouts(storageService.getWorkouts());
            const state = storageService.getUserState();
            setUser(prev => ({ ...prev, ...state, gymSchedule: storageService.getGymSchedule() }));
        });
        return () => unsub();
    }, []);

    const handleChange = (field: keyof UserState | 'gymSchedule', value: any) => {
        setUser(prev => ({ ...prev, [field]: value }));
    };

    // Phase 5 — Live BMI
    const bmi = useMemo(
        () => calcBMI(user.height, user.weight, user.gender, user.experienceLevel),
        [user.height, user.weight, user.gender, user.experienceLevel],
    );

    const handleManualSave = async () => {
        setSaveStatus('saving');
        try {
            // saveUserState writes localCache → localStorage → RTDB → flattens name to RTDB
            // syncToRemote pushes full payload to RTDB + Firestore (incl. height/weight for compare)
            storageService.saveUserState(user);
            storageService.saveGymSchedule(user.gymSchedule || storageService.getGymSchedule());
            await storageService.syncToRemote();
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2400);
        } catch (error) {
            console.error('Manual save failed', error);
            setSaveStatus('idle');
        }
    };

    return (
        <div className="space-y-6 pb-24 animate-slide-up">
            {/* ═══════════════════ PHASE 6: PUBLIC HUNTER CARD ═══════════════════ */}
            <HunterCard gymProfile={gymProfile} displayName={user.name} />

            {/* ═══════════════════ PHASE 6: BADGE GRID ═══════════════════ */}
            <BadgeGrid currentLevel={gymProfile.level || 1} longestStreak={gymProfile.longestStreak || 0} />

            {/* ═══════════════════ Project Chimera Phase 2: ACHIEVEMENTS ═══════════════════ */}
            <AchievementsGrid workouts={workouts} gymProfile={gymProfile} />

            {/* ═══════════════════ PHASE 6: COMPARE UI ═══════════════════ */}
            <CompareSection gymProfile={gymProfile} displayName={user.name} />

            {/* Save Status Indicator */}
            <div className="flex items-center justify-end text-xs font-mono">
                {saveStatus === 'saving' && <span className="text-amber-400 animate-pulse">Saving...</span>}
                {saveStatus === 'saved' && <span className="text-emerald-400">Saved</span>}
            </div>

            {/* ═══════════════════ IDENTITY ═══════════════════ */}
            <div className="jarvis-card p-5 rounded-2xl space-y-4">
                <div className="flex items-center space-x-3 mb-2">
                    <UserCircle size={24} className="text-cyan-400" />
                    <h3 className="text-lg font-bold text-white">Identity</h3>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs text-slate-500 font-mono uppercase mb-1.5">Full Name</label>
                        <input
                            type="text"
                            value={user.name}
                            onChange={e => handleChange('name', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-500 font-mono uppercase mb-1.5">Age</label>
                            <input
                                type="number"
                                value={user.age}
                                onChange={e => handleChange('age', parseInt(e.target.value) || 0)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500 appearance-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 font-mono uppercase mb-1.5">Gender</label>
                            <select
                                value={user.gender}
                                onChange={e => handleChange('gender', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500 appearance-none"
                            >
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════ PHASE 5: PHYSICAL STATS — SLIDERS + LIVE BMI ═══════════════════ */}
            <PhysicalStatsSection
                height={user.height}
                weight={user.weight}
                bmi={bmi}
                onHeightChange={v => handleChange('height', v)}
                onWeightChange={v => handleChange('weight', v)}
            />

            {/* ═══════════════════ FITNESS GOALS ═══════════════════ */}
            <div className="jarvis-card p-5 rounded-2xl space-y-4">
                <div className="flex items-center space-x-3 mb-2">
                    <User size={24} className="text-amber-400" />
                    <h3 className="text-lg font-bold text-white">Fitness Goals</h3>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs text-slate-500 font-mono uppercase mb-1.5">Primary Goal</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['Lose Weight', 'Build Muscle', 'Keep Fit'].map(goal => (
                                <button
                                    key={goal}
                                    onClick={() => handleChange('fitnessGoal', goal)}
                                    className={`py-2 px-1 rounded-lg text-xs font-bold transition-all ${user.fitnessGoal === goal
                                        ? 'bg-amber-500 text-slate-900'
                                        : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                                        }`}
                                >
                                    {goal}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-slate-500 font-mono uppercase mb-1.5">Activity Level</label>
                        <select
                            value={user.activityLevel}
                            onChange={e => handleChange('activityLevel', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 appearance-none"
                        >
                            <option value="Sedentary">Sedentary (Office job)</option>
                            <option value="Light">Light (1-2 days/week)</option>
                            <option value="Moderate">Moderate (3-5 days/week)</option>
                            <option value="Active">Active (6-7 days/week)</option>
                        </select>
                    </div>

                    {/* Weekly Schedule */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-xs text-slate-500 font-mono uppercase flex items-center">
                                <Calendar size={12} className="mr-1" /> Weekly Workout Schedule
                            </label>
                            <div className="text-[10px] text-slate-500 italic">Click box to change focus</div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                            {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => {
                                const currentFocus = user.gymSchedule?.[day] || '';
                                const dayLabels: Record<string, string> = {
                                    monday: 'SEN', tuesday: 'SEL', wednesday: 'RAB', thursday: 'KAM',
                                    friday: 'JUM', saturday: 'SAB', sunday: 'MIN'
                                };
                                return (
                                    <div key={day} className="relative group">
                                        <div className={`p-3 rounded-xl border border-slate-700 bg-slate-900/50 hover:border-cyan-500/50 transition-all h-full min-h-[80px] flex flex-col justify-between ${currentFocus ? 'bg-slate-800/80' : ''}`}>
                                            <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-1">
                                                {dayLabels[day]}
                                            </div>
                                            <div className={`text-xs font-medium truncate ${currentFocus ? 'text-white' : 'text-slate-600'}`}>
                                                {currentFocus || 'Rest'}
                                            </div>
                                            <select
                                                value={currentFocus}
                                                onChange={(e) => {
                                                    const newSchedule = { ...user.gymSchedule, [day]: e.target.value };
                                                    handleChange('gymSchedule', newSchedule);
                                                    storageService.saveGymSchedule(newSchedule);
                                                }}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none"
                                            >
                                                <option value="">Rest Day 🧘</option>
                                                <option value="Push">Push</option>
                                                <option value="Pull">Pull</option>
                                                <option value="Legs">Legs</option>
                                                <option value="Upper">Upper</option>
                                                <option value="Lower">Lower</option>
                                                <option value="Full Body">Full Body</option>
                                                <option value="Cardio">Cardio</option>
                                            </select>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════ SAVE ═══════════════════ */}
            <div className="pt-4">
                <button
                    onClick={handleManualSave}
                    disabled={saveStatus === 'saving'}
                    className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center space-x-2 transition-all ${saveStatus === 'saved'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                        : 'bg-cyan-500 hover:bg-cyan-400 text-slate-900'
                        }`}
                >
                    {saveStatus === 'saving' ? (
                        <>
                            <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                            <span>Saving...</span>
                        </>
                    ) : saveStatus === 'saved' ? (
                        <>
                            <CheckSquare size={20} />
                            <span>Saved Successfully</span>
                        </>
                    ) : (
                        <>
                            <Save size={20} />
                            <span>Save Changes</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════
// Phase 6 — Public Hunter Card: Rank, Lifetime XP bar, Streak counter
// ═══════════════════════════════════════════════════════════════════
const HunterCard: React.FC<{ gymProfile: GymProfile; displayName: string }> = ({ gymProfile, displayName }) => {
    const totalXP = gymProfile.totalXP || 0;
    const level = gymProfile.level || 1;
    const rank = getRankForLevel(level);
    const title = getTitleForLevel(level);
    const progress = getXPProgress(totalXP);
    const streak = gymProfile.currentStreak ?? 0;
    const longestStreak = gymProfile.longestStreak ?? 0;

    return (
        <div className="relative rounded-3xl overflow-hidden border border-cyan-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-6 shadow-2xl shadow-cyan-500/10">
            {/* Ambient glow */}
            <div className="absolute -top-24 -right-24 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-5">
                {/* Header row — name, rank emblem */}
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-cyan-400/80">Public Profile</div>
                        <h2 className="text-2xl font-bold text-white mt-1">{displayName || 'Hunter'}</h2>
                        <p className={`text-sm font-mono mt-0.5 ${title.color}`}>&ldquo;{title.title}&rdquo;</p>
                    </div>
                    <div className="flex flex-col items-center">
                        <div className={`text-4xl ${rank.color}`}>{rank.emoji}</div>
                        <div className={`text-[11px] font-mono font-bold mt-1 ${rank.color}`}>{rank.name}</div>
                    </div>
                </div>

                {/* Stat row */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                        <div className="text-[9px] font-mono uppercase tracking-wider text-slate-500">Level</div>
                        <div className="text-2xl font-bold text-white font-mono">{level}</div>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                        <div className="text-[9px] font-mono uppercase tracking-wider text-slate-500">Lifetime XP</div>
                        <div className="text-2xl font-bold text-cyan-300 font-mono">{totalXP.toLocaleString()}</div>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                        <div className="text-[9px] font-mono uppercase tracking-wider text-slate-500">Workouts</div>
                        <div className="text-2xl font-bold text-white font-mono">{gymProfile.workoutsCompleted || 0}</div>
                    </div>
                </div>

                {/* Lifetime XP progress bar — to next level */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                            Level {level} → {level + 1}
                        </span>
                        <span className="text-[11px] font-mono text-cyan-300">
                            {progress.current.toLocaleString()} / {progress.needed.toLocaleString()} XP
                        </span>
                    </div>
                    <div className="relative h-3 bg-slate-950 border border-slate-800 rounded-full overflow-hidden">
                        <div
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${progress.percent}%`, boxShadow: '0 0 14px rgba(6,182,212,0.6)' }}
                        />
                        <div
                            className="absolute inset-y-0 left-0 shimmer rounded-full"
                            style={{ width: `${progress.percent}%` }}
                        />
                    </div>
                    <div className="text-right text-[10px] font-mono text-slate-500 mt-1">{progress.percent}%</div>
                </div>

                {/* Streak counter — fire */}
                <div className="flex items-center justify-between bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-transparent border border-amber-500/30 rounded-xl p-3">
                    <div className="flex items-center space-x-3">
                        <div className="relative">
                            <Flame size={32} className="text-orange-400 streak-fire animate-breathe" />
                            {streak >= 7 && (
                                <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full animate-ping" />
                            )}
                        </div>
                        <div>
                            <div className="text-[9px] font-mono uppercase tracking-widest text-amber-400">Current Streak</div>
                            <div className="text-xl font-bold text-white font-mono">
                                {streak} <span className="text-xs text-slate-400 font-normal">day{streak === 1 ? '' : 's'}</span>
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Longest</div>
                        <div className="text-lg font-bold text-slate-300 font-mono">{longestStreak}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════
// Phase 6 — Visual Badge Grid (Solo Leveling Titles as Medals)
// ═══════════════════════════════════════════════════════════════════
const BadgeGrid: React.FC<{ currentLevel: number; longestStreak: number }> = ({ currentLevel, longestStreak }) => {
    return (
        <div className="jarvis-card p-5 rounded-2xl space-y-5">
            <div className="flex items-center space-x-3">
                <Trophy size={22} className="text-amber-400" />
                <div>
                    <h3 className="text-lg font-bold text-white">Hall of Titles</h3>
                    <p className="text-[11px] text-slate-500 font-mono">Unlock medals by climbing ranks</p>
                </div>
            </div>

            {/* ── Level-based titles ───────────────────────────── */}
            <div>
                <div className="flex items-center space-x-2 mb-2">
                    <Crown size={14} className="text-cyan-400" />
                    <div className="text-[11px] text-cyan-400 font-mono uppercase tracking-widest">Level Titles</div>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                    {TITLE_TIERS.map((tier) => {
                        const style = BADGE_STYLE[tier.minLevel] || BADGE_STYLE[1];
                        const unlocked = currentLevel >= tier.minLevel;
                        const Icon = style.icon;
                        return (
                            <div
                                key={tier.minLevel}
                                className={`badge-tier ${style.rarity} ${unlocked ? '' : 'badge-locked'} rounded-2xl p-3 flex flex-col items-center text-center aspect-square justify-center relative`}
                                title={unlocked ? tier.title : `Unlock at Level ${tier.minLevel}`}
                            >
                                {!unlocked && (
                                    <Lock size={14} className="absolute top-2 right-2 text-slate-500" />
                                )}
                                <Icon size={30} className={`${unlocked ? tier.color : 'text-slate-600'} mb-1.5`} />
                                <div className={`text-[10px] font-bold leading-tight ${unlocked ? 'text-white' : 'text-slate-500'}`}>
                                    {tier.title}
                                </div>
                                <div className={`text-[9px] font-mono mt-0.5 ${unlocked ? 'text-slate-400' : 'text-slate-600'}`}>
                                    Lv {tier.minLevel} • {style.label}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Streak-based titles ──────────────────────────── */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                        <Flame size={14} className="text-orange-400" />
                        <div className="text-[11px] text-orange-400 font-mono uppercase tracking-widest">Streak Titles</div>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                        Best: <span className="text-orange-300">{longestStreak}d</span>
                    </div>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {STREAK_TITLE_TIERS.map((tier) => {
                        const unlocked = longestStreak >= tier.minDays;
                        return (
                            <div
                                key={tier.minDays}
                                className={`badge-tier badge-${tier.rarity} ${unlocked ? '' : 'badge-locked'} rounded-2xl p-3 flex flex-col items-center text-center aspect-square justify-center relative`}
                                title={unlocked ? `${tier.title} — ${tier.description}` : `Unlock at ${tier.minDays} day streak`}
                            >
                                {!unlocked && (
                                    <Lock size={14} className="absolute top-2 right-2 text-slate-500" />
                                )}
                                <div className={`text-3xl mb-1 leading-none ${unlocked ? '' : 'grayscale opacity-50'}`}>
                                    {tier.emoji}
                                </div>
                                <div className={`text-[10px] font-bold leading-tight ${unlocked ? 'text-white' : 'text-slate-500'}`}>
                                    {tier.title}
                                </div>
                                <div className={`text-[9px] font-mono mt-0.5 ${unlocked ? 'text-slate-400' : 'text-slate-600'}`}>
                                    {tier.minDays}d streak
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════
// Project Chimera Phase 2 — Achievements Grid (specific milestones)
// ═══════════════════════════════════════════════════════════════════
const AchievementsGrid: React.FC<{ workouts: WorkoutLog[]; gymProfile: GymProfile }> = ({ workouts, gymProfile }) => {
    const evaluated = useMemo(() => evaluateAchievements(workouts, gymProfile), [workouts, gymProfile]);
    const unlockedCount = evaluated.filter(a => a.unlocked).length;
    const total = evaluated.length;

    return (
        <div className="jarvis-card p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <Award size={22} className="text-amber-400" />
                    <div>
                        <h3 className="text-lg font-bold text-white">Achievements</h3>
                        <p className="text-[11px] text-slate-500 font-mono">Milestones forged through training</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-xl font-bold text-amber-400 font-mono">{unlockedCount}<span className="text-slate-500 text-sm">/{total}</span></div>
                    <div className="text-[9px] font-mono uppercase tracking-wider text-slate-500">Unlocked</div>
                </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {evaluated.map((a) => (
                    <div
                        key={a.id}
                        className={`badge-tier badge-${a.rarity} ${a.unlocked ? '' : 'badge-locked'} rounded-2xl p-3 flex flex-col items-center text-center aspect-square justify-center relative`}
                        title={a.unlocked ? `${a.label} — ${a.description}` : `Locked: ${a.description}`}
                    >
                        {!a.unlocked && (
                            <Lock size={12} className="absolute top-2 right-2 text-slate-500" />
                        )}
                        <div className={`text-3xl mb-1 leading-none ${a.unlocked ? '' : 'grayscale opacity-50'}`}>
                            {a.emoji}
                        </div>
                        <div className={`text-[10px] font-bold leading-tight ${a.unlocked ? 'text-white' : 'text-slate-500'}`}>
                            {a.label}
                        </div>
                        <div className={`text-[9px] font-mono mt-0.5 ${a.unlocked ? 'text-slate-400' : 'text-slate-600'} leading-tight line-clamp-2`}>
                            {a.description}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════
// Phase 6 — Compare UI (Monthly XP + Workouts vs another user)
// ═══════════════════════════════════════════════════════════════════
const CompareSection: React.FC<{ gymProfile: GymProfile; displayName: string }> = ({ gymProfile, displayName }) => {
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<CompareUser[]>([]);
    const [selectedId, setSelectedId] = useState<string>('');
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const selected = users.find(u => u.id === selectedId);

    const loadUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const all = await storageService.getAllUsers();
            const candidates: CompareUser[] = all
                .filter(u => u.name !== displayName)
                .map(u => ({
                    id: u.id,
                    name: u.name,
                    monthlyXP: u.monthlyXP ?? 0,
                    monthlyWorkouts: u.monthlyWorkouts ?? 0,
                    currentStreak: u.currentStreak ?? 0,
                    rank: u.rank || 'E-Rank',
                    rankEmoji: u.rankEmoji || '🥉',
                    photoURL: u.photoURL,
                }));
            setUsers(candidates);
            if (candidates.length > 0) setSelectedId(prev => prev || candidates[0].id);
            setLoaded(true);
        } catch (e: any) {
            console.error('[CompareSection] load users failed', e);
            setError(e?.message || 'Failed to load rivals.');
        } finally {
            setLoading(false);
        }
    };

    // Project Chimera Phase 4 — auto-load rivals on mount so the Compare card
    // is populated without an extra tap.
    useEffect(() => {
        loadUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const myMonthlyXP = gymProfile.monthlyXP ?? 0;
    const myMonthlyWorkouts = gymProfile.monthlyWorkouts ?? 0;
    const myStreak = gymProfile.currentStreak ?? 0;

    const maxXP = Math.max(myMonthlyXP, selected?.monthlyXP ?? 0, 1);
    const maxWorkouts = Math.max(myMonthlyWorkouts, selected?.monthlyWorkouts ?? 0, 1);

    // Streak Leading/Behind delta (positive = you're ahead).
    const streakDelta = selected ? myStreak - selected.currentStreak : 0;

    return (
        <div className="jarvis-card p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                    <BarChart3 size={22} className="text-purple-400" />
                    <div>
                        <h3 className="text-lg font-bold text-white">Current Month Rank</h3>
                        <p className="text-[11px] text-slate-500 font-mono">
                            Resets on the 1st • Compare vs another Hunter
                        </p>
                    </div>
                </div>
                <button
                    onClick={loadUsers}
                    disabled={loading}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold hover:bg-purple-500/20 transition-all disabled:opacity-50"
                >
                    {loading ? <Loader2 size={12} className="animate-spin" /> : <UsersIcon size={12} />}
                    <span>{loading ? 'Loading' : 'Refresh'}</span>
                </button>
            </div>

            {error && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-3 py-2 rounded-lg text-xs mb-3">
                    {error}
                </div>
            )}

            {loading && !loaded ? (
                <div className="text-center py-6 text-xs text-slate-500 font-mono flex items-center justify-center gap-2">
                    <Loader2 size={12} className="animate-spin text-purple-400" />
                    Pulling rivals from the leaderboard…
                </div>
            ) : users.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500 font-mono">
                    No other Hunters found yet — invite friends!
                </div>
            ) : (
                <>
                    {/* Rival Selector */}
                    <div className="mb-4">
                        <label className="block text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-1.5">Opponent</label>
                        <select
                            value={selectedId}
                            onChange={e => setSelectedId(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 appearance-none"
                        >
                            {users.map(u => (
                                <option key={u.id} value={u.id}>{u.rankEmoji} {u.name}</option>
                            ))}
                        </select>
                    </div>

                    {selected && (
                        <div className="space-y-4">
                            {/* VS header */}
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                                <StatHead name={displayName || 'You'} label="YOU" accent="cyan" />
                                <div className="text-xs font-bold font-mono text-slate-500 px-2">VS</div>
                                <StatHead name={selected.name} label={selected.rank} accent="purple" photoURL={selected.photoURL} />
                            </div>

                            {/* Current Month XP */}
                            <CompareBar
                                label="Current Month XP"
                                myValue={myMonthlyXP}
                                theirValue={selected.monthlyXP}
                                max={maxXP}
                                format={(v) => v.toLocaleString()}
                            />

                            {/* Current Month Workouts */}
                            <CompareBar
                                label="Current Month Workouts"
                                myValue={myMonthlyWorkouts}
                                theirValue={selected.monthlyWorkouts}
                                max={maxWorkouts}
                                format={(v) => String(v)}
                            />

                            {/* Streak mini row + Leading/Behind indicator */}
                            <div className="pt-2 border-t border-slate-800 space-y-2">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-3 text-center">
                                        <div className="text-[9px] font-mono uppercase text-cyan-300/70">Your Streak</div>
                                        <div className="text-xl font-bold text-cyan-300 font-mono flex items-center justify-center gap-1">
                                            <Flame size={14} /> {myStreak}
                                        </div>
                                    </div>
                                    <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-3 text-center">
                                        <div className="text-[9px] font-mono uppercase text-purple-300/70">Rival's Streak</div>
                                        <div className="text-xl font-bold text-purple-300 font-mono flex items-center justify-center gap-1">
                                            <Flame size={14} /> {selected.currentStreak}
                                        </div>
                                    </div>
                                </div>
                                <div className={`text-center text-[11px] font-mono font-bold uppercase tracking-widest py-1.5 rounded-lg border ${
                                    streakDelta > 0
                                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                                        : streakDelta < 0
                                            ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                                            : 'text-slate-400 bg-slate-800/50 border-slate-700'
                                }`}>
                                    {streakDelta > 0
                                        ? `↑ Leading by ${streakDelta} day${streakDelta === 1 ? '' : 's'}`
                                        : streakDelta < 0
                                            ? `↓ Behind by ${Math.abs(streakDelta)} day${Math.abs(streakDelta) === 1 ? '' : 's'}`
                                            : '⚖ Tied'}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

const StatHead: React.FC<{ name: string; label: string; accent: 'cyan' | 'purple'; photoURL?: string }> = ({ name, label, accent, photoURL }) => {
    const color = accent === 'cyan' ? 'text-cyan-300 border-cyan-500/40' : 'text-purple-300 border-purple-500/40';
    return (
        <div className={`flex flex-col items-center text-center rounded-xl p-2 border ${color}`}>
            {photoURL ? (
                <img src={photoURL} alt={name} className="w-8 h-8 rounded-full border border-slate-700 object-cover mb-1" onError={e => { e.currentTarget.style.display = 'none'; }} />
            ) : (
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-1">
                    <User size={14} className="text-slate-500" />
                </div>
            )}
            <div className="text-xs font-bold text-white truncate max-w-full">{name}</div>
            <div className={`text-[9px] font-mono uppercase tracking-wider ${color}`}>{label}</div>
        </div>
    );
};

const CompareBar: React.FC<{
    label: string;
    myValue: number;
    theirValue: number;
    max: number;
    format: (v: number) => string;
}> = ({ label, myValue, theirValue, max, format }) => {
    const myPct = (myValue / max) * 100;
    const theirPct = (theirValue / max) * 100;
    const winning = myValue >= theirValue;

    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">{label}</span>
                <span className={`text-[10px] font-mono font-bold ${winning ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {winning ? '↑ Leading' : '↓ Behind'}
                </span>
            </div>
            {/* Your bar */}
            <div className="flex items-center space-x-2 mb-1.5">
                <span className="text-[9px] text-cyan-300 font-mono w-10">YOU</span>
                <div className="flex-1 h-5 bg-slate-950 border border-slate-800 rounded-md overflow-hidden relative">
                    <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-md transition-all duration-700 ease-out"
                        style={{ width: `${myPct}%`, boxShadow: '0 0 10px rgba(6,182,212,0.5)' }}
                    />
                </div>
                <span className="text-xs font-bold text-cyan-300 font-mono w-16 text-right">{format(myValue)}</span>
            </div>
            {/* Their bar */}
            <div className="flex items-center space-x-2">
                <span className="text-[9px] text-purple-300 font-mono w-10">RIVAL</span>
                <div className="flex-1 h-5 bg-slate-950 border border-slate-800 rounded-md overflow-hidden relative">
                    <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 to-fuchsia-500 rounded-md transition-all duration-700 ease-out"
                        style={{ width: `${theirPct}%`, boxShadow: '0 0 10px rgba(168,85,247,0.5)' }}
                    />
                </div>
                <span className="text-xs font-bold text-purple-300 font-mono w-16 text-right">{format(theirValue)}</span>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════
// Phase 5 — Physical Stats with Sliders + Live BMI + Recommendation
// ═══════════════════════════════════════════════════════════════════
const PhysicalStatsSection: React.FC<{
    height: number;
    weight: number;
    bmi: ReturnType<typeof calcBMI>;
    onHeightChange: (v: number) => void;
    onWeightChange: (v: number) => void;
}> = ({ height, weight, bmi, onHeightChange, onWeightChange }) => {
    const HEIGHT_MIN = 120, HEIGHT_MAX = 220;
    const WEIGHT_MIN = 30, WEIGHT_MAX = 180;

    return (
        <div className="jarvis-card p-5 rounded-2xl space-y-5">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <Activity size={24} className="text-emerald-400" />
                    <h3 className="text-lg font-bold text-white">Physical Stats</h3>
                </div>
                <div className={`flex items-baseline space-x-1 px-3 py-1.5 rounded-lg border ${bmi.borderClass} ${bmi.bgClass}`}>
                    <span className={`text-xs font-mono font-bold ${bmi.colorClass}`}>BMI</span>
                    <span className={`text-base font-bold font-mono ${bmi.colorClass}`}>{bmi.value}</span>
                    <span className={`text-[10px] font-mono ${bmi.colorClass}`}>({bmi.category})</span>
                </div>
            </div>

            {/* BMI scale bar */}
            <div>
                <div className="relative h-2 rounded-full overflow-hidden bg-slate-900 border border-slate-800">
                    <div className="absolute inset-y-0 left-0 w-[calc(18.5/40*100%)] bg-cyan-500/40" />
                    <div className="absolute inset-y-0 left-[calc(18.5/40*100%)] w-[calc(6.5/40*100%)] bg-emerald-500/50" />
                    <div className="absolute inset-y-0 left-[calc(25/40*100%)] w-[calc(5/40*100%)] bg-amber-500/50" />
                    <div className="absolute inset-y-0 left-[calc(30/40*100%)] right-0 bg-rose-500/50" />
                    <div
                        className="absolute top-[-4px] w-1 h-[calc(100%+8px)] bg-white rounded-full shadow-lg transition-all duration-200"
                        style={{ left: `calc(${Math.min(100, (bmi.value / 40) * 100)}% - 2px)` }}
                    />
                </div>
                <div className="flex justify-between text-[9px] font-mono text-slate-500 mt-1">
                    <span>Kurus</span><span>Ideal</span><span>Berlebih</span><span>Obesitas</span>
                </div>
            </div>

            {/* Height Slider */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center text-xs text-slate-500 font-mono uppercase">
                        <Ruler size={12} className="mr-1" /> Height
                    </label>
                    <span className="text-xl font-bold text-white font-mono">
                        {height}<span className="text-xs text-slate-500 ml-1">cm</span>
                    </span>
                </div>
                <input
                    type="range"
                    min={HEIGHT_MIN}
                    max={HEIGHT_MAX}
                    value={height}
                    onChange={(e) => onHeightChange(parseInt(e.target.value))}
                    className="range-slider"
                    style={bmiSliderStyle(height, HEIGHT_MIN, HEIGHT_MAX)}
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-600 mt-1">
                    <span>{HEIGHT_MIN}</span><span>{HEIGHT_MAX}</span>
                </div>
            </div>

            {/* Weight Slider */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center text-xs text-slate-500 font-mono uppercase">
                        <Weight size={12} className="mr-1" /> Weight
                    </label>
                    <span className="text-xl font-bold text-white font-mono">
                        {weight}<span className="text-xs text-slate-500 ml-1">kg</span>
                    </span>
                </div>
                <input
                    type="range"
                    min={WEIGHT_MIN}
                    max={WEIGHT_MAX}
                    value={weight}
                    onChange={(e) => onWeightChange(parseInt(e.target.value))}
                    className={`range-slider ${bmi.sliderVariant}`}
                    style={bmiSliderStyle(weight, WEIGHT_MIN, WEIGHT_MAX)}
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-600 mt-1">
                    <span>{WEIGHT_MIN}</span><span>{WEIGHT_MAX}</span>
                </div>
            </div>

            {/* Tailored Routine Recommendation */}
            <div className={`rounded-xl p-4 border ${bmi.borderClass} bg-slate-900/60`}>
                <div className="flex items-center space-x-2 mb-2">
                    <Sparkles size={14} className={bmi.colorClass} />
                    <span className={`text-[10px] uppercase tracking-widest font-mono font-bold ${bmi.colorClass}`}>Tailored Routine Recommendation</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{bmi.recommendation}</p>
            </div>
        </div>
    );
};
