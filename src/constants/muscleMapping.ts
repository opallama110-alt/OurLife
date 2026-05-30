// ═══════════════════════════════════════════════════════════════════════════
// MUSCLE MAPPING — Phase 2 of the Anatomy refactor
// ═══════════════════════════════════════════════════════════════════════════
//
// `MUSCLE_MAP` translates raw muscle name strings (from Firestore exercise
// docs, the strict `MuscleGroup` union, or anywhere in the app) into the
// SVG path/group id PREFIXES that `AnatomyViewer` uses with its
// `[id^="..."]` attribute selectors.
//
// Why prefixes?  Adobe Illustrator appended a unique 30-char suffix to
// every <path>/<g> id when it exported `Full_body_front_muscles.svg` and
// `Full_body_back_muscles.svg` — e.g. `Lats_00000133492815442984477070...`.
// Matching by prefix lets us target a stable human-readable name without
// caring about the suffix.
//
// Many muscles span BOTH views (e.g. calves, deltoids, traps), so each
// entry's value is an array of prefixes. The viewer will light up every
// match across both faces; selectors that don't exist in the active SVG
// are simply no-ops.
// ═══════════════════════════════════════════════════════════════════════════

export const ANTIGRAVITY_MAPPING: Record<string, string> = {
  // Firebase Name : SVG ID  (LEGACY — kept for backwards compat with imports)
  "abs": "rectus_abdominis",
  "pectorals": "pectoralis_major",
  "biceps": "biceps_brachii",
  "triceps": "triceps_brachii",
  "delts": "deltoid_anterior",
  "shoulders": "deltoid_lateral",
  "quads": "rectus_femoris",
  "hamstrings": "biceps_femoris",
  "lats": "latissimus_dorsi",
  "glutes": "gluteus_maximus",
  "calves": "gastrocnemius",
  "forearms": "brachioradialis",
  "traps": "trapezius_upper"
};

/**
 * Safely maps an anatomical RTDB string back to the standard UI key (e.g. pectorals -> chest).
 * Prevents "Cannot read properties of undefined" array index out of bounds crashes.
 */
export const mapDBMuscleToUIKey = (dbMuscle: string | undefined): string => {
  if (!dbMuscle) return 'chest';
  const raw = dbMuscle.toLowerCase();
  for (const [uiKey, dbKey] of Object.entries(ANTIGRAVITY_MAPPING)) {
    if (dbKey === raw || uiKey === raw) return uiKey;
  }
  return raw.replace(/ /g, '_'); // Fallback to safe format
};

