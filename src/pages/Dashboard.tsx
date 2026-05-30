import React, { useEffect, useState } from 'react';
import { storageService } from '../services/storageService';
import { WorkoutLog, Habit, MuscleGroup, GymSchedule, getRecoveryHours, GymProfile, ExerciseDefinition, UserState } from '../types';
import { Calendar, Edit3, Save, X, Plus, Play, Repeat, Activity, CheckCircle2, Sparkles, Pencil } from 'lucide-react';
import { MUSCLE_GROUP_CONFIG } from '../config/constants';
import { calculateStreak } from '../services/gamificationService';
import { computeFatigue } from '../services/fatigueService';
import { StatusCard } from '../components/StatusCard';
import { SystemNotification, BodyAnatomy, splitExhaustedByView, CornerBracket } from '../components/hud';
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

// Get muscles currently recovering based on workout history.
// Phase 9: gender modifier — Female users recover ~18% faster.
function getRecoveringMuscles(
  workouts: WorkoutLog[],
  nowMs: number,
  gender?: 'Male' | 'Female',
): { muscle: MuscleGroup; hoursLeft: number; minutesLeft: number; secondsLeft: number }[] {
  const recovering: { muscle: MuscleGroup; hoursLeft: number; minutesLeft: number; secondsLeft: number }[] = [];
  const seen = new Set<MuscleGroup>();

  for (const w of workouts) {
    const workoutTime = w.timestamp
      ? new Date(w.timestamp).getTime()
      : new Date(w.date + 'T12:00:00').getTime();

    if (isNaN(workoutTime)) continue;

    const msSince = nowMs - workoutTime;
    if (msSince < 0) continue;

    const muscles: MuscleGroup[] = w.muscleGroups && w.muscleGroups?.length > 0
      ? w.muscleGroups
      : [];

    for (const m of muscles) {
      if (seen.has(m)) continue;
      const recoveryH = getRecoveryHours(m, gender);
      const recoveryMs = recoveryH * 60 * 60 * 1000;

      if (msSince < recoveryMs) {
        const msLeft = recoveryMs - msSince;
        const totalSecondsLeft = Math.floor(msLeft / 1000);
        const hoursLeft = Math.floor(totalSecondsLeft / 3600);
        const minutesLeft = Math.floor((totalSecondsLeft % 3600) / 60);
        const secondsLeft = totalSecondsLeft % 60;

        if (totalSecondsLeft > 0) {
          recovering.push({ muscle: m, hoursLeft, minutesLeft, secondsLeft });
          seen.add(m);
        }
      }
    }
  }
  return recovering;
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
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [profile, setProfile] = useState<GymProfile | null>(null);
  const [schedule, setSchedule] = useState<GymSchedule>({});
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [editSchedule, setEditSchedule] = useState<GymSchedule>({});
  const [userState, setUserState] = useState<UserState | null>(null);
  const [editingWeight, setEditingWeight] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [newHabitName, setNewHabitName] = useState('');
  const [systemMessage, setSystemMessage] = useState<string>(storageService.getLastSystemMessage());
  // Long verdicts (3-5 paragraphs) collapse to 4 lines until user expands.
  // Scoped to this card only — re-collapses whenever the verdict text changes.
  const [verdictExpanded, setVerdictExpanded] = useState(false);
  useEffect(() => { setVerdictExpanded(false); }, [systemMessage]);

  // Muscle Recovery 3D flip state (Q4: 600ms cubic ease-out)
  const [bodyView, setBodyView] = useState<'front' | 'back'>('front');
  const [bodyAngle, setBodyAngle] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      setWorkouts(storageService.getWorkouts());
      setHabits(storageService.getHabits());
      setProfile(storageService.getGymProfile());
      setSchedule(storageService.getGymSchedule());
      setUserState(storageService.getUserState());
    } catch (err) {
      console.error('[Dashboard] Failed to load data from storage:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = storageService.subscribe(() => {
      setProfile(storageService.getGymProfile());
      setWorkouts(storageService.getWorkouts());
      setUserState(storageService.getUserState());
      setSystemMessage(storageService.getLastSystemMessage());
    });
    return unsubscribe;
  }, []);

  // Body flip RAF — interpolate to target angle (600ms cubic ease-out)
  useEffect(() => {
    const target = bodyView === 'back' ? 180 : 0;
    const from = bodyAngle;
    if (Math.abs(target - from) < 0.1) return;
    const start = performance.now();
    const dur = 600;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      setBodyAngle(from + (target - from) * ease(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyView]);

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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 animate-breathe" />
        <p className="text-slate-500 font-mono text-sm">Initializing Systems...</p>
      </div>
    </div>
  );

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

  const recoveringData = getRecoveringMuscles(workouts, currentTime, userState?.gender);
  const recoveringMuscles = recoveringData.map(r => r.muscle);
  const readyMuscles = getReadyMuscles(workouts, currentTime, new Set(recoveringMuscles));

  const fatigue = computeFatigue(workouts, currentTime, userState?.gender);

  // Split exhausted muscles by view (front/back) — feeds BodyAnatomy
  const exhaustedSplit = splitExhaustedByView(recoveringMuscles);

  // 3D body flip transform math
  const rad = bodyAngle * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const scaleX = 0.04 + 0.96 * Math.abs(cos);
  const showFront = cos >= 0;
  const edgeIntensity = Math.pow(1 - Math.abs(cos), 1.5);
  const rotateShade = Math.abs(sin) * 0.85;
  const visibleExhausted = showFront ? exhaustedSplit.front : exhaustedSplit.back;
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
          {getGreeting()}, <span
            className="fz-cyan"
            onClick={() => { setNewName(userState?.name || ''); setEditingName(true); }}
          >{userState?.name || 'Hunter'}</span>
        </h1>
        <div
          className="d-greet-weight"
          onClick={() => { setNewWeight(userState?.weight?.toString() || ''); setEditingWeight(true); }}
        >
          <span className="hud-label-sm">CURRENT WEIGHT:</span>
          <span className="d-greet-weight-val">{userState?.weight ?? '--'} <span className="d-greet-unit">kg</span></span>
          <button className="d-greet-edit" aria-label="Edit berat"><Pencil size={11} /></button>
        </div>
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
        className="card card-cyan d-card-last"
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
          <div className="d-body-toggle">
            <button className={`d-body-toggle-opt ${bodyView === 'front' ? 'is-on' : ''}`} onClick={() => setBodyView('front')}>FRONT</button>
            <button className={`d-body-toggle-opt ${bodyView === 'back' ? 'is-on' : ''}`} onClick={() => setBodyView('back')}>BACK</button>
          </div>

          <div className="d-body-fig-wrap">
            <div className="d-body-scan" />
            <div
              className="d-body-3d"
              style={{
                transform: `rotateY(${bodyAngle}deg) scaleX(${scaleX})`,
                filter: `brightness(${0.6 + 0.4 * Math.abs(cos)})`,
              }}
            >
              <div
                className="d-body-face-real"
                style={{ opacity: showFront ? 1 : 0, '--rotate-shade': rotateShade } as React.CSSProperties}
              >
                <BodyAnatomy view="front" exhausted={exhaustedSplit.front} gender={gender} />
              </div>
              <div
                className="d-body-face-real d-body-face-mirror"
                style={{ opacity: showFront ? 0 : 1, '--rotate-shade': rotateShade } as React.CSSProperties}
              >
                <BodyAnatomy view="back" exhausted={exhaustedSplit.back} gender={gender} />
              </div>
            </div>
            <div
              className="d-body-edge"
              style={{
                opacity: edgeIntensity * 0.9,
                transform: `translateX(-50%) scaleY(${1 - edgeIntensity * 0.05})`,
              }}
            />
          </div>

          <div className="d-body-active">
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

        {recoveringData.length > 0 && (
          <div className="mt-3 space-y-2">
            {recoveringData.map((data) => {
              const maxH = getRecoveryHours(data.muscle, userState?.gender);
              const totalSecsLeft = (data.hoursLeft * 3600) + (data.minutesLeft * 60) + (data.secondsLeft || 0);
              const pct = Math.max(0, Math.min(100, 100 - (totalSecsLeft / (maxH * 3600)) * 100));
              const nearlyDone = pct > 80;
              return (
                <div key={data.muscle} className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg relative overflow-hidden">
                  <div className={`absolute top-0 left-0 w-1 h-full ${nearlyDone ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ boxShadow: nearlyDone ? undefined : '0 0 8px rgba(239,68,68,0.7)' }} />
                  <div className="flex items-center justify-between pl-2 mb-1.5">
                    <span className="text-xs font-bold text-slate-200 capitalize">
                      {MUSCLE_GROUP_CONFIG[data.muscle]?.label || data.muscle}
                    </span>
                    <span className={`text-[10px] font-mono font-bold tracking-wider ${nearlyDone ? 'text-emerald-400' : 'text-red-400'}`}>
                      {data.hoursLeft}h {data.minutesLeft}m {data.secondsLeft}s
                    </span>
                  </div>
                  <div className="w-full ml-2 h-1 bg-slate-900 rounded-full overflow-hidden">
                    <div className={`h-full ${nearlyDone ? 'bg-emerald-700/70' : 'bg-gradient-to-r from-red-600 to-red-400'}`} style={{ width: `${pct}%`, transition: 'width 1s linear' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
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

      {/* ── Weight Update Modal ── */}
      {editingWeight && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-scale-in">
            <h3 className="text-xl font-bold text-white mb-4">Update Weight</h3>
            <div className="relative mb-6">
              <input
                type="number"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                autoFocus
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white text-lg focus:outline-none focus:border-cyan-500 transition-colors"
                placeholder="Ex: 65.5"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">kg</span>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setEditingWeight(false)}
                className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-400 font-bold hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleWeightUpdate}
                disabled={!newWeight}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold hover:shadow-lg hover:shadow-cyan-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Name Update Modal ── */}
      {editingName && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-scale-in">
            <h3 className="text-xl font-bold text-white mb-4">Update Name</h3>
            <div className="relative mb-6">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white text-lg focus:outline-none focus:border-cyan-500 transition-colors"
                placeholder="Enter your name"
              />
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setEditingName(false)}
                className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-400 font-bold hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleNameUpdate}
                disabled={!newName}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold hover:shadow-lg hover:shadow-cyan-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
