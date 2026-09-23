import React, { ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../../hooks/usePresence';

// ─────────────────────────────────────────────────────────────────────────
// BodyTurntable — the "puter balik badan" stage shared by the Dashboard
// Muscle Recovery card and the Gym active-session anatomy.
//
// A real 3D turntable: `.bt-card` is a preserve-3d card with the front face
// and a pre-rotated (180°) back face, both backface-hidden, under a
// perspective stage. The angle is driven by a small spring integrator that
// writes transforms straight to the DOM via refs — React never re-renders
// during a turn, so the host page (which may tick every second) stays idle.
//
// Interaction:
//   • Controlled `view` prop — flipping it turns the body forward 180°.
//   • Horizontal drag/swipe rotates the body under the finger; on release it
//     snaps (with the flick's velocity) to the nearest face and reports the
//     new face through `onViewChange`. Vertical scrolling is left to the
//     browser (`touch-action: pan-y`).
//
// Depth cues (all derived from the live angle each frame): a floor glow that
// squashes when the body is edge-on, a cyan rim-light band that sweeps
// across in the turn direction, faces dimming as they turn away, and a
// hologram scan band while turning.
//
// §5.3: `.bt-card` and every ancestor up to the stage must stay free of
// `filter` / `mix-blend-mode` / `opacity < 1` — they would flatten 3D.
// ─────────────────────────────────────────────────────────────────────────

export type TurntableView = 'front' | 'back';

// Spring tuned for a ~0.55s half-turn with a ~3-4° settle overshoot
// (damping ratio ≈ 0.78) — weighty enough to read as a body turning,
// never floaty or wobbly.
const STIFFNESS = 85;
const DAMPING = 14.4;
const REST_EPS_ANGLE = 0.04;
const REST_EPS_VEL = 0.6;

const HINT_KEY = 'ol_turntable_hint_seen';

const faceOf = (angle: number): TurntableView =>
  (((Math.round(angle / 180) % 2) + 2) % 2) === 0 ? 'front' : 'back';

export interface BodyTurntableProps {
  view: TurntableView;
  onViewChange?: (view: TurntableView) => void;
  front: ReactNode;
  back: ReactNode;
  /** Allow horizontal drag / swipe to rotate. Default true. */
  swipe?: boolean;
  /** Show the one-time "geser untuk memutar" hint. Default true when swipe is on. */
  hint?: boolean;
  className?: string;
  /** Overlays (toggle, readouts) rendered above the 3D stage. */
  children?: ReactNode;
}

export default function BodyTurntable({
  view,
  onViewChange,
  front,
  back,
  swipe = true,
  hint = true,
  className = '',
  children,
}: BodyTurntableProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const floorRef = useRef<HTMLDivElement>(null);
  const rimRef = useRef<HTMLDivElement>(null);
  const faceFrontRef = useRef<HTMLDivElement>(null);
  const faceBackRef = useRef<HTMLDivElement>(null);

  const angleRef = useRef(view === 'back' ? 180 : 0);
  const velRef = useRef(0);          // deg/s
  const targetRef = useRef(angleRef.current);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);

  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;

  const [showHint, setShowHint] = useState(() => {
    if (!swipe || !hint) return false;
    try { return localStorage.getItem(HINT_KEY) !== '1'; } catch { return false; }
  });

  // ── Paint one frame from the current angle (pure DOM writes) ──
  const paint = useCallback((angle: number) => {
    const rad = (angle * Math.PI) / 180;
    const c = Math.abs(Math.cos(rad));
    const s = Math.sin(rad);
    const edge = Math.abs(s);                  // 0 face-on → 1 edge-on
    const card = cardRef.current;
    if (card) {
      // Slight shrink at edge-on sells depth without a fake scaleX squash.
      card.style.transform = `rotateY(${angle.toFixed(3)}deg) scale(${(1 - 0.05 * edge).toFixed(4)})`;
    }
    const floor = floorRef.current;
    if (floor) {
      floor.style.transform = `translateX(-50%) scaleX(${(0.42 + 0.58 * c).toFixed(4)})`;
      floor.style.opacity = (0.55 + 0.45 * c).toFixed(3);
    }
    const rim = rimRef.current;
    if (rim) {
      // Light band sweeps across the body over each half-turn (following the
      // turn direction for free, since the phase runs backwards on a reverse
      // drag) and peaks when the body is edge-on. It is invisible at phase
      // 0/1, so the wrap-around between half-turns never shows.
      const phase = (((angle % 180) + 180) % 180) / 180;
      rim.style.opacity = Math.pow(edge, 1.3).toFixed(3);
      rim.style.transform = `translateX(${((phase - 0.5) * 120).toFixed(2)}%)`;
    }
    // Faces dim toward edge-on, as if turning away from the light. Opacity on
    // the leaf faces (already their own 3D layers) is a compositor-only
    // update — no SVG re-raster, and unlike an overlay it darkens only the
    // body, never its bounding box. (Never set opacity on .bt-card itself:
    // that would flatten the 3D card and break backface culling.)
    const dim = (1 - 0.55 * edge).toFixed(3);
    if (faceFrontRef.current) faceFrontRef.current.style.opacity = dim;
    if (faceBackRef.current) faceBackRef.current.style.opacity = dim;
    const stage = stageRef.current;
    if (stage) {
      const turning = edge > 0.02;
      if (turning !== stage.hasAttribute('data-turning')) {
        if (turning) stage.setAttribute('data-turning', '');
        else stage.removeAttribute('data-turning');
      }
    }
  }, []);

  const stopLoop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  };

  // ── Spring toward targetRef ──
  const startLoop = useCallback(() => {
    if (rafRef.current) return;
    lastTsRef.current = performance.now();
    const tick = (now: number) => {
      // Clamp dt so a backgrounded tab / dropped frames can't explode the sim.
      const dt = Math.min(0.032, Math.max(0.001, (now - lastTsRef.current) / 1000));
      lastTsRef.current = now;
      const x = angleRef.current - targetRef.current;
      const a = -STIFFNESS * x - DAMPING * velRef.current;
      velRef.current += a * dt;
      angleRef.current += velRef.current * dt;
      if (Math.abs(angleRef.current - targetRef.current) < REST_EPS_ANGLE && Math.abs(velRef.current) < REST_EPS_VEL) {
        angleRef.current = targetRef.current;
        velRef.current = 0;
        paint(angleRef.current);
        rafRef.current = 0;
        return;
      }
      paint(angleRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [paint]);

  const goTo = useCallback((target: number, initialVel = 0) => {
    targetRef.current = target;
    if (prefersReducedMotion()) {
      stopLoop();
      angleRef.current = target;
      velRef.current = 0;
      paint(target);
      return;
    }
    velRef.current = initialVel;
    startLoop();
  }, [paint, startLoop]);

  // First paint before the browser shows anything.
  useLayoutEffect(() => { paint(angleRef.current); }, [paint]);
  useEffect(() => () => stopLoop(), []);

  // ── Controlled view: when the parent asks for the other face, keep
  // turning FORWARD (+180°) — a turntable never un-spins, and a tap mid-turn
  // is never dropped (it just queues the next half-turn with momentum). If
  // the requested face already matches where we're headed (e.g. we just
  // reported it after a drag), there's nothing to do. Layout effect so the
  // spring starts on the very next frame after the tap's render. ──
  useLayoutEffect(() => {
    if (faceOf(targetRef.current) === view) return;
    goTo(targetRef.current + 180, velRef.current);
  }, [view, goTo]);

  // ── Drag / swipe ──
  const dragRef = useRef<{
    id: number; x0: number; y0: number; a0: number;
    active: boolean; lastX: number; lastT: number; v: number; degPerPx: number;
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!swipe) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Let overlay controls (toggle buttons, links) keep their own taps.
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    const width = stageRef.current?.clientWidth || 300;
    dragRef.current = {
      id: e.pointerId, x0: e.clientX, y0: e.clientY, a0: angleRef.current,
      active: false, lastX: e.clientX, lastT: performance.now(), v: 0,
      // Dragging across ~85% of the stage = one half-turn.
      degPerPx: 180 / Math.max(160, width * 0.85),
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.active) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { dragRef.current = null; return; }
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      d.active = true;
      // Re-anchor so the body doesn't jump by the 8px activation slop.
      d.x0 = e.clientX;
      d.a0 = angleRef.current;
      stopLoop();
      velRef.current = 0;
      try { stageRef.current?.setPointerCapture(e.pointerId); } catch { /* capture is best-effort */ }
      stageRef.current?.setAttribute('data-dragging', '');
      if (showHint) {
        setShowHint(false);
        try { localStorage.setItem(HINT_KEY, '1'); } catch { /* private mode — hint just reappears */ }
      }
    }
    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    // Exponential smoothing keeps one jittery sample from deciding the flick.
    const instV = ((e.clientX - d.lastX) * d.degPerPx) / (dt / 1000);
    d.v = d.v * 0.6 + instV * 0.4;
    d.lastX = e.clientX;
    d.lastT = now;
    angleRef.current = d.a0 + (e.clientX - d.x0) * d.degPerPx;
    velRef.current = d.v;
    paint(angleRef.current);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null;
    stageRef.current?.removeAttribute('data-dragging');
    if (!d.active) return;
    try { stageRef.current?.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    // A finger lifted after pausing shouldn't fling.
    const v = performance.now() - d.lastT > 90 ? 0 : d.v;
    // Project where momentum would carry the body, then snap to a face —
    // but never more than one half-turn past where the drag began.
    const projected = angleRef.current + v * 0.16;
    const base = Math.round(d.a0 / 180) * 180;
    const snapped = Math.max(base - 180, Math.min(base + 180, Math.round(projected / 180) * 180));
    goTo(snapped, v);
    const face = faceOf(snapped);
    if (face !== view) onViewChangeRef.current?.(face);
  };

  return (
    <div
      ref={stageRef}
      className={`bt-stage ${swipe ? 'is-swipeable' : ''} ${className}`.trim()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="bt-floor" ref={floorRef} aria-hidden="true" />
      <div className="bt-card" ref={cardRef}>
        <div className="bt-face bt-face--front" ref={faceFrontRef} aria-hidden={view !== 'front'}>{front}</div>
        <div className="bt-face bt-face--back" ref={faceBackRef} aria-hidden={view !== 'back'}>{back}</div>
      </div>
      <div className="bt-rim" ref={rimRef} aria-hidden="true" />
      <div className="bt-scan" aria-hidden="true" />
      {showHint && (
        <div className="bt-hint" aria-hidden="true">
          <span className="bt-hint-arrow">‹</span>
          GESER
          <span className="bt-hint-arrow">›</span>
        </div>
      )}
      {children}
    </div>
  );
}

// ── Segmented FRONT/BACK control with a sliding thumb ──
export interface BodyViewToggleProps {
  view: TurntableView;
  onChange: (view: TurntableView) => void;
  className?: string;
}

export function BodyViewToggle({ view, onChange, className = '' }: BodyViewToggleProps) {
  return (
    <div className={`d-body-toggle ${className}`.trim()} data-view={view} role="group" aria-label="Tampilan tubuh">
      <button
        type="button"
        className={`d-body-toggle-opt ${view === 'front' ? 'is-on' : ''}`}
        aria-pressed={view === 'front'}
        onClick={() => onChange('front')}
      >FRONT</button>
      <button
        type="button"
        className={`d-body-toggle-opt ${view === 'back' ? 'is-on' : ''}`}
        aria-pressed={view === 'back'}
        onClick={() => onChange('back')}
      >BACK</button>
    </div>
  );
}
