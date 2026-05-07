import React, { useState, useEffect } from 'react';
import { Habit } from '../types';
import { storageService } from '../services/storageService';
import { aiService } from '../services/aiService';
import { computeFatigue } from '../services/fatigueService';
import { achievementService } from '../services/achievementService';
import { useAchievements } from '../context/AchievementContext';
import { Plus, Trash2, CheckCircle2, Circle, X, Clock, Flame, Trophy, Zap, Target, Sparkles, Loader2, Activity } from 'lucide-react';

// Calculate current streak properly (consecutive days including today or yesterday)
const calculateStreak = (completedDates: string[] | undefined | null): number => {
  // 1. Cek dulu: kalau bukan array atau kosong, langsung kasih 0
  // Gunakan Array.isArray untuk memastikan ini beneran daftar tanggal
  if (!completedDates || !Array.isArray(completedDates) || completedDates.length === 0) {
    return 0;
  }

  // 2. Gunakan || [] di sini sebagai pengaman spread operator
  const sorted = [...(completedDates || [])].sort((a, b) => b.localeCompare(a));
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const lastDate = sorted[0];
  if (lastDate !== today && lastDate !== yesterday) return 0;

  let streak = 1;
  // 3. Gunakan ?.length untuk berjaga-jaga di loop
  for (let i = 1; i < (sorted?.length || 0); i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000);
    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
};

// Calculate longest streak ever
const calculateLongestStreak = (completedDates: string[] | undefined | null): number => {
  // 1. Cek: Kalau bukan array atau kosong, langsung kasih 0
  if (!completedDates || !Array.isArray(completedDates) || completedDates.length === 0) {
    return 0;
  }

  // 2. Gunakan "ban serep" || [] saat melakukan spread operator
  const sorted = [...(completedDates || [])].sort();
  let longest = 1;
  let current = 1;

  // 3. Loop dengan pengaman length
  for (let i = 1; i < (sorted?.length || 0); i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);

    if (diff === 1) {
      current++;
      longest = Math.max(longest, current);
    } else if (diff > 1) {
      current = 1;
    }
  }
  return longest;
};

