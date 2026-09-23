import React, { useEffect, useId, useMemo, useState } from 'react';
import { getTrainedMuscleIds } from '../../constants/muscleMapping';
import BodyTurntable, { BodyViewToggle, TurntableView } from '../hud/BodyTurntable';

/**
 * AnatomyViewer (Solo Leveling aesthetic + shared 3D turntable)
 * ───────────────────────────────────────────────────────────────────────
 * Interactive anatomy viewer that loads BOTH full-body SVG files (front +
 * back) and mounts them on the two faces of the shared <BodyTurntable> —
 * the same real-3D, swipeable turn used by the Dashboard Muscle Recovery
 * card, so the body turns identically everywhere in the app.
 *
 * "Trained" muscles light up red-neon (Solo Leveling); "rest" muscles
 * fall back to a dark inactive state. Trained muscles are matched by
 * SVG <path>/<g> id PREFIX (Illustrator appended a unique suffix to
 * every id, so we use `[id^="..."]` attribute selectors).
 *
 * View can be uncontrolled (`defaultView`) or controlled (`view` +
 * `onViewChange`) — the Gym active session drives it from its own toggle.
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

// ── Per-file class scoping ──
// Both Illustrator exports ship a <style> with the SAME generic class names
// (.st0 … .st8) but different meanings. Inlined into one document those
// rules go global, so with both faces mounted the back file's
// `.st0{display:none}` also hid the front file's `.st0` body piece. Prefixing
// every class with the view keeps each file's rules to itself.
const scopeSvgClasses = (text: string, view: 'front' | 'back'): string =>
  text
    .replace(/<style([^>]*)>([\s\S]*?)<\/style>/g, (_m, attrs: string, css: string) =>
      `<style${attrs}>${css.replace(/\.st(\d+)/g, `.${view}-st$1`)}</style>`)
    .replace(/class="([^"]*)"/g, (_m, cls: string) =>
      `class="${cls.replace(/\bst(\d+)\b/g, `${view}-st$1`)}"`);

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
    .then(raw => {
      const text = scopeSvgClasses(raw, view);
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
  /** Initial view (uncontrolled mode) */
  defaultView?: 'front' | 'back';
  /** Controlled view. When set, pair with `onViewChange`. */
  view?: 'front' | 'back';
  /** Fires on toggle taps and on swipe-to-rotate snaps. */
  onViewChange?: (view: 'front' | 'back') => void;
  /** Show the built-in FRONT/BACK toggle (card chrome only). */
  showToggle?: boolean;
  /**
   * Draw the viewer's own card frame (border, corners, readout). Turn off
   * when the host already provides a stage (e.g. Gym active session).
   */
  chrome?: boolean;
  /**
   * Single static face, no turntable — for thumbnails where many viewers
   * are mounted at once (exercise lists, onboarding preview).
   */
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

