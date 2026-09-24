import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { storageService } from '../services/storageService';
import { WorkoutLog, Habit, MuscleGroup, GymSchedule, GymProfile, ExerciseDefinition, UserState } from '../types';
import { Calendar, Edit3, Save, X, Plus, Play, Repeat, Activity, CheckCircle2, Sparkles, Pencil } from 'lucide-react';
import { MUSCLE_GROUP_CONFIG } from '../config/constants';
import { calculateStreak } from '../services/gamificationService';
import { computeFatigue } from '../services/fatigueService';
import { StatusCard } from '../components/StatusCard';
import { SystemNotification, BodyAnatomy, splitExhaustedByView, CornerBracket, BodyTurntable, BodyViewToggle, HudDialog, CountUp } from '../components/hud';
import { RecoveryCountdown, getRecoveringMuscles } from '../components/dashboard/RecoveryCountdown';
import { useNavigate } from 'react-router-dom';

// Maps free-form schedule strings ("Push — Chest, Shoulders, Triceps") to MuscleGroup keys.
// Used by the today-row Quick Start to launch a session without the muscle picker.
const SCHEDULE_KEYWORD_MAP: { keyword: RegExp; muscle: MuscleGroup }[] = [
  { keyword: /chest|dada/i, muscle: 'chest' },
  { keyword: /shoulder|bahu/i, muscle: 'shoulders' },
  { keyword: /tricep/i, muscle: 'triceps' },
  { keyword: /bicep/i, muscle: 'biceps' },
  { keyword: /forearm/i, muscle: 'forearms' },
  { keyword: /lat|punggung|back/i, muscle: 'lats' },
  { keyword: /trap/i, muscle: 'traps' },
  { keyword: /lower\s*back|pinggang/i, muscle: 'lower_back' },
  { keyword: /abs|perut|core/i, muscle: 'abs' },
  { keyword: /oblique/i, muscle: 'obliques' },
  { keyword: /quad|paha/i, muscle: 'quads' },
  { keyword: /hamstring/i, muscle: 'hamstrings' },
  { keyword: /glute|bokong/i, muscle: 'glutes' },
  { keyword: /calf|calves|betis/i, muscle: 'calves' },
];

const parseScheduleMuscles = (label: string): MuscleGroup[] => {
  const found: MuscleGroup[] = [];
  for (const { keyword, muscle } of SCHEDULE_KEYWORD_MAP) {
    if (keyword.test(label) && !found.includes(muscle)) found.push(muscle);
  }
  return found;
};

const isRestDay = (label: string): boolean => /rest|libur|🧘/i.test(label || '');

// Reconstruct ExerciseDefinitions from a WorkoutLog so "Repeat Last" can drop
// the user straight into the active session with the right exercise list.
const exercisesFromLog = (log: WorkoutLog): ExerciseDefinition[] => {
  const fallbackMuscle: MuscleGroup = log.muscleGroups?.[0] || 'chest';
  return log.exercises.map((e, idx) => ({
    id: `repeat_${log.id}_${idx}`,
    name: e.name,
    muscleGroup: fallbackMuscle,
    secondaryMuscles: [],
    equipment: '',
    difficulty: 3,
    xpPerSet: 30,
    defaultSets: e.sets,
    defaultReps: e.reps,
    videoUrl: '',
    tips: '',
  }));
};

