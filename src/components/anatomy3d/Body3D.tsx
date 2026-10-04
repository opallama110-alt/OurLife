import { lazy, ReactNode, Suspense, useCallback, useEffect, useState } from 'react';
import type { BodyGender } from '../hud/BodyAnatomy';
import { prefersReducedMotion } from '../../hooks/usePresence';
import type { Body3DCanvasProps } from './Body3DCanvas';

// ─────────────────────────────────────────────────────────────────────────
// Body3D — rotating 3D anatomy avatar (both genders) with highlighted
// muscle groups. Replaces the FRONT/BACK toggle: the body turns by itself
// and follows the user's finger when dragged.
//
// The WebGL part (three.js) is code-split and only fetched when a Body3D
// mounts. Until the first 3D frame is ready — and whenever WebGL2 is
// missing or the GPU drops the context — the host's 2D `fallback` is shown
// instead, so the card is never empty.
// ─────────────────────────────────────────────────────────────────────────

// After a deploy the old chunk name can 404; without this catch React.lazy
// would throw to the nearest error boundary (none) and take the page down.
// Resolve to a stub that reports the failure so the 2D view stays.
function Body3DUnavailable({ onError }: Body3DCanvasProps) {
  useEffect(() => { onError(new Error('3D chunk failed to load')); }, [onError]);
  return null;
}
const Body3DCanvas = lazy(() => import('./Body3DCanvas').catch(() => ({ default: Body3DUnavailable })));

/** prefers-reduced-motion, kept live (users can flip it while the app runs). */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}

let webgl2Support: boolean | null = null;
/** three.js r163+ requires WebGL2; probe once per session. */
export function supportsWebGL2(): boolean {
  if (webgl2Support !== null) return webgl2Support;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    webgl2Support = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webgl2Support = false;
  }
  return webgl2Support;
}

/**
 * '3d'      — the 3D body is on screen.
 * 'loading' — 3D is coming (WebGL2 present); the 2D fallback shows meanwhile.
 * '2d'      — no 3D on this device / after a failure: the fallback stays.
 * Hosts keep 2D-only controls (the FRONT/BACK toggle) for '2d', so they
 * don't flash on and off while 3D loads.
 */
export type Body3DMode = '3d' | 'loading' | '2d';

/** Mode a host should assume before <Body3D> reports one. */
export const initialBody3DMode = (): Body3DMode => (supportsWebGL2() ? 'loading' : '2d');

/** Matches the .body3d-canvas opacity transition (--dur-4). */
const FADE_MS = 420;

export interface Body3DProps {
  gender: BodyGender;
  /** Muscle SVG id prefixes to light up red (same ids as the 2D views). */
  highlighted?: readonly string[];
  /** Spin on its own when idle. Default true (off under reduced motion). */
  autoRotate?: boolean;
  /**
   * Turn to this face (e.g. where the exercise's main muscle is). Applied
   * again whenever it or `facingKey` changes; auto-rotation resumes after.
   */
  facing?: 'front' | 'back';
  facingKey?: string | number;
  /** 2D view shown while 3D loads, or instead of it when unavailable. */
  fallback: ReactNode;
  /** Reports whether the 3D body or the 2D fallback is on screen. */
  onModeChange?: (mode: Body3DMode) => void;
  className?: string;
  /** Accessible description of what the body shows. */
  label?: string;
}

const NONE: readonly string[] = [];

export default function Body3D({
  gender,
  highlighted = NONE,
  autoRotate = true,
  facing,
  facingKey,
  fallback,
  onModeChange,
  className = '',
  label = 'Model anatomi 3D — geser untuk memutar',
}: Body3DProps) {
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  // The fallback stays mounted under the canvas until its fade-in is done,
  // so the hand-over never shows an empty frame.
  const [faded, setFaded] = useState(false);
  const reducedMotion = useReducedMotion();
  const can3D = !failed && supportsWebGL2();
  const mode: Body3DMode = !can3D ? '2d' : ready ? '3d' : 'loading';

  useEffect(() => { onModeChange?.(mode); }, [mode, onModeChange]);
  useEffect(() => {
    if (mode !== '3d') { setFaded(false); return; }
    const t = window.setTimeout(() => setFaded(true), FADE_MS);
    return () => window.clearTimeout(t);
  }, [mode]);

  // Stable callbacks keep the memoised canvas from re-rendering when the
  // host does (hosts like the Dashboard tick every second).
  const handleReady = useCallback(() => setReady(true), []);
  const handleError = useCallback((err: unknown) => {
    console.error('[Body3D] falling back to 2D:', err);
    setFailed(true);
  }, []);

  return (
    <div className={`body3d ${className}`.trim()} data-mode={mode}>
      {(mode !== '3d' || !faded) && <div className="body3d-fallback">{fallback}</div>}
      {can3D && (
        <Suspense fallback={null}>
          <Body3DCanvas
            gender={gender}
            highlighted={highlighted}
            autoRotate={autoRotate}
            reducedMotion={reducedMotion}
            facing={facing}
            facingKey={facingKey}
            interactive={ready}
            onReady={handleReady}
            onError={handleError}
            className={ready ? 'is-ready' : ''}
            label={label}
          />
        </Suspense>
      )}
    </div>
  );
}
