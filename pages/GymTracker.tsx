import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  MuscleGroup, WorkoutLog, GymProfile, ExerciseDefinition, FirestoreExercise, FocusArea
} from '../types';
import { storageService } from '../services/storageService';
import { exerciseService } from '../services/exerciseService';
import { MUSCLE_GROUP_CONFIG } from '../config/constants';
import { WORKOUT_PACKAGES, WorkoutRoutine } from '../data/workoutPackages';
import { auth, db } from '../firebase-config';
import { doc, getDoc } from 'firebase/firestore';
import {
  getLevelFromXP, getRankForLevel, getXPProgress, calculateWorkoutXP,
  generateLeaderboard, updateProfileAfterWorkout, recalculateGymProfile,
  RANK_TIERS, LeaderboardEntry,
} from '../services/gamificationService';
import {
  Play, Pause, RotateCcw, ChevronRight, X, Trophy, Dumbbell, Activity, Save, History, Trash2,
  Flame, Target, ListPlus, CheckSquare, Clock, Zap, ChevronDown, ImageOff, Minus, Plus,
  Timer, Star, BarChart3, TrendingUp, Package, ExternalLink, Database, Loader2, Youtube,
  Search, ChevronLeft,
} from 'lucide-react';
import { Leaderboard } from '../components/Leaderboard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import AnatomyViewer, { getViewForMuscle } from '../components/Anatomy/AnatomyViewer';
import { mapDBMuscleToUIKey, getTrainedMuscleIds } from '../constants/muscleMapping';

// ═══════════ INTERACTIVE INPUT ═══════════
const InteractiveInput: React.FC<{
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
}> = ({ label, value, onChange, min = 0, max = 200, step = 1 }) => (
  <div className="bg-slate-900 p-3 rounded-xl border border-slate-700 w-full">
    <div className="flex justify-between items-center mb-2">
      <span className="text-xs text-slate-400 font-mono uppercase">{label}</span>
      <input
        type="number" value={value}
        onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); }}
        min={min} max={max} step={step} inputMode="decimal"
        className="bg-transparent text-xl font-bold text-white font-mono text-right w-24 focus:outline-none focus:border-b focus:border-cyan-500 transition-all appearance-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    </div>
    <div className="flex items-center space-x-3">
      <button onClick={() => onChange(Math.max(min, parseFloat((value - step).toFixed(2))))}
        className="w-8 h-8 flex items-center justify-center bg-slate-800 rounded-full text-slate-300 hover:bg-slate-700 active:scale-95 transition-all flex-shrink-0"><Minus size={14} /></button>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-jarvis-accent min-w-0" />
      <button onClick={() => onChange(Math.min(max, parseFloat((value + step).toFixed(2))))}
        className="w-8 h-8 flex items-center justify-center bg-jarvis-accent/20 rounded-full text-jarvis-accent hover:bg-jarvis-accent/30 active:scale-95 transition-all flex-shrink-0"><Plus size={14} /></button>
    </div>
  </div>
);

