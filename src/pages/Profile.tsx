import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UserState, GymProfile, WorkoutLog } from '../types';
import { storageService } from '../services/storageService';
import {
    Save, User, UserCircle, Ruler, Weight, Activity, Check, Calendar, Sparkles,
    Flame, Trophy, Crown, BarChart3, Users as UsersIcon, Loader2,
} from 'lucide-react';
import {
    STREAK_TITLE_TIERS,
    RANK_TIERS,
    getRankForLevel,
    getXPProgress,
    getTitleForLevel,
} from '../services/gamificationService';
import { calcBMI, bmiSliderStyle } from '../utils/bmi';
import { calculateAge, getTodayString } from '../utils/dateUtils';
import { liveWorkoutStreak } from '../utils/liveStreak';
import { DateOfBirthPicker } from '../components/DateOfBirthPicker';
import { AchievementGallery } from '../components/AchievementGallery';
import { RankBadge, rankFromTierName, CountUp } from '../components/hud';
import { StreakFlame, StreakNumber } from '../components/streak';
import { useInViewPause } from '../hooks/useInViewPause';
import { prefersReducedMotion } from '../hooks/usePresence';

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

interface ProfileProps {
    achievementsDefaultExpanded?: boolean;
}

const fmtId = (v: number) => Math.round(v).toLocaleString('id-ID');
const pct = (v: number) => `${Math.round(v)}%`;
const barStyle = (width: number, delayMs: number) =>
    ({ width: `${width}%`, '--bar-delay': `${delayMs}ms` } as React.CSSProperties);

// ─── Streak "since your last visit" ─────────────────────────────────────
// Profile lives in Settings, so the streak almost never changes while it is
// on screen and StreakFlame's burst (which fires on an increase after mount)
// would never play here. Instead the card opens on the value the viewer saw
// last time and rolls up to today's streak once the card has landed — the
// flame bursts, the number rolls. Per-viewer cosmetic, so localStorage (and
// any storage failure just shows the live value).
const SEEN_STREAK_KEY = 'ol:pf-seen-streak';
const STREAK_BUMP_DELAY_MS = 700;

function useStreakSinceLastVisit(live: number): number {
    const [shown, setShown] = useState<number>(() => {
        if (prefersReducedMotion()) return live;
        try {
            const raw = localStorage.getItem(SEEN_STREAK_KEY);
            const prev = raw === null ? NaN : Number(raw);
            return Number.isFinite(prev) && prev >= 0 && prev < live ? prev : live;
        } catch {
            return live;
        }
    });

    useEffect(() => {
        try { localStorage.setItem(SEEN_STREAK_KEY, String(live)); } catch { /* storage blocked — cosmetic only */ }
        const t = window.setTimeout(() => setShown(live), prefersReducedMotion() ? 0 : STREAK_BUMP_DELAY_MS);
        return () => window.clearTimeout(t);
    }, [live]);

    return shown;
}

