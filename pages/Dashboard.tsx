import React, { useEffect, useState } from 'react';
import { storageService } from '../services/storageService';
import { WorkoutLog, Habit, MuscleGroup, GymSchedule, MUSCLE_RECOVERY_HOURS, getRecoveryHours, GymProfile, ExerciseDefinition } from '../types';
import { Activity, CheckCircle2, Flame, Zap, Calendar, Edit3, Save, X, Plus, UserCircle, Play, Repeat, Sparkles } from 'lucide-react';
import { View } from '../types';
import AnatomyViewer from '../components/Anatomy/AnatomyViewer';
import { getTrainedMuscleIds } from '../constants/muscleMapping';
import { MUSCLE_GROUP_CONFIG } from '../config/constants';
import { UserState } from '../types';
import { getRankForLevel, calculateStreak } from '../services/gamificationService';
import { computeFatigue } from '../services/fatigueService';
import { StatusWindowModal } from '../components/StatusWindowModal';

import { useNavigate } from 'react-router-dom';

// Maps free-form schedule strings ("Push — Chest, Shoulders, Triceps") to MuscleGroup keys.
// Used by the "Today's Plan" hero card to launch a session without the muscle picker.
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
    // Use precise timestamp if available, otherwise fall back to noon
    const workoutTime = w.timestamp
      ? new Date(w.timestamp).getTime()
      : new Date(w.date + 'T12:00:00').getTime();

    // NaN guard
    if (isNaN(workoutTime)) continue;

    const msSince = nowMs - workoutTime;
    if (msSince < 0) continue; // future date guard

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

