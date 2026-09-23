import React, { useEffect, useRef, useState } from 'react';
import { Habit, HabitSubTask } from '../types';
import { storageService } from '../services/storageService';
import { aiService } from '../services/aiService';
import { computeFatigue } from '../services/fatigueService';
import { achievementService } from '../services/achievementService';
import { useAchievements } from '../context/AchievementContext';
import {
  Plus, Trash2, Trophy, Zap, Target, Loader2, Clock, Shield, Check, Sparkles, ListChecks,
} from 'lucide-react';
import { NewHabitModal, NewHabitPayload } from '../components/habits/NewHabitModal';
import { ConfirmDialog, CountUp, SysToast, useSysToasts } from '../components/hud';
import { StreakFlame, StreakNumber } from '../components/streak';
import { crossedMilestone, flameLevel, hashId, MILESTONE_COPY } from '../constants/streak';
import { useInViewPause } from '../hooks/useInViewPause';
import { prefersReducedMotion } from '../hooks/usePresence';
import { getLocalDateString } from '../utils/dateUtils';
import { calculateHabitStreak as calculateStreak, calculateHabitLongestStreak as calculateLongestStreak } from '../utils/habitStreak';

// ── Trailing-7-day window helpers ──
// Single-letter weekday initials (Sun…Sat) for the .h-week grid. English
// initials collide less than Indonesian ones and match the design reference.
const WEEKDAY_INITIAL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * The 7 day-cells shown on every habit card: today−6 … today. Local YYYY-MM-DD
 * matches the storage format so membership checks line up exactly.
 */
const buildWeekCells = (todayISO: string) =>
  Array.from({ length: 7 }, (_, k) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - k));
    const iso = getLocalDateString(d);
    return { iso, label: WEEKDAY_INITIAL[d.getDay()], isToday: iso === todayISO };
  });

/** Short tactile tick on completions (Android; iOS ignores it). */
const haptic = (pattern: number | number[]) => {
  if (prefersReducedMotion()) return;
  try { navigator.vibrate?.(pattern); } catch { /* vibration unsupported */ }
};

/**
 * Card exit for a confirmed delete: slide/fade out, then collapse the height
 * so the cards below glide up instead of jumping ~150px in one frame. WAAPI
 * one-shots on a single element — no React state per frame. `done` (the real
 * delete) runs once the collapse finishes, or immediately under reduced motion.
 */