const AnatomyViewer: React.FC<AnatomyViewerProps> = ({
  trainedMuscles,
  readyMuscles,
  highlightedMuscle,
  highlightedMuscles,
  defaultView = 'front',
  view: viewProp,
  onViewChange,
  showToggle = true,
  chrome = true,
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

  // Turntable (both faces mounted) everywhere except minimal thumbnails,
  // which render just one static face to keep list DOM light.
  const enableFlip = !minimal;

  // Controlled when `view` is passed; otherwise own the state.
  const [innerView, setInnerView] = useState<TurntableView>(defaultView);
  const view: TurntableView = viewProp ?? innerView;
  const setView = (v: TurntableView) => {
    if (viewProp === undefined) setInnerView(v);
    onViewChange?.(v);
  };

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
  // Single-face mode depends on `view`; flip mode loads both once and must
  // NOT refetch/re-render per turn, hence the conditional dependency.
  const fetchKey = enableFlip ? 'both' : view;
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

    // Dual-face turntable mode: load BOTH up-front so the turn is instant.
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
    // `view` is folded into `fetchKey` for single-face mode only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableFlip, fetchKey]);

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

    return `
      ${scope} svg {
        width: 100%;
        height: 100%;
        max-height: 100%;
        display: block;
        object-fit: contain;
      }

      /* ── DEFAULT (UNTOUCHED) STATE ────────────────────────────────────
         Project Chimera Phase 2: Solid colored fills are GONE. Every muscle
         renders as a dark base body; status (rested vs exhausted) is conveyed
         purely through colored OUTLINES + AI System notifications. ───────── */
      ${scope} svg path,
      ${scope} svg polygon,
      ${scope} svg circle,
      ${scope} svg ellipse {
        fill: #0f172a !important;
        stroke: #1e293b !important;
        stroke-width: 0.4;
        opacity: 0.95;
        transition: fill 0.6s ease, stroke 0.6s ease, stroke-width 0.4s ease, opacity 0.6s ease;
      }

      ${readySelectors ? `
      /* ── RESTED / READY ─────────────────────────────────────────────
         Grey neutral outline. The Dashboard's ✓ Ready chip carries the
         explicit text signal now, so the SVG outline doesn't need to
         compete — drop-shadow filter removed (1 paint op vs filter pass
         per state change), stroke-width softened. */
      ${readySelectors} {
        fill: #0f172a !important;
        stroke: #94a3b8 !important;
        stroke-width: 1.0 !important;
        opacity: 1 !important;
      }
      ` : ''}

      ${trainedSelectors ? `
      /* ── EXHAUSTED / RECOVERING ─────────────────────────────────────
         Translucent red fill + edge stroke. Anatomy stays readable
         underneath (translucent ≠ flood), and dropping the drop-shadow
         filter trades a per-path filter pass for a single paint op —
         this is the real fix for the muscle picker's perceived "search
         lag" across Dashboard, GymTracker picker, and active session. */
      ${trainedSelectors} {
        fill: rgba(239, 68, 68, 0.45) !important;
        stroke: #ef4444 !important;
        stroke-width: 1.2 !important;
        opacity: 1 !important;
      }
      ` : ''}
    `;
  }, [resolvedTrainedIds, readyMuscles, instanceId]);

  // ── Spinner / error overlays ──
  const overlays = (
    <>
      {loading && (
        <div className="av-overlay" aria-hidden="true">
          <span className="av-spinner" />
        </div>
      )}
      {error && !loading && (
        <div className="av-overlay av-overlay--error">
          <span>{error}</span>
        </div>
      )}
    </>
  );

  const face = (text: string | null) => (
    text ? <div className="av-face" dangerouslySetInnerHTML={{ __html: text }} /> : <div className="av-face" />
  );

  // ── Inner SVG renderer ──
  // Turntable mode: both faces on the shared 3D card (tap or swipe to turn).
  // Single-face mode: just the active SVG.
  const svgStage = enableFlip ? (
    <BodyTurntable
      view={view}
      onViewChange={setView}
      front={face(frontText)}
      back={face(backText)}
    />
  ) : (
    <div className="av-single">
      {view === 'front' && frontText && face(frontText)}
      {view === 'back' && backText && face(backText)}
    </div>
  );

  // ── Inner viewer (style + svg + states), scoped under #instanceId ──
  const inner = (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div id={instanceId} className="av-inner">
        {svgStage}
        {overlays}
      </div>
    </>
  );

  // ── Minimal / chromeless: no frame, fills parent ──
  if (minimal || !chrome) {
    return (
      <div className={`av-root ${minimal ? 'is-minimal' : ''} ${className}`.trim()}>
        {inner}
      </div>
    );
  }

  // ── Full card mode with toggle ──
  return (
    <div className={`av-card ${className}`.trim()}>
      {/* corner crosshair ornaments */}
      <span className="av-corner av-corner--tl" aria-hidden="true" />
      <span className="av-corner av-corner--tr" aria-hidden="true" />
      <span className="av-corner av-corner--bl" aria-hidden="true" />
      <span className="av-corner av-corner--br" aria-hidden="true" />

      {inner}

      {showToggle && <BodyViewToggle view={view} onChange={setView} className="av-toggle" />}

      {/* trained-count readout */}
      {resolvedTrainedIds && resolvedTrainedIds.length > 0 && (
        <div className="av-readout">{resolvedTrainedIds.length} Active</div>
      )}
    </div>
  );
};

export default AnatomyViewer;