// Phase 9: muscles trained in the last 7 days that are NOW fully recovered.
// Surfaced as a green "ready" overlay on the Anatomy SVG so the gender-based
// recovery boost is visually obvious for female users.
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
  monday: 'Sen', tuesday: 'Sel', wednesday: 'Rab', thursday: 'Kam',
  friday: 'Jum', saturday: 'Sab', sunday: 'Min'
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

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000); // Update every second for recovery timer
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

  // ── Phase 3: subscribe to storageService so XP/Rank/Title updates from
  // GymTracker (or RTDB sync) are reflected here in real-time. ──
  useEffect(() => {
    const unsubscribe = storageService.subscribe(() => {
      setProfile(storageService.getGymProfile());
      setWorkouts(storageService.getWorkouts());
      setUserState(storageService.getUserState());
      setSystemMessage(storageService.getLastSystemMessage());
    });
    return unsubscribe;
  }, []);

  // ═══ Phase 25: Quick-Start launchers ═══
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
      name: newHabitName,
      streak: 0,
      completedDates: []
    };

    const updatedHabits = [...habits, newHabit];
    storageService.saveHabits(updatedHabits);
    setHabits(updatedHabits);
    setNewHabitName('');
  };



  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 animate-breathe" />
        <p className="text-slate-500 font-mono text-sm">Initializing Systems...</p>
      </div>
    </div>
  );

  const today = new Date(currentTime).toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
  const now = new Date(currentTime);
  const currentDayKey = DAYS[now.getDay() === 0 ? 6 : now.getDay() - 1]; // JS 0=Sun

  const getGreeting = () => {
    const hour = now.getHours();
    if (hour < 12) return 'Selamat Pagi';
    if (hour < 17) return 'Selamat Siang';
    if (hour < 20) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  const formattedDate = now.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  // Quick Stats
  const lastWorkout = workouts[0];
  const habitCompletion = habits.filter(h => h.completedDates?.includes(today))?.length;
  const habitTotal = habits?.length;
  const habitPercentage = habitTotal > 0 ? (habitCompletion / habitTotal) * 100 : 0;
  const workoutStreak = calculateStreak(workouts);

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekStartStr = weekStart.toLocaleDateString('en-CA');
  const workoutsThisWeek = workouts.filter(w => w.date >= weekStartStr)?.length;

  // 7-day heatmap
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i)); // Only call setDate ONCE
    const dateStr = d.toLocaleDateString('en-CA');
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
    const completedCount = habits.filter(h => h.completedDates?.includes(dateStr))?.length;
    return { dateStr, dayLabel, completedCount, total: habitTotal, isToday: dateStr === today };
  });

  // Recovery — Phase 9: gender-aware threshold
  const recoveringData = getRecoveringMuscles(workouts, currentTime, userState?.gender);
  const recoveringMuscles = recoveringData.map(r => r.muscle);
  const readyMuscles = getReadyMuscles(workouts, currentTime, new Set(recoveringMuscles));

  // Project Chimera Phase 2 — fatigue/recovery signal for the Status Window
  const fatigue = computeFatigue(workouts, currentTime, userState?.gender);

  // Schedule editing
  const startEditSchedule = () => {
    setEditSchedule({ ...schedule });
    setEditingSchedule(true);
  };
  const saveSchedule = () => {
    setSchedule(editSchedule);
    storageService.saveGymSchedule(editSchedule);
    setEditingSchedule(false);
  };

  return (
    <div className="space-y-8">
      {/* ── Compact Status Window trigger (opens elegant modal) ────────── */}
      {profile && (
        <div className="animate-slide-up">
          <StatusWindowModal
            gymProfile={profile}
            workouts={workouts}
            fatigue={fatigue}
            displayName={userState?.name || ''}
          />
        </div>
      )}

      {/* Greeting Header */}
      <div className="animate-slide-up">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <p className="text-slate-400 text-sm mb-1">{formattedDate}</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              {getGreeting()}, <span
                onClick={() => navigate('/profile')}
                className="gradient-text-cyan cursor-pointer hover:underline decoration-cyan-500/30 underline-offset-4 transition-all"
              >{userState?.name || 'Naufal'}</span>
            </h2>
            <div className="flex items-center space-x-3 mt-1 cursor-pointer hover:bg-slate-800/50 p-1 rounded-lg transition-colors w-fit" onClick={() => { setNewWeight(userState?.weight.toString() || ''); setEditingWeight(true); }}>
              <p className="text-slate-500 text-sm">
                Current Weight: <span className="text-white font-mono">{userState?.weight || '--'} kg</span>
              </p>
              <Edit3 size={12} className="text-slate-600" />
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {workoutStreak > 0 && (
              <div className="flex items-center space-x-2 bg-orange-500/10 border border-orange-500/30 rounded-full px-4 py-2 shadow-[0_0_10px_rgba(249,115,22,0.1)]">
                <Flame size={16} className="text-orange-500 animate-pulse" />
                <span className="text-sm font-bold text-orange-400 font-mono">{workoutStreak} Day Streak</span>
              </div>
            )}
            {profile && (() => {
              const rank = getRankForLevel(profile.level || 1);
              return (
                <div
                  onClick={() => navigate('/gym')}
                  className="flex items-center space-x-2 bg-slate-900/80 border border-slate-700 rounded-full px-4 py-2 cursor-pointer hover:border-cyan-500/50 transition-all shadow-lg"
                >
                  <span className="text-lg">{rank.emoji}</span>
                  <div className="flex flex-col">
                    <span className={`text-[10px] font-bold leading-none ${rank.color}`}>{rank.name} <span className="text-slate-500 font-mono">Lv.{profile.level || 1}</span></span>
                    <span className="text-[10px] text-slate-400 font-mono font-bold">{(profile?.totalXP || 0).toLocaleString()} XP</span>
                  </div>
                </div>
              );
            })()}
            <button
              onClick={() => navigate('/profile')}
              className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <UserCircle size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* ═══ Phase 25: QUICK-START HERO STRIP ═══ */}
      {(() => {
        const todayLabel = schedule[currentDayKey] || '';
        const todayIsRest = isRestDay(todayLabel);
        const todayMuscles = todayLabel ? parseScheduleMuscles(todayLabel) : [];
        const canStartToday = !!todayLabel && !todayIsRest && todayMuscles.length > 0;
        const repeatLabel = lastWorkout?.type;
        const repeatExerciseCount = lastWorkout?.exercises?.length ?? 0;
        const repeatXP = lastWorkout?.xpEarned ?? 0;

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-slide-up">
            {/* Today's Plan */}
            <button
              onClick={launchTodaysPlan}
              disabled={!canStartToday}
              className={`relative overflow-hidden text-left p-5 rounded-2xl border transition-all duration-200 group ${canStartToday
                ? 'bg-gradient-to-br from-red-500/15 via-orange-500/10 to-amber-500/5 border-red-500/40 hover:border-red-400 shadow-[0_0_25px_rgba(239,68,68,0.15)] hover:shadow-[0_0_35px_rgba(239,68,68,0.3)] cursor-pointer'
                : 'bg-slate-900/60 border-slate-800 cursor-not-allowed opacity-70'
                }`}
            >
              {canStartToday && (
                <div className="absolute -top-12 -right-12 w-40 h-40 bg-red-500/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-500" />
              )}
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className={`p-2 rounded-lg ${canStartToday ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-600'}`}>
                      <Calendar size={16} />
                    </div>
                    <span className={`text-[10px] font-mono uppercase tracking-widest font-bold ${canStartToday ? 'text-red-400' : 'text-slate-500'}`}>
                      Today's Plan
                    </span>
                  </div>
                  {canStartToday && (
                    <div className="flex items-center space-x-1 bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-lg shadow-red-500/40 group-hover:bg-red-400 transition-colors">
                      <Play size={10} fill="currentColor" />
                      <span>Start</span>
                    </div>
                  )}
                </div>
                <h3 className={`text-lg font-extrabold mb-1 ${canStartToday ? 'text-white' : 'text-slate-400'}`}>
                  {todayLabel || 'No schedule set'}
                </h3>
                <p className="text-xs text-slate-400">
                  {canStartToday
                    ? `${todayMuscles.length} muscle ${todayMuscles.length === 1 ? 'group' : 'groups'} · skips picker`
                    : todayIsRest
                      ? 'Rest day — recover well 🧘'
                      : 'Edit your schedule below to enable Quick Start'}
                </p>
              </div>
            </button>

            {/* Repeat Last Workout */}
            <button
              onClick={launchRepeatLast}
              disabled={!lastWorkout}
              className={`relative overflow-hidden text-left p-5 rounded-2xl border transition-all duration-200 group ${lastWorkout
                ? 'bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-slate-900 border-cyan-500/30 hover:border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.1)] hover:shadow-[0_0_30px_rgba(6,182,212,0.25)] cursor-pointer'
                : 'bg-slate-900/60 border-slate-800 cursor-not-allowed opacity-70'
                }`}
            >
              {lastWorkout && (
                <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-cyan-500/15 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-500" />
              )}
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className={`p-2 rounded-lg ${lastWorkout ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-600'}`}>
                      <Repeat size={16} />
                    </div>
                    <span className={`text-[10px] font-mono uppercase tracking-widest font-bold ${lastWorkout ? 'text-cyan-400' : 'text-slate-500'}`}>
                      Repeat Last
                    </span>
                  </div>
                  {lastWorkout && (
                    <div className="flex items-center space-x-1 bg-cyan-500 text-slate-900 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-lg shadow-cyan-500/40 group-hover:bg-cyan-400 transition-colors">
                      <Play size={10} fill="currentColor" />
                      <span>Start</span>
                    </div>
                  )}
                </div>
                <h3 className={`text-lg font-extrabold mb-1 ${lastWorkout ? 'text-white' : 'text-slate-400'}`}>
                  {repeatLabel || 'No previous workout'}
                </h3>
                <p className="text-xs text-slate-400">
                  {lastWorkout
                    ? `${repeatExerciseCount} exercises · ${repeatXP > 0 ? `${repeatXP} XP earned` : 'last session'}`
                    : 'Log your first session to enable Repeat'}
                </p>
              </div>
            </button>
          </div>
        );
      })()}

      {/* ═══ Phase 25: SYSTEM BRIEFING ═══ */}
      {systemMessage && (
        <div className="animate-slide-up jarvis-card p-4 rounded-xl border border-red-500/30 bg-gradient-to-br from-slate-900 via-red-500/5 to-slate-900 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-3xl" />
          <div className="relative z-10 flex items-start space-x-3">
            <div className="shrink-0 mt-0.5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center shadow-lg shadow-red-500/40">
                <Sparkles size={16} className="text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-red-400">The System</span>
                <span className="text-[10px] font-mono text-slate-500">latest verdict</span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed line-clamp-3 whitespace-pre-line">
                {systemMessage}
              </p>
            </div>
            <button
              onClick={() => { storageService.saveLastSystemMessage(''); setSystemMessage(''); }}
              className="shrink-0 p-1 text-slate-600 hover:text-slate-300 transition-colors"
              aria-label="Dismiss System briefing"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Gym Card */}
        <div onClick={() => navigate('/gym')}
          className="animate-slide-up delay-100 jarvis-card jarvis-card-glow p-6 cursor-pointer group gradient-border rounded-xl">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400 group-hover:bg-cyan-500 group-hover:text-slate-900 transition-all duration-300">
              <Activity size={22} />
            </div>
            <div className="text-right">
              {lastWorkout && lastWorkout.date === today ? (
                <span className="bg-emerald-500/15 text-emerald-400 text-[10px] px-2.5 py-1 rounded-full border border-emerald-500/30 font-bold uppercase tracking-wider">Logged</span>
              ) : (
                <span className="bg-slate-800 text-slate-500 text-[10px] px-2.5 py-1 rounded-full border border-slate-700 font-bold uppercase tracking-wider">Pending</span>
              )}
            </div>
          </div>
          <h3 className="text-slate-400 text-xs uppercase tracking-widest font-mono mb-2">Last Session</h3>
          {lastWorkout ? (
            <>
              <span className="text-2xl font-extrabold text-white">{lastWorkout.type}</span>
              <span className="text-slate-500 text-xs ml-2">({lastWorkout.date})</span>
              <div className="text-xs text-slate-400 mt-2 flex items-center">
                <Calendar size={12} className={schedule[currentDayKey] ? "text-cyan-400 mr-1.5" : "text-slate-600 mr-1.5"} />
                {schedule[currentDayKey] ? (
                  <span>Scheduled: <span className="text-white font-medium">{schedule[currentDayKey]}</span></span>
                ) : (
                  <span>Rest Day</span>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
                <span className="flex items-center"><Zap size={10} className="mr-1" />{workoutsThisWeek} this week</span>
                {lastWorkout.xpEarned > 0 && <span className="text-amber-400 font-mono">+{lastWorkout.xpEarned} XP</span>}
              </div>
            </>
          ) : (
            <span className="text-lg text-slate-500">No data logged</span>
          )}
        </div>

        {/* Habits Card */}
        <div onClick={() => navigate('/habits')}
          className="animate-slide-up delay-300 jarvis-card jarvis-card-glow p-6 cursor-pointer group gradient-border rounded-xl">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-900 transition-all duration-300">
              <CheckCircle2 size={22} />
            </div>
            <span className="text-2xl font-mono font-extrabold text-white">{Math.round(habitPercentage)}%</span>
          </div>
          <h3 className="text-slate-400 text-xs uppercase tracking-widest font-mono mb-2">Daily Protocol</h3>
          <div className="text-sm text-slate-300 font-medium">{habitCompletion} / {habitTotal} Tasks Executed</div>
          <div className="mt-3 flex space-x-1.5">
            {habits.slice(0, 5).map(h => (
              <div key={h.id}
                className={`h-2 flex-1 rounded-full transition-all duration-500 ${h.completedDates?.includes(today) ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-slate-800'}`} />
            ))}
          </div>

          {/* Quick Add Habit */}
          <div onClick={e => e.stopPropagation()} className="mt-4 pt-3 border-t border-slate-800">
            <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-2">Create New Protocol</div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newHabitName}
                onChange={e => setNewHabitName(e.target.value)}
                placeholder="e.g. Morning Run..."
                className="bg-slate-950 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white w-full focus:outline-none focus:border-cyan-500 placeholder:text-slate-600 shadow-inner"
                onKeyDown={e => e.key === 'Enter' && handleAddHabit(e)}
              />
              <button onClick={handleAddHabit} className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 p-2 rounded-lg transition-colors font-bold shadow-lg shadow-cyan-500/20">
                <Plus size={14} strokeWidth={3} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ MUSCLE RECOVERY MAP ═══ */}
      <div className="animate-slide-up delay-400 jarvis-card p-6 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Activity size={18} className="text-red-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Muscle Recovery Status</h3>
          </div>
          <div className="flex items-center space-x-3 text-[10px]">
            <span className="flex items-center">
              <span className="w-2.5 h-2.5 rounded-full bg-transparent border-2 border-red-500 mr-1.5 shadow-[0_0_4px_rgba(239,68,68,0.7)]" />
              Exhausted
            </span>
            <span className="flex items-center">
              <span className="w-2.5 h-2.5 rounded-full bg-transparent border-2 border-slate-400 mr-1.5" />
              Rested
            </span>
          </div>
        </div>

        {/* SINGLE CENTERED ANATOMY VIEWER — built-in toggle handles front/back */}
        <div className="w-full flex justify-center mt-6">
          <div className="w-full max-w-[280px] sm:max-w-xs">
            <AnatomyViewer
              trainedMuscles={getTrainedMuscleIds(recoveringMuscles)}
              readyMuscles={getTrainedMuscleIds(readyMuscles)}
              defaultView="front"
            />
          </div>
        </div>

        {/* RECOVERY TIMERS LIST */}
        {recoveringData.length > 0 && (
          <div className="mt-8 space-y-3 max-w-md mx-auto">
            <h4 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3 text-center">Recovery Estimations</h4>
            {recoveringData.map((data, i) => {
              const maxH = getRecoveryHours(data.muscle as MuscleGroup, userState?.gender);
              const totalSecsLeft = (data.hoursLeft * 3600) + (data.minutesLeft * 60) + (data.secondsLeft || 0);
              // Progress = how much recovery is COMPLETE (0% = just started, 100% = fully recovered)
              const pct = Math.max(0, Math.min(100, 100 - (totalSecsLeft / (maxH * 3600)) * 100));
              const nearlyDone = pct > 80;

              return (
                <div key={i} className="p-3 bg-slate-900 border border-slate-800 rounded-xl relative overflow-hidden group">
                  <div className={`absolute top-0 left-0 w-1 h-full ${nearlyDone ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]'}`} />

                  <div className="flex items-center justify-between pl-2 mb-2">
                    <span className="text-sm font-bold text-slate-300 capitalize flex items-center tracking-wide">
                      {MUSCLE_GROUP_CONFIG[data.muscle as MuscleGroup]?.label || data.muscle}
                    </span>
                    <span className={`text-[10px] font-mono font-bold tracking-widest ${nearlyDone ? 'text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.8)]' : 'text-red-400 drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]'}`}>
                      {data.hoursLeft}h {data.minutesLeft}m {data.secondsLeft}s remaining
                    </span>
                  </div>

                  {/* Progress Bar - fills up as recovery progresses */}
                  <div className="w-full ml-2 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${nearlyDone ? 'bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-gradient-to-r from-red-600 to-red-400 shadow-[0_0_8px_rgba(239,68,68,0.8)]'} transition-all duration-1000 ease-linear`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ GYM SCHEDULE ═══ */}
      <div className="animate-slide-up delay-400 jarvis-card p-6 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Calendar size={18} className="text-jarvis-accent" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Weekly Gym Schedule</h3>
          </div>
          {editingSchedule ? (
            <div className="flex space-x-2">
              <button onClick={saveSchedule} className="flex items-center space-x-1 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-3 py-1.5 rounded-lg">
                <Save size={12} /><span>Save</span>
              </button>
              <button onClick={() => setEditingSchedule(false)} className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white bg-slate-800 px-3 py-1.5 rounded-lg">
                <X size={12} /><span>Cancel</span>
              </button>
            </div>
          ) : (
            <button onClick={startEditSchedule} className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white bg-slate-800 px-3 py-1.5 rounded-lg">
              <Edit3 size={12} /><span>Edit</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
          {DAYS.map(day => {
            const isToday = day === currentDayKey;
            const val = editingSchedule ? editSchedule[day] || '' : schedule[day] || '';
            return (
              <div key={day}
                className={`p-3 rounded-xl border transition-all ${isToday
                  ? 'bg-gradient-to-b from-cyan-500/15 to-blue-500/10 border-cyan-500/40 shadow-lg shadow-cyan-500/5'
                  : 'bg-slate-900/50 border-slate-800'
                  }`}>
                <div className={`text-[10px] font-mono font-bold uppercase tracking-widest mb-1.5 ${isToday ? 'text-cyan-400' : 'text-slate-500'}`}>
                  {DAY_LABELS[day]}
                  {isToday && <span className="ml-1 text-[8px] text-cyan-500">TODAY</span>}
                </div>
                {editingSchedule ? (
                  <input
                    type="text" value={val}
                    onChange={(e) => setEditSchedule({ ...editSchedule, [day]: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                ) : (
                  <div className={`text-xs ${isToday ? 'text-white font-medium' : 'text-slate-400'}`}>
                    {val || '—'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>



      {/* Weight Update Modal */}
      {
        editingWeight && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-scale-in">
              <h3 className="text-xl font-bold text-white mb-4">Update Body Weight</h3>
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
        )
      }


      {/* Name Update Modal */}
      {
        editingName && (
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
        )
      }
    </div>
  );
};