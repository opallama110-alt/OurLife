import { db } from '../firebase-config';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { FirestoreExercise } from '../types';

// ── All anatomical name variants mapped from UI muscle key → DB targetMuscle values ──
// These must match the EXACT strings stored in Firestore (including trailing commas/spaces
// that some entries have — the normalize() function strips them before comparison).
const MUSCLE_VARIANTS: Record<string, string[]> = {
  chest:      ['pectorals', 'pectoralis major, sternal,', 'pectoralis major', 'chest'],
  shoulders:  ['delts', 'deltoids', 'deltoid', 'deltoid, anterior,', 'deltoid, lateral,', 'deltoid, posterior,', 'shoulders'],
  triceps:    ['triceps', 'triceps brachii', 'triceps, long head,'],
  biceps:     ['biceps', 'biceps brachii,', 'brachialis'],
  forearms:   ['forearms', 'brachioradialis,', 'wrist flexors,', 'wrist extensors,'],
  lats:       ['lats', 'latissimus dorsi,', 'back, general,', 'teres major', 'teres minor,'],
  traps:      ['traps', 'trapezius, upper,', 'upper back', 'rhomboids,', 'levator scapulae'],
  lower_back: ['spine', 'lower back', 'erector spinae', 'thoracolumbar fascia'],
  abs:        ['abs', 'abdominals', 'rectus abdominis', 'core'],
  obliques:   ['obliques', 'external obliques', 'internal obliques'],
  quads:      ['quads', 'quadriceps', 'rectus femoris', 'rectus femoris,', 'vastus lateralis', 'vastus medialis', 'vastus intermedius'],
  hamstrings: ['hamstrings', 'hamstrings,', 'biceps femoris', 'semitendinosus', 'semimembranosus'],
  glutes:     ['glutes', 'gluteus maximus,', 'gluteus medius, gluteus minimus,', 'gluteus medius, gluteus minimus, anterior fibers,', 'piriformis, quadratus femoris,', 'external hip rotators,', 'hip abductors'],
  calves:     ['calves', 'gastrocnemius,', 'gastrocnemius (hands further away from feet),', 'soleus,', 'tibialis anterior,', 'calf'],
};

// bodyPart fallback mapping — used when MUSCLE_VARIANTS query returns empty
const BODYPART_FALLBACK: Record<string, string> = {
  chest: 'chest',
  shoulders: 'shoulder',
  triceps: 'upper arms',
  biceps: 'upper arms',
  forearms: 'lower arms',
  lats: 'back',
  traps: 'back',
  lower_back: 'back',
  abs: 'waist',
  obliques: 'waist',
  quads: 'upper legs',
  hamstrings: 'upper legs',
  glutes: 'upper legs',
  calves: 'lower legs',
};

const normalize = (s: string): string => s.toLowerCase().replace(/_/g, ' ').trim();
const getVariants = (key: string): string[] => MUSCLE_VARIANTS[normalize(key)] ?? [normalize(key)];
const toExercise = (docSnap: any): FirestoreExercise => ({
  id: docSnap.id,
  ...docSnap.data(),
  equipment: docSnap.data().equipment || 'Bodyweight',
} as FirestoreExercise);

