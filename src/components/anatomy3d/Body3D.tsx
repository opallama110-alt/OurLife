import { lazy, ReactNode, Suspense, useCallback, useEffect, useState } from 'react';
import type { BodyGender } from '../hud/BodyAnatomy';
import { prefersReducedMotion } from '../../hooks/usePresence';

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

const Body3DCanvas = lazy(() => import('./Body3DCanvas'));

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

export type Body3DMode = '3d' | '2d';

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
  const can3D = !failed && supportsWebGL2();
  const mode: Body3DMode = can3D && ready ? '3d' : '2d';

  useEffect(() => { onModeChange?.(mode); }, [mode, onModeChange]);

  // Stable callbacks keep the memoised canvas from re-rendering when the
  // host does (hosts like the Dashboard tick every second).
  const handleReady = useCallback(() => setReady(true), []);
  const handleError = useCallback((err: unknown) => {
    console.error('[Body3D] falling back to 2D:', err);
    setFailed(true);
  }, []);

  return (
    <div className={`body3d ${className}`.trim()} data-mode={mode}>
      {mode === '2d' && <div className="body3d-fallback">{fallback}</div>}
      {can3D && (
        <Suspense fallback={null}>
          <Body3DCanvas
            gender={gender}
            highlighted={highlighted}
            autoRotate={autoRotate}
            reducedMotion={prefersReducedMotion()}
            facing={facing}
            facingKey={facingKey}
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
