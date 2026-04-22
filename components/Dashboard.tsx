import React, { useEffect, useState } from 'react';
import { storageService } from '../services/storageService';
import { WorkoutLog, Habit, MuscleGroup, GymSchedule, MUSCLE_RECOVERY_HOURS, getRecoveryHours, GymProfile } from '../types';
import { Activity, CheckCircle2, Flame, Zap, Calendar, Edit3, Save, X, Clock, Plus, UserCircle, Dumbbell } from 'lucide-react';
import { View } from '../types';
import AnatomyViewer from './Anatomy/AnatomyViewer';
import { getTrainedMuscleIds } from '../constants/muscleMapping';
import { MUSCLE_GROUP_CONFIG } from '../constants';
import { UserState } from '../types';
import { getRankForLevel, calculateStreak } from '../gamification';

import { useNavigate } from 'react-router-dom';

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
    });
    return unsubscribe;
  }, []);



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

      {/* ═══ HYPERTROPHY TOOLS ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-slide-up delay-300">
        <div onClick={() => navigate('/tools')} className="jarvis-card jarvis-card-glow p-5 rounded-xl flex items-center justify-between cursor-pointer group gradient-border">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 group-hover:bg-indigo-500 group-hover:text-slate-900 transition-all duration-300">
              <Zap size={22} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">1RM Calculator</h3>
              <p className="text-[10px] font-mono text-slate-500 mt-1">Strength Architect & Standards</p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 group-hover:text-indigo-400 shadow-inner">
            <span className="text-xl leading-none">➔</span>
          </div>
        </div>

        <div onClick={() => navigate('/tools')} className="jarvis-card jarvis-card-glow p-5 rounded-xl flex items-center justify-between cursor-pointer group gradient-border">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-violet-500/10 rounded-xl text-violet-400 group-hover:bg-violet-500 group-hover:text-slate-900 transition-all duration-300">
              <Clock size={22} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">Rest Timer</h3>
              <p className="text-[10px] font-mono text-slate-500 mt-1">Customizable active countdowns</p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 group-hover:text-violet-400 shadow-inner">
            <span className="text-xl leading-none">➔</span>
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
            <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-red-500 mr-1.5" />Recovering</span>
            <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-gray-600 mr-1.5" />Ready</span>
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