// ═══════════ REST TIMER ═══════════
const RestTimer: React.FC<{ trigger?: boolean; defaultTime?: number; onTimerEnd?: () => void }> = ({
  trigger = false, defaultTime = 60, onTimerEnd,
}) => {
  const [seconds, setSeconds] = useState(0);
  const [maxS, setMaxS] = useState(defaultTime);
  const [active, setActive] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);

  useEffect(() => { if (trigger) start(defaultTime); }, [trigger, defaultTime]);

  const beep = useCallback(() => {
    try {
      if (!audioCtx.current) audioCtx.current = new AudioContext();
      const osc = audioCtx.current.createOscillator();
      const gain = audioCtx.current.createGain();
      osc.connect(gain); gain.connect(audioCtx.current.destination);
      osc.frequency.value = 880; gain.gain.value = 0.3;
      osc.start(); osc.stop(audioCtx.current.currentTime + 0.2);
    } catch { }
  }, []);

  useEffect(() => {
    if (active && seconds > 0) {
      intervalRef.current = window.setInterval(() => setSeconds(s => s - 1), 1000);
    } else if (seconds === 0 && active) {
      setActive(false); beep(); if (onTimerEnd) onTimerEnd();
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [active, seconds, beep, onTimerEnd]);

  const start = (s: number) => { setMaxS(s); setSeconds(s); setActive(true); };
  const stop = () => { setActive(false); setSeconds(0); };
  const pct = maxS > 0 ? ((maxS - seconds) / maxS) * 100 : 0;
  const r = 36; const circ = 2 * Math.PI * r;

  if (!active && !trigger) return null;
  return (
    <div className={`jarvis-card p-4 rounded-xl mb-4 transition-all duration-300 ${active ? 'opacity-100 scale-100' : 'opacity-0 scale-95 hidden'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono text-slate-400 uppercase flex items-center"><Timer size={12} className="mr-1" />Rest Timer</span>
        <button onClick={stop} className="text-xs text-slate-500 hover:text-white"><X size={12} /></button>
      </div>
      <div className="flex items-center space-x-4">
        <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
          <svg width="80" height="80" className="-rotate-90">
            <circle cx="40" cy="40" r={r} stroke="#1e293b" strokeWidth="5" fill="none" />
            <circle cx="40" cy="40" r={r} stroke={seconds > 0 ? '#06b6d4' : '#334155'} strokeWidth="5" fill="none"
              strokeDasharray={circ} strokeDashoffset={circ - (circ * pct / 100)} strokeLinecap="round" className="transition-all duration-1000" />
          </svg>
          <span className="absolute text-lg font-bold text-white font-mono">{seconds}s</span>
        </div>
        <div className="flex flex-wrap gap-2 flex-1">
          {[30, 60, 90, 120].map(s => (
            <button key={s} onClick={() => start(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex-1 min-w-[60px] ${active && maxS === s ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>{s}s</button>
          ))}
          <button onClick={() => start(maxS + 10)} className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-slate-800 text-slate-400 hover:bg-slate-700 active:scale-95 flex-1 min-w-[60px]">+10s</button>
        </div>
      </div>
    </div>
  );
};

// ═══════════ DIFFICULTY STARS ═══════════
const DifficultyStars: React.FC<{ d: number }> = ({ d }) => (
  <div className="flex space-x-0.5">{Array.from({ length: 5 }, (_, i) => (
    <Star key={i} size={10} className={i < d ? 'text-amber-400 fill-amber-400' : 'text-slate-700'} />
  ))}</div>
);

// ═══════════ XP HEADER ═══════════
const XPHeader: React.FC<{ profile: GymProfile }> = ({ profile }) => {
  const progress = getXPProgress(profile.totalXP);
  const rank = getRankForLevel(profile.level);
  return (
    <div className="jarvis-card rounded-xl p-4 md:p-5 border border-slate-700/50 relative overflow-hidden">
      <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 transition-all duration-500" style={{ width: `${progress.percent}%` }} />
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="text-3xl">{rank.emoji}</div>
          <div>
            <div className="flex items-center space-x-2">
              <span className={`text-sm font-bold ${rank.color}`}>{rank.name}</span>
              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">Lv.{profile?.level || 1}</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">{(profile?.totalXP || 0).toLocaleString()} XP total</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400 mb-1">{progress.current} / {progress.needed} XP</div>
          <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500" style={{ width: `${progress.percent}%` }} />
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-4 mt-3 text-[10px] text-slate-500 font-mono">
        <span>🏋️ {profile?.workoutsCompleted || 0} workouts</span>
        <span>💪 {profile?.totalSetsCompleted || 0} sets</span>
      </div>
    </div>
  );
};

// ═══════════ MUSCLE GROUP PICKER ═══════════
const MuscleGroupPicker: React.FC<{
  selected: MuscleGroup[]; onToggle: (m: MuscleGroup) => void;
}> = ({ selected, onToggle }) => {
  const categories = ['Push', 'Pull', 'Core', 'Legs'];
  const allMuscles = Object.entries(MUSCLE_GROUP_CONFIG) as [MuscleGroup, typeof MUSCLE_GROUP_CONFIG[MuscleGroup]][];
  return (
    <div className="space-y-6 animate-slide-up">
      {categories.map(cat => {
        const muscles = allMuscles.filter(([, v]) => v.category === cat);
        if (muscles.length === 0) return null;
        return (
          <div key={cat} className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="h-px bg-slate-800 flex-1" />
              <h3 className="text-xs font-mono font-bold text-slate-500 tracking-[0.2em] uppercase">{cat}</h3>
              <div className="h-px bg-slate-800 flex-1" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {muscles.map(([key, cfg]) => {
                const isSelected = selected?.includes(key);
                return (
                  <button key={key} onClick={() => onToggle(key)}
                    className={`relative flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-300 group overflow-hidden ${isSelected
                      ? 'bg-gradient-to-br from-cyan-900/40 to-blue-900/20 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30'
                      : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800 hover:border-slate-600'}`}>
                    {isSelected && <div className="absolute inset-0 bg-cyan-500/5 mix-blend-screen" />}
                    {isSelected && <div className="absolute top-0 w-1/2 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />}
                    <div className="relative w-16 h-16 mb-3 transition-transform duration-300 group-hover:scale-110">
                      <img src={`/assets/muscles/${key}.webp`} alt={cfg.label}
                        className={`w-full h-full object-contain filter transition-all duration-500 ${isSelected ? 'drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] brightness-125 saturate-150' : 'opacity-70 grayscale-[30%]'}`}
                        onError={e => { e.currentTarget.style.display = 'none'; }} />
                    </div>
                    <div className="text-center z-10">
                      <h4 className={`text-sm font-bold tracking-wide transition-colors ${isSelected ? 'text-cyan-300' : 'text-slate-300'}`}>{cfg.label}</h4>
                      <p className={`text-[10px] font-mono mt-1 ${isSelected ? 'text-cyan-500/70' : 'text-slate-500'}`}>
                        {isSelected ? '✓ Selected' : 'Firestore'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ═══════════ DB → MUSCLE GROUP MAPPING ═══════════
// Handles ALL targetMuscle/secondaryMuscles values from ourlife_exercises.json,
// including variants with trailing commas like "gluteus maximus, " or "biceps brachii, ".
export const mapDBToMuscleGroup = (raw: string | undefined, fallback: MuscleGroup = 'chest'): MuscleGroup => {
  if (!raw) return fallback;
  const lower = raw.toLowerCase().replace(/,\s*$/, '').trim(); // strip trailing comma

  if (lower.includes('chest') || lower.includes('pectoral')) return 'chest';
  if (lower.includes('shoulder') || lower.includes('delt')) return 'shoulders';
  if (lower.includes('tricep')) return 'triceps';
  // Hamstrings BEFORE generic biceps to avoid "biceps femoris" → biceps
  if (lower.includes('hamstring') || lower.includes('biceps femoris') || lower.includes('semitendinosus') || lower.includes('semimembranosus')) return 'hamstrings';
  if (lower.includes('bicep') || lower.includes('brachialis')) return 'biceps';
  // Lower back / spine BEFORE generic 'lat' to avoid "latissimus" → lower_back
  if (lower.includes('lower back') || lower.includes('erector') || lower.includes('thoracolumbar') || lower === 'spine') return 'lower_back';
  if (lower.includes('latissimus') || lower === 'lats' || lower.includes('teres major') || lower === 'back, general') return 'lats';
  if (lower.includes('trap') || lower.includes('rhomboid') || lower === 'upper back' || lower.includes('levator scapulae') || lower.includes('splenius')) return 'traps';
  if (lower.includes('oblique')) return 'obliques';
  if (lower.includes('abs') || lower.includes('core') || lower.includes('rectus abdominis') || lower.includes('abdominal')) return 'abs';
  if (lower.includes('quad') || lower.includes('rectus femoris') || lower.includes('vastus')) return 'quads';
  if (lower.includes('glute') || lower.includes('gluteus') || lower.includes('hip abductor') || lower.includes('piriformis') || lower.includes('hip rotator')) return 'glutes';
  if (lower.includes('calf') || lower.includes('calv') || lower.includes('gastrocnemius') || lower.includes('soleus') || lower.includes('tibialis') || lower.includes('peroneus')) return 'calves';
  if (lower.includes('forearm') || lower.includes('brachioradialis') || lower.includes('wrist') || lower.includes('grip')) return 'forearms';
  // Adductors → quads (closest UI category)
  if (lower.includes('adductor') || lower.includes('inner thigh') || lower.includes('groin') || lower.includes('gracilis') || lower.includes('iliopsoas') || lower.includes('hip flexor')) return 'quads';
  // Abductors → glutes
  if (lower.includes('abductor') || lower.includes('tensor fasciae')) return 'glutes';
  // Infraspinatus, teres minor, rotator cuff → traps (back/upper back group)
  if (lower.includes('infraspinatus') || lower.includes('teres minor') || lower.includes('rotator cuff') || lower.includes('serratus')) return 'traps';
  // Neck
  if (lower.includes('longus colli') || lower.includes('sternocleidomastoid')) return 'traps';
  // Cardiovascular
  if (lower.includes('cardiovascular')) return 'abs';

  return fallback;
};

// ═══════════ DYNAMIC DIFFICULTY ═══════════
const calculateDifficulty = (ex: FirestoreExercise): 1 | 2 | 3 | 4 | 5 => {
  let score = 2;
  const equip = (ex.equipment || '').toLowerCase();
  if (equip.includes('barbell') || equip.includes('smith')) score += 1;
  if (equip.includes('body weight') && (ex.name?.toLowerCase().includes('pull') || ex.name?.toLowerCase().includes('dip') || ex.name?.toLowerCase().includes('muscle up'))) score += 1;
  const secondaryCount = ex.secondaryMuscles?.length || 0;
  if (secondaryCount >= 3) score += 2;
  else if (secondaryCount >= 1) score += 1;
  return Math.min(5, Math.max(1, score)) as 1 | 2 | 3 | 4 | 5;
};

// ═══════════ FIRESTORE EXERCISE BROWSER (Project Chimera Phase 3) ═══════════
// Page size: caps each muscle list to 5 items at a time — keeps DOM light and
// avoids janky scrolling on mid-range phones. User pages forward/back manually.
const EXERCISE_PAGE_SIZE = 5;

const ExerciseBrowser: React.FC<{
  muscles: MuscleGroup[];
  selectedExercises: ExerciseDefinition[];
  onToggleExercise: (ex: ExerciseDefinition) => void;
  userEquipment?: string[];
  logs?: WorkoutLog[];
}> = ({ muscles, selectedExercises, onToggleExercise, userEquipment, logs = [] }) => {
  const [exercisesByMuscle, setExercisesByMuscle] = useState<Record<string, FirestoreExercise[]>>({});
  const [loadingState, setLoadingState] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [pageByMuscle, setPageByMuscle] = useState<Record<string, number>>({});
  const fetchedRef = useRef<Set<string>>(new Set());

  // Re-filter cache whenever userEquipment changes (no need to refetch).
  const equipKey = (userEquipment || []).join('|');

  useEffect(() => {
    if (muscles.length === 0) return;
    const toFetch = muscles.filter(m => !fetchedRef.current.has(m));
    if (toFetch.length === 0) return;

    toFetch.forEach(async muscle => {
      fetchedRef.current.add(muscle);
      setLoadingState(prev => ({ ...prev, [muscle]: true }));
      try {
        const results = await exerciseService.getExercisesByMuscle(muscle);
        setExercisesByMuscle(prev => ({ ...prev, [muscle]: results }));
      } catch {
        setExercisesByMuscle(prev => ({ ...prev, [muscle]: [] }));
      } finally {
        setLoadingState(prev => ({ ...prev, [muscle]: false }));
      }
    });
  }, [muscles]);

  // Reset to page 0 whenever search or muscle list changes so we never strand
  // the user on an empty page.
  useEffect(() => {
    setPageByMuscle({});
  }, [search, equipKey, muscles]);

  // ── Habit-history frequency map: exercise name (lowercased) → count ──
  // Used to sort the list so the user's most-used moves bubble to the top.
  const historyCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const log of logs) {
      for (const ex of (log.exercises || [])) {
        const key = (ex.name || '').toLowerCase().trim();
        if (!key) continue;
        map.set(key, (map.get(key) || 0) + 1);
      }
    }
    return map;
  }, [logs]);

  // STRICT equipment filter — per Project Chimera spec, exercises requiring
  // gear the user does not have should not be displayed at all.
  const filteredByMuscle = useMemo(() => {
    const out: Record<string, FirestoreExercise[]> = {};
    const q = search.trim().toLowerCase();

    for (const m of Object.keys(exercisesByMuscle)) {
      let list = exercisesByMuscle[m] || [];

      // Hard equipment filter — no fallback. If you don't own it, you don't see it.
      if (userEquipment && userEquipment.length > 0) {
        list = exerciseService.filterByUserEquipment(list, userEquipment);
      }

      // Live search — match name OR equipment so "barbell" surfaces every barbell move.
      if (q) {
        list = list.filter(ex =>
          (ex.name || '').toLowerCase().includes(q) ||
          (ex.equipment || '').toLowerCase().includes(q),
        );
      }

      // Sort by historical frequency (descending), then alphabetically as tiebreak.
      list = [...list].sort((a, b) => {
        const ca = historyCount.get((a.name || '').toLowerCase().trim()) || 0;
        const cb = historyCount.get((b.name || '').toLowerCase().trim()) || 0;
        if (cb !== ca) return cb - ca;
        return (a.name || '').localeCompare(b.name || '');
      });

      out[m] = list;
    }
    return out;
  }, [exercisesByMuscle, equipKey, search, historyCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedIds = new Set(selectedExercises.map(e => e.id));

  const handleSelect = (ex: FirestoreExercise, muscle: MuscleGroup) => {
    const diff = calculateDifficulty(ex);
    const secondaryMapped = (ex.secondaryMuscles || [])
      .map(s => mapDBToMuscleGroup(s, muscle))
      .filter((m, i, arr) => arr.indexOf(m) === i); // deduplicate
    const mapped: ExerciseDefinition = {
      id: ex.id,
      name: ex.name,
      muscleGroup: mapDBToMuscleGroup(ex.targetMuscle, muscle),
      secondaryMuscles: secondaryMapped,
      equipment: ex.equipment || 'Bodyweight',
      difficulty: diff,
      xpPerSet: diff * 10,
      defaultSets: 3,
      defaultReps: 10,
      videoUrl: ex.gifUrl || '',
      tips: ex.instructions?.[0] || 'Maintain proper form and full range of motion.',
    };
    onToggleExercise(mapped);
  };

  if (muscles.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-center opacity-70">
        <Dumbbell size={40} className="text-slate-700 mb-3" />
        <p className="text-slate-500 text-sm">Select muscle groups first to load exercises.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Live search bar (Project Chimera Phase 3) ─────────────────── */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari latihan… (contoh: bench press, squat, barbell)"
          className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {(!userEquipment || userEquipment.length === 0) && (
        <div className="text-[10px] font-mono text-amber-400/80 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
          ⚠ Set your equipment in <span className="underline">Settings → Profile</span> to filter exercises you can actually perform.
        </div>
      )}

      <div className="space-y-5 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
        {muscles.map(muscle => {
          const cfg = MUSCLE_GROUP_CONFIG[muscle];
          const exercises = filteredByMuscle[muscle] || [];
          const isLoading = loadingState[muscle] ?? true;
          const page = pageByMuscle[muscle] || 0;
          const pageCount = Math.max(1, Math.ceil(exercises.length / EXERCISE_PAGE_SIZE));
          const safePage = Math.min(page, pageCount - 1);
          const start = safePage * EXERCISE_PAGE_SIZE;
          const visible = exercises.slice(start, start + EXERCISE_PAGE_SIZE);

          const setPage = (next: number) =>
            setPageByMuscle(prev => ({ ...prev, [muscle]: Math.max(0, Math.min(pageCount - 1, next)) }));

          return (
            <div key={muscle}>
              {/* Muscle Group Header */}
              <div className="flex items-center space-x-2 py-1.5 sticky top-0 bg-slate-950 z-10 border-b border-slate-800 mb-2">
                <div className="w-5 h-5 flex-shrink-0">
                  <img src={`/assets/muscles/${muscle}.webp`} alt={cfg.label}
                    className="w-full h-full object-contain opacity-80 mix-blend-screen"
                    onError={e => { e.currentTarget.style.display = 'none'; }} />
                </div>
                <span className="text-xs font-bold text-slate-300 flex-1">{cfg.label}</span>
                {isLoading
                  ? <span className="text-[9px] text-cyan-500 font-mono flex items-center gap-1"><Loader2 size={10} className="animate-spin" />Loading...</span>
                  : <span className="text-[9px] text-slate-600 font-mono">
                      {exercises.length === 0
                        ? 'no matches'
                        : `${start + 1}–${Math.min(start + EXERCISE_PAGE_SIZE, exercises.length)} of ${exercises.length}`}
                    </span>
                }
              </div>

              {/* Skeleton */}
              {isLoading && (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-14 bg-slate-800/50 rounded-xl animate-pulse" />
                  ))}
                </div>
              )}

              {/* Empty */}
              {!isLoading && exercises.length === 0 && (
                <div className="py-4 text-center text-slate-600 text-xs font-mono">
                  {search.trim()
                    ? `No "${search.trim()}" matches in ${cfg.label}.`
                    : userEquipment && userEquipment.length > 0
                      ? `No ${cfg.label} exercises match your equipment.`
                      : `No exercises found in database for ${cfg.label}.`}
                </div>
              )}

              {/* Exercise List (capped at EXERCISE_PAGE_SIZE) */}
              {!isLoading && visible.length > 0 && (
                <div className="space-y-1.5">
                  {visible.map(ex => {
                    const isSel = selectedIds.has(ex.id);
                    const exDiff = calculateDifficulty(ex);
                    const exXP = exDiff * 10;
                    const allMuscles = [ex.targetMuscle, ...(ex.secondaryMuscles || [])].filter(Boolean);
                    const bestView = getViewForMuscle(ex.targetMuscle || muscle);
                    const usedCount = historyCount.get((ex.name || '').toLowerCase().trim()) || 0;
                    return (
                      <div key={ex.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all duration-200 ${isSel
                          ? 'bg-cyan-500/10 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.1)]'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-600 hover:bg-slate-800/80'}`}
                        onClick={() => handleSelect(ex, muscle)}>
                        {/* Premium SVG Anatomy Thumbnail */}
                        <div className="shrink-0 mr-2 w-12 h-[4.5rem] rounded-lg overflow-hidden bg-slate-950/50 border border-slate-800/50">
                          <AnatomyViewer
                            trainedMuscles={getTrainedMuscleIds(allMuscles)}
                            defaultView={bestView}
                            minimal
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <div className={`text-sm font-medium truncate ${isSel ? 'text-cyan-300' : 'text-slate-200'}`}>{ex.name}</div>
                            {usedCount > 0 && (
                              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1 rounded shrink-0">
                                ×{usedCount}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 mt-0.5">
                            <DifficultyStars d={exDiff} />
                            <span className="text-[10px] text-slate-500 truncate">{ex.equipment}</span>
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded mt-1 inline-block capitalize ${isSel ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-500'}`}>
                            {ex.targetMuscle}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0 ml-2">
                          <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-mono font-bold">+{exXP}xp</span>
                          {isSel
                            ? <div className="w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center"><X size={12} className="text-black" /></div>
                            : <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center"><Plus size={12} className="text-slate-300" /></div>
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pager — appears only when there's more than one page */}
              {!isLoading && pageCount > 1 && (
                <div className="flex items-center justify-between mt-2 px-1">
                  <button
                    onClick={() => setPage(safePage - 1)}
                    disabled={safePage === 0}
                    className="flex items-center gap-1 text-[10px] font-mono text-slate-400 disabled:text-slate-700 disabled:cursor-not-allowed hover:text-cyan-400 transition-colors"
                  >
                    <ChevronLeft size={12} /> Prev
                  </button>
                  <span className="text-[10px] font-mono text-slate-500">
                    Page {safePage + 1} / {pageCount}
                  </span>
                  <button
                    onClick={() => setPage(safePage + 1)}
                    disabled={safePage >= pageCount - 1}
                    className="flex items-center gap-1 text-[10px] font-mono text-slate-400 disabled:text-slate-700 disabled:cursor-not-allowed hover:text-cyan-400 transition-colors"
                  >
                    Next <ChevronRight size={12} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ═══════════ FOCUS AREA → MUSCLE MAPPING (Phase 11c) ═══════════
const FOCUS_TO_MUSCLES: Record<FocusArea, MuscleGroup[]> = {
  'Dada & Lengan':  ['chest', 'shoulders', 'triceps', 'biceps', 'forearms'],
  'Kaki & Bokong':  ['quads', 'hamstrings', 'glutes', 'calves'],
  'Core':           ['abs', 'obliques', 'lower_back'],
  'Seluruh Tubuh':  ['chest', 'shoulders', 'triceps', 'biceps', 'forearms', 'lats', 'traps', 'lower_back', 'abs', 'obliques', 'quads', 'hamstrings', 'glutes', 'calves'],
};

/** Sorts routines so packages overlapping the user's focus area bubble to the top. */
const sortRoutinesByFocus = (routines: WorkoutRoutine[], focus?: FocusArea): WorkoutRoutine[] => {
  if (!focus) return routines;
  const target = new Set(FOCUS_TO_MUSCLES[focus] || []);
  const score = (r: WorkoutRoutine) => r.muscleGroups.filter(m => target.has(m)).length;
  return [...routines].sort((a, b) => score(b) - score(a));
};

// ═══════════ MAIN GYMTRACKER ═══════════
export const GymTracker: React.FC = () => {
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [profile, setProfile] = useState<GymProfile>(storageService.getGymProfile());
  const [viewMode, setViewMode] = useState<'workout' | 'analytics'>('workout');
  const [flowStep, setFlowStep] = useState<'idle' | 'selectMuscles' | 'selectExercises' | 'active' | 'addExercise'>('idle');
  const [selectedMuscles, setSelectedMuscles] = useState<MuscleGroup[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<ExerciseDefinition[]>([]);
  const [currentExIndex, setCurrentExIndex] = useState(0);
  const [sessionData, setSessionData] = useState<{ name: string; sets: number; reps: number; weight: number }[]>([]);
  const [currentSets, setCurrentSets] = useState(3);
  const [currentReps, setCurrentReps] = useState(10);
  const [currentWeight, setCurrentWeight] = useState(20);
  const [sessionXP, setSessionXP] = useState(0);
  const [notes, setNotes] = useState('');
  const [triggerTimer, setTriggerTimer] = useState(false);
  const [userEquipment, setUserEquipment] = useState<string[]>([]);
  const [userEnvironment, setUserEnvironment] = useState<'Home' | 'Gym' | null>(null);

  useEffect(() => {
    try {
      setLogs(storageService.getWorkouts());
      setProfile(storageService.getGymProfile());
    } catch (err) {
      console.error('[GymTracker] Failed to load data:', err);
    }
  }, []);

  // ── Phase 11b: Load user equipment preferences from Firestore ──
  useEffect(() => {
    const loadPrefs = async () => {
      const u = auth.currentUser;
      if (!u) return;
      try {
        const snap = await getDoc(doc(db, 'users', u.uid));
        const prefs = snap.exists() ? (snap.data() as any).preferences : null;
        if (prefs) {
          if (Array.isArray(prefs.equipment)) setUserEquipment(prefs.equipment);
          if (prefs.environment === 'Home' || prefs.environment === 'Gym') setUserEnvironment(prefs.environment);
        }
      } catch (e) {
        console.warn('[GymTracker] Failed to load preferences:', e);
      }
    };
    loadPrefs();
  }, []);

  // ── Phase 3: subscribe so RTDB-pushed profile changes (e.g. from
  // another device or the admin panel) update the XP header live. ──
  useEffect(() => {
    const unsubscribe = storageService.subscribe(() => {
      setProfile(storageService.getGymProfile());
      setLogs(storageService.getWorkouts());
    });
    return unsubscribe;
  }, []);

  // ═══ Phase 25: consume Dashboard quick-start handoff ═══
  // If the user clicked "Today's Plan" or "Repeat Last" on Dashboard, a pendingWorkout
  // will have been queued in storageService. Consume it once on mount and jump straight
  // into the active session so they skip the muscle/exercise pickers.
  useEffect(() => {
    const pending = storageService.consumePendingWorkout();
    if (!pending) return;
    if (pending.kind === 'repeat') {
      launchActiveSession(pending.exercises);
      return;
    }
    // 'schedule' or 'package' — fetch exercises async, then launch.
    (async () => {
      const exercises = await buildExercisesForMuscles(pending.muscles);
      if (exercises.length > 0) {
        launchActiveSession(exercises);
      } else {
        // Fallback: drop the user on the muscle picker with the muscles preselected.
        setSelectedMuscles(pending.muscles);
        setFlowStep('selectMuscles');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMuscle = (m: MuscleGroup) => {
    setSelectedMuscles(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    );
  };

  const toggleExercise = (ex: ExerciseDefinition) => {
    setSelectedExercises(prev =>
      prev.find(e => e.id === ex.id) ? prev.filter(e => e.id !== ex.id) : [...prev, ex]
    );
  };

  const startWorkout = () => {
    if (selectedExercises.length === 0) return;
    setCurrentExIndex(0);
    setSessionData([]);
    setSessionXP(0);
    const first = selectedExercises[0];
    setCurrentSets(first.defaultSets);
    setCurrentReps(first.defaultReps);
    setCurrentWeight(20);
    setFlowStep('active');
  };

  // ═══ Phase 25: build a pre-loaded exercise list for a package's muscle groups ═══
  // Fetches from Firestore (already-cached exercise data), filters by user equipment,
  // and picks the top 2 per muscle so we can drop the user straight into 'active'.
  const buildExercisesForMuscles = async (muscles: MuscleGroup[]): Promise<ExerciseDefinition[]> => {
    const out: ExerciseDefinition[] = [];
    for (const muscle of muscles) {
      try {
        const fsList = await exerciseService.getExercisesByMuscle(muscle);
        const filtered = userEquipment.length > 0
          ? exerciseService.filterByUserEquipment(fsList, userEquipment)
          : fsList;
        const picks = (filtered.length > 0 ? filtered : fsList).slice(0, 2);
        for (const ex of picks) {
          const diff = calculateDifficulty(ex);
          const secondaryMapped = (ex.secondaryMuscles || [])
            .map(s => mapDBToMuscleGroup(s, muscle))
            .filter((m, i, arr) => arr.indexOf(m) === i);
          out.push({
            id: ex.id,
            name: ex.name,
            muscleGroup: mapDBToMuscleGroup(ex.targetMuscle, muscle),
            secondaryMuscles: secondaryMapped,
            equipment: ex.equipment || 'Bodyweight',
            difficulty: diff,
            xpPerSet: diff * 10,
            defaultSets: 3,
            defaultReps: 10,
            videoUrl: ex.gifUrl || '',
            tips: ex.instructions?.[0] || 'Maintain proper form and full range of motion.',
          });
        }
      } catch (err) {
        console.warn('[GymTracker] buildExercisesForMuscles failed for', muscle, err);
      }
    }
    return out;
  };

  // Drop straight into the active session with a known exercise list.
  const launchActiveSession = (exercises: ExerciseDefinition[]) => {
    if (exercises.length === 0) return;
    const muscles = Array.from(new Set(exercises.flatMap(e => [e.muscleGroup, ...(e.secondaryMuscles || [])])));
    setSelectedMuscles(muscles);
    setSelectedExercises(exercises);
    setCurrentExIndex(0);
    setSessionData([]);
    setSessionXP(0);
    const first = exercises[0];
    setCurrentSets(first.defaultSets);
    setCurrentReps(first.defaultReps);
    setCurrentWeight(20);
    setFlowStep('active');
  };

  /** Phase 25: Tapping a Package now skips the picker — fetches exercises for the
   *  package's muscle groups, then lands on the active workout screen directly. */
  const startPackage = async (pkg: WorkoutRoutine) => {
    setSelectedMuscles(pkg.muscleGroups);
    setFlowStep('selectExercises'); // shows loading spinner while we fetch
    const exercises = await buildExercisesForMuscles(pkg.muscleGroups);
    if (exercises.length === 0) {
      // Nothing fetchable — keep the user on the picker so they can choose manually.
      setSelectedExercises([]);
      return;
    }
    launchActiveSession(exercises);
  };

  const logExercise = () => {
    const ex = selectedExercises[currentExIndex];
    if (!ex) return;
    const entry = { name: ex.name, sets: currentSets, reps: currentReps, weight: currentWeight };
    const newData = [...sessionData, entry];
    setSessionData(newData);
    const xp = ex.xpPerSet * currentSets;
    setSessionXP(prev => prev + xp);
    setTriggerTimer(true);
    setTimeout(() => setTriggerTimer(false), 500);
    if (currentExIndex < selectedExercises.length - 1) {
      const nextEx = selectedExercises[currentExIndex + 1];
      setCurrentExIndex(currentExIndex + 1);
      setCurrentSets(nextEx.defaultSets);
      setCurrentReps(nextEx.defaultReps);
    }
  };

  /** FIXED: finalMuscles always sourced from selectedExercises, never blank. */
  const finishWorkout = () => {
    if (selectedExercises.length === 0) return;

    const xpMap: Record<string, number> = {};
    for (const ex of selectedExercises) xpMap[ex.name] = ex.xpPerSet;

    // Include current exercise even if not explicitly logged via "Log & Next" button
    const currentEx = selectedExercises[currentExIndex];
    const currentEntry = { name: currentEx?.name || 'Exercise', sets: currentSets, reps: currentReps, weight: currentWeight };
    const finalData = sessionData.length > 0 ? sessionData : [currentEntry];
    // If the last exercise wasn't logged yet, append it
    const alreadyLogged = sessionData.some(d => d.name === currentEx?.name);
    const enrichedData = alreadyLogged ? finalData : [...sessionData, currentEntry].filter(d => d.name);

    // Derive unique muscles from ALL selectedExercises (not just logged ones)
    const allWorkedMuscles = Array.from(new Set<MuscleGroup>(
      selectedExercises.flatMap(ex => [ex.muscleGroup, ...ex.secondaryMuscles])
    ));
    // Fallback chain: selected exercises → selectedMuscles → default
    const finalMuscles: MuscleGroup[] = allWorkedMuscles.length > 0
      ? allWorkedMuscles
      : selectedMuscles.length > 0
        ? selectedMuscles
        : ['chest' as MuscleGroup];

    const totalXP = calculateWorkoutXP(enrichedData, xpMap, finalMuscles.length);
    const totalSets = enrichedData.reduce((s, e) => s + e.sets, 0);
    const typeLabel = finalMuscles.length > 3
      ? 'Full Body'
      : finalMuscles.map(m => MUSCLE_GROUP_CONFIG[m]?.label || m).join(', ');

    const workout: WorkoutLog = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
      type: typeLabel,
      muscleGroups: finalMuscles,
      exercises: enrichedData,
      coreWork: finalMuscles.some(m => ['abs', 'obliques'].includes(m)),
      notes: notes || undefined,
      xpEarned: totalXP,
    };

    const newLogs = [workout, ...logs];
    setLogs(newLogs);
    try { storageService.saveWorkouts(newLogs); } catch (e) { console.error('[GymTracker] saveWorkouts:', e); }

    const newProfile = updateProfileAfterWorkout(profile, totalXP, finalMuscles, totalSets, newLogs);
    setProfile(newProfile);
    try { storageService.saveGymProfile(newProfile); } catch (e) { console.error('[GymTracker] saveGymProfile:', e); }

    // Reset
    setFlowStep('idle');
    setSelectedMuscles([]);
    setSelectedExercises([]);
    setSessionData([]);
    setCurrentExIndex(0);
    setSessionXP(0);
    setNotes('');
  };

  const deleteLog = (id: string) => {
    const updated = logs.filter(l => l.id !== id);
    setLogs(updated);
    try { storageService.saveWorkouts(updated); } catch { }
    const newProfile = recalculateGymProfile(updated);
    setProfile(newProfile);
    try { storageService.saveGymProfile(newProfile); } catch { }
  };

  // ── Project Chimera Phase 4: Weekly / Monthly / Yearly trend selector ──
  const [trendRange, setTrendRange] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');

  const volumeData = useMemo(() => {
    if (!logs || logs.length === 0) return [] as { date: string; volume: number; xp: number }[];

    const volumeOf = (l: WorkoutLog) =>
      (l.exercises || []).reduce((s, e) => s + e.sets * e.reps * e.weight, 0);

    const now = new Date();

    if (trendRange === 'weekly') {
      // Last 7 daily buckets
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now);
        d.setDate(d.getDate() - (6 - i));
        const key = d.toLocaleDateString('en-CA');
        const dayLogs = logs.filter(l => l.date === key);
        return {
          date: d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
          volume: dayLogs.reduce((s, l) => s + volumeOf(l), 0),
          xp: dayLogs.reduce((s, l) => s + (l.xpEarned || 0), 0),
        };
      });
    }

    if (trendRange === 'monthly') {
      // Last 30 daily buckets — empty days kept at zero so the line shows breaks
      return Array.from({ length: 30 }, (_, i) => {
        const d = new Date(now);
        d.setDate(d.getDate() - (29 - i));
        const key = d.toLocaleDateString('en-CA');
        const dayLogs = logs.filter(l => l.date === key);
        return {
          date: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
          volume: dayLogs.reduce((s, l) => s + volumeOf(l), 0),
          xp: dayLogs.reduce((s, l) => s + (l.xpEarned || 0), 0),
        };
      });
    }

    // Yearly: last 12 monthly buckets
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthLogs = logs.filter(l => (l.date || '').startsWith(monthKey));
      return {
        date: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        volume: monthLogs.reduce((s, l) => s + volumeOf(l), 0),
        xp: monthLogs.reduce((s, l) => s + (l.xpEarned || 0), 0),
      };
    });
  }, [logs, trendRange]);

  const currentExercise = flowStep === 'active' ? selectedExercises[currentExIndex] : null;

  return (
    <div className="space-y-6 pb-24 animate-slide-up">
      <XPHeader profile={profile} />

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-slate-900 p-1 rounded-xl">
        {[{ key: 'workout', label: 'Workout', icon: Dumbbell }, { key: 'analytics', label: 'Analytics', icon: BarChart3 }].map(t => (
          <button key={t.key} onClick={() => setViewMode(t.key as any)}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${viewMode === t.key ? 'bg-jarvis-card text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>
            <t.icon size={14} /><span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ═══ IDLE VIEW ═══ */}
      {viewMode === 'workout' && flowStep === 'idle' && (
        <div className="space-y-6">
          <button onClick={() => setFlowStep('selectMuscles')}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl text-white font-bold text-lg shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition-all active:scale-[0.98] flex items-center justify-center space-x-2">
            <Dumbbell size={20} /><span>Start Custom Workout</span><Zap size={16} className="text-amber-300" />
          </button>

          {/* Packages */}
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
            <div className="flex items-center space-x-2 mb-3">
              <Package className="text-purple-400" size={20} />
              <h3 className="text-md font-bold text-white">Workout Routines</h3>
              {storageService.getUserState().focusArea && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30">
                  Focus: {storageService.getUserState().focusArea}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {sortRoutinesByFocus(WORKOUT_PACKAGES, storageService.getUserState().focusArea).map(pkg => (
                <button key={pkg.id} onClick={() => startPackage(pkg)}
                  className="p-3 bg-slate-800 rounded-lg text-left hover:bg-slate-700 transition-colors border border-slate-700 hover:border-purple-500/50 group">
                  <div className="text-xs font-bold text-white group-hover:text-purple-300 mb-1">{pkg.name}</div>
                  <div className="text-[10px] text-slate-500 line-clamp-2">{pkg.description}</div>
                  <div className={`mt-2 text-[9px] px-1.5 py-0.5 rounded inline-block ${pkg.difficulty === 'Beginner' ? 'bg-emerald-500/10 text-emerald-400' : pkg.difficulty === 'Intermediate' ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'}`}>
                    {pkg.difficulty}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800"><Leaderboard profile={profile} /></div>

          {/* Recent Workouts */}
          <div>
            <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center"><Activity size={14} className="mr-1.5" />Recent Workouts</h3>
            <div className="space-y-2">
              {(logs || []).slice(0, 5).map(l => (
                <div key={l.id} className="jarvis-card p-3 rounded-xl flex items-center justify-between group">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-white">{l.type}</span>
                      {(l.xpEarned || 0) > 0 && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-mono">+{l.xpEarned}xp</span>}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">{l.date} • {l.exercises?.length || 0} exercises</div>
                  </div>
                  <button onClick={() => deleteLog(l.id)} className="text-slate-700 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-1"><Trash2 size={14} /></button>
                </div>
              ))}
              {(!logs || logs.length === 0) && <p className="text-sm text-slate-600 text-center py-6">No workouts yet. Start your first session!</p>}
            </div>
          </div>
        </div>
      )}

      {/* ═══ STEP 1: SELECT MUSCLES ═══ */}
      {viewMode === 'workout' && flowStep === 'selectMuscles' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Select Muscle Groups</h3>
            <button onClick={() => { setFlowStep('idle'); setSelectedMuscles([]); }} className="text-slate-500 hover:text-white"><X size={18} /></button>
          </div>
          <MuscleGroupPicker selected={selectedMuscles} onToggle={toggleMuscle} />
          {selectedMuscles.length > 0 && (
            <button onClick={() => setFlowStep('selectExercises')}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl text-white font-bold shadow-lg shadow-cyan-500/20 flex items-center justify-center space-x-2">
              <span>Choose Exercises ({selectedMuscles.length} muscles)</span><ChevronRight size={16} />
            </button>
          )}
        </div>
      )}

      {/* ═══ STEP 2: SELECT EXERCISES (Firestore Auto-Load) ═══ */}
      {viewMode === 'workout' && flowStep === 'selectExercises' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Choose Exercises</h3>
            <button onClick={() => setFlowStep('selectMuscles')} className="text-slate-500 hover:text-white text-xs">← Back</button>
          </div>
          <p className="text-xs text-slate-500">Tap an exercise to add or remove it. Exercises load automatically from Firestore.</p>

          <ExerciseBrowser
            muscles={selectedMuscles}
            selectedExercises={selectedExercises}
            onToggleExercise={toggleExercise}
            userEquipment={userEquipment}
            logs={logs}
          />

          {selectedExercises.length > 0 && (
            <button onClick={startWorkout}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl text-white font-bold shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 sticky bottom-4">
              <Zap size={16} /><span>Start Workout ({selectedExercises.length} exercises)</span>
            </button>
          )}
        </div>
      )}

      {/* ═══ ACTIVE WORKOUT ═══ */}
      {viewMode === 'workout' && flowStep === 'active' && currentExercise && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 font-mono">Exercise {currentExIndex + 1} / {selectedExercises.length}</div>
              <h3 className="text-lg font-bold text-white flex items-center">
                <div className="relative w-6 h-6 mr-2 inline-flex items-center justify-center shrink-0">
                  <img src={`/assets/muscles/${currentExercise.muscleGroup}.webp`} alt={currentExercise.muscleGroup}
                    className="w-full h-full object-contain opacity-80 mix-blend-screen bg-cyan-500/10 rounded p-0.5"
                    onError={e => { e.currentTarget.style.display = 'none'; }} />
                </div>
                {currentExercise.name}
              </h3>
              <div className="flex items-center space-x-2 mt-1">
                <DifficultyStars d={currentExercise.difficulty} />
                <span className="text-[10px] text-slate-500">{currentExercise.equipment}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-amber-400 font-mono font-bold flex items-center"><Zap size={12} className="mr-0.5" />{sessionXP} XP</div>
              <span className="text-[10px] text-slate-500">+{currentExercise.xpPerSet}/set</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all"
              style={{ width: `${(currentExIndex / selectedExercises.length) * 100}%` }} />
          </div>

          {/* Anatomy viewer — single centered card with built-in front/back flip */}
          <div className="w-full max-w-xs mx-auto my-4">
            <AnatomyViewer
              trainedMuscles={getTrainedMuscleIds([
                currentExercise.muscleGroup,
                ...(currentExercise.secondaryMuscles || []),
              ])}
              defaultView={getViewForMuscle(currentExercise.muscleGroup)}
            />
          </div>

          {/* Tags */}
          <div className="flex gap-2">
            <span className="bg-slate-800 text-cyan-400 text-[10px] px-2 py-1 rounded-full border border-cyan-400/30 capitalize">{currentExercise.equipment || 'Bodyweight'}</span>
            <span className="bg-slate-800 text-pink-400 text-[10px] px-2 py-1 rounded-full border border-pink-400/30 capitalize">{MUSCLE_GROUP_CONFIG[currentExercise.muscleGroup]?.label}</span>
          </div>

          {/* Tips */}
          <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
            <p className="text-sm text-slate-400 leading-relaxed">{currentExercise.tips || 'Position yourself and maintain proper form.'}</p>
          </div>

          {/* Watch on YouTube — dynamic search for proper form / tutorial */}
          <a
            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(currentExercise.name + ' exercise form tutorial')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-center space-x-2 py-3 px-4 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 rounded-xl text-white font-bold shadow-lg shadow-red-500/20 hover:shadow-red-500/40 active:scale-[0.98] transition-all"
          >
            <Youtube size={18} className="fill-white text-red-600" />
            <span className="text-sm">Watch on YouTube</span>
            <ExternalLink size={12} className="opacity-70 group-hover:opacity-100 transition-opacity" />
          </a>

          {/* Input Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <InteractiveInput label="Sets" value={currentSets} onChange={setCurrentSets} min={1} max={10} />
            <InteractiveInput label="Reps" value={currentReps} onChange={setCurrentReps} min={1} max={50} />
            <InteractiveInput label="Kg" value={currentWeight} onChange={setCurrentWeight} min={0} max={300} step={2.5} />
          </div>

          {/* Logged exercises */}
          {sessionData.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Completed ({sessionData.length})</div>
              {sessionData.map((d, i) => {
                const matchedEx = selectedExercises.find(e => e.name === d.name);
                const xpGained = (matchedEx?.xpPerSet || 15) * d.sets;
                const volume = d.sets * d.reps * d.weight;
                return (
                  <div key={i} className="flex items-center justify-between bg-slate-900/80 border border-emerald-500/30 rounded-xl px-4 py-3 hover:border-emerald-500/50 transition-all">
                    <div className="flex items-center space-x-3">
                      <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <CheckSquare size={13} className="text-emerald-400" />
                      </div>
                      <div>
                        <span className="text-emerald-300 font-bold text-sm">{d.name}</span>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {d.sets} sets x {d.reps} reps @ {d.weight}kg
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <span className="text-amber-400 font-mono font-bold text-xs">+{xpGained}xp</span>
                      <div className="text-[10px] text-slate-600 font-mono">{volume.toLocaleString()}kg vol</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Notes */}
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
            placeholder="Session notes (optional)..." />

          <RestTimer trigger={triggerTimer} defaultTime={60} />

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button onClick={() => setFlowStep('addExercise')}
              className="py-3 px-4 bg-slate-800 rounded-xl text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center border border-slate-700">
              <ListPlus size={20} />
            </button>
            {currentExIndex < selectedExercises.length - 1 ? (
              <button onClick={logExercise}
                className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl text-white font-bold flex items-center justify-center space-x-2 shadow-lg shadow-cyan-500/20">
                <span>Log & Next</span><ChevronRight size={16} />
              </button>
            ) : (
              <button onClick={logExercise}
                className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl text-white font-bold flex items-center justify-center space-x-2">
                <span>Log Exercise</span>
              </button>
            )}
            <button onClick={finishWorkout}
              className="py-3 px-5 bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl text-white font-bold flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20">
              <Save size={16} /><span>Finish</span>
            </button>
          </div>
          <button onClick={() => { setFlowStep('idle'); setSelectedMuscles([]); setSelectedExercises([]); setSessionData([]); }}
            className="w-full py-2 text-slate-600 hover:text-rose-400 text-xs transition-colors">Cancel Workout</button>
        </div>
      )}

      {/* ═══ ADD EXERCISE MID-SESSION ═══ */}
      {viewMode === 'workout' && flowStep === 'addExercise' && (
        <div className="space-y-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Add Exercise</h3>
            <button onClick={() => setFlowStep('active')} className="text-slate-500 hover:text-white text-xs">Cancel</button>
          </div>
          <p className="text-xs text-slate-500">Selected exercises will be appended to the current session.</p>
          <ExerciseBrowser
            muscles={selectedMuscles}
            selectedExercises={selectedExercises}
            onToggleExercise={(ex) => { setSelectedExercises(prev => [...prev.filter(e => e.id !== ex.id), ex]); setFlowStep('active'); }}
            userEquipment={userEquipment}
            logs={logs}
          />
        </div>
      )}

      {/* ═══ ANALYTICS VIEW ═══ */}
      {viewMode === 'analytics' && (
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-white flex items-center"><TrendingUp size={16} className="mr-2 text-cyan-400" />Analytics</h3>

          {/* Workout Streak — sourced from unified profile so it matches Profile.tsx */}
          {(() => {
            const currentStreak = profile.currentStreak ?? 0;
            const longestStreak = profile.longestStreak ?? 0;
            return (
              <div className="jarvis-card p-6 rounded-xl flex flex-col items-center justify-center text-center space-y-4 shadow-lg border border-slate-700/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl" />
                <h4 className="text-xs font-mono text-slate-400 uppercase tracking-widest z-10">Workout Streak</h4>
                <div className="relative flex justify-center items-center">
                  {currentStreak > 0 && <div className="absolute inset-0 bg-orange-500/20 blur-xl rounded-full scale-150 animate-pulse" />}
                  <Flame size={72} strokeWidth={1.5} className={`z-10 transition-all duration-1000 ${currentStreak > 0 ? 'text-orange-500 drop-shadow-[0_0_25px_rgba(249,115,22,0.9)] scale-110 animate-bounce' : 'text-slate-700'}`} />
                </div>
                <div className="z-10 mt-2">
                  <span className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-300 font-mono tracking-tighter">{currentStreak}</span>
                  <span className="text-xl text-slate-500 ml-2 font-medium">Days</span>
                </div>
                <div className="z-10 text-xs font-mono text-slate-500 uppercase tracking-widest">
                  Best: <span className="text-orange-300">{longestStreak}d</span>
                </div>
                <p className="text-sm text-slate-400 max-w-[250px] z-10 mt-2 font-medium">
                  {currentStreak > 0 ? "Keep the fire burning! Don't break the streak! 🔥" : 'Time to ignite your streak! Start a workout today.'}
                </p>
              </div>
            );
          })()}

          {/* Volume + XP Trend — with Weekly / Monthly / Yearly toggle */}
          <div className="jarvis-card p-4 rounded-xl">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h4 className="text-xs font-mono text-slate-400 uppercase">Volume & XP Trend</h4>
              <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800">
                {(['weekly', 'monthly', 'yearly'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setTrendRange(r)}
                    className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wider rounded-md transition-all ${trendRange === r
                        ? 'bg-cyan-500 text-slate-900 font-bold shadow-lg shadow-cyan-500/30'
                        : 'text-slate-400 hover:text-white'}`}
                  >
                    {r === 'weekly' ? '7D' : r === 'monthly' ? '30D' : '12M'}
                  </button>
                ))}
              </div>
            </div>
            {volumeData.some(d => d.volume > 0 || d.xp > 0) ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={volumeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="volume" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} name="Volume (kg)" />
                  <Line type="monotone" dataKey="xp" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="XP" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="py-8 text-center text-xs text-slate-600 font-mono">
                No data in this {trendRange === 'weekly' ? 'week' : trendRange === 'monthly' ? 'month' : 'year'} — log a workout to populate the trend.
              </div>
            )}
          </div>

          {/* Muscle XP Distribution */}
          <div className="jarvis-card p-4 rounded-xl">
            <h4 className="text-xs font-mono text-slate-400 uppercase mb-3">Muscle XP Distribution</h4>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(profile?.muscleXP || {}) as [MuscleGroup, number][])
                .filter(([, xp]) => xp > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([muscle, xp]) => {
                  const cfg = MUSCLE_GROUP_CONFIG[muscle];
                  const maxXP = Math.max(...(Object.values(profile?.muscleXP || {}) as number[]), 1);
                  const pct = Math.round((xp / maxXP) * 100);
                  return (
                    <div key={muscle} className="flex items-center space-x-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                        <img src={`/assets/muscles/${muscle}.webp`} alt={cfg?.label}
                          className="w-full h-full object-cover scale-110 opacity-80 mix-blend-screen"
                          onError={e => { e.currentTarget.style.display = 'none'; }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-slate-200 font-bold truncate">{cfg?.label}</span>
                          <span className="text-amber-400 font-mono ml-2 shrink-0">{xp}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              {Object.values(profile?.muscleXP || {}).every(v => v === 0) && (
                <p className="text-sm text-slate-600 col-span-2 text-center py-4">Complete a workout to see muscle XP</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};