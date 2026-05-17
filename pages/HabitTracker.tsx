import React, { useState, useEffect } from 'react';
import { Habit, HabitSubTask } from '../types';
import { storageService } from '../services/storageService';
import { aiService } from '../services/aiService';
import { computeFatigue } from '../services/fatigueService';
import { achievementService } from '../services/achievementService';
import { useAchievements } from '../context/AchievementContext';
import {
  Plus, Trash2, Trophy, Zap, Target, Loader2, Flame, Clock, Shield, Check,
} from 'lucide-react';
import { NewHabitModal, NewHabitPayload } from '../components/habits/NewHabitModal';
import { SystemNotification } from '../components/hud';

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
// DailyProtocolEvaluator — wrapped in .sys-frame (inline mode).
// Uses the SystemNotification cta slot for "Evaluate Now" so the
// pill sits right-edge of .sys-head per the canonical reference.
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
    } catch (e) {
      console.error('[DailyProtocol] eval failed:', e);
      setError((e as Error)?.message || 'The System is unreachable.');
    } finally {
      setLoading(false);
    }
  };

  const evaluateCta = (
    <button type="button" className="sys-cta" onClick={runEvaluation} disabled={loading}>
      {loading
        ? <><Loader2 size={12} className="animate-spin" /><span>Deliberating</span></>
        : <><span className="sys-cta-bolt">⚡</span><span>{verdict ? 'Re-evaluate' : 'Evaluate Now'}</span></>}
    </button>
  );

  return (
    <div className="reveal" style={{ ['--reveal-i' as string]: 3 }}>
      <SystemNotification
        mode="inline"
        tone="cyan"
        closable={false}
        title="Daily Protocol"
        subtitle="system ai evaluation — habits × gym × recovery"
        cta={evaluateCta}
      >
        {!verdict && !loading && !error && (
          <p style={{ margin: 0 }}>
            Ketuk <strong style={{ color: 'var(--sys-cyan-3)' }}>Evaluate Now</strong> untuk menerima
            verdict yang dipersonalisasi — System akan menganalisa penyelesaian habit, performa gym
            terakhir, streak saat ini, dan fatigue otot, lalu memberikan langkah berikutnya.
          </p>
        )}
        {error && (
          <div className="sys-chat-error">{error}</div>
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
      </SystemNotification>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// HabitTracker — main screen
// Every habit card is wrapped in <SystemNotification mode="inline">
// per user spec ("kayanya gw mau ganti kotak sama dengan kotak pesan").
// The body holds the weekly 7-day grid + optional sub-task checklist.
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

  /**
   * Persist updated habit list and run the "all daily habits done" side-effects:
   *   - grant a streak-freeze token (rate-limited inside storageService),
   *   - re-run achievement evaluation against the fresh state.
   */
  const persist = (updated: Habit[]) => {
    setHabits(updated);
    storageService.saveHabits(updated);

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

  /**
   * Toggle a date's completion for the parent habit (single-toggle path).
   * For habits with subTasks defined, this still fires from the weekly
   * grid as a manual override (mark whole day done/undone regardless of
   * per-sub-task state).
   */
  const togglePerDay = (habitId: string, dateISO: string) => {
    const updated = habits.map(h => {
      if (h.id !== habitId) return h;
      const isCompleted = h.completedDates?.includes(dateISO);
      const newDates = isCompleted
        ? (h.completedDates || []).filter(d => d !== dateISO)
        : [...(h.completedDates || []), dateISO];
      return { ...h, completedDates: newDates, streak: calculateStreak(newDates) };
    });
    persist(updated);
  };

  /**
   * Toggle a single sub-task for today. If every sub-task is now checked
   * for today, also mark the parent habit complete (adds today to
   * completedDates). If a sub-task is unchecked and the parent was
   * previously complete-for-today, the parent is uncomplete-for-today.
   */
  const toggleSubTask = (habitId: string, subTaskId: string) => {
    const updated = habits.map(h => {
      if (h.id !== habitId) return h;
      const subTasks = h.subTasks || [];
      if (subTasks.length === 0) return h;

      const map = { ...(h.completedSubTasks || {}) };
      const todays = new Set(map[today] || []);
      if (todays.has(subTaskId)) todays.delete(subTaskId);
      else todays.add(subTaskId);
      if (todays.size === 0) {
        delete map[today];
      } else {
        map[today] = Array.from(todays);
      }

      // Auto-complete parent when every subtask is checked.
      const allSubsDone = subTasks.every(st => todays.has(st.id));
      const wasComplete = (h.completedDates || []).includes(today);
      let newDates = h.completedDates || [];
      if (allSubsDone && !wasComplete) {
        newDates = [...newDates, today];
      } else if (!allSubsDone && wasComplete) {
        newDates = newDates.filter(d => d !== today);
      }

      return {
        ...h,
        completedSubTasks: map,
        completedDates: newDates,
        streak: calculateStreak(newDates),
      };
    });
    persist(updated);
  };

  const addHabit = (data: NewHabitPayload) => {
    const subTasks: HabitSubTask[] | undefined = data.subTasks.length > 0
      ? data.subTasks.map(st => ({ id: st.id, label: st.label, target: st.target }))
      : undefined;
    const newHabit: Habit = {
      id: Date.now().toString(),
      name: data.title,
      cue: data.description || undefined,
      streak: 0,
      completedDates: [],
      subTasks,
      completedSubTasks: subTasks ? {} : undefined,
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

      {/* Daily Protocol (System AI) — sys-frame inline */}
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

      {/* Habit cards — every habit wraps in .sys-frame */}
      <div className="h-list">
        {habits.map((h, idx) => {
          const isDoneToday = h.completedDates?.includes(today);
          const todaysSubs = new Set(h.completedSubTasks?.[today] || []);
          const hasSubTasks = !!h.subTasks && h.subTasks.length > 0;
          const subDone = hasSubTasks
            ? (h.subTasks || []).filter(st => todaysSubs.has(st.id)).length
            : 0;
          const subTotal = hasSubTasks ? (h.subTasks || []).length : 0;

          // Subtitle: streak + (sub-task progress OR cue OR frequency hint).
          const subtitleBits = [
            `streak ${h.streak} hari`,
          ];
          if (hasSubTasks) subtitleBits.push(`${subDone}/${subTotal} sub-task`);
          else if (h.cue) subtitleBits.push(h.cue);
          const subtitleText = subtitleBits.join(' · ');

          // CTA: delete button as right-edge .sys-head slot.
          const deleteCta = (
            <button
              type="button"
              className="h-card-trash"
              onClick={(e) => deleteHabit(e, h.id)}
              aria-label="Hapus habit"
            >
              <Trash2 size={12} />
            </button>
          );

          return (
            <div key={h.id} className="reveal" style={{ ['--reveal-i' as string]: 5 + idx }}>
              <SystemNotification
                mode="inline"
                tone={isDoneToday ? 'gold' : 'cyan'}
                closable={false}
                title={h.name}
                subtitle={subtitleText}
                cta={deleteCta}
                className="sys-frame-habit"
              >
                {/* TODAY-ONLY big check — replaces the 7-day grid per user
                    feedback ("kayang terlalu rapet terus kayanya ceklisnya
                    untuk hari itu aja"). For habits WITH sub-tasks, this
                    is a manual override that marks the whole day done
                    without ticking the individual sub-tasks (they remain
                    untouched so the user's sub-task history is preserved). */}
                <button
                  type="button"
                  className={`h-today ${isDoneToday ? 'is-on' : ''}`}
                  onClick={() => togglePerDay(h.id, today)}
                  aria-pressed={isDoneToday}
                  aria-label={isDoneToday ? 'Batalkan tanda selesai hari ini' : 'Tandai selesai hari ini'}
                >
                  <span className={`h-today-circle ${isDoneToday ? 'is-on' : ''}`}>
                    {isDoneToday && <Check size={28} strokeWidth={2.6} />}
                  </span>
                  <span className="h-today-label">
                    {isDoneToday ? '✓ Selesai Hari Ini' : 'Tandai Selesai Hari Ini'}
                  </span>
                </button>

                {/* TODO (Tier 6 — defer): dashboard grafik perkembangan
                    habit (per user: "nanti kalo udah di cheklist hari itu
                    nanti ada dashborad grafik habits nya kaya perkembangannya").
                    Likely surface: weekly + 30-day completion sparkline,
                    sub-task heatmap, streak velocity chart. Keep
                    completedDates + completedSubTasks as the source of
                    truth — no schema change needed for the dashboard. */}

                {/* Sub-task checklist — only when defined */}
                {hasSubTasks && (
                  <div className="h-subtasks">
                    <div className="h-subtasks-head">
                      <Flame size={11} className="h-subtasks-flame" />
                      <span>SUB-TASK HARI INI</span>
                      <span className="h-subtasks-count">{subDone}/{subTotal}</span>
                    </div>
                    <ul className="h-subtask-list">
                      {(h.subTasks || []).map(st => {
                        const checked = todaysSubs.has(st.id);
                        return (
                          <li key={st.id}>
                            <button
                              type="button"
                              className={`h-subtask ${checked ? 'is-on' : ''}`}
                              onClick={() => toggleSubTask(h.id, st.id)}
                              aria-pressed={checked}
                            >
                              <span className={`h-subtask-box ${checked ? 'is-on' : ''}`}>
                                {checked && <Check size={12} />}
                              </span>
                              <span className="h-subtask-label">{st.label}</span>
                              {st.target !== undefined && (
                                <span className="h-subtask-target">
                                  [{checked ? st.target : 0}/{st.target}]
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Quick toggle for single-task habits: row of optional cue + clock icon */}
                {!hasSubTasks && h.cue && (
                  <div className="h-cue-row">
                    <Clock size={11} className="h-cue-ico" />
                    <span>{h.cue}</span>
                  </div>
                )}
              </SystemNotification>
            </div>
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