export const Profile: React.FC<ProfileProps> = ({ achievementsDefaultExpanded = true }) => {
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

    // Live workout streak (freeze-token days count). `profile.currentStreak`
    // is only refreshed on workout save/sync, so after a lapse it keeps
    // burning an old number. Display-only selector.
    const liveStreak = useMemo(
        () => liveWorkoutStreak(workouts, gymProfile),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only the protected dates matter
        [workouts, gymProfile.tokenProtectedDates],
    );
    const today = getTodayString();
    const trainedToday = useMemo(() => workouts.some(w => w.date === today), [workouts, today]);
    // The stored best can lag the live streak until the next sync.
    const bestStreak = Math.max(gymProfile.longestStreak ?? 0, liveStreak);

    const handleManualSave = async () => {
        setSaveStatus('saving');
        try {
            // saveUserState writes localCache → localStorage → RTDB → flattens name to RTDB
            // syncToRemote updates private profile data plus the public ranking mirror.
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

    // Sections stagger in with `.reveal` (backwards fill → no lingering
    // transform once settled). The old root `animate-slide-up` used `both`
    // fill, which kept translateY(0) on the whole Profile forever and trapped
    // position:fixed overlays inside it.
    const revealStyle = (i: number) => ({ '--reveal-i': i } as React.CSSProperties);

    return (
        <div className="space-y-6 pb-24">
            {/* ═══════════════════ PHASE 6: PUBLIC HUNTER CARD ═══════════════════ */}
            <div className="reveal" style={revealStyle(0)}>
                <HunterCard
                    gymProfile={gymProfile}
                    displayName={user.name}
                    liveStreak={liveStreak}
                    bestStreak={bestStreak}
                    trainedToday={trainedToday}
                />
            </div>

            {/* ═══════════════════ PENGHARGAAN — Hunter Rank + Consistency Tracks ═══════════════════ */}
            <div className="reveal" style={revealStyle(1)}>
                <Penghargaan gymProfile={gymProfile} liveStreak={liveStreak} bestStreak={bestStreak} />
            </div>

            {/* ═══════════════════ PHASE 5B: ACHIEVEMENT GALLERY ═══════════════════ */}
            <div className="reveal" style={revealStyle(2)}>
                <AchievementGallery defaultExpanded={achievementsDefaultExpanded} />
            </div>

            {/* ═══════════════════ PHASE 6: COMPARE UI ═══════════════════ */}
            <div className="reveal" style={revealStyle(3)}>
                <CompareSection gymProfile={gymProfile} displayName={user.name} myStreak={liveStreak} />
            </div>

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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <DateOfBirthPicker
                                value={user.dateOfBirth || ''}
                                onChange={(date) => handleChange('dateOfBirth', date)}
                                label="Date of Birth"
                            />
                            {user.dateOfBirth && (
                                <p className="text-xs text-slate-500 font-mono mt-1">
                                    Age: {calculateAge(user.dateOfBirth)} (auto)
                                </p>
                            )}
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
                            <Check size={20} />
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
// Hero numbers count up on every visit, the XP bar charges from empty, and
// the streak row uses the shared tiered StreakFlame (cold ash at 0, System
// blue at 30d+) with a roll + burst when the streak rose since last visit.
// Glows are painted gradients (no blur-3xl blobs re-rasterizing under the
// bar sheen), and the card no longer clips, so the burst isn't cut off.
// ═══════════════════════════════════════════════════════════════════
const HunterCard: React.FC<{
    gymProfile: GymProfile;
    displayName: string;
    liveStreak: number;
    bestStreak: number;
    trainedToday: boolean;
}> = ({ gymProfile, displayName, liveStreak, bestStreak, trainedToday }) => {
    const ref = useRef<HTMLDivElement>(null);
    useInViewPause(ref);   // pauses the XP bar sheen while scrolled away

    const totalXP = gymProfile.totalXP || 0;
    const level = gymProfile.level || 1;
    const rank = getRankForLevel(level);
    const title = getTitleForLevel(level);
    const progress = getXPProgress(totalXP);
    const shownStreak = useStreakSinceLastVisit(liveStreak);
    const atRisk = liveStreak > 0 && !trainedToday;

    const streakHint = liveStreak === 0
        ? 'Latihan hari ini untuk menyalakan api.'
        : atRisk
            ? 'Belum latihan hari ini — jaga apinya.'
            : 'Api terjaga hari ini.';

    return (
        <div ref={ref} className="pf-hero">
            {/* Header row — name, rank emblem */}
            <div className="pf-hero-head">
                <div className="min-w-0">
                    <div className="pf-kicker">Rekor Personal</div>
                    <h2 className="pf-hero-name">{displayName || 'Hunter'}</h2>
                    <p className={`pf-hero-title ${title.color}`}>&ldquo;{title.title}&rdquo;</p>
                </div>
                <div className="pf-hero-rank">
                    <RankBadge rank={rankFromTierName(rank.name)} size="lg" isCurrent />
                    <div className={`pf-hero-rank-name ${rank.color}`}>{rank.name}</div>
                </div>
            </div>

            {/* Stat row — counts up on every visit */}
            <div className="pf-stats">
                <div className="pf-stat">
                    <div className="pf-stat-label">Level</div>
                    <CountUp value={level} duration={700} className="pf-stat-val" />
                </div>
                <div className="pf-stat">
                    <div className="pf-stat-label">Total XP</div>
                    <CountUp value={totalXP} duration={1100} format={fmtId} className="pf-stat-val is-cyan" />
                </div>
                <div className="pf-stat">
                    <div className="pf-stat-label">Workout</div>
                    <CountUp value={gymProfile.workoutsCompleted || 0} duration={800} format={fmtId} className="pf-stat-val" />
                </div>
            </div>

            {/* Lifetime XP progress bar — to next level */}
            <div>
                <div className="pf-bar-head">
                    <span className="pf-bar-label">Level {level} → {level + 1}</span>
                    <span className="pf-bar-meta tnum">
                        {fmtId(progress.current)} / {fmtId(progress.needed)} XP
                    </span>
                </div>
                <div
                    className="pf-track"
                    role="progressbar"
                    aria-label={`Progres ke level ${level + 1}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress.percent}
                >
                    <div className="pf-fill pf-fill-xp pf-grow pf-sheen" style={barStyle(progress.percent, 260)} />
                </div>
                <div className="pf-bar-foot">
                    <span />
                    <CountUp value={progress.percent} duration={900} format={pct} className="pf-bar-pct" />
                </div>
            </div>

            {/* Streak counter — tiered flame */}
            <div className={`pf-streak ${liveStreak > 0 ? '' : 'is-cold'}`}>
                <span className="pf-sr">Streak latihan {liveStreak} hari, terpanjang {bestStreak} hari.</span>
                <span className="pf-streak-flame" aria-hidden="true">
                    <StreakFlame streak={shownStreak} size={34} atRisk={atRisk} />
                </span>
                <div className="pf-streak-main" aria-hidden="true">
                    <div className="pf-streak-label">Streak Saat Ini</div>
                    <div className="pf-streak-val">
                        <StreakNumber value={shownStreak} />
                        <span className="pf-streak-unit">hari</span>
                    </div>
                    <p className="pf-streak-hint">{streakHint}</p>
                </div>
                <div className="pf-streak-best" aria-hidden="true">
                    <div className="pf-streak-best-label">Terpanjang</div>
                    <div className="pf-streak-best-val">
                        <CountUp value={bestStreak} duration={800} />
                        <span className="pf-streak-unit">h</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════
// PENGHARGAAN — Hunter Rank Track + Consistency Track
// Two horizontal progress bars: progress within current rank tier (E/D/C/B/A/S/National)
// and progress toward the next streak-title milestone (Spark Bearer → Eternal Phoenix).
// ═══════════════════════════════════════════════════════════════════
const Penghargaan: React.FC<{ gymProfile: GymProfile; liveStreak: number; bestStreak: number }> = ({
    gymProfile, liveStreak, bestStreak,
}) => {
    const ref = useRef<HTMLElement>(null);
    useInViewPause(ref);   // pauses both track sheens while scrolled away

    const level = gymProfile.level || 1;
    const longestStreak = bestStreak;

    // ── HUNTER RANK TRACK ─────────────────────────────────────────────
    const currentRank = getRankForLevel(level);
    const currentRankIdx = RANK_TIERS.findIndex(r => r.name === currentRank.name);
    const nextRank = currentRankIdx >= 0 && currentRankIdx < RANK_TIERS.length - 1
        ? RANK_TIERS[currentRankIdx + 1]
        : null;
    const rankFloor = currentRank.minLevel;
    const rankCeiling = nextRank ? nextRank.minLevel : currentRank.maxLevel + 1;
    const rankSpan = Math.max(1, rankCeiling - rankFloor);
    const rankPct = nextRank
        ? Math.max(0, Math.min(100, ((level - rankFloor) / rankSpan) * 100))
        : 100;

    // ── CONSISTENCY TRACK ─────────────────────────────────────────────
    const nextStreakMilestone = STREAK_TITLE_TIERS.find(t => t.minDays > longestStreak) || null;
    const prevStreakMilestone = [...STREAK_TITLE_TIERS]
        .reverse()
        .find(t => t.minDays <= longestStreak) || null;
    const streakFloor = prevStreakMilestone?.minDays ?? 0;
    const streakCeiling = nextStreakMilestone?.minDays ?? Math.max(longestStreak, 1);
    const streakSpan = Math.max(1, streakCeiling - streakFloor);
    const streakPct = nextStreakMilestone
        ? Math.max(0, Math.min(100, ((longestStreak - streakFloor) / streakSpan) * 100))
        : 100;

    return (
        <section ref={ref} className="s-section pf-stack">
            <div className="s-section-head pf-sec-head">
                <span className="s-section-icon s-icon-gold"><Trophy size={15} /></span>
                <div className="min-w-0">
                    <h3 className="s-section-title">Penghargaan</h3>
                    <p className="pf-sec-sub">Lacak progres rank & konsistensi-mu</p>
                </div>
            </div>

            {/* ── HUNTER RANK TRACK ───────────────────────────────────── */}
            <div className="pf-panel pf-panel-rank">
                <div className="pf-panel-head">
                    <span className="pf-panel-kicker text-cyan-400">
                        <Crown size={13} /> Hunter Rank Track
                    </span>
                    <span className="pf-panel-meta">Lv.{level}</span>
                </div>

                {/* Current → Next emblem row */}
                <div className="pf-milestones">
                    <div className="flex items-center gap-2 min-w-0">
                        <RankBadge rank={rankFromTierName(currentRank.name)} size="sm" isCurrent />
                        <div className="min-w-0">
                            <div className={`text-xs font-bold font-mono ${currentRank.color} truncate`}>{currentRank.name}</div>
                            <div className="pf-milestone-sub">Lv {rankFloor}</div>
                        </div>
                    </div>
                    {nextRank ? (
                        <div className="flex items-center gap-2 min-w-0 text-right">
                            <div className="min-w-0">
                                <div className={`text-xs font-bold font-mono ${nextRank.color} truncate`}>{nextRank.name}</div>
                                <div className="pf-milestone-sub">Lv {nextRank.minLevel}</div>
                            </div>
                            <RankBadge rank={rankFromTierName(nextRank.name)} size="sm" className="opacity-50" />
                        </div>
                    ) : (
                        <div className="text-right">
                            <div className="text-xs font-bold font-mono text-yellow-400">MAX RANK</div>
                            <div className="pf-milestone-sub">Apex Hunter</div>
                        </div>
                    )}
                </div>

                <div className="pf-track" role="progressbar" aria-label="Progres rank" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rankPct)}>
                    <div className="pf-fill pf-fill-xp pf-grow pf-sheen" style={barStyle(rankPct, 420)} />
                </div>
                <div className="pf-bar-foot">
                    <span>
                        {nextRank
                            ? `${level - rankFloor}/${rankSpan} level di ${currentRank.name}`
                            : 'Rank tertinggi tercapai'}
                    </span>
                    <CountUp value={rankPct} duration={900} format={pct} className="pf-bar-pct text-cyan-300" />
                </div>
            </div>

            {/* ── CONSISTENCY TRACK ───────────────────────────────────── */}
            <div className="pf-panel pf-panel-streak">
                <div className="pf-panel-head">
                    <span className="pf-panel-kicker text-orange-400">
                        <Flame size={13} /> Consistency Track
                    </span>
                    <span className="pf-panel-meta">
                        Terbaik <span className="text-orange-300">{longestStreak}h</span>
                        {liveStreak > 0 && (
                            <> · Kini <span className="text-orange-400">{liveStreak}h</span></>
                        )}
                    </span>
                </div>

                {/* Current → Next milestone row */}
                <div className="pf-milestones">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="pf-milestone-emoji">{prevStreakMilestone?.emoji ?? '🌱'}</span>
                        <div className="min-w-0">
                            <div className={`text-xs font-bold font-mono truncate ${prevStreakMilestone?.color ?? 'text-slate-500'}`}>
                                {prevStreakMilestone?.title ?? 'Unawakened'}
                            </div>
                            <div className="pf-milestone-sub">
                                {prevStreakMilestone ? `${prevStreakMilestone.minDays} hari` : '—'}
                            </div>
                        </div>
                    </div>
                    {nextStreakMilestone ? (
                        <div className="flex items-center gap-2 min-w-0 text-right">
                            <div className="min-w-0">
                                <div className={`text-xs font-bold font-mono truncate ${nextStreakMilestone.color}`}>{nextStreakMilestone.title}</div>
                                <div className="pf-milestone-sub">{nextStreakMilestone.minDays} hari</div>
                            </div>
                            <span className="pf-milestone-emoji is-next">{nextStreakMilestone.emoji}</span>
                        </div>
                    ) : (
                        <div className="text-right">
                            <div className="text-xs font-bold font-mono text-yellow-400">LEGEND</div>
                            <div className="pf-milestone-sub">Semua milestone tercapai</div>
                        </div>
                    )}
                </div>

                <div className="pf-track" role="progressbar" aria-label="Progres konsistensi" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(streakPct)}>
                    <div className="pf-fill pf-fill-streak pf-grow pf-sheen" style={barStyle(streakPct, 520)} />
                </div>
                <div className="pf-bar-foot">
                    <span>
                        {nextStreakMilestone
                            ? `${longestStreak - streakFloor}/${streakSpan} hari menuju milestone berikutnya`
                            : 'Eternal Phoenix terbangun'}
                    </span>
                    <CountUp value={streakPct} duration={900} format={pct} className="pf-bar-pct text-orange-300" />
                </div>
            </div>
        </section>
    );
};

// ═══════════════════════════════════════════════════════════════════
// Phase 6 — Compare UI (Monthly XP + Workouts vs another user)
// A skeleton holds the final geometry while rivals load (no ~350px jump
// under the reader), and the VS block re-keys per opponent so switching
// cross-fades and re-charges the bars instead of snapping.
// ═══════════════════════════════════════════════════════════════════
const CompareSection: React.FC<{ gymProfile: GymProfile; displayName: string; myStreak: number }> = ({
    gymProfile, displayName, myStreak,
}) => {
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
        } catch (e) {
            console.error('[CompareSection] load users failed', e);
            setError('Gagal memuat daftar rival. Coba muat ulang.');
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

    const maxXP = Math.max(myMonthlyXP, selected?.monthlyXP ?? 0, 1);
    const maxWorkouts = Math.max(myMonthlyWorkouts, selected?.monthlyWorkouts ?? 0, 1);

    // Streak Leading/Behind delta (positive = you're ahead).
    const streakDelta = selected ? myStreak - selected.currentStreak : 0;

    return (
        <div className="jarvis-card p-5 rounded-2xl">
            <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center space-x-3 min-w-0">
                    <BarChart3 size={22} className="text-purple-400 shrink-0" />
                    <div className="min-w-0">
                        <h3 className="text-lg font-bold text-white">Peringkat Bulan Ini</h3>
                        <p className="text-[11px] text-slate-500 font-mono">
                            Reset tiap tanggal 1 • Bandingkan dengan Hunter lain
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={loadUsers}
                    disabled={loading}
                    className="pf-mini-btn"
                >
                    {loading ? <Loader2 size={13} className="animate-spin" /> : <UsersIcon size={13} />}
                    <span>{loading ? 'Memuat' : 'Muat ulang'}</span>
                </button>
            </div>

            {error && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-3 py-2 rounded-lg text-xs mb-3" role="alert">
                    {error}
                </div>
            )}

            {loading && !loaded ? (
                <div className="pf-cmp-skel" aria-busy="true" aria-label="Memuat rival">
                    <div className="pf-skel" style={{ height: 44 }} />
                    <div className="pf-skel" style={{ height: 76 }} />
                    <div className="pf-skel" style={{ height: 64 }} />
                    <div className="pf-skel" style={{ height: 64 }} />
                    <div className="pf-skel" style={{ height: 96 }} />
                </div>
            ) : users.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500 font-mono">
                    Belum ada Hunter lain — ajak temanmu!
                </div>
            ) : (
                <>
                    {/* Rival Selector */}
                    <div className="mb-4">
                        <label className="block text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-1.5">Lawan</label>
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
                        <div key={selected.id} className="space-y-4 pf-swap">
                            {/* VS header */}
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                                <StatHead name={displayName || 'Kamu'} label="KAMU" accent="cyan" />
                                <div className="text-xs font-bold font-mono text-slate-500 px-2">VS</div>
                                <StatHead name={selected.name} label={selected.rank} accent="purple" photoURL={selected.photoURL} />
                            </div>

                            {/* Current Month XP */}
                            <CompareBar
                                label="XP Bulan Ini"
                                myValue={myMonthlyXP}
                                theirValue={selected.monthlyXP}
                                max={maxXP}
                                delayMs={120}
                            />

                            {/* Current Month Workouts */}
                            <CompareBar
                                label="Workout Bulan Ini"
                                myValue={myMonthlyWorkouts}
                                theirValue={selected.monthlyWorkouts}
                                max={maxWorkouts}
                                delayMs={240}
                            />

                            {/* Streak mini row + Leading/Behind indicator */}
                            <div className="pt-2 border-t border-slate-800 space-y-2">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-3 text-center">
                                        <div className="text-[9px] font-mono uppercase text-cyan-300/70">Streak Kamu</div>
                                        <div className="text-xl font-bold text-cyan-300 font-mono flex items-center justify-center gap-1.5">
                                            <StreakFlame streak={myStreak} size={16} celebrate={false} />
                                            <CountUp value={myStreak} duration={700} />
                                        </div>
                                    </div>
                                    <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-3 text-center">
                                        <div className="text-[9px] font-mono uppercase text-purple-300/70">Streak Rival</div>
                                        <div className="text-xl font-bold text-purple-300 font-mono flex items-center justify-center gap-1.5">
                                            <StreakFlame streak={selected.currentStreak} size={16} celebrate={false} phase={700} />
                                            <CountUp value={selected.currentStreak} duration={700} />
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
                                        ? `↑ Unggul ${streakDelta} hari`
                                        : streakDelta < 0
                                            ? `↓ Tertinggal ${Math.abs(streakDelta)} hari`
                                            : '⚖ Seri'}
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
        <div className={`flex flex-col items-center text-center rounded-xl p-2 border min-w-0 ${color}`}>
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
    delayMs: number;
}> = ({ label, myValue, theirValue, max, delayMs }) => {
    const myPct = (myValue / max) * 100;
    const theirPct = (theirValue / max) * 100;
    const verdict = myValue > theirValue ? 'lead' : myValue < theirValue ? 'behind' : 'tie';

    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">{label}</span>
                <span className={`text-[10px] font-mono font-bold ${verdict === 'lead' ? 'text-emerald-400' : verdict === 'behind' ? 'text-rose-400' : 'text-slate-400'}`}>
                    {verdict === 'lead' ? '↑ Unggul' : verdict === 'behind' ? '↓ Tertinggal' : '⚖ Seri'}
                </span>
            </div>
            {/* Your bar */}
            <div className="pf-cmp-row mb-1.5">
                <span className="pf-cmp-who text-cyan-300">KAMU</span>
                <div className="pf-cmp-track">
                    <div className="pf-fill pf-fill-you pf-grow" style={barStyle(myPct, delayMs)} />
                </div>
                <CountUp value={myValue} duration={800} format={fmtId} className="pf-cmp-val text-cyan-300" />
            </div>
            {/* Their bar */}
            <div className="pf-cmp-row">
                <span className="pf-cmp-who text-purple-300">RIVAL</span>
                <div className="pf-cmp-track">
                    <div className="pf-fill pf-fill-rival pf-grow" style={barStyle(theirPct, delayMs + 100)} />
                </div>
                <CountUp value={theirValue} duration={800} format={fmtId} className="pf-cmp-val text-purple-300" />
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
