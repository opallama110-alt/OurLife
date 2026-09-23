import { useEffect, useMemo, useRef, useState } from 'react';
import { MuscleGroup } from '../../types';

// ─────────────────────────────────────────────────────────────────────────
// BodyAnatomy — inline the imported anatomical SVGs (front/back, male/female)
// and tint specified muscle groups red via per-instance scoped CSS.
//
// Source SVGs live in /public/assets/ and are fetched lazily, then cached at
// module scope so subsequent renders / view toggles don't re-fetch.
// Per-instance <style> block targets SVG group id prefixes (g[id^="..."])
// because the underlying SVG generator emits randomized id suffixes per export.
//
// The component renders a single view at a time. Parent owns the front/back
// toggle state — wrap two BodyAnatomy instances in your own flip frame to
// build a rotating dual-view (see pages/Dashboard.tsx muscle recovery card).
// ─────────────────────────────────────────────────────────────────────────

export type BodyView = 'front' | 'back';
export type BodyGender = 'male' | 'female';

export interface BodyAnatomyProps {
    view: BodyView;
    exhausted: MuscleGroup[];
    gender?: BodyGender;
    className?: string;
}

const FRONT_MUSCLE_IDS: Partial<Record<MuscleGroup, string[]>> = {
    chest:    ['Pecs'],
    shoulders:['Deltoids_front'],
    biceps:   ['Biceps_brachii', 'Biceps_Brachialis'],
    triceps:  ['Triceps_long_head', 'triceps_lateral_head'],
    abs:      ['Upper_abs', 'Lower_abs', 'Serratus_Anterior'],
    obliques: ['Obliques_external'],
    forearms: ['fore_arm_upper', 'Flexor_digitorium', 'Extensor_x', 'Brachioradialis'],
    quads:    ['Outer_quads', 'Inner_quads', 'Mid_quad', 'Sartorius'],
    calves:   ['Soleus', 'Peroneus_longus'],
    traps:    ['Front_traps'],
};

const BACK_MUSCLE_IDS: Partial<Record<MuscleGroup, string[]>> = {
    lats:       ['Lats'],
    traps:      ['Trapz', 'Middle_and_lower_trapz'],
    shoulders:  ['Delts'],
    triceps:    ['Triceps'],
    forearms:   ['Extensor_carpi', 'Extensor_carpi_ulnaris', 'Extensor_digitorum'],
    obliques:   ['Obliques', 'Upper_obliques'],
    glutes:     ['Gluteus_maximus', 'Gluteus_medius'],
    hamstrings: ['Biceps_Femoris', 'Semi_Tendinosis', 'Semimembranosis', 'Upper_inner_hamstring'],
    calves:     ['Claves', 'Soleus'],
};

// Helper for callers — returns which exhausted muscles are visible on each view.
// Muscles with both-side visibility (traps, triceps, forearms, etc.) appear in both buckets.
export function splitExhaustedByView(
    exhausted: MuscleGroup[],
): { front: MuscleGroup[]; back: MuscleGroup[] } {
    const front: MuscleGroup[] = [];
    const back: MuscleGroup[] = [];
    for (const m of exhausted) {
        if (FRONT_MUSCLE_IDS[m]) front.push(m);
        if (BACK_MUSCLE_IDS[m]) back.push(m);
    }
    return { front, back };
}

// ── SVG fetch + module cache ─────────────────────────────────────────────
type Bucket = {
    front: string | null;
    back: string | null;
    pending: { front: Promise<string> | null; back: Promise<string> | null };
};
const SVG_CACHE: Record<BodyGender, Bucket> = {
    male:   { front: null, back: null, pending: { front: null, back: null } },
    female: { front: null, back: null, pending: { front: null, back: null } },
};

function svgURL(gender: BodyGender, view: BodyView): string {
    if (gender === 'female') return `/assets/body-female-${view}.svg`;
    return `/assets/body-${view}.svg`;
}