// ═══════════════════════════════════════════════════════════════════════════
// MUSCLE_MAP  —  Firestore muscle name → AnatomyViewer SVG id prefixes
// ═══════════════════════════════════════════════════════════════════════════
//
// Keys are normalized: lowercase, trailing commas/whitespace stripped.
// Lookup the helper `getTrainedMuscleIds()` below for the proper way to
// query this map (it normalizes input for you).
//
export const MUSCLE_MAP: Record<string, string[]> = {

  // ─── Chest / Pectorals ────────────────────────────────────────────────
  chest:                              ['Pecs'],
  pectorals:                          ['Pecs'],
  pectoral:                           ['Pecs'],
  'pectoralis major':                 ['Pecs'],
  'pectoralis major, sternal':        ['Pecs'],
  'pectoralis minor':                 ['Pecs', 'Serratus_Anterior'],
  sternal:                            ['Pecs'],
  clavicular:                         ['Pecs'],
  'upper chest':                      ['Pecs', 'Deltoids_front'],

  // ─── Abs / Core ───────────────────────────────────────────────────────
  abs:                                ['Upper_abs', 'Lower_abs'],
  abdominals:                         ['Upper_abs', 'Lower_abs'],
  abdominal:                          ['Upper_abs', 'Lower_abs'],
  'rectus abdominis':                 ['Upper_abs', 'Lower_abs'],
  core:                               ['Upper_abs', 'Lower_abs', 'Obliques_external'],
  'lower abs':                        ['Lower_abs'],
  'upper abs':                        ['Upper_abs'],

  // ─── Obliques ─────────────────────────────────────────────────────────
  obliques:                           ['Obliques_external', 'Obliques', 'Upper_obliques'],
  'external obliques':                ['Obliques_external', 'Obliques'],
  'internal obliques':                ['Obliques_external', 'Obliques'],

  // ─── Quads ────────────────────────────────────────────────────────────
  quads:                              ['Outer_quads', 'Inner_quads', 'Mid_quad'],
  quadriceps:                         ['Outer_quads', 'Inner_quads', 'Mid_quad'],
  'rectus femoris':                   ['Mid_quad'],
  'vastus lateralis':                 ['Outer_quads'],
  'vastus medialis':                  ['Inner_quads'],
  'vastus intermedius':               ['Mid_quad'],

  // ─── Biceps ───────────────────────────────────────────────────────────
  biceps:                             ['Biceps_brachii', 'Biceps_Brachialis'],
  'biceps brachii':                   ['Biceps_brachii', 'Biceps_Brachialis'],
  brachialis:                         ['Biceps_Brachialis'],

  // ─── Shoulders / Deltoids ─────────────────────────────────────────────
  shoulders:                          ['Deltoids_front', 'Delts'],
  shoulder:                           ['Deltoids_front', 'Delts'],
  delts:                              ['Deltoids_front', 'Delts'],
  deltoids:                           ['Deltoids_front', 'Delts'],
  deltoid:                            ['Deltoids_front', 'Delts'],
  'deltoid, anterior':                ['Deltoids_front'],
  'anterior deltoid':                 ['Deltoids_front'],
  'deltoid, lateral':                 ['Deltoids_front', 'Delts'],
  'lateral deltoid':                  ['Deltoids_front', 'Delts'],
  'deltoid, posterior':               ['Delts'],
  'posterior deltoid':                ['Delts'],
  'rear deltoids':                    ['Delts'],
  anterior:                           ['Deltoids_front'],
  posterior:                          ['Delts'],

  // ─── Forearms ─────────────────────────────────────────────────────────
  forearms:                           ['Brachioradialis', 'fore_arm_upper', 'Extensor', 'Flexor_digitorium', 'Extensor_carpi', 'Extensor_digitorum', 'Extensor_carpi_ulnaris'],
  forearm:                            ['Brachioradialis', 'fore_arm_upper', 'Extensor', 'Flexor_digitorium', 'Extensor_carpi'],
  brachioradialis:                    ['Brachioradialis', 'fore_arm_upper'],
  'wrist flexors':                    ['Flexor_digitorium'],
  'wrist extensors':                  ['Extensor_carpi', 'Extensor_digitorum', 'Extensor_carpi_ulnaris'],
  'grip muscles':                     ['Brachioradialis', 'fore_arm_upper', 'Flexor_digitorium'],

  // ─── Calves ───────────────────────────────────────────────────────────
  // (the back SVG file misspells the group as `Claves_…` — included on purpose)
  calves:                             ['Calves', 'Soleus', 'Claves'],
  calf:                               ['Calves', 'Soleus', 'Claves'],
  gastrocnemius:                      ['Calves', 'Claves'],
  soleus:                             ['Soleus'],
  'tibialis anterior':                ['Peroneus_longus'],
  'peroneus longus':                  ['Peroneus_longus'],
  'gastrocnemius (hands further away from feet)': ['Calves', 'Claves'],

  // ─── Lats / Back ──────────────────────────────────────────────────────
  lats:                               ['Lats'],
  'latissimus dorsi':                 ['Lats'],
  back:                               ['Lats', 'Teres_Major', 'Trapz', 'Middle_and_lower_trapz'],
  'back, general':                    ['Lats', 'Teres_Major', 'Trapz', 'Rhomboid_major', 'Middle_and_lower_trapz'],
  'teres major':                      ['Teres_Major'],
  'teres minor':                      ['Infraspinatus', 'Teres_Major'],

  // ─── Traps / Upper Back ───────────────────────────────────────────────
  traps:                              ['Trapz', 'Front_traps', 'Middle_and_lower_trapz'],
  trapezius:                          ['Trapz', 'Front_traps', 'Middle_and_lower_trapz'],
  'trapezius, upper':                 ['Trapz', 'Front_traps'],
  'upper back':                       ['Trapz', 'Rhomboid_major', 'Middle_and_lower_trapz'],
  rhomboids:                          ['Rhomboid_major'],
  'rhomboid major':                   ['Rhomboid_major'],
  'levator scapulae':                 ['Trapz', 'Front_traps'],
  'lower fibers':                     ['Middle_and_lower_trapz'],

  // ─── Lower Back / Spine — FIX (previously empty in the library) ───────
  // Maps to Thoracolumbar (the lumbar fascia path on the back SVG) +
  // Middle_and_lower_trapz (which extends down the mid-spine).
  'lower back':                       ['Thoracolumbar', 'Middle_and_lower_trapz'],
  lower_back:                         ['Thoracolumbar', 'Middle_and_lower_trapz'],
  'erector spinae':                   ['Thoracolumbar', 'Middle_and_lower_trapz'],
  'thoracolumbar fascia':             ['Thoracolumbar'],
  thoracolumbar:                      ['Thoracolumbar'],
  spine:                              ['Thoracolumbar', 'Middle_and_lower_trapz'],

  // ─── Triceps ──────────────────────────────────────────────────────────
  triceps:                            ['Triceps', 'Triceps_long_head', 'triceps_lateral_head'],
  'triceps brachii':                  ['Triceps', 'Triceps_long_head', 'triceps_lateral_head'],
  'triceps, long head':               ['Triceps_long_head', 'Triceps'],

  // ─── Glutes ───────────────────────────────────────────────────────────
  glutes:                             ['Gluteus_maximus', 'Gluteus_medius'],
  'gluteus maximus':                  ['Gluteus_maximus'],
  'gluteus medius':                   ['Gluteus_medius'],
  'gluteus medius, gluteus minimus':  ['Gluteus_medius'],
  'gluteus medius, gluteus minimus, anterior fibers': ['Gluteus_medius'],
  'hip abductors':                    ['Gluteus_medius'],
  'external hip rotators':            ['Gluteus_medius', 'Gluteus_maximus'],
  'piriformis, quadratus femoris':    ['Gluteus_maximus'],
  abductors:                          ['Gluteus_medius'],

  // ─── Hamstrings ───────────────────────────────────────────────────────
  hamstrings:                         ['Biceps_Femoris', 'Semi_Tendinosis', 'Semimembranosis', 'Upper_inner_hamstring'],
  hamstring:                          ['Biceps_Femoris', 'Semi_Tendinosis', 'Semimembranosis', 'Upper_inner_hamstring'],
  'biceps femoris':                   ['Biceps_Femoris'],
  semitendinosus:                     ['Semi_Tendinosis'],
  semimembranosus:                    ['Semimembranosis'],
  'hamstrings (hands closer to feet)': ['Biceps_Femoris', 'Semi_Tendinosis', 'Semimembranosis', 'Upper_inner_hamstring'],

  // ─── Adductors / Inner Thighs ────────────────────────────────────────
  adductors:                          ['Sartorius', 'Pectinius'],
  'adductors, hip':                   ['Sartorius', 'Pectinius'],
  'adductor magnus':                  ['Sartorius', 'Pectinius'],
  'adductor magnus, ischial fibers':  ['Sartorius', 'Pectinius'],
  'inner thighs':                     ['Sartorius', 'Pectinius'],
  groin:                              ['Pectinius', 'Sartorius'],

  // ─── Hip Flexors ──────────────────────────────────────────────────────
  'hip flexors':                      ['Sartorius'],
  iliopsoas:                          ['Sartorius'],
  'tensor fasciae latae':             ['Outer_quads'],

  // ─── Serratus Anterior ────────────────────────────────────────────────
  'serratus anterior':                ['Serratus_Anterior'],
  serratus:                           ['Serratus_Anterior'],

  // ─── Neck ─────────────────────────────────────────────────────────────
  neck:                               ['Sternocleids', 'Sternocleid', 'Scm'],
  sternocleidomastoid:                ['Sternocleids', 'Sternocleid', 'Scm'],
  'longus colli':                     ['Sternocleids', 'Scm'],

  // ─── Rotator Cuff ─────────────────────────────────────────────────────
  infraspinatus:                      ['Infraspinatus'],
  'rotator cuff':                     ['Infraspinatus', 'Teres_Major'],

  // ─── Misc fragments seen in the JSON ──────────────────────────────────
  splenius:                           ['Trapz', 'Front_traps'],
  'cervicis & capitis fibers':        ['Trapz', 'Front_traps'],
  middle:                             ['Middle_and_lower_trapz'],
  lower:                              ['Middle_and_lower_trapz', 'Lower_abs'],
  upper:                              ['Trapz', 'Upper_abs'],
  'upper (part 1)':                   ['Trapz'],

  // Cardiovascular — light up most major movers as a "full activation" hint
  'cardiovascular system':            ['Pecs', 'Lats', 'Outer_quads', 'Inner_quads', 'Mid_quad', 'Biceps_Femoris', 'Calves', 'Claves', 'Trapz', 'Gluteus_maximus'],
  cardiovascular:                     ['Pecs', 'Lats', 'Outer_quads', 'Inner_quads', 'Mid_quad', 'Biceps_Femoris', 'Calves', 'Claves', 'Trapz', 'Gluteus_maximus'],
};