// ═══════════════════════════════════════════════════════════════════
// Project Chimera Phase 4 — Daily Protocol System AI Evaluator
// Bundles habit completion %, recent gym performance, current streak,
// and the Phase-2 Fatigue score into a structured prompt for the
// System (aiService.chat). Surfaces tailored advice in a card.
// ═══════════════════════════════════════════════════════════════════
const DailyProtocolEvaluator: React.FC<{
    habits: Habit[];
    completedToday: number;
    totalHabits: number;
    percentage: number;
}> = ({ habits, completedToday, totalHabits, percentage }) => {
    const [verdict, setVerdict] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [evaluatedAt, setEvaluatedAt] = useState<number | null>(null);

    const runEvaluation = async () => {
        setLoading(true);
        setError(null);
        setVerdict(null);
        try {
            const userState = storageService.getUserState();
            const profile = storageService.getGymProfile();
            const workouts = storageService.getWorkouts();
            const fatigue = computeFatigue(workouts, Date.now(), userState.gender);

            const today = new Date().toISOString().split('T')[0];
            const habitLines = habits.map(h => {
                const done = h.completedDates?.includes(today) ? 'DONE' : 'pending';
                return `  - ${h.name} [${done}, streak ${h.streak}d]`;
            }).join('\n') || '  (no protocols defined)';

            const recentWorkouts = workouts.slice(0, 5).map(w =>
                `  - ${w.date}: ${w.type} (${w.exercises.length} exercises, +${w.xpEarned || 0} XP)`,
            ).join('\n') || '  (no recent workouts)';

            const fatigueLine = `${fatigue.score}/100 (${fatigue.label})`;
            const recoveringMuscles = fatigue.perMuscle
                .filter(m => m.fatigue > 30)
                .sort((a, b) => b.fatigue - a.fatigue)
                .slice(0, 4)
                .map(m => `${m.muscle}=${m.fatigue}`)
                .join(', ') || 'all muscles fresh';

            const prompt = [
                '=== DAILY PROTOCOL EVALUATION REQUEST ===',
                `Date: ${today}`,
                `Hunter: ${userState.name || 'Unnamed'}, Lv ${profile.level || 1} ${profile.rank || 'E-Rank'}`,
                `Goal: ${userState.fitnessGoal} (${userState.activityLevel} activity)`,
                '',
                `HABIT COMPLETION: ${completedToday}/${totalHabits} done today (${percentage}%)`,
                habitLines,
                '',
                `GYM PERFORMANCE:`,
                `  Current streak: ${profile.currentStreak ?? 0} days (best ${profile.longestStreak ?? 0})`,
                `  Workouts this month: ${profile.monthlyWorkouts ?? 0}`,
                `  Recent sessions:`,
                recentWorkouts,
                '',
                `RECOVERY / FATIGUE STATUS:`,
                `  Overall fatigue: ${fatigueLine}`,
                `  Recovering muscles: ${recoveringMuscles}`,
                '',
                'Evaluate the user holistically. In 3-4 sentences (ID/EN mix is fine):',
                '1. Acknowledge what they got right today.',
                '2. Flag the weakest signal (habits OR gym OR recovery).',
                '3. Give ONE concrete next action — respect fatigue. If fatigue is high, suggest active recovery; if low, push intensity.',
                'Use the Solo Leveling System voice. Do NOT invoke any tools — just deliver the verdict text.',
            ].join('\n');

            const reply = await aiService.chat(prompt);
            setVerdict(reply || '[The System returned no reply.]');
            setEvaluatedAt(Date.now());
        } catch (e: any) {
            console.error('[DailyProtocol] eval failed:', e);
            setError(e?.message || 'The System is unreachable.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-slide-up delay-150 jarvis-card rounded-xl border border-red-500/30 bg-gradient-to-br from-slate-900 via-red-500/5 to-slate-900 relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-44 h-44 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center shadow-lg shadow-red-500/40">
                            <Sparkles size={18} className="text-white" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-sm font-bold text-white uppercase tracking-widest font-mono">Daily Protocol</h3>
                            <p className="text-[10px] text-slate-500 font-mono truncate">
                                System AI evaluation — habits × gym × fatigue
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={runEvaluation}
                        disabled={loading}
                        className="shrink-0 flex items-center gap-1.5 bg-gradient-to-r from-red-500 to-amber-500 hover:from-red-400 hover:to-amber-400 disabled:opacity-60 text-white text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-lg shadow-lg shadow-red-500/30 transition-all"
                    >
                        {loading ? <Loader2 size={12} className="animate-spin" /> : <Activity size={12} />}
                        {loading ? 'Deliberating' : verdict ? 'Re-evaluate' : 'Evaluate Now'}
                    </button>
                </div>

                {!verdict && !loading && !error && (
                    <p className="text-xs text-slate-400 leading-relaxed">
                        Tap <span className="text-red-400 font-mono font-bold">Evaluate Now</span> to receive a tailored verdict — the System will analyze habit completion, recent gym performance, your current streak, and muscle fatigue, then advise the next move.
                    </p>
                )}

                {error && (
                    <div className="bg-red-500/10 border border-red-500/40 text-red-400 px-3 py-2 rounded-lg text-xs">
                        {error}
                    </div>
                )}

                {loading && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono py-2">
                        <Loader2 size={14} className="text-red-400 animate-spin" />
                        Synthesizing habit, gym, and recovery signals…
                    </div>
                )}

                {verdict && !loading && (
                    <div className="bg-slate-950/60 border border-red-500/20 rounded-lg p-3">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-red-400 mb-1">The System</div>
                        <p className="text-sm text-slate-100 leading-relaxed whitespace-pre-line">{verdict}</p>
                        {evaluatedAt && (
                            <p className="text-[9px] font-mono text-slate-600 mt-2">
                                Verdict at {new Date(evaluatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export const HabitTracker: React.FC = () => {
  const { addUnlocks } = useAchievements();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitCue, setNewHabitCue] = useState('');
  const [tokenToast, setTokenToast] = useState<string | null>(null);

  useEffect(() => {
    const loadedHabits = storageService.getHabits();
    // Recalculate streaks on load
    const recalculated = loadedHabits.map(h => ({
      ...h,
      streak: calculateStreak(h.completedDates)
    }));
    setHabits(recalculated);
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const completedToday = habits.filter(h => h.completedDates?.includes(today))?.length;
  const totalHabits = habits?.length;
  const percentage = totalHabits > 0 ? Math.round((completedToday / totalHabits) * 100) : 0;
  const bestStreakOverall = habits.reduce((max, h) => Math.max(max, calculateLongestStreak(h.completedDates || [])), 0);

  const toggleHabit = (id: string) => {
    const updated = habits.map(h => {
      if (h.id !== id) return h;

      const isCompleted = h.completedDates?.includes(today);
      let newDates: string[];

      if (isCompleted) {
        newDates = h.completedDates?.filter(d => d !== today);
      } else {
        newDates = [...h.completedDates, today];
      }

      return {
        ...h,
        completedDates: newDates,
        streak: calculateStreak(newDates)
      };
    });

    setHabits(updated);
    storageService.saveHabits(updated);

    // Phase 4: grant a Streak Freeze Token when ALL daily habits are now done.
    // grantStreakToken self-rate-limits (max 3 tokens, max 1 earned/day) so we
    // don't need to guard here — call it and let storage decide.
    if (updated.length > 0 && updated.every(h => h.completedDates?.includes(today))) {
      const granted = storageService.grantStreakToken();
      if (granted) {
        const remaining = storageService.getGymProfile().streakFreezeTokens || 0;
        setTokenToast(`+1 Streak Freeze Token  (${remaining}/3)`);
        window.setTimeout(() => setTokenToast(null), 2800);
      }
    }

    // Achievement check — habit-category entries (habit_starter, etc.) and
    // anything XP-bumped by a token grant re-evaluates against fresh state.
    try {
      const unlocks = achievementService.checkAndGrant(undefined, undefined, updated);
      if (unlocks.length > 0) addUnlocks(unlocks);
    } catch (e) { console.error('[HabitTracker] achievement check:', e); }
  };

  const handleAddHabit = () => {
    if (!newHabitName.trim()) return;

    const newHabit: Habit = {
      id: Date.now().toString(),
      name: newHabitName.trim(),
      cue: newHabitCue.trim() || undefined,
      streak: 0,
      completedDates: []
    };

    const updated = [...habits, newHabit];
    setHabits(updated);
    storageService.saveHabits(updated);
    setNewHabitName('');
    setNewHabitCue('');
    setShowAddModal(false);
  };

  const handleDeleteHabit = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = habits.filter(h => h.id !== id);
    setHabits(updated);
    storageService.saveHabits(updated);
  };

  // Get last 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      date: d.toISOString().split('T')[0],
      label: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
      isToday: d.toISOString().split('T')[0] === today
    };
  });

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 animate-slide-up">
        <div>
          <h2 className="text-3xl font-extrabold text-white mb-1">Habit Algorithms</h2>
          <p className="text-slate-400">Atomic Habits Protocol—One Day at a Time</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-2.5 px-5 rounded-xl flex items-center space-x-2 transition-all shadow-lg shadow-amber-500/20"
        >
          <Plus size={18} />
          <span>New Protocol</span>
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 md:gap-4 animate-slide-up delay-100">
        {/* Daily Progress */}
        <div className="jarvis-card p-4 md:p-5 rounded-xl text-center relative overflow-hidden" style={{ transform: 'none' }}>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500" style={{ width: `${percentage}%` }} />
          <Target size={20} className="mx-auto text-amber-400 mb-2" />
          <span className="text-3xl font-extrabold text-white block">{percentage}%</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest">{completedToday}/{totalHabits} Today</span>
        </div>

        {/* Best Streak */}
        <div className="jarvis-card p-4 md:p-5 rounded-xl text-center" style={{ transform: 'none' }}>
          <Trophy size={20} className="mx-auto text-amber-400 mb-2" />
          <span className="text-3xl font-extrabold text-amber-400 block streak-fire">{bestStreakOverall}</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest">Best Streak</span>
        </div>

        {/* Total Completions */}
        <div className="jarvis-card p-4 md:p-5 rounded-xl text-center" style={{ transform: 'none' }}>
          <Zap size={20} className="mx-auto text-cyan-400 mb-2" />
          <span className="text-3xl font-extrabold text-white block">
            {habits.reduce((sum, h) => sum + h.completedDates?.length, 0)}
          </span>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest">All-Time</span>
        </div>
      </div>

      {/* ═══ Project Chimera Phase 4: Daily Protocol — System AI Evaluation ═══ */}
      <DailyProtocolEvaluator
        habits={habits}
        completedToday={completedToday}
        totalHabits={totalHabits}
        percentage={percentage}
      />

      {/* 7-Day Calendar Grid per Habit */}
      <div className="space-y-3 animate-slide-up delay-200">
        {habits.map((habit) => {
          const isCompletedToday = habit.completedDates?.includes(today);
          const longestStreak = calculateLongestStreak(habit.completedDates);

          return (
            <div key={habit.id} className={`jarvis-card rounded-xl overflow-hidden transition-all ${isCompletedToday ? 'border-emerald-500/30' : ''}`} style={{ transform: 'none' }}>
              {/* Habit Header */}
              <div className="p-4 flex items-start justify-between">
                <div
                  className="flex items-start space-x-3 flex-1 cursor-pointer"
                  onClick={() => toggleHabit(habit.id)}
                >
                  <div className={`mt-0.5 transition-all duration-300 ${isCompletedToday ? 'text-emerald-400 scale-110' : 'text-slate-600 hover:text-slate-400'}`}>
                    {isCompletedToday ? (
                      <CheckCircle2 size={24} className="drop-shadow-lg" />
                    ) : (
                      <Circle size={24} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-bold text-base transition-all ${isCompletedToday ? 'text-emerald-400 line-through decoration-emerald-500/50' : 'text-white'
                      }`}>
                      {habit.name}
                    </h3>
                    {habit.cue && (
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center">
                        <Clock size={10} className="mr-1 text-amber-500" />
                        {habit.cue}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-3 shrink-0 ml-3">
                  {/* Current Streak */}
                  <div className="flex items-center space-x-1 bg-slate-800 rounded-lg px-2 py-1">
                    <Flame size={12} className={habit.streak > 0 ? 'text-amber-500' : 'text-slate-600'} />
                    <span className={`text-xs font-bold font-mono ${habit.streak > 0 ? 'text-amber-400' : 'text-slate-600'}`}>
                      {habit.streak}
                    </span>
                  </div>
                  {/* Best Streak */}
                  {longestStreak > 0 && (
                    <div className="flex items-center space-x-1 bg-amber-500/10 rounded-lg px-2 py-1 border border-amber-500/20">
                      <Trophy size={10} className="text-amber-500" />
                      <span className="text-[10px] font-bold text-amber-400 font-mono">{longestStreak}</span>
                    </div>
                  )}
                  {/* Delete */}
                  <button
                    onClick={(e) => handleDeleteHabit(e, habit.id)}
                    className="text-slate-700 hover:text-rose-500 transition-colors p-1"
                    title="Delete habit"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* 7-Day Grid */}
              <div className="px-4 pb-4">
                <div className="flex justify-between items-center bg-slate-900/50 rounded-lg p-2.5 border border-slate-800">
                  {last7Days.map(day => {
                    const completed = habit.completedDates?.includes(day.date);
                    return (
                      <div key={day.date} className="flex flex-col items-center space-y-1.5">
                        <span className={`text-[9px] font-bold uppercase ${day.isToday ? 'text-cyan-400' : 'text-slate-600'}`}>
                          {day.label}
                        </span>
                        <div
                          className={`heatmap-cell ${completed
                            ? 'bg-emerald-500 shadow-md shadow-emerald-500/30'
                            : day.isToday
                              ? 'bg-slate-700 border border-dashed border-slate-500'
                              : 'bg-slate-800'
                            }`}
                          title={`${day.date}: ${completed ? 'Completed' : 'Missed'}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {habits?.length === 0 && (
          <div className="jarvis-card p-12 rounded-xl text-center" style={{ transform: 'none' }}>
            <Target size={40} className="mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400 text-lg font-medium mb-2">No protocols defined yet.</p>
            <p className="text-slate-600 text-sm">Click "New Protocol" to start building your first habit.</p>
          </div>
        )}
      </div>

      {/* Phase 4 Streak Freeze Token earn toast */}
      {tokenToast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[70] px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm shadow-[0_0_25px_rgba(6,182,212,0.55)] animate-slide-up flex items-center gap-2">
          <span className="drop-shadow-[0_0_4px_rgba(255,255,255,0.9)]">🛡️</span>
          {tokenToast}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-jarvis-card w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl p-6 animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">New Protocol</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">Habit Name</label>
                <input
                  type="text"
                  value={newHabitName}
                  onChange={(e) => setNewHabitName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500 placeholder-slate-600"
                  placeholder="e.g. Read 10 pages"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">Cue / Trigger <span className="text-slate-600">(optional)</span></label>
                <input
                  type="text"
                  value={newHabitCue}
                  onChange={(e) => setNewHabitCue(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500 placeholder-slate-600"
                  placeholder="e.g. After morning coffee"
                />
                <p className="text-[10px] text-slate-500 mt-1.5">
                  💡 Habit Stacking: "After [EXISTING HABIT], I will [NEW HABIT]"
                </p>
              </div>
            </div>

            <div className="flex space-x-3 mt-8">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddHabit}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold shadow-lg shadow-amber-500/20"
              >
                Activate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};