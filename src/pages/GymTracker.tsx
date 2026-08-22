import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  MuscleGroup, WorkoutLog, GymProfile, ExerciseDefinition, FirestoreExercise, FocusArea
} from '../types';
import { storageService } from '../services/storageService';
import { exerciseService } from '../services/exerciseService';
import { MUSCLE_GROUP_CONFIG } from '../config/constants';
import { WORKOUT_PACKAGES, WorkoutRoutine } from '../data/workoutPackages';
import { auth, db } from '../../firebase-config';
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
import { useAchievements } from '../context/AchievementContext';
import { achievementService } from '../services/achievementService';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import AnatomyViewer, { getViewForMuscle } from '../components/Anatomy/AnatomyViewer';
import { RankBadge, rankFromTierName } from '../components/hud';
import { mapDBMuscleToUIKey, getTrainedMuscleIds } from '../constants/muscleMapping';
import { getLocalDateString } from '../utils/dateUtils';

const createWorkoutId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const getWorkoutSaveError = (error: unknown): string => {
  const details = error as { code?: string; message?: string };
  const raw = `${details?.code || ''} ${details?.message || ''}`.toLowerCase();
  if (raw.includes('not-authenticated') || raw.includes('unauthenticated')) {
    return 'Sesi login sudah berakhir. Masuk kembali sebelum menyimpan workout.';
  }
  if (raw.includes('permission-denied') || raw.includes('permission_denied')) {
    return 'Workout belum tersimpan karena akses database ditolak. Coba muat ulang setelah login.';
  }
  if (raw.includes('network') || raw.includes('unavailable') || raw.includes('offline')) {
    return 'Workout belum tersimpan. Periksa koneksi internet lalu tekan Coba Simpan Lagi.';
  }
  return 'Workout belum tersimpan ke cloud. Datamu masih ada di layar ini; silakan coba lagi.';
};