/**
 * Normalize a raw muscle name (Firestore strings, MuscleGroup keys, etc.)
 * to the canonical form used as a `MUSCLE_MAP` key.
 *  - lowercase
 *  - underscores → spaces (so 'lower_back' → 'lower back')
 *  - strip trailing comma + whitespace (Firestore data has many of these)
 */
const normalizeMuscleName = (raw: string): string =>
  (raw || '').toLowerCase().replace(/_/g, ' ').replace(/,\s*$/, '').trim();

/**
 * Translate a list of raw muscle names into a deduplicated array of SVG
 * path-id PREFIXES that `AnatomyViewer` can render as "trained" (red neon).
 *
 * Accepts a mix of:
 *  - strict `MuscleGroup` union values (`'lower_back'`, `'lats'`, …)
 *  - raw Firestore exercise strings (`'biceps brachii,'`, `'deltoid, anterior,'`, …)
 *  - free-form names (`'Latissimus Dorsi'`, `'Lower Back'`, …)
 *
 * Unknown / null / undefined entries are silently skipped — never throws.
 */
export const getTrainedMuscleIds = (
  rawNames: ReadonlyArray<string | undefined | null>
): string[] => {
  const ids = new Set<string>();
  for (const raw of rawNames) {
    if (!raw) continue;
    const key = normalizeMuscleName(raw);

    const direct = MUSCLE_MAP[key];
    if (direct) {
      direct.forEach(id => ids.add(id));
      continue;
    }

    // Fallback 1: try the underscored form (so a free-form 'lower back'
    // also matches the canonical `lower_back` key if someone added it that way).
    const underscored = key.replace(/ /g, '_');
    const u = MUSCLE_MAP[underscored];
    if (u) {
      u.forEach(id => ids.add(id));
      continue;
    }

    // Fallback 2: try the comma-prefix form (e.g. 'deltoid' is in the map
    // even though Firestore stores 'deltoid, anterior,').
    const commaHead = key.split(',')[0].trim();
    const c = MUSCLE_MAP[commaHead];
    if (c) c.forEach(id => ids.add(id));
  }
  return Array.from(ids);
};