const collapseThen = (el: HTMLElement | undefined, done: () => void) => {
  if (!el || prefersReducedMotion() || typeof el.animate !== 'function') { done(); return; }
  const height = el.offsetHeight;
  const cs = getComputedStyle(el);
  el.style.pointerEvents = 'none';
  el.animate(
    [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-28px) scale(0.97)' }],
    { duration: 180, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' },
  ).finished
    .then(() => {
      el.style.overflow = 'hidden';
      return el.animate(
        [
          { height: `${height}px`, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, borderTopWidth: cs.borderTopWidth, borderBottomWidth: cs.borderBottomWidth, marginBottom: '0px' },
          // -10px swallows the .h-list gap so the next card lands exactly where
          // it will sit once this one unmounts (no final 10px snap).
          { height: '0px', paddingTop: '0px', paddingBottom: '0px', borderTopWidth: '0px', borderBottomWidth: '0px', marginBottom: '-10px' },
        ],
        { duration: 240, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'forwards' },
      ).finished;
    })
    .then(() => done(), () => done());
};

// ── DayCell — one cell of the weekly grid, with its own tap ripple ──
const DayCell: React.FC<{
  label: string;
  checked: boolean;
  isToday: boolean;
  /** The previous day is also done → draw the streak chain into this cell. */
  chainPrev: boolean;
  index: number;
  onToggle: () => void;
}> = ({ label, checked, isToday, chainPrev, index, onToggle }) => {
  // Keyed per tap so a quick double-tap restarts the ripple instead of being
  // swallowed; grey when the tap un-completes the day, green when it completes.
  const [burst, setBurst] = useState<{ n: number; off: boolean } | null>(null);
  const handle = () => {
    setBurst(b => ({ n: (b?.n ?? 0) + 1, off: checked }));
    if (!checked) haptic(10);
    onToggle();
  };
  return (
    <button
      type="button"
      className={`h-day${checked ? ' is-on' : ''}${isToday ? ' is-today' : ''}${chainPrev ? ' is-chain' : ''}`}
      onClick={handle}
      style={{ ['--d-i' as string]: index }}
      aria-pressed={checked}
      aria-label={`${label}${isToday ? ' (hari ini)' : ''}${checked ? ', selesai' : ''}`}
    >
      <span className="h-day-label">{label}</span>
      <span className="h-day-box">
        {checked && (
          <svg className="h-day-check" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M5 12.5 L10 17.5 L19 8.5" pathLength={1} stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {burst && (
        <span
          key={burst.n}
          className={`h-day-ripple${burst.off ? ' is-off' : ''}`}
          onAnimationEnd={() => setBurst(null)}
        />
      )}
    </button>
  );
};

// ═══════════════════════════════════════════════════════════════
// DailyProtocolEvaluator — restyled to the .h-system reference card
// (no SystemNotification wrapper). AI evaluation logic is unchanged.
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
  // Pause the icon halo loop while the card is scrolled away.
  const cardRef = useRef<HTMLElement>(null);
  useInViewPause(cardRef);

  const runEvaluation = async () => {
    setLoading(true);
    setError(null);
    setVerdict(null);
    try {
      const userState = storageService.getUserState();
      const profile = storageService.getGymProfile();
      const workouts = storageService.getWorkouts();
      const fatigue = computeFatigue(workouts, Date.now(), userState.gender);

      const today = getLocalDateString();
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

  return (
    <article ref={cardRef} className="h-system reveal" style={{ ['--reveal-i' as string]: 3 }}>
      <div className="h-system-glow" />
      <div className="h-system-head">
        <div className="h-system-icon">
          <Sparkles size={14} />
          <span className="h-system-icon-halo" />
        </div>
        <div className="h-system-text">
          <div className="hud-label">DAILY PROTOCOL</div>
          <div className="h-system-sub">system ai evaluation — habits × gym × recovery</div>
        </div>
        <button type="button" className="h-system-eval" onClick={runEvaluation} disabled={loading}>
          {loading
            ? <><Loader2 size={12} className="animate-spin" /><span>Deliberating</span></>
            : <><Zap size={12} /><span>{verdict ? 'Re-evaluate' : 'Evaluate Now'}</span></>}
        </button>
      </div>

      {!verdict && !loading && !error && (
        <p className="h-system-body">
          Ketuk <strong className="fz-orange">Evaluate Now</strong> untuk menerima verdict yang
          dipersonalisasi — System akan menganalisis penyelesaian habit, performa gym terakhir,
          streak saat ini, dan fatigue otot, lalu memberikan langkah berikutnya.
        </p>
      )}
      {error && <div className="sys-chat-error h-system-error">{error}</div>}
      {/* Skeleton holds the verdict's space while the System thinks, so the
          card doesn't collapse and then jump back open when the reply lands. */}
      {loading && (
        <div className="h-system-verdict is-loading" aria-live="polite" aria-busy="true">
          <div className="h-system-verdict-label">THE SYSTEM · MENGANALISIS…</div>
          <span className="h-skel" />
          <span className="h-skel" />
          <span className="h-skel" />
        </div>
      )}
      {verdict && !loading && (
        <div className="h-system-verdict is-fresh" key={evaluatedAt ?? 0}>
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
// Each habit renders as an .h-card (design-reference look): today check
// circle + 7-day .h-week grid + flame streak + completions badge + trash.
// Optional sub-task checklist renders below the week when present.
// ═══════════════════════════════════════════════════════════════
export const HabitTracker: React.FC = () => {
  const { addUnlocks } = useAchievements();
  // Read synchronously from the storage cache on first render (same data the
  // old mount effect loaded) so the empty state never flashes for one frame
  // before the cards replace it.
  const [habits, setHabits] = useState<Habit[]>(() =>
    storageService.getHabits().map(h => ({ ...h, streak: calculateStreak(h.completedDates) })),
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const { current: toast, push: pushToast } = useSysToasts();
  const [pendingDelete, setPendingDelete] = useState<Habit | null>(null);
  // The confirm dialog keeps rendering the last target while it plays its
  // exit, so its text doesn't blank out mid-fade.
  const lastDeleteRef = useRef<Habit | null>(null);
  if (pendingDelete) lastDeleteRef.current = pendingDelete;
  const deleteTarget = pendingDelete ?? lastDeleteRef.current;
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  // Cards present on first paint join the page's reveal stagger; habits
  // created later get their own entrance (.is-new) instead of waiting in it.
  const initialIdsRef = useRef<Set<string> | null>(null);
  if (initialIdsRef.current === null) initialIdsRef.current = new Set(habits.map(h => h.id));
  const cardRefs = useRef(new Map<string, HTMLElement>());

  const ctaRef = useRef<HTMLButtonElement>(null);
  useInViewPause(ctaRef);

  // A freshly created habit is appended at the bottom — often below the fold.
  // Bring it into view once the sheet has slid away so Save visibly "lands".
  useEffect(() => {
    if (!justAddedId) return;
    const t = window.setTimeout(() => {
      cardRefs.current.get(justAddedId)?.scrollIntoView({
        block: 'center',
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
      setJustAddedId(null);
    }, 240);
    return () => window.clearTimeout(t);
  }, [justAddedId]);

  const today = getLocalDateString();
  const weekCells = buildWeekCells(today);
  const completedToday = habits.filter(h => h.completedDates?.includes(today))?.length;
  const totalHabits = habits?.length;
  const percentage = totalHabits > 0 ? Math.round((completedToday / totalHabits) * 100) : 0;
  const bestStreakOverall = habits.reduce(
    (max, h) => Math.max(max, calculateLongestStreak(h.completedDates || [])), 0,
  );
  const allTimeCompletions = habits.reduce((sum, h) => sum + (h.completedDates?.length || 0), 0);
  const allDone = totalHabits > 0 && completedToday === totalHabits;

  // Freeze banner copy reflects what actually happened: grantStreakToken()
  // refuses when already earned today or at the 3/3 cap, so "all done" alone
  // doesn't mean a token was given. Read-only.
  const gymProfile = storageService.getGymProfile();
  const freezeTokens = gymProfile.streakFreezeTokens ?? 0;
  const tokenEarnedToday = gymProfile.lastTokenEarned === today;
  const freezeTitle = tokenEarnedToday
    ? '+1 Token Freeze diperoleh'
    : freezeTokens >= 3 ? 'Token Freeze penuh (3/3)' : 'Semua protokol selesai';
  const freezeSub = tokenEarnedToday || freezeTokens >= 3
    ? `${freezeTokens}/3 token tersimpan · streak aman hari ini`
    : 'Selesaikan semua habit harian → bekukan streak satu hari';

  /** Toast when a toggle carries a habit's streak across a milestone (3/7/30/100/365). */
  const announceMilestone = (before: Habit[], after: Habit[], habitId: string) => {
    const prev = before.find(h => h.id === habitId)?.streak ?? 0;
    const next = after.find(h => h.id === habitId)?.streak ?? 0;
    const m = crossedMilestone(prev, next);
    if (m == null) return;
    pushToast({
      tone: m >= 30 ? 'cyan' : 'orange',
      icon: <StreakFlame streak={m} size={16} celebrate={false} />,
      title: `Streak ${m} hari!`,
      sub: MILESTONE_COPY[m],
    });
  };

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
        pushToast({
          tone: 'cyan',
          icon: <Shield size={14} />,
          title: '+1 Token Freeze',
          sub: `${remaining}/3 tersimpan`,
        });
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
    announceMilestone(habits, updated, habitId);
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
    announceMilestone(habits, updated, habitId);
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
    setJustAddedId(newHabit.id);
  };

  const deleteHabit = (id: string) => {
    const updated = habits.filter(h => h.id !== id);
    setHabits(updated);
    storageService.saveHabits(updated);
  };

  // Tier 0.6: deleting wipes the habit's whole history, so it goes through a
  // confirm first; the card then animates out before the (unchanged) delete.
  const confirmDelete = () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target || leavingId) return;
    setLeavingId(target.id);
    collapseThen(cardRefs.current.get(target.id), () => {
      deleteHabit(target.id);
      setLeavingId(null);
    });
  };

  return (
    <div className="h-page">
      {/* Hero */}
      <section className="h-hero reveal" style={{ ['--reveal-i' as string]: 0 }}>
        <h1 className="h-title">
          Habit <span className="fz-orange">Algorithms</span>
        </h1>
        <p className="h-subtitle">Atomic Habits Protocol — Satu Hari pada Suatu Waktu</p>
      </section>

      {/* New Protocol CTA */}
      <button type="button" className="h-newproto reveal"
        ref={ctaRef}
        style={{ ['--reveal-i' as string]: 1 }}
        onClick={() => setShowAddModal(true)}>
        <span className="h-newproto-glow" />
        <span className="h-newproto-ico"><Plus size={14} /></span>
        <span>Protokol Baru</span>
      </button>

      {/* Stats */}
      <div className="h-stats reveal" style={{ ['--reveal-i' as string]: 2 }}>
        <div className={`h-stat h-stat-cyan${allDone ? ' is-full' : ''}`}>
          <div className="h-stat-icon"><Target size={16} /></div>
          <div className="h-stat-val"><CountUp value={percentage} />%</div>
          <div className="h-stat-sub tnum">{completedToday}/{totalHabits} HARI INI</div>
        </div>
        <div className="h-stat h-stat-orange">
          <div className="h-stat-icon"><Trophy size={16} /></div>
          <div className="h-stat-val"><StreakNumber value={bestStreakOverall} /></div>
          <div className="h-stat-sub">STREAK TERBAIK</div>
        </div>
        <div className="h-stat h-stat-cyan">
          <div className="h-stat-icon"><Zap size={16} /></div>
          <div className="h-stat-val"><CountUp value={allTimeCompletions} /></div>
          <div className="h-stat-sub">SEPANJANG WAKTU</div>
        </div>
      </div>

      {/* Daily Protocol (System AI) — .h-system reference card */}
      <DailyProtocolEvaluator
        habits={habits}
        completedToday={completedToday}
        totalHabits={totalHabits}
        percentage={percentage}
      />

      {/* Habit cards — design-reference .h-card with weekly grid */}
      <div className="h-list">
        {habits.map((h, idx) => {
          const isDoneToday = !!h.completedDates?.includes(today);
          const todaysSubs = new Set(h.completedSubTasks?.[today] || []);
          const hasSubTasks = !!h.subTasks && h.subTasks.length > 0;
          const subDone = hasSubTasks
            ? (h.subTasks || []).filter(st => todaysSubs.has(st.id)).length
            : 0;
          const subTotal = hasSubTasks ? (h.subTasks || []).length : 0;
          const isNew = !initialIdsRef.current?.has(h.id);
          // Streak alive (yesterday done) but today not checked yet.
          const atRisk = !isDoneToday && h.streak > 0;
          const completions = h.completedDates?.length || 0;

          return (
            <article
              key={h.id}
              ref={el => {
                if (el) cardRefs.current.set(h.id, el);
                else cardRefs.current.delete(h.id);
              }}
              className={`h-card h-card-cyan ${isNew ? 'is-new' : 'reveal'}${isDoneToday ? ' is-done' : ''}`}
              style={{ ['--reveal-i' as string]: 4 + idx }}
              aria-busy={leavingId === h.id || undefined}
            >
              <div className="h-card-top">
                {/* Top-left circle: quick-toggle TODAY (mirrors the last
                    day-cell). For sub-task habits it's a manual override
                    that marks the whole day done without ticking individual
                    sub-tasks (their history stays intact). */}
                <button
                  type="button"
                  className="h-card-check"
                  onClick={() => {
                    if (!isDoneToday) haptic(12);
                    togglePerDay(h.id, today);
                  }}
                  aria-pressed={isDoneToday}
                  aria-label={isDoneToday ? 'Batalkan selesai hari ini' : 'Tandai selesai hari ini'}
                >
                  {/* Tick stays mounted so un-checking can animate out too. */}
                  <span className={`h-card-check-circle ${isDoneToday ? 'is-on' : ''}`}>
                    <Check size={14} strokeWidth={2.8} className="h-card-check-ico" />
                  </span>
                </button>

                <h3 className={`h-card-title ${isDoneToday ? 'is-done' : ''}`}>
                  <span className="h-strike">{h.name}</span>
                </h3>

                <div className="h-card-meta">
                  <span
                    className={`h-card-streak${atRisk ? ' is-risk' : ''}`}
                    data-lvl={flameLevel(h.streak)}
                    title={atRisk ? 'Selesaikan hari ini untuk menjaga streak' : 'Streak saat ini'}
                    aria-label={`Streak ${h.streak} hari`}
                  >
                    <StreakFlame streak={h.streak} atRisk={atRisk} phase={hashId(h.id) % 1200} />
                    <StreakNumber value={h.streak} />
                  </span>
                  <span className="h-card-xp" title="Total selesai sepanjang waktu" aria-label={`${completions} kali selesai`}>
                    <Trophy size={12} />
                    <StreakNumber value={completions} />
                  </span>
                  <button
                    type="button"
                    className="h-card-trash"
                    onClick={() => { if (!leavingId) setPendingDelete(h); }}
                    aria-label={`Hapus habit ${h.name}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* 7-day week grid (today−6 … today). Each cell toggles that
                  date's completion via togglePerDay → completedDates + streak. */}
              <div className="h-week">
                {weekCells.map((cell, i) => {
                  const checked = !!h.completedDates?.includes(cell.iso);
                  return (
                    <DayCell
                      key={cell.iso}
                      label={cell.label}
                      checked={checked}
                      isToday={cell.isToday}
                      chainPrev={checked && i > 0 && !!h.completedDates?.includes(weekCells[i - 1].iso)}
                      index={i}
                      onToggle={() => togglePerDay(h.id, cell.iso)}
                    />
                  );
                })}
              </div>

              {/* TODO (Tier 6 — defer): dashboard grafik perkembangan habit
                  (weekly + 30-day completion sparkline, sub-task heatmap,
                  streak velocity). completedDates + completedSubTasks stay the
                  source of truth — no schema change needed for the dashboard. */}

              {/* Sub-task checklist — only when defined. Auto-completes the
                  day once every sub-task is checked (see toggleSubTask). */}
              {hasSubTasks && (
                <div className="h-subtasks">
                  <div className="h-subtasks-head">
                    <ListChecks size={11} className="h-subtasks-ico" />
                    <span>SUB-TASK HARI INI</span>
                    <span className="h-subtasks-count tnum">{subDone}/{subTotal}</span>
                  </div>
                  {/* Build-up toward the auto-complete of the parent habit. */}
                  <div
                    className={`h-subtasks-bar${subDone === subTotal ? ' is-full' : ''}`}
                    style={{ ['--p' as string]: subTotal > 0 ? subDone / subTotal : 0 }}
                    aria-hidden="true"
                  >
                    <i />
                  </div>
                  <ul className="h-subtask-list">
                    {(h.subTasks || []).map(st => {
                      const checked = todaysSubs.has(st.id);
                      return (
                        <li key={st.id}>
                          <button
                            type="button"
                            className={`h-subtask ${checked ? 'is-on' : ''}`}
                            onClick={() => {
                              if (!checked) haptic(8);
                              toggleSubTask(h.id, st.id);
                            }}
                            aria-pressed={checked}
                          >
                            <span className={`h-subtask-box ${checked ? 'is-on' : ''}`}>
                              <Check size={12} className="h-subtask-ico" />
                            </span>
                            <span className="h-subtask-label"><span className="h-strike">{st.label}</span></span>
                            {st.target !== undefined && (
                              <span className="h-subtask-target tnum">
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

              {/* Cue row for single-task habits with a trigger note. */}
              {!hasSubTasks && h.cue && (
                <div className="h-cue-row">
                  <Clock size={11} className="h-cue-ico" />
                  <span>{h.cue}</span>
                </div>
              )}
            </article>
          );
        })}

        {habits.length === 0 && (
          <div className="h-empty reveal" style={{ ['--reveal-i' as string]: 4 }}>
            <span className="brk-c brk-tl" /><span className="brk-c brk-tr" />
            <span className="brk-c brk-bl" /><span className="brk-c brk-br" />
            <span className="h-empty-ico"><Target size={18} /></span>
            <div className="h-empty-title">Belum ada protokol</div>
            <div className="h-empty-sub">Mulai dari satu kebiasaan kecil — konsistensi &gt; intensitas.</div>
            <button type="button" className="h-empty-cta" onClick={() => setShowAddModal(true)}>
              <Plus size={14} /> Buat Protokol Pertama
            </button>
          </div>
        )}
      </div>

      {/* Freeze banner when all habits are done. Lives BELOW the list and
          glides its height open, so checking the last habit never shoves the
          card under the user's finger. */}
      <div
        className={`h-freeze-shell reveal${allDone ? ' is-open' : ''}`}
        style={{ ['--reveal-i' as string]: 4 + habits.length }}
        aria-hidden={!allDone}
      >
        <div className="h-freeze-inner">
          <div className="h-freeze" role="status">
            <span className="h-freeze-shield"><Shield size={16} /></span>
            <div>
              <div className="h-freeze-title">{freezeTitle}</div>
              <div className="h-freeze-sub">{freezeSub}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Freeze-token + streak-milestone toasts (FIFO queue). */}
      <SysToast item={toast} />

      <ConfirmDialog
        open={!!pendingDelete}
        title="Hapus habit ini?"
        message={deleteTarget && (
          <>
            <b>{deleteTarget.name}</b> beserta seluruh riwayatnya
            {(deleteTarget.completedDates?.length ?? 0) > 0
              ? <> ({deleteTarget.completedDates?.length} kali selesai, streak {deleteTarget.streak} hari)</>
              : null}
            {' '}akan dihapus permanen.
          </>
        )}
        confirmLabel="Hapus"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      {/* New habit modal (slide-up) */}
      <NewHabitModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreate={addHabit}
      />
    </div>
  );
};