export const exerciseService = {
  /**
   * Smart multi-query: tries all anatomical name variants (batched 'in' queries),
   * then falls back to bodyPart. For categories like "obliques" that exist only as
   * secondaryMuscles, we query by bodyPart and filter client-side.
   */
  getExercisesByMuscle: async (targetMuscle: string): Promise<FirestoreExercise[]> => {
    try {
      const key = normalize(targetMuscle);
      const variants = getVariants(targetMuscle);
      const seen = new Set<string>();
      const results: FirestoreExercise[] = [];

      // Firestore 'in' supports max 10 items — batch accordingly
      for (let i = 0; i < variants.length; i += 10) {
        const chunk = variants.slice(i, i + 10);
        try {
          const q = query(
            collection(db, 'exercises'),
            where('targetMuscle', 'in', chunk),
            limit(30),
          );
          const snap = await getDocs(q);
          snap.docs.forEach(d => {
            if (!seen.has(d.id)) { seen.add(d.id); results.push(toExercise(d)); }
          });
        } catch (e) {
          console.warn('[exerciseService] batch query warn:', e);
        }
      }

      // Fallback: bodyPart query — crucial for categories that exist primarily
      // as secondaryMuscles ("obliques") or whose Firestore targetMuscle values
      // use less obvious anatomical names ("lower_back" → "spine").
      if (results.length === 0) {
        const bodyPart = BODYPART_FALLBACK[key] || normalize(targetMuscle);
        const q2 = query(
          collection(db, 'exercises'),
          where('bodyPart', '==', bodyPart),
          limit(80),
        );
        const snap2 = await getDocs(q2);

        // Per-category client-side filters keyed on substrings the JSON
        // actually contains. `lower_back` got added in Phase 2 because
        // Firestore stores those exercises under `targetMuscle: "spine"`
        // and they were leaking into the generic-back catch-all.
        const CLIENT_FILTERS: Record<string, RegExp> = {
          obliques:    /oblique/,
          lower_back:  /lower\s*back|spine|erector\s*spinae|thoracolumbar|lumbar/,
        };
        const filter = CLIENT_FILTERS[key];

        snap2.docs.forEach(d => {
          if (seen.has(d.id)) return;
          const ex = toExercise(d);
          if (filter) {
            const target = (ex.targetMuscle || '').toLowerCase();
            const secondaries = (ex.secondaryMuscles || []).map((s: string) => s.toLowerCase());
            if (filter.test(target) || secondaries.some(s => filter.test(s))) {
              seen.add(d.id);
              results.push(ex);
            }
          } else {
            seen.add(d.id);
            results.push(ex);
          }
        });
      }

      return results.slice(0, 50);
    } catch (error) {
      console.error('[exerciseService] getExercisesByMuscle:', error);
      return [];
    }
  },

  getExercisesByBodyPart: async (bodyPart: string): Promise<FirestoreExercise[]> => {
    try {
      const q = query(
        collection(db, 'exercises'),
        where('bodyPart', '==', normalize(bodyPart)),
        limit(50),
      );
      const snap = await getDocs(q);
      return snap.docs.map(toExercise);
    } catch (error) {
      console.error('[exerciseService] getExercisesByBodyPart:', error);
      return [];
    }
  },

  getExerciseById: async (id: string): Promise<FirestoreExercise | null> => {
    try {
      const snap = await getDoc(doc(db, 'exercises', id));
      return snap.exists() ? toExercise(snap) : null;
    } catch (error) {
      console.error('[exerciseService] getExerciseById:', error);
      return null;
    }
  },

  getPopularExercises: async (limitNum = 20): Promise<FirestoreExercise[]> => {
    try {
      const q = query(collection(db, 'exercises'), limit(limitNum));
      const snap = await getDocs(q);
      return snap.docs.map(toExercise);
    } catch (error) {
      console.error('[exerciseService] getPopularExercises:', error);
      return [];
    }
  },

  /** Client-side filter: keep only mainstream gym equipment. */
  filterMainstreamExercises: (exercises: FirestoreExercise[]): FirestoreExercise[] => {
    const MAINSTREAM = ['barbell', 'dumbbell', 'cable', 'machine', 'body weight', 'kettlebell', 'ez barbell', 'band', 'smith machine'];
    return exercises.filter(ex =>
      MAINSTREAM.some(s => (ex.equipment || '').toLowerCase().includes(s)),
    );
  },

  /**
   * Context-aware filter: keep only exercises whose equipment the user actually has.
   * `userEquipment` entries use the Settings UI labels
   * ('Barbell', 'Dumbbell', 'Cable', 'Machine', 'Kettlebell', 'Bands', 'Smith Machine', 'Bodyweight').
   * If the list is empty or undefined, no filtering is applied.
   */
  filterByUserEquipment: (
    exercises: FirestoreExercise[],
    userEquipment: string[] | undefined,
  ): FirestoreExercise[] => {
    if (!userEquipment || userEquipment.length === 0) return exercises;

    const EQUIP_ALIASES: Record<string, string[]> = {
      barbell: ['barbell', 'ez barbell', 'olympic barbell'],
      dumbbell: ['dumbbell'],
      cable: ['cable'],
      machine: ['machine', 'leverage machine', 'sled'],
      kettlebell: ['kettlebell'],
      bands: ['band', 'resistance band'],
      'smith machine': ['smith machine'],
      bodyweight: ['body weight', 'bodyweight', 'assisted', 'rope'],
    };

    const allowedTokens = new Set<string>();
    userEquipment.forEach(label => {
      const key = label.toLowerCase();
      const aliases = EQUIP_ALIASES[key] || [key];
      aliases.forEach(a => allowedTokens.add(a));
    });

    return exercises.filter(ex => {
      const eq = (ex.equipment || '').toLowerCase();
      for (const token of allowedTokens) {
        if (eq.includes(token)) return true;
      }
      return false;
    });
  },
};
