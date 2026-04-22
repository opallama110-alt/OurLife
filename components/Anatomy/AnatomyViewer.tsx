import React, { useEffect, useId, useMemo, useState } from 'react';
import { getTrainedMuscleIds } from '../../constants/muscleMapping';

/**
 * AnatomyViewer (Phase 2 — Solo Leveling Aesthetic + Depth-Illusion Flip)
 * ───────────────────────────────────────────────────────────────────────
 * High-performance interactive anatomy viewer that loads BOTH full-body
 * SVG files (front + back) and renders them on opposite faces of a 3D
 * perspective card.  The Front/Back toggle triggers a continuous-forward
 * flip animation with TWO depth-illusion tricks layered on top of the
 * `rotateY`:
 *
 *   1. SCALE pulse — the card eases down to 0.86 at the 90° flat moment
 *      and back up to 1.0 at the end, hiding the zero-thickness edge of
 *      a 2D SVG.
 *   2. DYNAMIC SHADOW — a `drop-shadow()` whose X-offset sweeps from 0
 *      → +30 → 0 → -30 → 0 across the rotation, simulating directional
 *      light catching the body as it turns. A second `drop-shadow()`
 *      pulses red glow at the midpoint to add visual weight when the
 *      body is edge-on.
 *
 * "Trained" muscles light up red-neon (Solo Leveling); "rest" muscles
 * fall back to a dark inactive state. Trained muscles are matched by
 * SVG <path>/<g> id PREFIX (Illustrator appended a unique suffix to
 * every id, so we use `[id^="..."]` attribute selectors).
 *
 * No external SVG libraries — fetch + dangerouslySetInnerHTML.
 *
 * The two SVG files live at:
 *   /assets/anatomy/front/Full_body_front_muscles.svg
 *   /assets/anatomy/back/Full_body_back_muscles.svg
 */

const SVG_URLS: Record<'front' | 'back', string> = {
  front: '/assets/anatomy/front/Full_body_front_muscles.svg',
  back:  '/assets/anatomy/back/Full_body_back_muscles.svg',
};

// ── Module-level cache so the SVG text is fetched at most once per view ──
const svgTextCache: Record<'front' | 'back', string | null> = { front: null, back: null };
const svgPromiseCache: Record<'front' | 'back', Promise<string> | null> = { front: null, back: null };

const loadSvg = (view: 'front' | 'back'): Promise<string> => {
  if (svgTextCache[view]) return Promise.resolve(svgTextCache[view] as string);
  if (svgPromiseCache[view]) return svgPromiseCache[view] as Promise<string>;
  const p = fetch(SVG_URLS[view])
    .then(r => {
      if (!r.ok) throw new Error(`Failed to load ${SVG_URLS[view]}`);
      return r.text();
    })
    .then(text => {
      svgTextCache[view] = text;
      return text;
    })
    .catch(err => {
      svgPromiseCache[view] = null; // allow retry
      throw err;
    });
  svgPromiseCache[view] = p;
  return p;
};

// ── Escape user-provided id prefix for safe CSS attribute-selector use ──
const escapeForAttrSelector = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/**
 * Lightweight heuristic — kept exported for legacy callers (GymTracker.tsx)
 * that pre-decide which view to show.
 */
export const getViewForMuscle = (muscle: string): 'front' | 'back' => {
  const k = (muscle || '').toLowerCase();
  if (/back|lat|trap|rhomb|glute|hamstring|tricep|spine|erector|rear|posterior|infra|teres|calves/.test(k))
    return 'back';
  return 'front';
};

interface AnatomyViewerProps {
  /** Array of SVG <path>/<g> id PREFIXES to render in the trained (red neon) state */
  trainedMuscles?: string[];
  /**
   * Phase 9 — Array of SVG <path>/<g> id PREFIXES to render in the
   * "ready / fully recovered" state (green neon). Trained always wins
   * over ready when a muscle appears in both lists.
   */
  readyMuscles?: string[];
  /** Initial view */
  defaultView?: 'front' | 'back';
  /** Hide the front/back toggle button (e.g. for thumbnails or twin-card layouts) */
  showToggle?: boolean;
  /** Strip the card chrome (border, padding, background) so the viewer fills its parent */
  minimal?: boolean;
  /** Optional className passed to the outer wrapper */
  className?: string;