// Indonesia relative date format. "Hari ini" / "Kemarin" / "X hari lalu" /
// "X minggu lalu" — falls back to YYYY-MM-DD when older than 30 days.
const formatRelativeID = (input: number | string | undefined): string => {
  if (!input) return '';
  const ts = typeof input === 'number' ? input : new Date(input + (input.includes('T') ? '' : 'T12:00:00')).getTime();
  if (isNaN(ts)) return '';
  const diffDays = Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return new Date(ts).toLocaleDateString('en-CA');
  if (diffDays === 0) return 'Hari ini';
  if (diffDays === 1) return 'Kemarin';
  if (diffDays < 7) return `${diffDays} hari lalu`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} minggu lalu`;
  return new Date(ts).toLocaleDateString('en-CA');
};

// getRecoveringMuscles lives in dashboard/RecoveryCountdown.tsx (moved
// verbatim) so the per-second countdown and this page share one definition.

/**
 * Minute-resolution wall clock for everything on the page that doesn't need
 * seconds (greeting, date, today's key, body map, fatigue). Aligned to the
 * minute boundary and re-synced when the tab becomes visible again. Only the
 * recovery countdown ticks per second, inside its own leaf component, so the
 * page (StatusCard, both body faces) no longer re-renders every second —
 * that per-second reconciliation used to drop frames mid body-turn.
 */
function useMinuteClock(): [number, () => void] {
  const [now, setNow] = useState(() => Date.now());
  const resync = useCallback(() => setNow(Date.now()), []);
  useEffect(() => {
    let t = 0;
    const schedule = () => {
      t = window.setTimeout(() => { setNow(Date.now()); schedule(); }, 60_000 - (Date.now() % 60_000) + 50);
    };
    const onVisibility = () => {
      window.clearTimeout(t);
      if (document.hidden) return;
      setNow(Date.now());
      schedule();
    };
    schedule();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  return [now, resync];
}

/**
 * Weight field sanitiser: many Android keyboards type "65,5", which a
 * type=number input silently turns into an empty value (Save disabled for no
 * visible reason). Accept the comma as a decimal point, drop anything that
 * isn't a digit and keep a single dot. handleWeightUpdate still parses it.
 */
const normalizeWeightInput = (raw: string): string => {
  const s = raw.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const dot = s.indexOf('.');
  return dot === -1 ? s : s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '');
};

/** "65" / "65.5" / "65.25" — no trailing zeros, like the stored value. */
const formatWeight = (v: number): string => String(Math.round(v * 100) / 100);

/** First-render read from the storageService cache (it is synchronous). */
function readOr<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch (err) {
    console.error('[Dashboard] Failed to load data from storage:', err);
    return fallback;
  }
}

function getReadyMuscles(
  workouts: WorkoutLog[],
  nowMs: number,
  recoveringSet: Set<MuscleGroup>,
): MuscleGroup[] {
  const seven = 7 * 24 * 60 * 60 * 1000;
  const ready = new Set<MuscleGroup>();
  for (const w of workouts) {
    const t = w.timestamp
      ? new Date(w.timestamp).getTime()
      : new Date(w.date + 'T12:00:00').getTime();
    if (isNaN(t)) continue;
    if (nowMs - t > seven) continue;
    for (const m of (w.muscleGroups || [])) {
      if (!recoveringSet.has(m)) ready.add(m);
    }
  }
  return Array.from(ready);
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<string, string> = {
  monday: 'SEN', tuesday: 'SEL', wednesday: 'RAB', thursday: 'KAM',
  friday: 'JUM', saturday: 'SAB', sunday: 'MIN'
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  // Read synchronously from the storageService cache on first render (the
  // same data the old mount effect loaded), so there's no one-render
  // "Initializing" flash before the reveal stagger starts.
  const [workouts, setWorkouts] = useState<WorkoutLog[]>(() => readOr(() => storageService.getWorkouts(), []));
  const [habits, setHabits] = useState<Habit[]>(() => readOr(() => storageService.getHabits(), []));
  const [profile, setProfile] = useState<GymProfile | null>(() => readOr<GymProfile | null>(() => storageService.getGymProfile(), null));
  const [schedule, setSchedule] = useState<GymSchedule>(() => readOr(() => storageService.getGymSchedule(), {}));
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [editSchedule, setEditSchedule] = useState<GymSchedule>({});
  const [userState, setUserState] = useState<UserState | null>(() => readOr<UserState | null>(() => storageService.getUserState(), null));
  const [editingWeight, setEditingWeight] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [currentTime, resyncClock] = useMinuteClock();
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [newHabitName, setNewHabitName] = useState('');
  const [systemMessage, setSystemMessage] = useState<string>(storageService.getLastSystemMessage());
  // Long verdicts (3-5 paragraphs) collapse to 4 lines until user expands.
  // Scoped to this card only — re-collapses whenever the verdict text changes.
  const [verdictExpanded, setVerdictExpanded] = useState(false);
  useEffect(() => { setVerdictExpanded(false); }, [systemMessage]);

  // Muscle Recovery body view. The turn itself is animated inside
  // BodyTurntable (DOM-driven spring), so this page never re-renders per frame.
  const [bodyView, setBodyView] = useState<'front' | 'back'>('front');

  // The edit sheets keep showing the last typed value while they slide away
  // (the save handlers clear the field in the same tick they close).
  const lastWeightRef = useRef(newWeight);
  if (editingWeight) lastWeightRef.current = newWeight;
  const weightShown = editingWeight ? newWeight : lastWeightRef.current;
  const weightValid = newWeight !== '' && Number.isFinite(parseFloat(newWeight));
  const lastNameRef = useRef(newName);
  if (editingName) lastNameRef.current = newName;
  const nameShown = editingName ? newName : lastNameRef.current;

  useEffect(() => {
    const unsubscribe = storageService.subscribe(() => {
      setProfile(storageService.getGymProfile());
      setWorkouts(storageService.getWorkouts());
      setUserState(storageService.getUserState());
      setSystemMessage(storageService.getLastSystemMessage());
    });
    return unsubscribe;
  }, []);

  const launchTodaysPlan = () => {
    const label = schedule[currentDayKey];
    if (!label || isRestDay(label)) return;
    const muscles = parseScheduleMuscles(label);
    if (muscles.length === 0) {
      navigate('/gym');
      return;
    }
    storageService.setPendingWorkout({ kind: 'schedule', muscles, label });
    navigate('/gym');
  };

  const launchRepeatLast = () => {
    if (!lastWorkout) return;
    const exercises = exercisesFromLog(lastWorkout);
    if (exercises.length === 0) {
      navigate('/gym');
      return;
    }
    storageService.setPendingWorkout({
      kind: 'repeat',
      exercises,
      type: lastWorkout.type,
    });
    navigate('/gym');
  };

  const handleWeightUpdate = () => {
    if (!userState || !newWeight) return;
    const weight = parseFloat(newWeight);
    if (isNaN(weight)) return;

    const newState = { ...userState, weight };
    storageService.saveUserState(newState);
    setUserState(newState);
    setEditingWeight(false);
    setNewWeight('');
  };

  const handleNameUpdate = () => {
    if (!userState || !newName) return;
    const newState = { ...userState, name: newName };
    storageService.saveUserState(newState);
    setUserState(newState);
    setEditingName(false);
    setNewName('');
  };

  const handleAddHabit = (e: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    if (!newHabitName.trim()) return;

    const newHabit: Habit = {
      id: Date.now().toString(),
      name: newHabitName.trim(),
      streak: 0,
      completedDates: []
    };

    const updatedHabits = [...habits, newHabit];
    storageService.saveHabits(updatedHabits);
    setHabits(updatedHabits);
    setNewHabitName('');
  };

  // Toggle today's completion for a habit (Dashboard inline quick-toggle)
  const toggleHabitToday = (id: string) => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    const updated = habits.map(h => {
      if (h.id !== id) return h;
      const dates = h.completedDates || [];
      const done = dates.includes(todayStr);
      return { ...h, completedDates: done ? dates.filter(d => d !== todayStr) : [...dates, todayStr] };
    });
    storageService.saveHabits(updated);
    setHabits(updated);
  };

  const startEditSchedule = () => {
    setEditSchedule({ ...schedule });
    setEditingSchedule(true);
  };
  const saveSchedule = () => {
    setSchedule(editSchedule);
    storageService.saveGymSchedule(editSchedule);
    setEditingSchedule(false);
  };

  const today = new Date(currentTime).toLocaleDateString('en-CA');
  const now = new Date(currentTime);
  const currentDayKey = DAYS[now.getDay() === 0 ? 6 : now.getDay() - 1];

  const getGreeting = () => {
    const hour = now.getHours();
    if (hour < 12) return 'Selamat Pagi';
    if (hour < 17) return 'Selamat Siang';
    if (hour < 20) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  const formattedDate = now.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).toUpperCase();

  const lastWorkout = workouts[0];
  const habitCompletion = habits.filter(h => h.completedDates?.includes(today))?.length;
  const habitTotal = habits?.length;
  const habitPercentage = habitTotal > 0 ? Math.round((habitCompletion / habitTotal) * 100) : 0;
  const workoutStreak = calculateStreak(workouts);

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekStartStr = weekStart.toLocaleDateString('en-CA');
  const workoutsThisWeek = workouts.filter(w => w.date >= weekStartStr)?.length;

  // Minute-resolution recovery state. The countdown leaf below calls
  // `resyncClock` the moment a muscle finishes, so the body map and the
  // ready chips flip in sync with the timer hitting zero.
  const userGender = userState?.gender;
  const recoveringKey = useMemo(
    () => getRecoveringMuscles(workouts, currentTime, userGender).map(r => r.muscle).join('|'),
    [workouts, currentTime, userGender],
  );
  // Keyed on the muscle list (not the clock) so both BodyAnatomy faces get
  // the same array instances — and skip rebuilding their tint CSS — until
  // the set of exhausted muscles actually changes.
  const recoveringMuscles = useMemo(
    () => (recoveringKey ? (recoveringKey.split('|') as MuscleGroup[]) : []),
    [recoveringKey],
  );
  const readyMuscles = useMemo(
    () => getReadyMuscles(workouts, currentTime, new Set(recoveringMuscles)),
    [workouts, currentTime, recoveringMuscles],
  );

  const fatigue = useMemo(
    () => computeFatigue(workouts, currentTime, userGender),
    [workouts, currentTime, userGender],
  );

  // Split exhausted muscles by view (front/back) — feeds BodyAnatomy
  const exhaustedSplit = useMemo(() => splitExhaustedByView(recoveringMuscles), [recoveringMuscles]);

  const visibleExhausted = bodyView === 'front' ? exhaustedSplit.front : exhaustedSplit.back;
  const exhaustedCount = visibleExhausted.length;

  const gender: 'male' | 'female' = (userState?.gender === 'Female' ? 'female' : 'male');

  // Last-session derived bits
  const lastMuscleLabel = lastWorkout?.muscleGroups?.[0]
    ? (MUSCLE_GROUP_CONFIG[lastWorkout.muscleGroups[0]]?.label || lastWorkout.muscleGroups[0]).toLowerCase()
    : '';
  const lastRelative = lastWorkout ? formatRelativeID(lastWorkout.timestamp || lastWorkout.date) : '';

  const todayLabel = schedule[currentDayKey] || '';
  const todayIsRest = isRestDay(todayLabel);
  const todayMuscles = todayLabel ? parseScheduleMuscles(todayLabel) : [];
  const canStartToday = !!todayLabel && !todayIsRest && todayMuscles.length > 0;

  return (
    <div className="dashboard">
      {/* ── 1. GREETING ── */}
      <section className="d-greet reveal" style={{ '--reveal-i': 0 } as React.CSSProperties}>
        <div className="d-greet-date">{formattedDate}</div>
        <h1 className="d-greet-hello">
          {getGreeting()},{' '}
          <button
            type="button"
            className="fz-cyan d-greet-name"
            onClick={() => { setNewName(userState?.name || ''); setEditingName(true); }}
            aria-label={`Ubah nama, saat ini ${userState?.name || 'Hunter'}`}
          >{userState?.name || 'Hunter'}</button>
        </h1>
        <button
          type="button"
          className="d-greet-weight"
          onClick={() => { setNewWeight(userState?.weight?.toString() || ''); setEditingWeight(true); }}
          aria-label={`Ubah berat badan${typeof userState?.weight === 'number' ? `, saat ini ${userState.weight} kg` : ''}`}
        >
          <span className="hud-label-sm">CURRENT WEIGHT:</span>
          <span className="d-greet-weight-val tnum">
            {typeof userState?.weight === 'number'
              ? <CountUp value={userState.weight} fromZero={false} decimals={1} format={formatWeight} />
              : '--'}
            {' '}<span className="d-greet-unit">kg</span>
          </span>
          <span className="d-greet-edit" aria-hidden="true"><Pencil size={11} /></span>
        </button>
      </section>

      {/* ── 2. SYSTEM VERDICT (inline .sys-frame) ──
          title + subtitle now come from the component's own .sys-head.
          Body uses the .sys-body--verdict modifier: italic first paragraph,
          drop cap, and a 4-line clamp with "Selengkapnya ↓" / "Lebih sedikit ↑"
          toggle so long oracle responses don't dominate the screen. */}
      {systemMessage && (
        <div className="reveal" style={{ '--reveal-i': 1 } as React.CSSProperties}>
          <SystemNotification
            mode="inline"
            tone="cyan"
            closable
            title="The System"
            subtitle="latest verdict"
            onClose={() => { storageService.saveLastSystemMessage(''); setSystemMessage(''); }}
          >
            <div className={`sys-body--verdict ${verdictExpanded ? 'is-expanded' : ''}`}>
              <p className="whitespace-pre-line glitch-in" style={{ margin: 0 }}>
                {systemMessage}
              </p>
            </div>
            <button
              type="button"
              className="sys-verdict-toggle"
              onClick={() => setVerdictExpanded(v => !v)}
            >
              {verdictExpanded ? 'Lebih sedikit ↑' : 'Selengkapnya ↓'}
            </button>
          </SystemNotification>
        </div>
      )}

      {/* ── 3. LAST SESSION ── */}
      <div className="reveal" style={{ '--reveal-i': 2 } as React.CSSProperties}>
      <CornerBracket
        className="card card-cyan"
        tone="cyan"
        size={9}
        inset={4}
      >
        <div className="card-head">
          <span className="card-head-icon d-last-icon"><Activity size={14} /></span>
          <span className="hud-label">LAST SESSION</span>
          {lastWorkout && <span className="d-last-pending">PENDING</span>}
        </div>
        <div className="d-last-title">
          {lastWorkout ? lastWorkout.type : 'Belum ada sesi'}
          {lastWorkout && <span className="d-last-date">({lastRelative})</span>}
        </div>
        {lastWorkout && (
          <div className="d-last-row">
            <span className="d-last-row-icon"><Calendar size={13} /></span>
            <span>
              <strong>{lastWorkout.exercises.length}</strong> latihan
              {lastMuscleLabel && <> · <strong>{lastMuscleLabel}</strong></>}
              {(lastWorkout.xpEarned ?? 0) > 0 && <> · {lastWorkout.xpEarned} XP</>}
            </span>
          </div>
        )}
        <div className="d-last-foot">
          <span className="d-last-streak">
            <Sparkles size={11} />
            {workoutsThisWeek} minggu ini · {workoutStreak} day streak
          </span>
          <span className="d-last-xp">+{(lastWorkout?.xpEarned ?? 0).toLocaleString()} XP</span>
        </div>
        <button
          className="d-last-repeat"
          onClick={launchRepeatLast}
          disabled={!lastWorkout}
        >
          <span className="d-last-repeat-ico"><Repeat size={16} /></span>
          <span className="d-last-repeat-text">
            <span className="d-last-repeat-hud">REPEAT LAST</span>
            <span className="d-last-repeat-sub">
              {lastWorkout
                ? (lastMuscleLabel ? `Mulai sesi ${lastMuscleLabel} lagi` : 'Mulai sesi lagi')
                : 'Selesaikan sesi pertamamu untuk mengaktifkan'}
            </span>
          </span>
          {lastWorkout && (
            <span className="d-last-repeat-cta">
              <Play size={10} fill="currentColor" /> START
            </span>
          )}
        </button>
      </CornerBracket>
      </div>

      {/* ── 4. DAILY PROTOCOL ── */}
      <article className="card reveal" style={{ '--reveal-i': 3 } as React.CSSProperties}>
        <div className="card-head">
          <span className="card-head-icon d-proto-icon"><CheckCircle2 size={14} /></span>
          <span className="hud-label">DAILY PROTOCOL</span>
          <span className="d-proto-pct">{habitPercentage}%</span>
        </div>
        <div className="d-proto-count">{habitCompletion} / {habitTotal} Tugas Hari Ini</div>
        <div className="d-proto-progress">
          <div className="d-proto-progress-fill" style={{ width: `${habitPercentage}%` }} />
        </div>
        {habits.length > 0 && (
          <div className="d-proto-list">
            {habits.map(h => {
              const done = h.completedDates?.includes(today) ?? false;
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => toggleHabitToday(h.id)}
                  className={`d-proto-item ${done ? 'is-done' : ''}`}
                >
                  <span className="d-proto-item-check">
                    {done && <CheckCircle2 size={14} />}
                  </span>
                  <span className="d-proto-item-text">{h.name}</span>
                  {(h.streak ?? 0) > 0 && (
                    <span className="d-proto-item-streak">{h.streak}d</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <div className="hud-label-sm" style={{ marginTop: 14, marginBottom: 6, letterSpacing: '0.18em', color: 'var(--t-3)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
          BUAT PROTOKOL BARU
        </div>
        <div className="d-proto-input">
          <input
            type="text"
            placeholder="cth: Lari pagi, baca 10 hal..."
            value={newHabitName}
            onChange={(e) => setNewHabitName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddHabit(e); }}
          />
          <button
            className="d-proto-add"
            aria-label="Tambah protokol"
            onClick={handleAddHabit}
            disabled={!newHabitName.trim()}
          >
            <Plus size={16} />
          </button>
        </div>
      </article>

      {/* ── 5. HUNTER STATUS (existing StatusCard — Phase 3 wired) ── */}
      {profile && userState && (
        <div className="reveal" style={{ '--reveal-i': 4 } as React.CSSProperties}>
          <StatusCard
            gymProfile={profile}
            workouts={workouts}
            fatigue={fatigue}
            displayName={userState?.name || ''}
          />
        </div>
      )}

      {/* ── 6. MUSCLE RECOVERY ── */}
      <article className="card d-card-body reveal" style={{ '--reveal-i': 5 } as React.CSSProperties}>
        <div className="card-head">
          <span className="card-head-icon"><Activity size={14} /></span>
          <span className="hud-label">MUSCLE RECOVERY STATUS</span>
        </div>

        <div className="d-body-legend">
          <span className="d-legend-item"><span className="d-legend-dot d-dot-exh" /><span>Lelah</span></span>
          <span className="d-legend-item"><span className="d-legend-dot d-dot-rest" /><span>Pulih</span></span>
        </div>

        <CornerBracket className="d-body-stage" tone="cyan" size={11} inset={6}>
          <BodyViewToggle view={bodyView} onChange={setBodyView} />

          <div className="d-body-fig-wrap">
            <div className="d-body-scan" />
            <BodyTurntable
              view={bodyView}
              onViewChange={setBodyView}
              front={<BodyAnatomy view="front" exhausted={exhaustedSplit.front} gender={gender} />}
              back={<BodyAnatomy view="back" exhausted={exhaustedSplit.back} gender={gender} />}
            />
          </div>

          {/* Keyed on the face so the count re-enters when the body turns. */}
          <div className="d-body-active" key={bodyView}>
            <span style={{ color: 'var(--red)' }}>●</span> {exhaustedCount} LELAH
          </div>
        </CornerBracket>

        {readyMuscles.length > 0 && (
          <div className="d-body-ready">
            <div className="d-body-ready-head">
              <span className="hud-label-sm" style={{ color: 'var(--green-bright)', letterSpacing: '0.18em', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                SIAP DILATIH
              </span>
              <span className="d-body-ready-count">{readyMuscles.length} otot</span>
            </div>
            <div className="d-body-ready-list">
              {readyMuscles.map(m => (
                <span key={m} className="d-body-ready-chip">
                  <span className="d-body-ready-dot" />
                  <span>{MUSCLE_GROUP_CONFIG[m]?.label || m}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Per-muscle countdown — owns the only 1s tick on this page. */}
        <RecoveryCountdown workouts={workouts} gender={userGender} onSetChange={resyncClock} />

      </article>

      {/* ── 7. WEEKLY SCHEDULE ── */}
      <article className="card reveal" style={{ '--reveal-i': 6 } as React.CSSProperties}>
        <div className="card-head">
          <span className="card-head-icon"><Calendar size={14} /></span>
          <span className="hud-label">WEEKLY GYM SCHEDULE</span>
          {editingSchedule ? (
            <div className="d-sched-edit-actions">
              <button onClick={saveSchedule} className="d-sched-edit-btn is-primary">
                <Save size={11} /> Save
              </button>
              <button onClick={() => setEditingSchedule(false)} className="d-sched-edit-btn">
                <X size={11} /> Cancel
              </button>
            </div>
          ) : (
            <button onClick={startEditSchedule} className="d-sched-edit">
              <Edit3 size={11} /> Edit
            </button>
          )}
        </div>
        <ul className="d-sched-list">
          {DAYS.map(day => {
            const isToday = day === currentDayKey;
            const val = editingSchedule ? (editSchedule[day] ?? schedule[day] ?? '') : (schedule[day] || '');
            const rest = isRestDay(val);
            const muscles = val && !rest ? parseScheduleMuscles(val) : [];
            const canStart = isToday && !rest && muscles.length > 0;
            return (
              <li
                key={day}
                className={`d-sched-row ${isToday ? 'is-today' : ''} ${rest ? 'is-rest' : ''}`}
              >
                {isToday && <span className="d-sched-glow" />}
                <span className="d-sched-day">
                  {DAY_LABELS[day]}
                  {isToday && <span className="d-sched-today">TODAY</span>}
                </span>
                {editingSchedule ? (
                  <input
                    type="text"
                    className="d-sched-plan-input"
                    value={val}
                    onChange={(e) => setEditSchedule({ ...editSchedule, [day]: e.target.value })}
                    placeholder="—"
                  />
                ) : (
                  <span className="d-sched-plan">{val || '—'}</span>
                )}
                {!editingSchedule && canStart && (
                  <button className="d-sched-start" onClick={launchTodaysPlan}>
                    <Play size={9} fill="currentColor" /> Start
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </article>

      {/* ── Weight / Name edit sheets ──
          Shared HudDialog: portaled (a fixed overlay inside the transformed
          route wrapper would anchor to it), real enter + exit, Esc/backdrop
          dismiss, focus in and back. Bottom-anchored so the mobile keyboard
          pushes the sheet up instead of jumping a centred box. A <form> per
          sheet makes Enter / the keyboard's "done" key submit. */}
      <HudDialog
        open={editingWeight}
        onClose={() => setEditingWeight(false)}
        variant="sheet"
        title="Perbarui Berat Badan"
        subtitle="Status fisik"
        footer={
          <>
            <button type="button" className="hd-btn hd-btn--ghost" onClick={() => setEditingWeight(false)}>Batal</button>
            <button type="submit" form="d-weight-form" className="hd-btn hd-btn--primary" disabled={!weightValid}>Simpan</button>
          </>
        }
      >
        <form
          id="d-weight-form"
          onSubmit={(e) => { e.preventDefault(); if (weightValid) handleWeightUpdate(); }}
        >
          <div className="hd-field">
            <input
              className="hd-input tnum"
              type="text"
              inputMode="decimal"
              enterKeyHint="done"
              autoComplete="off"
              maxLength={6}
              value={weightShown}
              onChange={(e) => setNewWeight(normalizeWeightInput(e.target.value))}
              placeholder="cth: 65.5"
              aria-label="Berat badan (kg)"
            />
            <span className="hd-input-suffix">kg</span>
          </div>
        </form>
      </HudDialog>

      <HudDialog
        open={editingName}
        onClose={() => setEditingName(false)}
        variant="sheet"
        title="Ubah Nama Hunter"
        subtitle="Identitas"
        footer={
          <>
            <button type="button" className="hd-btn hd-btn--ghost" onClick={() => setEditingName(false)}>Batal</button>
            <button type="submit" form="d-name-form" className="hd-btn hd-btn--primary" disabled={!newName.trim()}>Simpan</button>
          </>
        }
      >
        <form
          id="d-name-form"
          onSubmit={(e) => { e.preventDefault(); if (newName.trim()) handleNameUpdate(); }}
        >
          <div className="hd-field">
            <input
              className="hd-input"
              type="text"
              enterKeyHint="done"
              autoComplete="nickname"
              maxLength={24}
              value={nameShown}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nama Hunter-mu"
              aria-label="Nama"
            />
          </div>
        </form>
      </HudDialog>
    </div>
  );
};
