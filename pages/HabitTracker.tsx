import React, { useState, useEffect } from 'react';
import { Habit } from '../types';
import { storageService } from '../services/storageService';
import { aiService } from '../services/aiService';
import { computeFatigue } from '../services/fatigueService';
import { achievementService } from '../services/achievementService';
import { useAchievements } from '../context/AchievementContext';
import {
  Plus, Trash2, Check, Trophy, Zap, Target, Sparkles, Loader2,
  Activity, Flame, Clock, Shield,
} from 'lucide-react';
import { NewHabitModal, NewHabitPayload } from '../components/habits/NewHabitModal';

// ── Streak helpers (preserved verbatim from prior implementation) ──
const calculateStreak = (completedDates: string[] | undefined | null): number => {
  if (!completedDates || !Array.isArray(completedDates) || completedDates.length === 0) return 0;

  const sorted = [...(completedDates || [])].sort((a, b) => b.localeCompare(a));
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const lastDate = sorted[0];
  if (lastDate !== today && lastDate !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < (sorted?.length || 0); i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000);
    if (diff === 1) streak++;
    else break;
  }
  return streak;
};

const calculateLongestStreak = (completedDates: string[] | undefined | null): number => {
  if (!completedDates || !Array.isArray(completedDates) || completedDates.length === 0) return 0;
  const sorted = [...(completedDates || [])].sort();
  let longest = 1;
  let current = 1;
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

// ═══════════════════════════════════════════════════════════════
// Daily Protocol — System AI evaluator (Phase 4)
// Same prompt + handler as before; just restyled with .h-system classes.
// ═══════════════════════════════════════════════════════════════
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
    <article className="h-system reveal" style={{ ['--reveal-i' as string]: 3 }}>
      <div className="h-system-glow" />
      <div className="h-system-head">
        <div className="h-system-icon">
          <Sparkles size={16} />
          <span className="h-system-icon-halo" />
        </div>
        <div className="h-system-text">
          <div className="hud-label">DAILY PROTOCOL</div>
          <div className="h-system-sub">System AI evaluation — habits × gym × fatigue</div>
        </div>
        <button type="button" className="h-system-eval"
          onClick={runEvaluation} disabled={loading}>
          {loading
            ? <><Loader2 size={12} className="animate-spin" />DELIBERATING</>
            : <><Activity size={12} />{verdict ? 'RE-EVALUATE' : 'EVALUATE NOW'}</>}
        </button>
      </div>

      {!verdict && !loading && !error && (
        <p className="h-system-body">
          Ketuk <strong className="fz-orange">Evaluate Now</strong> untuk menerima verdict yang
          dipersonalisasi — System akan menganalisa penyelesaian habit, performa gym terakhir,
          streak saat ini, dan fatigue otot, lalu memberikan langkah berikutnya.
        </p>
      )}

      {error && (
        <div className="h-system-verdict" style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}>
          <div className="h-system-verdict-label" style={{ color: 'var(--red)' }}>SYSTEM ERROR</div>
          <div className="h-system-verdict-body">{error}</div>
        </div>
      )}

      {verdict && !loading && (
        <div className="h-system-verdict">
          <div className="h-system-verdict-label">THE SYSTEM</div>
          <div className="h-system-verdict-body">{verdict}</div>
          {evaluatedAt && (
            <div className="h-system-verdict-meta">
              Verdict at {new Date(evaluatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      )}
    </article>
  );
};

// ═══════════════════════════════════════════════════════════════
// HabitTracker — main screen
// ═══════════════════════════════════════════════════════════════
export const HabitTracker: React.FC = () => {
  const { addUnlocks } = useAchievements();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [tokenToast, setTokenToast] = useState<string | null>(null);

  useEffect(() => {
    const loadedHabits = storageService.getHabits();
    const recalculated = loadedHabits.map(h => ({
      ...h,
      streak: calculateStreak(h.completedDates),
    }));
    setHabits(recalculated);
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const completedToday = habits.filter(h => h.completedDates?.includes(today))?.length;
  const totalHabits = habits?.length;
  const percentage = totalHabits > 0 ? Math.round((completedToday / totalHabits) * 100) : 0;
  const bestStreakOverall = habits.reduce(
    (max, h) => Math.max(max, calculateLongestStreak(h.completedDates || [])), 0,
  );
  const allTimeCompletions = habits.reduce((sum, h) => sum + (h.completedDates?.length || 0), 0);
  const allDone = totalHabits > 0 && completedToday === totalHabits;

  // Last-7-days array (Mon-relative to today)
  // Prototype uses 0..6 = SEN..MIN, with today index = 6 in the seeded example.
  // We use actual dates so the checkboxes line up correctly.
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      date: d.toISOString().split('T')[0],
      label: ['S','M','T','W','T','F','S'][d.getDay()],
      isToday: d.toISOString().split('T')[0] === today,
    };
  });

  const toggleDay = (habitId: string, dateISO: string) => {
    const updated = habits.map(h => {
      if (h.id !== habitId) return h;
      const isCompleted = h.completedDates?.includes(dateISO);
      const newDates = isCompleted
        ? (h.completedDates || []).filter(d => d !== dateISO)
        : [...(h.completedDates || []), dateISO];
      return { ...h, completedDates: newDates, streak: calculateStreak(newDates) };
    });
    setHabits(updated);
    storageService.saveHabits(updated);

    // Phase 4: grant a Streak Freeze Token when ALL daily habits are now done.
    if (updated.length > 0 && updated.every(h => h.completedDates?.includes(today))) {
      const granted = storageService.grantStreakToken();
      if (granted) {
        const remaining = storageService.getGymProfile().streakFreezeTokens || 0;
        setTokenToast(`+1 Streak Freeze Token  (${remaining}/3)`);
        window.setTimeout(() => setTokenToast(null), 2800);
      }
    }

    try {
      const unlocks = achievementService.checkAndGrant(undefined, undefined, updated);
      if (unlocks.length > 0) addUnlocks(unlocks);
    } catch (e) { console.error('[HabitTracker] achievement check:', e); }
  };

  const addHabit = (data: NewHabitPayload) => {
    const newHabit: Habit = {
      id: Date.now().toString(),
      name: data.title,
      cue: data.description || undefined,
      streak: 0,
      completedDates: [],
    };
    const updated = [...habits, newHabit];
    setHabits(updated);
    storageService.saveHabits(updated);
  };

  const deleteHabit = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = habits.filter(h => h.id !== id);
    setHabits(updated);
    storageService.saveHabits(updated);
  };

  return (
    <div className="pb-24">
      {/* Hero */}
      <section className="h-hero reveal" style={{ ['--reveal-i' as string]: 0 }}>
        <h1 className="h-title">
          Habit <span className="fz-orange">Algorithms</span>
        </h1>
        <p className="h-subtitle">Atomic Habits Protocol — Satu Hari pada Suatu Waktu</p>
      </section>

      {/* New Protocol CTA */}
      <button type="button" className="h-newproto reveal"
        style={{ ['--reveal-i' as string]: 1 }}
        onClick={() => setShowAddModal(true)}>
        <span className="h-newproto-glow" />
        <span className="h-newproto-ico"><Plus size={14} /></span>
        <span>Protokol Baru</span>
      </button>

      {/* Stats */}
      <div className="h-stats reveal" style={{ ['--reveal-i' as string]: 2 }}>
        <div className="h-stat h-stat-cyan">
          <div className="h-stat-icon"><Target size={16} /></div>
          <div className="h-stat-val">{percentage}%</div>
          <div className="h-stat-sub">{completedToday}/{totalHabits} HARI INI</div>
        </div>
        <div className="h-stat h-stat-orange">
          <div className="h-stat-icon"><Trophy size={16} /></div>
          <div className="h-stat-val">{bestStreakOverall}</div>
          <div className="h-stat-sub">STREAK TERBAIK</div>
        </div>
        <div className="h-stat h-stat-cyan">
          <div className="h-stat-icon"><Zap size={16} /></div>
          <div className="h-stat-val">{allTimeCompletions}</div>
          <div className="h-stat-sub">SEPANJANG WAKTU</div>
        </div>
      </div>

      {/* Daily Protocol (System AI) */}
      <DailyProtocolEvaluator
        habits={habits}
        completedToday={completedToday}
        totalHabits={totalHabits}
        percentage={percentage}
      />

      {/* Freeze banner when all habits done */}
      {allDone && (
        <div className="h-freeze reveal" style={{ ['--reveal-i' as string]: 4 }}>
          <span className="h-freeze-shield"><Shield size={16} /></span>
          <div>
            <div className="h-freeze-title">+1 Token Freeze diperoleh</div>
            <div className="h-freeze-sub">Selesaikan semua habit harian → bekukan streak satu hari</div>
          </div>
        </div>
      )}

      {/* Habit cards */}
      <div className="h-list">
        {habits.map((h, idx) => {
          const isDoneToday = h.completedDates?.includes(today);
          const colorVariant = idx % 2 === 0 ? 'cyan' : 'orange';
          return (
            <article key={h.id} className={`h-card reveal h-card-${colorVariant}`}
              style={{ ['--reveal-i' as string]: 5 + idx }}>
              <div className="h-card-top">
                <button type="button" className="h-card-check"
                  onClick={() => toggleDay(h.id, today)}
                  aria-label={isDoneToday ? 'Tandai belum' : 'Tandai selesai'}>
                  <span className={`h-card-check-circle ${isDoneToday ? 'is-on' : ''}`}>
                    {isDoneToday && <Check size={14} />}
                  </span>
                </button>
                <div>
                  <h3 className={`h-card-title ${isDoneToday ? 'is-done' : ''}`}>{h.name}</h3>
                  {h.cue && (
                    <div className="h-card-cue">
                      <Clock size={10} className="h-card-cue-ico" />
                      <span>{h.cue}</span>
                    </div>
                  )}
                </div>
                <div className="h-card-meta">
                  <span className="h-card-streak">
                    <span className="h-card-flame"><Flame size={12} /></span>
                    <span>{h.streak}</span>
                  </span>
                  <span className="h-card-xp">
                    <Trophy size={11} /> {Math.max(1, Math.floor(h.streak / 7) + 1)}
                  </span>
                  <button type="button" className="h-card-trash"
                    onClick={(e) => deleteHabit(e, h.id)}
                    aria-label="Hapus habit">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <div className="h-week">
                {last7Days.map((day) => {
                  const checked = h.completedDates?.includes(day.date);
                  return (
                    <button key={day.date} type="button"
                      className={`h-day ${checked ? 'is-on' : ''} ${day.isToday ? 'is-today' : ''}`}
                      onClick={() => toggleDay(h.id, day.date)}
                      aria-label={`${day.date}: ${checked ? 'Selesai' : 'Belum'}`}>
                      <span className="h-day-label">{day.label}</span>
                      <span className="h-day-box">
                        {checked && (
                          <svg className="h-day-check" width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M5 12.5 L10 17.5 L19 8.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </article>
          );
        })}

        {habits.length === 0 && (
          <div className="h-empty">
            <span className="brk-c brk-tl" /><span className="brk-c brk-tr" />
            <span className="brk-c brk-bl" /><span className="brk-c brk-br" />
            <div className="h-empty-title">Belum ada habit</div>
            <div className="h-empty-sub">Ketuk &ldquo;Protokol Baru&rdquo; untuk memulai.</div>
          </div>
        )}
      </div>

      {/* Freeze token toast */}
      {tokenToast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[70] px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm shadow-[0_0_25px_rgba(6,182,212,0.55)] flex items-center gap-2">
          <Shield size={14} />
          {tokenToast}
        </div>
      )}

      {/* New habit modal (slide-up) */}
      <NewHabitModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreate={addHabit}
      />
    </div>
  );
};