// ═══════════ STEPPER SLIDER (workout.css .ae-step port) ═══════════
const StepperSlider: React.FC<{
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; unit?: string;
}> = ({ label, value, onChange, min = 1, max = 30, step = 1, unit }) => {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const dec = useCallback(() => onChange(Math.max(min, parseFloat((value - step).toFixed(2)))), [onChange, value, min, step]);
  const inc = useCallback(() => onChange(Math.min(max, parseFloat((value + step).toFixed(2)))), [onChange, value, max, step]);
  return (
    <div className="ae-step">
      <div className="ae-step-top">
        <span className="ae-step-label">{label}</span>
        <span className="ae-step-val">
          {value}
          {unit && <span className="ae-step-unit">{unit}</span>}
        </span>
      </div>
      <div className="ae-step-row">
        <button className="ae-step-btn" onClick={dec} aria-label="Kurang" type="button">
          <Minus size={14} />
        </button>
        <div className="ae-step-track">
          <div className="ae-step-fill" style={{ width: `${pct}%` }} />
          <input type="range" min={min} max={max} step={step} value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="ae-step-input" />
          <div className="ae-step-thumb" style={{ left: `${pct}%` }} />
        </div>
        <button className="ae-step-btn" onClick={inc} aria-label="Tambah" type="button">
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
};

// ═══════════ REST TIMER RING (workout.css .ae-timer port) ═══════════
// Circular SVG countdown with preset chips. The `trigger` prop kicks off a
// new countdown — used by the "Log & Next" handler to auto-start rest.
const RestTimerRing: React.FC<{ trigger?: boolean; defaultTime?: number; onTimerEnd?: () => void }> = ({
  trigger = false, defaultTime = 60, onTimerEnd,
}) => {
  const [target, setTarget] = useState(defaultTime);
  const [remaining, setRemaining] = useState(defaultTime);
  const [running, setRunning] = useState(false);
  const audioCtx = useRef<AudioContext | null>(null);

  const beep = useCallback(() => {
    try {
      if (!audioCtx.current) audioCtx.current = new AudioContext();
      const osc = audioCtx.current.createOscillator();
      const gain = audioCtx.current.createGain();
      osc.connect(gain); gain.connect(audioCtx.current.destination);
      osc.frequency.value = 880; gain.gain.value = 0.3;
      osc.start(); osc.stop(audioCtx.current.currentTime + 0.2);
    } catch { /* AudioContext may be blocked pre-interaction */ }
  }, []);

  // Auto-start when trigger flips true
  useEffect(() => {
    if (trigger) {
      setTarget(defaultTime);
      setRemaining(defaultTime);
      setRunning(true);
    }
  }, [trigger, defaultTime]);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let prev = performance.now();
    const tick = (t: number) => {
      const dt = (t - prev) / 1000;
      prev = t;
      setRemaining((r) => {
        const next = r - dt;
        if (next <= 0) {
          setRunning(false);
          beep();
          onTimerEnd?.();
          return 0;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, beep, onTimerEnd]);

  const setPreset = (sec: number) => { setTarget(sec); setRemaining(sec); setRunning(true); };
  const addTen = () => { setTarget((t) => t + 10); setRemaining((r) => r + 10); setRunning(true); };
  const reset = () => { setRemaining(target); setRunning(false); };

  const SIZE = 110;
  const R = 47;
  const C = 2 * Math.PI * R;
  const pct = target > 0 ? Math.max(0, Math.min(1, remaining / target)) : 0;
  const dash = C * pct;
  const displaySec = Math.ceil(remaining);

  return (
    <section className="ae-timer">
      <div className="ae-timer-head">
        <span className="ae-step-label"><Timer size={11} style={{ display: 'inline', marginRight: 4 }} />REST TIMER</span>
        <button className="ae-timer-close" onClick={reset} aria-label="Reset" type="button">
          <X size={12} />
        </button>
      </div>
      <div className="ae-timer-body">
        <div className="ae-timer-ring">
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <defs>
              <linearGradient id="rt-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#67E8F9" />
                <stop offset="100%" stopColor="#3B82F6" />
              </linearGradient>
            </defs>
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="rgba(34, 211, 238, 0.1)" strokeWidth="6" />
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="url(#rt-grad)" strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${C}`}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              style={{ filter: 'drop-shadow(0 0 6px rgba(34, 211, 238, 0.55))', transition: 'stroke-dasharray 200ms linear' }} />
          </svg>
          <div className="ae-timer-center">
            <div className="ae-timer-sec">{displaySec}</div>
            <div className="ae-timer-unit">SEC</div>
          </div>
          {running && <div className="ae-timer-pulse" />}
        </div>
        <div className="ae-timer-presets">
          {[30, 60, 90, 120].map((s) => (
            <button key={s} type="button"
              className={`ae-timer-preset ${target === s ? 'is-on' : ''}`}
              onClick={() => setPreset(s)}>{s}s</button>
          ))}
          <button type="button" className="ae-timer-preset ae-timer-add" onClick={addTen}>+10s</button>
        </div>
      </div>
    </section>
  );
};

// ═══════════ DIFFICULTY STARS ═══════════
const DifficultyStars: React.FC<{ d: number }> = ({ d }) => (
  <div className="flex space-x-0.5">{Array.from({ length: 5 }, (_, i) => (
    <Star key={i} size={10} className={i < d ? 'text-amber-400 fill-amber-400' : 'text-slate-700'} />
  ))}</div>
);

// ═══════════ WORKOUT.CSS STARS (wf-stars — gold, 1-5) ═══════════
const WfStars: React.FC<{ value: number }> = ({ value }) => (
  <span className="wf-stars">
    {[1, 2, 3, 4, 5].map((i) => (
      <svg key={i} width="11" height="11" viewBox="0 0 24 24" className={i <= value ? 'on' : 'off'}>
        <path d="M12 2 L14.9 8.5 L22 9.3 L16.6 14 L18.1 21 L12 17.5 L5.9 21 L7.4 14 L2 9.3 L9.1 8.5 Z" fill="currentColor" />
      </svg>
    ))}
  </span>
);

// ═══════════ XP HEADER (gym.css .g-rank-card port) ═══════════
const XPHeader: React.FC<{ profile: GymProfile }> = ({ profile }) => {
  const progress = getXPProgress(profile.totalXP);
  const rank = getRankForLevel(profile.level);
  return (
    <div className="g-rank-card">
      <div className="g-rank-progress-bar" style={{ width: `${progress.percent}%` }} />
      <div className="g-rank-body">
        <div className="g-rank-medal">
          <RankBadge rank={rankFromTierName(rank.name)} size="md" isCurrent />
        </div>
        <div className="g-rank-info">
          <div className="g-rank-line">
            <span className={`g-rank-rank ${rank.color}`}>{rank.name}</span>
            <span className="g-rank-lv">Lv.{profile?.level || 1}</span>
          </div>
          <div className="g-rank-xp-total">{(profile?.totalXP || 0).toLocaleString()} XP total</div>
        </div>
        <div className="g-rank-right">
          <div className="g-rank-xp">{progress.current} / {progress.needed} XP</div>
          <div className="g-rank-bar">
            <div className="g-rank-bar-fill" style={{ width: `${progress.percent}%` }} />
          </div>
        </div>
      </div>
      <div className="g-rank-stats">
        <span className="g-rank-stat"><span style={{ color: 'var(--orange)' }}>⚔</span> {profile?.workoutsCompleted || 0} workouts</span>
        <span className="g-rank-stat"><span style={{ color: 'var(--orange)' }}>💪</span> {profile?.totalSetsCompleted || 0} sets</span>
      </div>
    </div>
  );
};

// ═══════════ MUSCLE GROUP PICKER (workout.css .wf-mcard port) ═══════════
const MuscleGroupPicker: React.FC<{
  selected: MuscleGroup[]; onToggle: (m: MuscleGroup) => void;
}> = ({ selected, onToggle }) => {
  // PUSH / PULL / CORE / LEGS — order matches prototype MUSCLE_CATALOG.
  const categories: ('Push' | 'Pull' | 'Core' | 'Legs')[] = ['Push', 'Pull', 'Core', 'Legs'];
  const allMuscles = Object.entries(MUSCLE_GROUP_CONFIG) as [MuscleGroup, typeof MUSCLE_GROUP_CONFIG[MuscleGroup]][];
  return (
    <div className="wf-body">
      {categories.map(cat => {
        const muscles = allMuscles.filter(([, v]) => v.category === cat);
        if (muscles.length === 0) return null;
        return (
          <div key={cat} className="wf-section">
            <div className="wf-section-head">
              <span className="wf-section-line" />
              <span className="wf-section-cat">{cat.toUpperCase()}</span>
              <span className="wf-section-line" />
            </div>
            <div className="wf-mgrid">
              {muscles.map(([key, cfg]) => {
                const isSelected = selected?.includes(key);
                return (
                  <button key={key} type="button" onClick={() => onToggle(key)}
                    className={`wf-mcard ${isSelected ? 'is-selected' : ''}`}>
                    <div className="wf-mcard-fig">
                      <img src={`/assets/muscles/${key}.webp`} alt={cfg.label} className="wf-mcard-img"
                        onError={e => { e.currentTarget.style.display = 'none'; }} />
                    </div>
                    <div className="wf-mcard-label">{cfg.label}</div>
                    {isSelected
                      ? <div className="wf-mcard-check">✓ Dipilih</div>
                      : <div className="wf-mcard-store">Firestore</div>}
                    {isSelected && <div className="wf-mcard-corner" />}
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
  const [search, setSearch] = useState('');           // raw input — controlled & instant
  const [debouncedSearch, setDebouncedSearch] = useState(''); // throttled — drives the filter
  const [pageByMuscle, setPageByMuscle] = useState<Record<string, number>>({});
  const fetchedRef = useRef<Set<string>>(new Set());

  // ── 300ms debounce — keeps typing instantaneous and stops the heavy
  //    filter+sort+paginate work from running on every keystroke. ──
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);

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

  // Reset to page 0 whenever the debounced search or muscle list changes so we
  // never strand the user on an empty page.
  useEffect(() => {
    setPageByMuscle({});
  }, [debouncedSearch, equipKey, muscles]);

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
  // Reads debouncedSearch (not raw search) so this only re-runs after typing
  // has settled; the input itself stays buttery.
  const filteredByMuscle = useMemo(() => {
    const out: Record<string, FirestoreExercise[]> = {};
    const q = debouncedSearch.trim().toLowerCase();

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
  }, [exercisesByMuscle, equipKey, debouncedSearch, historyCount]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="wf-body">
      {/* Live search bar — preserves 300ms debounce from prior implementation */}
      <div className="wf-search">
        <Search size={14} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari latihan… (cth: bench press, squat)"
        />
        {search && (
          <button onClick={() => setSearch('')} aria-label="Clear search" type="button"
            style={{ background: 'transparent', border: 0, color: 'var(--t-3)', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        )}
      </div>

      {(!userEquipment || userEquipment.length === 0) && (
        <div className="wf-equip-hint">
          <span className="wf-equip-hint-ico">⚠</span>
          <span>
            Set <strong>peralatan kamu</strong> di Settings → Profile untuk memfilter latihan yang bisa kamu lakukan.
          </span>
        </div>
      )}

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
          <div key={muscle} className="wf-ex-section">
            <div className="wf-ex-section-head">
              <span className="wf-ex-section-icon">
                <img src={`/assets/muscles/${muscle}.webp`} alt={cfg.label}
                  onError={e => { e.currentTarget.style.display = 'none'; }} />
              </span>
              <span className="wf-ex-section-label">{cfg.label.toUpperCase()}</span>
              <span className="wf-ex-section-count">
                {isLoading
                  ? <><Loader2 size={9} className="animate-spin" style={{ marginRight: 4 }} />LOADING…</>
                  : exercises.length === 0
                    ? 'NO MATCHES'
                    : `${start + 1}–${Math.min(start + EXERCISE_PAGE_SIZE, exercises.length)} dari ${exercises.length}`}
              </span>
            </div>

            {isLoading && (
              <div className="wf-ex-list">
                {[1, 2, 3].map(i => <div key={i} className="wf-skeleton" />)}
              </div>
            )}

            {!isLoading && exercises.length === 0 && (
              <div className="wf-ex-empty">
                {debouncedSearch.trim()
                  ? `Tidak ada hasil "${debouncedSearch.trim()}" di ${cfg.label}.`
                  : userEquipment && userEquipment.length > 0
                    ? `Tidak ada latihan ${cfg.label} yang cocok dengan peralatanmu.`
                    : `Belum ada latihan ${cfg.label} di database.`}
              </div>
            )}

            {!isLoading && visible.length > 0 && (
              <div className="wf-ex-list">
                {visible.map(ex => {
                  const isSel = selectedIds.has(ex.id);
                  const exDiff = calculateDifficulty(ex);
                  const exXP = exDiff * 10;
                  const allMuscles = [ex.targetMuscle, ...(ex.secondaryMuscles || [])].filter(Boolean);
                  const bestView = getViewForMuscle(ex.targetMuscle || muscle);
                  const usedCount = historyCount.get((ex.name || '').toLowerCase().trim()) || 0;
                  return (
                    <article key={ex.id} className={`wf-ex ${isSel ? 'is-selected' : ''}`}
                      onClick={() => handleSelect(ex, muscle)}>
                      <div className="wf-ex-thumb">
                        <div className="wf-ex-thumb-body">
                          <AnatomyViewer
                            trainedMuscles={getTrainedMuscleIds(allMuscles)}
                            defaultView={bestView}
                            minimal
                          />
                        </div>
                      </div>
                      <div className="wf-ex-info">
                        <div className="wf-ex-title">
                          <span className="wf-ex-title-text">{ex.name}</span>
                          {usedCount > 0 && <span className="wf-ex-used">×{usedCount}</span>}
                        </div>
                        <div className="wf-ex-meta">
                          <WfStars value={exDiff} />
                          <span className="wf-ex-equip">{ex.equipment}</span>
                        </div>
                        <span className="wf-ex-tag">{ex.targetMuscle}</span>
                      </div>
                      <div className="wf-ex-right">
                        <span className="wf-ex-xp">+{exXP}xp</span>
                        <button type="button"
                          className={`wf-ex-btn ${isSel ? 'is-on' : ''}`}
                          onClick={(e) => { e.stopPropagation(); handleSelect(ex, muscle); }}
                          aria-label={isSel ? 'Hapus' : 'Tambah'}>
                          {isSel ? <X size={14} /> : <Plus size={14} />}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {!isLoading && pageCount > 1 && (
              <div className="wf-pager">
                <button type="button" className="wf-pager-btn"
                  onClick={() => setPage(safePage - 1)} disabled={safePage === 0}>
                  <ChevronLeft size={12} /> PREV
                </button>
                <span className="wf-pager-info">PAGE {safePage + 1} / {pageCount}</span>
                <button type="button" className="wf-pager-btn"
                  onClick={() => setPage(safePage + 1)} disabled={safePage >= pageCount - 1}>
                  NEXT <ChevronRight size={12} />
                </button>
              </div>
            )}
          </div>
        );
      })}
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

// ═══════════ ANALYTICS — HEART-FIRE STREAK (prototype Analytics.jsx port) ═══════════
// 5-tier evolution: ember → flame → blaze → phoenix → eternal. Animations are
// driven entirely by CSS classes (`.hf-tier-N`) — JS just toggles the tier.
type StreakTier = { tier: 1 | 2 | 3 | 4 | 5; name: string; min: number; color: string; sub: string };
const STREAK_TIERS: StreakTier[] = [
  { tier: 1, name: 'EMBER',   min: 1,   color: '#FB923C', sub: 'Bara' },
  { tier: 2, name: 'FLAME',   min: 7,   color: '#F97316', sub: 'Nyala' },
  { tier: 3, name: 'BLAZE',   min: 30,  color: '#EF4444', sub: 'Membara' },
  { tier: 4, name: 'PHOENIX', min: 180, color: '#A855F7', sub: 'Phoenix' },
  { tier: 5, name: 'ETERNAL', min: 365, color: '#F5C518', sub: 'Abadi' },
];
const tierFromDays = (d: number): StreakTier => {
  let t = STREAK_TIERS[0];
  STREAK_TIERS.forEach((x) => { if (d >= x.min) t = x; });
  return t;
};
const nextTier = (current: StreakTier): StreakTier | null =>
  STREAK_TIERS.find((t) => t.tier === ((current.tier + 1) as StreakTier['tier'])) || null;

/** Anatomical heart fused with flame; lub-dub beat. Layers scale by tier. */
const HeartFire: React.FC<{ tier?: 1 | 2 | 3 | 4 | 5; size?: number }> = ({ tier = 1, size = 150 }) => {
  const auraTongues = useMemo(() => {
    const out: { x: number; y: number; rot: number; delay: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i * 60 - 90) * Math.PI / 180;
      out.push({
        x: 70 + Math.cos(a) * 64,
        y: 96 + Math.sin(a) * 64,
        rot: i * 60,
        delay: i * 0.18,
      });
    }
    return out;
  }, []);
  return (
    <div className={`an-hf-wrap hf-tier-${tier}`} style={{ width: size, height: size * 1.05 }}>
      <div className="an-hf-haze" />
      <div className="an-hf-halo" />
      <div className="an-hf-pulsehalo" />

      {tier >= 4 && (
        <>
          <div className="an-hf-orbit an-hf-orbit-1">
            <svg viewBox="-100 -100 200 200" width="100%" height="100%">
              <ellipse cx="0" cy="0" rx="90" ry="38" fill="none" stroke="#A855F7" strokeWidth="1.4" strokeDasharray="4 6" opacity="0.65" />
              <circle cx="90" cy="0" r="3" fill="#C4B5FD" />
              <circle cx="-90" cy="0" r="2" fill="#A855F7" opacity="0.7" />
            </svg>
          </div>
          <div className="an-hf-orbit an-hf-orbit-2">
            <svg viewBox="-100 -100 200 200" width="100%" height="100%">
              <ellipse cx="0" cy="0" rx="92" ry="38" fill="none" stroke="#F5C518" strokeWidth="1.2" strokeDasharray="2 5" opacity="0.55" />
              <circle cx="0" cy="38" r="2.5" fill="#FBBF24" />
            </svg>
          </div>
        </>
      )}

      {tier >= 5 && (
        <div className="an-hf-rays">
          <svg viewBox="-100 -100 200 200" width="100%" height="100%">
            {Array.from({ length: 12 }).map((_, i) => {
              const a = (i * 30 - 90) * Math.PI / 180;
              const r1 = 70, r2 = i % 2 === 0 ? 96 : 84;
              return (
                <line key={i}
                  x1={Math.cos(a) * r1} y1={Math.sin(a) * r1}
                  x2={Math.cos(a) * r2} y2={Math.sin(a) * r2}
                  stroke="#F5C518"
                  strokeWidth={i % 2 === 0 ? 2.4 : 1.4}
                  strokeLinecap="round"
                  opacity={i % 2 === 0 ? 0.9 : 0.55} />
              );
            })}
          </svg>
        </div>
      )}

      {tier >= 3 && (
        <div className="an-hf-flame-aura">
          <svg viewBox="0 0 140 160" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="hf-aura-flame" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#EF4444" />
                <stop offset="50%" stopColor="#FB923C" />
                <stop offset="100%" stopColor="#FEF3C7" stopOpacity="0.85" />
              </linearGradient>
            </defs>
            {auraTongues.map((t, i) => (
              <g key={i} className="hf-aura-tongue"
                 style={{ transformOrigin: `${t.x}px ${t.y}px`, animationDelay: `${t.delay}s` }}
                 transform={`rotate(${t.rot}, ${t.x}, ${t.y})`}>
                <path
                  d={`M ${t.x - 6} ${t.y + 10} Q ${t.x} ${t.y - 18} ${t.x + 6} ${t.y + 10} Q ${t.x} ${t.y + 4} ${t.x - 6} ${t.y + 10} Z`}
                  fill="url(#hf-aura-flame)" opacity="0.75" />
              </g>
            ))}
          </svg>
        </div>
      )}

      <svg className="an-hf-svg" viewBox="0 0 140 160" width={size} height={size * 1.05} aria-hidden="true">
        <defs>
          <radialGradient id="hf-heart" cx="50%" cy="80%" r="65%">
            <stop offset="0%"   stopColor="#FBBF24" />
            <stop offset="30%"  stopColor="#FB923C" />
            <stop offset="70%"  stopColor="#DC2626" />
            <stop offset="100%" stopColor="#7F1D1D" />
          </radialGradient>
          <linearGradient id="hf-flame" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%"   stopColor="#FB923C" stopOpacity="0.95" />
            <stop offset="50%"  stopColor="#FBBF24" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#FEF3C7" stopOpacity="0.8" />
          </linearGradient>
          <radialGradient id="hf-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#FFF7ED" stopOpacity="0.95" />
            <stop offset="55%"  stopColor="#FBBF24" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="hf-rim" cx="50%" cy="40%" r="60%">
            <stop offset="0%"   stopColor="#7F1D1D" stopOpacity="0" />
            <stop offset="80%"  stopColor="#7F1D1D" stopOpacity="0" />
            <stop offset="100%" stopColor="#450A0A" stopOpacity="0.6" />
          </radialGradient>
          <filter id="hf-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="hf-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        <ellipse cx="70" cy="100" rx="58" ry="62" fill="url(#hf-core)" filter="url(#hf-soft)" opacity="0.7" />

        <g className="hf-flame-group" filter="url(#hf-glow)">
          <path d="M 40 56 C 28 44, 22 26, 32 12 C 36 22, 42 18, 44 28 C 50 34, 52 46, 50 56 Z" fill="url(#hf-flame)" opacity="0.88" />
          <path d="M 60 50 C 56 32, 60 14, 72 -4 C 80 12, 82 30, 80 48 C 78 54, 74 56, 70 56 C 66 56, 62 54, 60 50 Z" fill="url(#hf-flame)" opacity="0.95" />
          <path d="M 100 56 C 112 44, 118 26, 108 12 C 104 22, 98 18, 96 28 C 90 34, 88 46, 90 56 Z" fill="url(#hf-flame)" opacity="0.88" />
        </g>

        <g className="hf-heart-group">
          <path d="M 70 142 C 30 118, 8 92, 18 64 C 24 48, 38 42, 50 50 C 58 54, 64 60, 70 66 C 76 60, 82 54, 90 50 C 102 42, 116 48, 122 64 C 132 92, 110 118, 70 142 Z"
            fill="url(#hf-heart)" stroke="#7F1D1D" strokeWidth="1.2" filter="url(#hf-glow)" />
          <path d="M 70 142 C 30 118, 8 92, 18 64 C 24 48, 38 42, 50 50 C 58 54, 64 60, 70 66 C 76 60, 82 54, 90 50 C 102 42, 116 48, 122 64 C 132 92, 110 118, 70 142 Z"
            fill="url(#hf-rim)" />
          <path d="M 72 60 Q 78 52, 82 48 Q 88 42, 92 50" stroke="#450A0A" strokeWidth="2" fill="none" opacity="0.55" strokeLinecap="round" />
          <path d="M 50 80 Q 56 90, 58 100 M 50 80 Q 44 88, 42 100" stroke="#7F1D1D" strokeWidth="1.2" fill="none" opacity="0.7" strokeLinecap="round" />
          <path d="M 90 82 Q 96 92, 96 102 M 90 82 Q 86 94, 84 105" stroke="#7F1D1D" strokeWidth="1.2" fill="none" opacity="0.6" strokeLinecap="round" />
          <ellipse cx="60" cy="85" rx="14" ry="22" fill="url(#hf-core)" opacity="0.85" />
          <ellipse cx="50" cy="74" rx="7" ry="11" fill="white" opacity="0.32" />
          <ellipse cx="48" cy="70" rx="3" ry="5" fill="white" opacity="0.55" />
        </g>

        <g className="hf-embers">
          <circle className="hf-ember hf-ember-1" cx="50" cy="40" r="1.5" fill="#FBBF24" />
          <circle className="hf-ember hf-ember-2" cx="90" cy="38" r="1.2" fill="#FB923C" />
          <circle className="hf-ember hf-ember-3" cx="70" cy="30" r="1.8" fill="#FFF7ED" />
          {tier >= 3 && <circle className="hf-ember hf-ember-4" cx="40" cy="60" r="1.3" fill="#FBBF24" />}
          {tier >= 3 && <circle className="hf-ember hf-ember-5" cx="100" cy="62" r="1.6" fill="#FB923C" />}
          {tier >= 4 && <circle className="hf-ember hf-ember-6" cx="35" cy="100" r="1.4" fill="#C4B5FD" />}
          {tier >= 4 && <circle className="hf-ember hf-ember-7" cx="105" cy="105" r="1.5" fill="#A855F7" />}
        </g>
      </svg>
    </div>
  );
};

/** Continuously scrolling ECG waveform behind the heart-fire. */
const ECGLine: React.FC = () => {
  const wave = (offset: number) => `
    M ${offset + 0} 30   L ${offset + 60} 30
    L ${offset + 75} 28  L ${offset + 85} 24
    L ${offset + 95} 28  L ${offset + 110} 30
    L ${offset + 125} 30 L ${offset + 132} 36
    L ${offset + 138} 6  L ${offset + 144} 50
    L ${offset + 150} 30 L ${offset + 170} 30
    L ${offset + 182} 26 L ${offset + 192} 30
    L ${offset + 280} 30
  `;
  const d = wave(0) + ' ' + wave(280);
  return (
    <div className="an-ecg">
      <div className="an-ecg-grid" />
      <svg className="an-ecg-svg" viewBox="0 0 280 60" preserveAspectRatio="none">
        <defs>
          <linearGradient id="ecg-fade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#22D3EE" stopOpacity="0" />
            <stop offset="20%"  stopColor="#22D3EE" stopOpacity="0.4" />
            <stop offset="80%"  stopColor="#22D3EE" stopOpacity="1" />
            <stop offset="100%" stopColor="#67E8F9" stopOpacity="1" />
          </linearGradient>
        </defs>
        <g className="an-ecg-track">
          <path d={d} fill="none" stroke="url(#ecg-fade)" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
        </g>
      </svg>
      <div className="an-ecg-dot" />
    </div>
  );
};

// ═══════════ MAIN GYMTRACKER ═══════════
export const GymTracker: React.FC = () => {
  const { addUnlocks } = useAchievements();
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
  const [isSavingWorkout, setIsSavingWorkout] = useState(false);
  const [workoutSaveError, setWorkoutSaveError] = useState<string | null>(null);
  const workoutIdRef = useRef<string>('');
  const [userEquipment, setUserEquipment] = useState<string[]>([]);
  const [userEnvironment, setUserEnvironment] = useState<'Home' | 'Gym' | null>(null);
  // Body-anatomy front/back toggle for the active exercise stage. Lives on the
  // root so it survives between exercises in a session.
  const [bodyView, setBodyView] = useState<'front' | 'back'>('front');
  // Heart-Fire tier preview (Analytics streak). Defaults to the user's current tier,
  // user can tap any tier in the roadmap to simulate visuals at that level.
  const [previewTier, setPreviewTier] = useState<1 | 2 | 3 | 4 | 5>(1);
  // Sync previewTier whenever the actual streak crosses a tier boundary.
  useEffect(() => {
    setPreviewTier(tierFromDays(profile.currentStreak ?? 0).tier);
  }, [profile.currentStreak]);

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
    workoutIdRef.current = createWorkoutId();
    setWorkoutSaveError(null);
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
    workoutIdRef.current = createWorkoutId();
    setWorkoutSaveError(null);
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
  const finishWorkout = async () => {
    if (selectedExercises.length === 0 || isSavingWorkout) return;
    setIsSavingWorkout(true);
    setWorkoutSaveError(null);

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

    const workoutId = workoutIdRef.current || createWorkoutId();
    workoutIdRef.current = workoutId;
    const workout: WorkoutLog = {
      id: workoutId,
      date: getLocalDateString(),
      timestamp: new Date().toISOString(),
      type: typeLabel,
      muscleGroups: finalMuscles,
      exercises: enrichedData,
      coreWork: finalMuscles.some(m => ['abs', 'obliques'].includes(m)),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      xpEarned: totalXP,
    };

    const newLogs = [workout, ...logs.filter(log => log.id !== workoutId)];
    const newProfile = updateProfileAfterWorkout(profile, totalXP, finalMuscles, totalSets, newLogs);

    // Achievement check — workout-driven achievements (volume, muscle-group counts,
    // streak, XP, rank, etc.) re-evaluate against the freshly saved state.
    try {
      await storageService.saveCompletedWorkout(newLogs, newProfile);
      setLogs(newLogs);
      setProfile(newProfile);

      // Rewards only evaluate after both cloud writes are acknowledged, so an
      // achievement can never get ahead of the workout history it depends on.
      const unlocks = achievementService.checkAndGrant();
      if (unlocks.length > 0) addUnlocks(unlocks);

      workoutIdRef.current = '';
      setFlowStep('idle');
      setSelectedMuscles([]);
      setSelectedExercises([]);
      setSessionData([]);
      setCurrentExIndex(0);
      setSessionXP(0);
      setNotes('');
    } catch (error) {
      console.error('[GymTracker] Failed to persist completed workout:', error);
      setWorkoutSaveError(getWorkoutSaveError(error));
    } finally {
      setIsSavingWorkout(false);
    }
  };

  const deleteLog = (id: string) => {
    const updated = logs.filter(l => l.id !== id);
    setLogs(updated);
    try { storageService.saveWorkouts(updated); } catch { }
    // Pass current profile in so token economy + unlocked achievements survive
    // a delete-induced rebuild.
    const newProfile = recalculateGymProfile(updated, profile);
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

      {/* Tab Navigation (prototype gym.css .g-tabs port) */}
      <div className="g-tabs">
        <button type="button" className={`g-tab ${viewMode === 'workout' ? 'is-on' : ''}`}
          onClick={() => setViewMode('workout')}>
          <Dumbbell size={14} /><span>Workout</span>
        </button>
        <button type="button" className={`g-tab ${viewMode === 'analytics' ? 'is-on' : ''}`}
          onClick={() => setViewMode('analytics')}>
          <BarChart3 size={14} /><span>Analytics</span>
        </button>
        <div className="g-tab-indicator"
          style={{ transform: `translateX(${viewMode === 'analytics' ? '100%' : '0%'})` }} />
      </div>

      {/* ═══ IDLE VIEW (prototype gym.css port) ═══ */}
      {viewMode === 'workout' && flowStep === 'idle' && (
        <div className="space-y-4">
          <button onClick={() => setFlowStep('selectMuscles')} className="g-start-cta">
            <span className="g-start-cta-bg" />
            <Dumbbell size={16} />
            <span>Start Custom Workout</span>
            <Zap size={14} />
          </button>

          {/* Workout Routines */}
          <section className="card">
            <div className="card-head">
              <span className="card-head-icon"><Package size={14} /></span>
              <span className="hud-label">WORKOUT ROUTINES</span>
              {storageService.getUserState().focusArea && (
                <span className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30">
                  Focus: {storageService.getUserState().focusArea}
                </span>
              )}
            </div>
            <div className="g-rt-grid">
              {sortRoutinesByFocus(WORKOUT_PACKAGES, storageService.getUserState().focusArea).map(pkg => {
                const diffID = pkg.difficulty === 'Beginner' ? 'Pemula' : pkg.difficulty === 'Intermediate' ? 'Menengah' : 'Lanjut';
                const diffStyle = diffID === 'Pemula'
                  ? { color: '#22C55E', background: 'rgba(34,197,94,0.10)', borderColor: 'rgba(34,197,94,0.4)' }
                  : diffID === 'Menengah'
                    ? { color: '#FBBF24', background: 'rgba(251,191,36,0.10)', borderColor: 'rgba(251,191,36,0.4)' }
                    : { color: '#EF4444', background: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.4)' };
                return (
                  <button key={pkg.id} onClick={() => startPackage(pkg)} className="g-rt-card">
                    <div className="g-rt-title">{pkg.name}</div>
                    <div className="g-rt-desc">{pkg.description}</div>
                    <span className="g-rt-diff" style={diffStyle}>{diffID}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Hunter Ranking Board */}
          <section className="card">
            <Leaderboard profile={profile} />
          </section>

          {/* Recent Workouts */}
          <section className="card">
            <div className="card-head">
              <span className="card-head-icon" style={{ color: 'var(--cyan)' }}><Activity size={14} /></span>
              <span className="hud-label">RECENT WORKOUTS</span>
            </div>
            <ul className="g-recent-list">
              {(logs || []).slice(0, 5).map(l => (
                <li key={l.id} className="g-recent-row group" onClick={() => undefined}>
                  <div className="g-recent-info">
                    <div className="g-recent-title">
                      {l.type}
                      {(l.xpEarned || 0) > 0 && <span className="g-recent-xp">+{l.xpEarned}xp</span>}
                    </div>
                    <div className="g-recent-meta">{l.date} · {l.exercises?.length || 0} latihan</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteLog(l.id); }}
                    className="text-slate-700 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                    aria-label="Delete workout log"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
              {(!logs || logs.length === 0) && (
                <li className="text-sm text-slate-600 text-center py-6">No workouts yet. Start your first session!</li>
              )}
            </ul>
          </section>
        </div>
      )}

      {/* ═══ STEP 1: SELECT MUSCLES (prototype workout.css port) ═══ */}
      {viewMode === 'workout' && flowStep === 'selectMuscles' && (
        <div className="wf-screen">
          <div className="wf-sub">
            <button className="wf-back" type="button" aria-label="Tutup"
              onClick={() => { setFlowStep('idle'); setSelectedMuscles([]); }}>
              <X size={14} />
            </button>
            <h2 className="wf-sub-title">Pilih Kelompok Otot</h2>
          </div>
          <MuscleGroupPicker selected={selectedMuscles} onToggle={toggleMuscle} />
          <button type="button"
            className={`wf-cta wf-cta-cyan ${selectedMuscles.length === 0 ? 'is-disabled' : ''}`}
            disabled={selectedMuscles.length === 0}
            onClick={() => setFlowStep('selectExercises')}>
            <span>Pilih Latihan{selectedMuscles.length ? ` (${selectedMuscles.length} otot)` : ''}</span>
            <span className="wf-cta-arrow">›</span>
          </button>
        </div>
      )}

      {/* ═══ STEP 2: SELECT EXERCISES (Firestore Auto-Load, .wf-ex port) ═══ */}
      {viewMode === 'workout' && flowStep === 'selectExercises' && (
        <div className="wf-screen">
          <div className="wf-sub">
            <button className="wf-back" type="button" aria-label="Kembali"
              onClick={() => setFlowStep('selectMuscles')}>
              <ChevronLeft size={14} />
            </button>
            <h2 className="wf-sub-title">Pilih Latihan</h2>
            <span className="wf-sub-meta">{selectedExercises.length} TERPILIH</span>
          </div>

          <ExerciseBrowser
            muscles={selectedMuscles}
            selectedExercises={selectedExercises}
            onToggleExercise={toggleExercise}
            userEquipment={userEquipment}
            logs={logs}
          />

          <button type="button"
            className={`wf-cta wf-cta-green ${selectedExercises.length === 0 ? 'is-disabled' : ''}`}
            disabled={selectedExercises.length === 0}
            onClick={startWorkout}>
            <Zap size={14} />
            <span>Mulai Workout{selectedExercises.length ? ` (${selectedExercises.length} latihan)` : ''}</span>
          </button>
        </div>
      )}

      {/* ═══ ACTIVE WORKOUT (prototype workout.css .ae-* port) ═══ */}
      {viewMode === 'workout' && flowStep === 'active' && currentExercise && (() => {
        const completedRows = sessionData.map((d) => {
          const matchedEx = selectedExercises.find(e => e.name === d.name);
          const xpGained = (matchedEx?.xpPerSet || 15) * d.sets;
          const volume = d.sets * d.reps * d.weight;
          return { ...d, xp: xpGained, vol: volume };
        });
        const muscleLabel = MUSCLE_GROUP_CONFIG[currentExercise.muscleGroup]?.label || currentExercise.muscleGroup;
        return (
        <div className="wf-screen">
          <div className="wf-sub ae-sub">
            <div className="ae-sub-left">
              <div className="ae-progress">Latihan {currentExIndex + 1} / {selectedExercises.length}</div>
              <h2 className="ae-title">
                <img src={`/assets/muscles/${currentExercise.muscleGroup}.webp`} alt=""
                  className="ae-title-ico"
                  onError={e => { e.currentTarget.style.display = 'none'; }} />
                {currentExercise.name}
              </h2>
              <div className="ae-stars-row">
                <WfStars value={currentExercise.difficulty} />
                <span className="ae-equip">{currentExercise.equipment}</span>
              </div>
            </div>
            <div className="ae-sub-right">
              <div className="ae-xp">
                <Zap size={12} />
                {sessionXP} <span className="ae-xp-unit">XP</span>
              </div>
              <div className="ae-xp-sub">+{currentExercise.xpPerSet}/set</div>
            </div>
          </div>

          <div className="ae-body">
            {/* Progress bar */}
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all"
                style={{ width: `${(currentExIndex / Math.max(1, selectedExercises.length)) * 100}%` }} />
            </div>

            {/* Body highlight stage — preserve-3d toggle around AnatomyViewer */}
            <section className="ae-bodystage">
              <span className="brk-c brk-tl" /><span className="brk-c brk-tr" />
              <span className="brk-c brk-bl" /><span className="brk-c brk-br" />
              <div className="d-body-toggle ae-bodystage-toggle">
                <button type="button" className={`d-body-toggle-opt ${bodyView === 'front' ? 'is-on' : ''}`}
                  onClick={() => setBodyView('front')}>FRONT</button>
                <button type="button" className={`d-body-toggle-opt ${bodyView === 'back' ? 'is-on' : ''}`}
                  onClick={() => setBodyView('back')}>BACK</button>
              </div>
              <div className="ae-bodystage-fig">
                <AnatomyViewer
                  trainedMuscles={getTrainedMuscleIds([
                    currentExercise.muscleGroup,
                    ...(currentExercise.secondaryMuscles || []),
                  ])}
                  defaultView={bodyView}
                />
              </div>
              <div className="ae-bodystage-tag">
                <span style={{ color: 'var(--red)' }}>●</span> {currentSets * currentReps} ACTIVE
              </div>
            </section>

            {/* Chips */}
            <div className="ae-chips">
              <span className="ae-chip">{currentExercise.equipment || 'Bodyweight'}</span>
              <span className="ae-chip ae-chip-pink">{muscleLabel}</span>
            </div>

            {/* Tips */}
            <div className="ae-desc">{currentExercise.tips || 'Atur posisi dan jaga form yang benar.'}</div>

            {/* YouTube */}
            <a
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(currentExercise.name + ' exercise form tutorial')}`}
              target="_blank" rel="noopener noreferrer"
              className="ae-yt">
              <Youtube size={14} />
              <span>Tonton di YouTube</span>
              <ExternalLink size={12} className="ae-yt-ext" />
            </a>

            {/* Steppers */}
            <div className="ae-steppers">
              <StepperSlider label="SETS" value={currentSets} onChange={setCurrentSets} min={1} max={10} />
              <StepperSlider label="REPS" value={currentReps} onChange={setCurrentReps} min={1} max={50} />
              <StepperSlider label="KG"   value={currentWeight} onChange={setCurrentWeight} min={0} max={300} step={2.5} />
            </div>

            {/* Completed sets */}
            {completedRows.length > 0 && (
              <div className="ae-completed">
                <div className="ae-completed-head">
                  <span className="ae-step-label">SELESAI ({completedRows.length})</span>
                </div>
                {completedRows.map((d, i) => (
                  <div key={i} className="ae-completed-row">
                    <div className="ae-completed-check"><CheckSquare size={14} /></div>
                    <div className="ae-completed-info">
                      <div className="ae-completed-title">{d.name}</div>
                      <div className="ae-completed-meta">{d.sets} set × {d.reps} rep @ {d.weight}kg</div>
                    </div>
                    <div className="ae-completed-right">
                      <div className="ae-completed-xp">+{d.xp}xp</div>
                      <div className="ae-completed-vol">{d.vol.toLocaleString()}kg vol</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Notes */}
            <input type="text" className="ae-notes"
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Catatan sesi (opsional)…" />

            {/* Rest Timer (auto-starts via trigger from logExercise) */}
            <RestTimerRing trigger={triggerTimer} defaultTime={60} />

            {/* Cancel link */}
            <button type="button" className="ae-cancel"
              disabled={isSavingWorkout}
              onClick={() => {
                workoutIdRef.current = '';
                setWorkoutSaveError(null);
                setFlowStep('idle');
                setSelectedMuscles([]);
                setSelectedExercises([]);
                setSessionData([]);
              }}>
              Batalkan Workout
            </button>
          </div>

          {/* Sticky bottom action row */}
          <div className="ae-sticky">
            {workoutSaveError && (
              <div className="ae-save-error" role="alert" aria-live="assertive">
                {workoutSaveError}
              </div>
            )}
            <button type="button" className="ae-act-edit" aria-label="Tambah latihan"
              disabled={isSavingWorkout}
              onClick={() => setFlowStep('addExercise')}>
              <ListPlus size={14} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--t-2)' }} />
            </button>
            <button type="button" className="ae-act-log" onClick={logExercise} disabled={isSavingWorkout}>
              <CheckSquare size={14} />
              <span>{currentExIndex < selectedExercises.length - 1 ? 'Log & Next' : 'Log Latihan'}</span>
            </button>
            <button type="button" className="ae-act-finish" onClick={finishWorkout} disabled={isSavingWorkout}>
              {isSavingWorkout ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{isSavingWorkout ? 'Menyimpan...' : workoutSaveError ? 'Coba Simpan Lagi' : 'Selesai'}</span>
            </button>
          </div>
        </div>
        );
      })()}

      {/* ═══ ADD EXERCISE MID-SESSION (.wf-screen wrapper) ═══ */}
      {viewMode === 'workout' && flowStep === 'addExercise' && (
        <div className="wf-screen">
          <div className="wf-sub">
            <button className="wf-back" type="button" aria-label="Batal"
              onClick={() => setFlowStep('active')}>
              <X size={14} />
            </button>
            <h2 className="wf-sub-title">Tambah Latihan</h2>
            <span className="wf-sub-meta">{selectedExercises.length} TERPILIH</span>
          </div>
          <ExerciseBrowser
            muscles={selectedMuscles}
            selectedExercises={selectedExercises}
            onToggleExercise={(ex) => { setSelectedExercises(prev => [...prev.filter(e => e.id !== ex.id), ex]); setFlowStep('active'); }}
            userEquipment={userEquipment}
            logs={logs}
          />
        </div>
      )}

      {/* ═══ ANALYTICS VIEW (prototype Analytics.jsx port) ═══ */}
      {viewMode === 'analytics' && (() => {
        const streakDays = profile.currentStreak ?? 0;
        const longestStreak = profile.longestStreak ?? 0;
        const current = tierFromDays(streakDays);
        const next = nextTier(current);
        const showTier = STREAK_TIERS.find((t) => t.tier === previewTier) || current;
        const hasData = volumeData.some(d => d.volume > 0 || d.xp > 0);
        const muscleXPMap = (profile?.muscleXP || {}) as Record<MuscleGroup, number>;
        const maxMuscleXP = Math.max(...(Object.values(muscleXPMap) as number[]), 1);
        const muscleXPRows = (Object.entries(muscleXPMap) as [MuscleGroup, number][])
          .filter(([, xp]) => xp > 0)
          .sort((a, b) => b[1] - a[1]);
        const trendIdx = ['weekly', 'monthly', 'yearly'].indexOf(trendRange);
        return (
        <div className="g-tabbody">
          <div className="an-title-row">
            <span className="an-title-ico"><TrendingUp size={14} /></span>
            <h2 className="an-title">Analytics</h2>
          </div>

          {/* Streak — Heart-Fire + ECG */}
          <section className="card an-streak-card">
            <div className="an-streak-top">
              <div className="hud-label an-streak-label">WORKOUT STREAK</div>
              <div className="an-streak-tier-pill"
                style={{ borderColor: showTier.color, color: showTier.color }}>
                <span>TIER {showTier.tier}</span>
                <span className="an-streak-tier-name">{showTier.name}</span>
              </div>
            </div>

            <div className="an-streak-stage">
              <ECGLine />
              <HeartFire size={150} tier={showTier.tier} />
            </div>

            <div className="an-streak-day">
              <span className="an-streak-num">{streakDays}</span>
              <span className="an-streak-unit">Hari</span>
            </div>
            <div className="an-streak-best">
              BEST: <span style={{ color: 'var(--orange)' }}>{longestStreak}H</span>
            </div>

            {next && (
              <div className="an-streak-next">
                <span className="an-streak-next-arrow">→</span>
                <span>{next.name} dalam</span>
                <strong style={{ color: next.color }}>{next.min - streakDays} hari</strong>
              </div>
            )}

            <div className="an-streak-roadmap">
              {STREAK_TIERS.map((t) => {
                const reached = streakDays >= t.min;
                const active = previewTier === t.tier;
                return (
                  <button key={t.tier} type="button"
                    className={`an-streak-rmark ${reached ? 'is-reached' : ''} ${active ? 'is-active' : ''}`}
                    style={{ ['--rm-color' as string]: t.color }}
                    onClick={() => setPreviewTier(t.tier)}
                    aria-label={`Preview ${t.name}`}>
                    <span className="an-streak-rmark-dot">
                      <span className="an-streak-rmark-glow" />
                    </span>
                    <span className="an-streak-rmark-name">{t.name}</span>
                    <span className="an-streak-rmark-day">
                      {t.min >= 365 ? `${Math.floor(t.min / 365)}thn+`
                        : t.min >= 30 ? `${Math.floor(t.min / 30)}bln`
                        : `${t.min}h`}
                    </span>
                  </button>
                );
              })}
            </div>
            {previewTier !== current.tier && (
              <div className="an-streak-preview-hint">
                ⌬ PREVIEW · ketuk tier untuk simulasi ·
                <button type="button" className="an-streak-preview-reset"
                  onClick={() => setPreviewTier(current.tier)}>
                  kembali ke tier kamu
                </button>
              </div>
            )}

            <p className="an-streak-quote">
              {streakDays > 0
                ? 'Jaga detak jantungmu menyala. Jangan biarkan rantai terputus.'
                : 'Mulai workout pertamamu untuk menyalakan bara.'}
            </p>
          </section>

          {/* Trend */}
          <section className="card">
            <div className="card-head">
              <span className="hud-label">VOLUME &amp; XP TREND</span>
              <div className="an-range">
                {(['weekly', 'monthly', 'yearly'] as const).map(r => (
                  <button key={r} type="button"
                    className={`an-range-opt ${trendRange === r ? 'is-on' : ''}`}
                    onClick={() => setTrendRange(r)}>
                    {r === 'weekly' ? '7D' : r === 'monthly' ? '30D' : '12M'}
                  </button>
                ))}
                <div className="an-range-indicator"
                  style={{ transform: `translateX(${trendIdx * 100}%)` }} />
              </div>
            </div>

            <div className="an-chart">
              {hasData ? (
                <div className="an-chart-recharts">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={volumeData} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(34,211,238,0.08)" />
                      <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} />
                      <Tooltip contentStyle={{ background: 'rgba(7,12,24,0.95)', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                      <Line type="monotone" dataKey="volume" stroke="#22D3EE" strokeWidth={2} dot={{ r: 3 }} name="Volume (kg)" />
                      <Line type="monotone" dataKey="xp" stroke="#FB923C" strokeWidth={2} dot={{ r: 3 }} name="XP" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <>
                  <div className="an-chart-grid">
                    {Array.from({ length: 5 }).map((_, i) => <div key={i} className="an-chart-grid-line" />)}
                  </div>
                  <div className="an-chart-empty">
                    <div className="an-chart-empty-icon">⌬</div>
                    <div>NO DATA · {trendRange === 'weekly' ? '7D' : trendRange === 'monthly' ? '30D' : '12M'}</div>
                    <div className="an-chart-empty-sub">Catat satu sesi untuk mulai mengisi tren.</div>
                  </div>
                  <div className="an-chart-axis">
                    {['SEN','SEL','RAB','KAM','JUM','SAB','MIN'].map((d) => <span key={d}>{d}</span>)}
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Muscle XP Distribution */}
          <section className="card">
            <div className="card-head">
              <span className="hud-label">MUSCLE XP DISTRIBUTION</span>
            </div>
            <div className="an-mx-grid">
              {muscleXPRows.length === 0 && (
                <p className="text-sm text-slate-600 text-center py-4">Selesaikan workout untuk melihat muscle XP</p>
              )}
              {muscleXPRows.map(([muscle, xp]) => {
                const cfg = MUSCLE_GROUP_CONFIG[muscle];
                const pct = Math.round((xp / maxMuscleXP) * 100);
                return (
                  <div key={muscle} className="an-mx-row">
                    <div className="an-mx-row-l">
                      <div className="an-puck">
                        <img src={`/assets/muscles/${muscle}.webp`} alt={cfg?.label}
                          className="an-puck-img"
                          onError={e => { e.currentTarget.style.display = 'none'; }} />
                      </div>
                      <span className="an-mx-name">{cfg?.label || muscle}</span>
                    </div>
                    <div className="an-mx-row-r">
                      <div className="an-mx-bar">
                        <div className="an-mx-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="an-mx-val">{xp}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
        );
      })()}
    </div>
  );
};