  // ─── Legacy props — auto-translated through MUSCLE_MAP at the boundary ───
  /** @deprecated pass `trainedMuscles` directly. Auto-translated via MUSCLE_MAP. */
  highlightedMuscle?: string;
  /** @deprecated pass `trainedMuscles` directly. Auto-translated via MUSCLE_MAP. */
  highlightedMuscles?: string[];
  /** @deprecated reserved for future recovery overlay */
  mode?: 'target' | 'recovery';
}

// Total flip duration in ms — used for both the animation and the cleanup
// timer that releases the temporary `<animation>` rule.
const FLIP_DURATION_MS = 1000;

const AnatomyViewer: React.FC<AnatomyViewerProps> = ({
  trainedMuscles,
  readyMuscles,
  highlightedMuscle,
  highlightedMuscles,
  defaultView = 'front',
  showToggle = true,
  minimal = false,
  className = '',
}) => {
  // ── Resolve the active trained-id list ─────────────────────────────────
  // Direct `trainedMuscles` wins. Otherwise auto-translate the legacy
  // `highlightedMuscles` / `highlightedMuscle` strings via MUSCLE_MAP so
  // existing call sites that haven't migrated yet still light up correctly.
  const resolvedTrainedIds = useMemo<string[]>(() => {
    if (trainedMuscles && trainedMuscles.length > 0) return trainedMuscles;
    const legacy: (string | undefined)[] = [];
    if (highlightedMuscles) legacy.push(...highlightedMuscles);
    if (highlightedMuscle) legacy.push(highlightedMuscle);
    if (legacy.length === 0) return [];
    return getTrainedMuscleIds(legacy);
  }, [trainedMuscles, highlightedMuscles, highlightedMuscle]);

  // ── 3D flip mode is enabled only when the toggle is visible AND we're not
  // in minimal/thumbnail mode (which renders just one static face to keep
  // the DOM light when many viewers are mounted at once, e.g. exercise lists).
  const enableFlip = showToggle && !minimal;

  // Continuously-increasing rotation (always rotates FORWARD on every toggle —
  // never reverses — so the body turns naturally regardless of which button
  // the user taps). Even multiples of 360 → front; odd multiples of 180 → back.
  const [rotation, setRotation] = useState<number>(defaultView === 'back' ? 180 : 0);
  const view: 'front' | 'back' = (((rotation % 360) + 360) % 360) === 180 ? 'back' : 'front';

  // The flip animation is driven by an inline @keyframes rule that uses the
  // *previous* rotation as the start angle. While `animFromAngle !== null`
  // the keyframe is active; after the duration we clear it and let the static
  // transform take over.
  const [animFromAngle, setAnimFromAngle] = useState<number | null>(null);
  const [flipId, setFlipId] = useState<number>(0); // unique animation-name per flip

  const [frontText, setFrontText] = useState<string | null>(svgTextCache.front);
  const [backText,  setBackText]  = useState<string | null>(svgTextCache.back);
  const [loading, setLoading] = useState<boolean>(
    enableFlip
      ? !(svgTextCache.front && svgTextCache.back)
      : svgTextCache[view] === null
  );
  const [error, setError] = useState<string | null>(null);

  // Stable per-instance id so multiple viewers on the same page don't collide.
  // useId() may contain ":" — strip it for valid CSS selector usage.
  const rawId = useId();
  const instanceId = useMemo(() => `anatomy-${rawId.replace(/[:]/g, '-')}`, [rawId]);

  // ── Fetch SVG(s) ──
  useEffect(() => {
    let cancelled = false;
    setError(null);

    // Single-face mode (minimal/thumbnails): only fetch the active view.
    if (!enableFlip) {
      if (svgTextCache[view]) {
        if (view === 'front') setFrontText(svgTextCache.front);
        else                  setBackText(svgTextCache.back);
        setLoading(false);
        return;
      }
      setLoading(true);
      loadSvg(view)
        .then(text => {
          if (cancelled) return;
          if (view === 'front') setFrontText(text);
          else                  setBackText(text);
          setLoading(false);
        })
        .catch(err => {
          if (cancelled) return;
          setError(err?.message || 'Failed to load anatomy SVG');
          setLoading(false);
        });
      return () => { cancelled = true; };
    }

    // Dual-face flip mode: load BOTH up-front so the flip is instant.
    if (svgTextCache.front && svgTextCache.back) {
      setFrontText(svgTextCache.front);
      setBackText(svgTextCache.back);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([loadSvg('front'), loadSvg('back')])
      .then(([f, b]) => {
        if (cancelled) return;
        setFrontText(f);
        setBackText(b);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load anatomy SVG');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [enableFlip, view]);

  // ── Cleanup the active flip after its duration so the static transform
  // takes over (without it, the @keyframes rule would linger forever) ──
  useEffect(() => {
    if (animFromAngle === null) return;
    const t = window.setTimeout(() => setAnimFromAngle(null), FLIP_DURATION_MS + 30);
    return () => window.clearTimeout(t);
  }, [animFromAngle, flipId]);

  // ── Toggle handler: always rotate FORWARD by 180° ──
  const handleToggle = (target: 'front' | 'back') => {
    if (target === view) return;
    if (animFromAngle !== null) return; // ignore clicks mid-flip
    const from = rotation;
    setAnimFromAngle(from);
    setFlipId(id => id + 1);
    setRotation(from + 180);
  };

  // ── Generate scoped CSS overriding the SVG's inline classes ──
  const css = useMemo(() => {
    const scope = `#${instanceId}`;
    const trained = (resolvedTrainedIds || []).map(s => s?.trim()).filter(Boolean);
    const trainedSet = new Set(trained);
    // Phase 9 — "ready / fully recovered" green state.
    // Trained always wins, so subtract any overlap before building selectors.
    const ready: string[] = (readyMuscles || [])
      .map((s: string) => (s || '').trim())
      .filter((s: string) => Boolean(s) && !trainedSet.has(s));

    const buildSelectors = (ids: string[]) =>
      ids.length
        ? ids
            .flatMap(id => {
              const safe = escapeForAttrSelector(id);
              return [
                `${scope} [id^="${safe}"]`,
                `${scope} [id^="${safe}"] path`,
                `${scope} [id^="${safe}"] polygon`,
                `${scope} [id^="${safe}"] circle`,
                `${scope} [id^="${safe}"] ellipse`,
                `${scope} path[id^="${safe}"]`,
                `${scope} polygon[id^="${safe}"]`,
              ];
            })
            .join(',\n          ')
        : null;

    const trainedSelectors = buildSelectors(trained);
    const readySelectors = buildSelectors(ready);

    // ── Flip keyframes ──
    // Each click bumps `flipId` so the animation-name changes — that's how
    // the browser knows to restart the animation rather than continue an
    // existing run. The rule is only injected while a flip is in progress.
    const animName = `anatomy-flip-${instanceId}-${flipId}`;
    const flipping = animFromAngle !== null;
    const a0 = animFromAngle ?? 0;
    const a25 = a0 + 45;
    const a50 = a0 + 90;
    const a75 = a0 + 135;
    const a100 = a0 + 180;

    const flipperRest = `transform: rotateY(${rotation}deg) scale(1);`;

    const flipperAnim = flipping ? `
      ${scope} .anatomy-flipper {
        animation: ${animName} ${FLIP_DURATION_MS}ms cubic-bezier(0.65, 0.0, 0.25, 1) forwards;
      }
      @keyframes ${animName} {
        0%   { transform: rotateY(${a0}deg) scale(1); }
        25%  { transform: rotateY(${a25}deg) scale(0.95); }
        50%  { transform: rotateY(${a50}deg) scale(0.86); }
        75%  { transform: rotateY(${a75}deg) scale(0.95); }
        100% { transform: rotateY(${a100}deg) scale(1); }
      }
    ` : '';

    return `
      ${scope} svg {
        width: 100%;
        height: 100%;
        max-height: 100%;
        display: block;
        object-fit: contain;
      }

      /* ── DEFAULT (REST) STATE ─────────────────────────────────────── */
      ${scope} svg path,
      ${scope} svg polygon,
      ${scope} svg circle,
      ${scope} svg ellipse {
        fill: #1a202c !important;
        stroke: #2d3748 !important;
        stroke-width: 0.4;
        opacity: 0.9;
        transition: fill 0.6s ease, opacity 0.6s ease, stroke 0.6s ease;
      }

      ${readySelectors ? `
      /* ── READY (RECOVERED) STATE — Phase 9 green neon ─────────────── */
      ${readySelectors} {
        fill: #10b981 !important;
        stroke: #34d399 !important;
        stroke-width: 0.55 !important;
        opacity: 0.95 !important;
      }
      ` : ''}

      ${trainedSelectors ? `
      /* ── TRAINED (ACTIVE) STATE — flat red, no heavy GPU effects ──── */
      ${trainedSelectors} {
        fill: #ef4444 !important;
        stroke: #f87171 !important;
        stroke-width: 0.6 !important;
        opacity: 1 !important;
      }
      ` : ''}

      /* ── FLIPPER (3D card) ─────────────────────────────────────────── */
      ${scope} .anatomy-flipper {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        transform-style: preserve-3d;
        ${flipperRest}
        will-change: transform;
      }
      ${flipperAnim}
    `;
  }, [resolvedTrainedIds, readyMuscles, instanceId, rotation, animFromAngle, flipId]);

  // ── Spinner / error overlays ──
  const overlays = (
    <>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <div className="w-10 h-10 border-2 border-red-500/20 border-t-red-500 rounded-full animate-spin shadow-[0_0_18px_rgba(255,0,0,0.4)]" />
        </div>
      )}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center text-center px-4 z-30">
          <span className="text-[10px] font-mono uppercase tracking-widest text-red-400/80">
            {error}
          </span>
        </div>
      )}
    </>
  );

  // ── Inner SVG renderer ──
  // In flip mode: both faces are rendered on opposite sides of a 3D card.
  // In single-face mode: just the active SVG.
  const svgStage = enableFlip ? (
    <div
      className="relative w-full h-full"
      style={{ perspective: '1600px' }}
    >
      <div className="anatomy-flipper">
        {/* FRONT FACE */}
        <div
          className="absolute inset-0 w-full h-full flex items-center justify-center"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(0deg)',
          }}
        >
          {frontText && (
            <div
              className="w-full h-full flex items-center justify-center"
              dangerouslySetInnerHTML={{ __html: frontText }}
            />
          )}
        </div>

        {/* BACK FACE — pre-rotated 180° in local space; the parent's flip
            un-mirrors it so the back-anatomy SVG appears as drawn. */}
        <div
          className="absolute inset-0 w-full h-full flex items-center justify-center"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          {backText && (
            <div
              className="w-full h-full flex items-center justify-center"
              dangerouslySetInnerHTML={{ __html: backText }}
            />
          )}
        </div>
      </div>
    </div>
  ) : (
    <div className="relative w-full h-full flex items-center justify-center">
      {view === 'front' && frontText && (
        <div
          className="w-full h-full flex items-center justify-center"
          dangerouslySetInnerHTML={{ __html: frontText }}
        />
      )}
      {view === 'back' && backText && (
        <div
          className="w-full h-full flex items-center justify-center"
          dangerouslySetInnerHTML={{ __html: backText }}
        />
      )}
    </div>
  );

  // ── Inner viewer (style + svg + states), scoped under #instanceId ──
  const inner = (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div
        id={instanceId}
        className="relative w-full h-full"
      >
        {svgStage}
        {overlays}
      </div>
    </>
  );

  // ── Minimal mode: no chrome, fills parent (used by GymTracker thumbnails) ──
  if (minimal) {
    return (
      <div className={`relative w-full h-full overflow-hidden ${className}`}>
        {inner}
      </div>
    );
  }

  // ── Full card mode with toggle ──
  return (
    <div
      className={`relative w-full aspect-[2/3] bg-slate-950/70 rounded-3xl p-4 border border-slate-800 shadow-[0_0_40px_rgba(255,0,0,0.05)] overflow-hidden group ${className}`}
    >
      {/* subtle carbon-fibre texture */}
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />

      {/* corner crosshair ornaments */}
      <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-red-500/40 pointer-events-none z-20" />
      <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-red-500/40 pointer-events-none z-20" />
      <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-red-500/40 pointer-events-none z-20" />
      <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-red-500/40 pointer-events-none z-20" />

      {inner}

      {/* Front / Back toggle */}
      {showToggle && (
        <div className="absolute top-3 right-3 z-30 flex bg-slate-900/85 backdrop-blur-sm rounded-full p-1 border border-slate-700 shadow-lg">
          {(['front', 'back'] as const).map(v => {
            const active = view === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => handleToggle(v)}
                className={`px-3 py-1 text-[10px] font-mono uppercase tracking-[0.15em] rounded-full transition-all duration-300 ${
                  active
                    ? 'bg-red-600 text-white shadow-[0_0_14px_rgba(255,0,0,0.7)]'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {v}
              </button>
            );
          })}
        </div>
      )}

      {/* trained-count readout */}
      {resolvedTrainedIds && resolvedTrainedIds.length > 0 && (
        <div className="absolute bottom-3 left-3 z-30">
          <span className="text-[10px] font-mono text-red-400 uppercase tracking-widest bg-red-500/10 px-2 py-1 rounded border border-red-500/30 shadow-[0_0_10px_rgba(255,0,0,0.15)]">
            {resolvedTrainedIds.length} Active
          </span>
        </div>
      )}
    </div>
  );
};

export default AnatomyViewer;