async function fetchSVG(gender: BodyGender, view: BodyView): Promise<string> {
    const bucket = SVG_CACHE[gender];
    const cached = bucket[view];
    if (cached) return cached;
    const pending = bucket.pending[view];
    if (pending) return pending;
    const p = fetch(svgURL(gender, view))
        .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.text();
        })
        .then(t => {
            // Strip width/height so the SVG scales to its container.
            const cleaned = t
                .replace(/(<svg[^>]*)\swidth="[^"]*"/, '$1')
                .replace(/(<svg[^>]*)\sheight="[^"]*"/, '$1');
            bucket[view] = cleaned;
            return cleaned;
        })
        .catch(err => {
            // Drop the rejected promise so the next mount retries instead of
            // awaiting the same failure forever (stuck on "SCANNING…").
            bucket.pending[view] = null;
            throw err;
        });
    bucket.pending[view] = p;
    return p;
}

// ── Component ────────────────────────────────────────────────────────────
export default function BodyAnatomy({
    view,
    exhausted,
    gender = 'male',
    className = '',
}: BodyAnatomyProps) {
    const [svg, setSvg] = useState<string | null>(() => SVG_CACHE[gender]?.[view] ?? null);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    // Only fade in SVGs that actually arrive over the network; a cached SVG
    // (e.g. revisiting the Dashboard) should appear instantly.
    const [fadeIn, setFadeIn] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let cancelled = false;
        setFailed(false);
        const cached = SVG_CACHE[gender]?.[view];
        if (cached) {
            setSvg(cached);
            return;
        }
        setSvg(null);
        fetchSVG(gender, view)
            .then(t => {
                if (cancelled) return;
                setFadeIn(true);
                setSvg(t);
            })
            .catch(err => {
                if (cancelled) return;
                console.error('[BodyAnatomy] SVG load failed:', err);
                setFailed(true);
            });
        return () => { cancelled = true; };
    }, [gender, view, attempt]);

    // Per-instance scoped CSS — tint exhausted muscle groups red.
    // The SVG generator emits randomized id suffixes per export, so we use
    // [id^="..."] prefix selectors. The .ba-1/.ba-3/.ba-5/.ba-8 classes are
    // the SVG's currentColor-bound fill classes (the prototype convention).
    const scopedCSS = useMemo(() => {
        const dict = view === 'front' ? FRONT_MUSCLE_IDS : BACK_MUSCLE_IDS;
        const selectors: string[] = [];
        for (const muscle of exhausted) {
            const ids = dict[muscle];
            if (!ids) continue;
            for (const prefix of ids) {
                selectors.push(`.body-anatomy[data-view="${view}"] g[id^="${prefix}"]`);
            }
        }
        if (!selectors.length) return '';
        const groupSel = selectors.join(',');
        const fillSel = selectors
            .map(s => `${s} .ba-1, ${s} .ba-3, ${s} .ba-5, ${s} .ba-8`)
            .join(',');
        return `
            ${groupSel} { color: #EF4444; }
            ${fillSel} {
                fill: #EF4444 !important;
                opacity: 0.95 !important;
                filter: drop-shadow(0 0 1.5px rgba(239, 68, 68, 0.4));
            }
        `;
    }, [view, exhausted]);

    return (
        <div
            ref={containerRef}
            className={`body-anatomy ${className}`.trim()}
            data-view={view}
        >
            <style>{scopedCSS}</style>
            {svg ? (
                <div
                    className={`body-anatomy-svg ${fadeIn ? 'is-fresh' : ''}`.trim()}
                    // SVG content is from our own /public/assets; not user input.
                    dangerouslySetInnerHTML={{ __html: svg }}
                />
            ) : failed ? (
                <button
                    type="button"
                    className="body-anatomy-loading body-anatomy-retry"
                    onClick={() => setAttempt(a => a + 1)}
                >
                    Gagal memuat — ketuk untuk ulang
                </button>
            ) : (
                <div className="body-anatomy-loading">
                    <span className="dot-pulse" style={{ color: 'var(--cyan)' }} />
                    <span className="body-anatomy-loading-text">SCANNING…</span>
                </div>
            )}
        </div>
    );
}
