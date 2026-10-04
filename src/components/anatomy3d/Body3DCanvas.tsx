import { memo, useEffect, useRef, useState } from 'react';
import type { BodyGender } from '../hud/BodyAnatomy';
import { bodyBaseColor, extractSilhouette, loadBodySvg, renderFace, type Silhouette } from './bodyArt';
import { buildBodyMesh } from './bodyMesh';
import type { FaceMapping } from './bodyMaterial';
import { BodyScene } from './BodyScene';

// ─────────────────────────────────────────────────────────────────────────
// Body3DCanvas — the WebGL half of <Body3D>, loaded lazily so three.js
// never weighs on the main bundle. Public API lives in Body3D.tsx.
// ─────────────────────────────────────────────────────────────────────────

/** Texture resolution relative to the 432×648 art. */
const TEXTURE_SCALE = 2;

export interface Body3DCanvasProps {
  gender: BodyGender;
  /** Muscle SVG id prefixes lit red (MUSCLE_MAP / FRONT|BACK_MUSCLE_IDS values). */
  highlighted: readonly string[];
  autoRotate: boolean;
  reducedMotion: boolean;
  /** Face to turn to; re-applied whenever it or `facingKey` changes. */
  facing?: 'front' | 'back';
  facingKey?: string | number;
  /** First frame is on screen. */
  onReady: () => void;
  /** The canvas is shown; only then is it focusable / keyboard-operable. */
  interactive: boolean;
  /** WebGL or asset failure — the host shows its 2D fallback instead. */
  onError: (err: unknown) => void;
  className?: string;
  label: string;
}

/** Affine map from front-art coordinates to the (mirrored) back art. */
function faceMapping(front: Silhouette, back: Silhouette): FaceMapping {
  return {
    frontCx: (front.minX + front.maxX) / 2,
    backCx: (back.minX + back.maxX) / 2,
    scaleX: (back.maxX - back.minX) / (front.maxX - front.minX),
    frontY0: front.minY,
    backY0: back.minY,
    scaleY: (back.maxY - back.minY) / (front.maxY - front.minY),
  };
}

// Mesh + mapping depend only on the art, so build them once per gender.
interface BodyAssets {
  frontSvg: string;
  backSvg: string;
  front: Silhouette;
  back: Silhouette;
  mapping: FaceMapping;
}
const assetCache = new Map<BodyGender, Promise<BodyAssets>>();

function loadAssets(gender: BodyGender): Promise<BodyAssets> {
  let p = assetCache.get(gender);
  if (!p) {
    p = (async () => {
      const [frontSvg, backSvg] = await Promise.all([loadBodySvg(gender, 'front'), loadBodySvg(gender, 'back')]);
      const [front, back] = await Promise.all([
        extractSilhouette(frontSvg, 'front'),
        extractSilhouette(backSvg, 'back'),
      ]);
      return { frontSvg, backSvg, front, back, mapping: faceMapping(front, back) };
    })();
    p.catch(() => assetCache.delete(gender));
    assetCache.set(gender, p);
  }
  return p;
}

// Rendered face textures keyed by gender + highlight set. Revisiting a page
// (or flipping between two highlight sets) then skips the SVG raster pass.
// Each entry pins two ~4.5 MB canvases for the session, so keep it small.
const FACE_CACHE_LIMIT = 2;
const faceCache = new Map<string, Promise<[HTMLCanvasElement, HTMLCanvasElement]>>();

function renderFaces(gender: BodyGender, assets: BodyAssets, lit: readonly string[]) {
  const key = `${gender}|${lit.join('|')}`;
  let p = faceCache.get(key);
  if (p) {
    faceCache.delete(key);            // refresh LRU position
  } else {
    p = Promise.all([
      renderFace(assets.frontSvg, 'front', gender, lit, TEXTURE_SCALE),
      renderFace(assets.backSvg, 'back', gender, lit, TEXTURE_SCALE),
    ]);
    p.catch(() => faceCache.delete(key));
  }
  faceCache.set(key, p);
  while (faceCache.size > FACE_CACHE_LIMIT) faceCache.delete(faceCache.keys().next().value as string);
  return p;
}

function Body3DCanvas({
  gender,
  highlighted,
  autoRotate,
  reducedMotion,
  facing,
  facingKey,
  interactive,
  onReady,
  onError,
  className = '',
  label,
}: Body3DCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<BodyScene | null>(null);
  const loadedGenderRef = useRef<BodyGender | null>(null);
  // Latest props for async callbacks without re-running effects.
  const highlightRef = useRef(highlighted);
  highlightRef.current = highlighted;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const highlightKey = highlighted.join('|');
  // Which highlight set the textures currently show, and a tick bumped when a
  // body finishes loading so a highlight change made mid-load is applied.
  const renderedKeyRef = useRef('');
  const [loadedTick, setLoadedTick] = useState(0);

  // ── Renderer lifetime ──
  // The canvas is created here rather than rendered by React: dispose()
  // force-loses its context, so a remount (StrictMode, route changes) must
  // never be handed the same, already-dead canvas.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);
    let scene: BodyScene;
    try {
      scene = new BodyScene(canvas, {
        autoRotate,
        reducedMotion,
        onContextLost: () => onErrorRef.current(new Error('WebGL context lost')),
        // Ready only once pixels are on the canvas: a body that loads while
        // scrolled off screen keeps the 2D fallback until it is really drawn.
        onFirstFrame: () => onReadyRef.current(),
      });
    } catch (err) {
      canvas.remove();
      onErrorRef.current(err);
      return;
    }
    sceneRef.current = scene;
    const ro = new ResizeObserver(entries => {
      const box = entries[0]?.contentRect;
      if (box) scene.resize(box.width, box.height);
    });
    ro.observe(host);
    return () => {
      ro.disconnect();
      scene.dispose();
      canvas.remove();
      sceneRef.current = null;
      loadedGenderRef.current = null;
      renderedKeyRef.current = '';
    };
    // The renderer is created once; option changes are pushed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { sceneRef.current?.setAutoRotate(autoRotate); }, [autoRotate]);
  useEffect(() => { sceneRef.current?.setReducedMotion(reducedMotion); }, [reducedMotion]);

  // Turn to the requested face once a body is on screen (and on each change).
  useEffect(() => {
    if (facing && loadedTick > 0) sceneRef.current?.turnTo(facing);
  }, [facing, facingKey, loadedTick]);

  // ── Body for the current gender ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const assets = await loadAssets(gender);
      const lit = highlightRef.current;
      const [front, back] = await renderFaces(gender, assets, lit);
      const scene = sceneRef.current;
      if (cancelled || !scene) return;
      scene.setBody(buildBodyMesh(assets.front, gender), front, back, assets.mapping, bodyBaseColor(gender));
      loadedGenderRef.current = gender;
      renderedKeyRef.current = lit.join('|');
      setLoadedTick(t => t + 1);
    })().catch(err => { if (!cancelled) onErrorRef.current(err); });
    return () => { cancelled = true; };
  }, [gender]);

  // ── Highlights: re-render the face textures, keep the old ones until ready ──
  useEffect(() => {
    if (loadedGenderRef.current !== gender || renderedKeyRef.current === highlightKey) return;
    let cancelled = false;
    (async () => {
      const assets = await loadAssets(gender);
      const lit = highlightRef.current;
      const [front, back] = await renderFaces(gender, assets, lit);
      if (cancelled || loadedGenderRef.current !== gender) return;
      sceneRef.current?.updateTextures(front, back);
      renderedKeyRef.current = lit.join('|');
    })().catch(err => { if (!cancelled) console.error('[Body3D] highlight update failed:', err); });
    return () => { cancelled = true; };
  }, [gender, highlightKey, loadedTick]);

  // Keyboard: arrows turn the body 45° at a time, Enter/Space flips it.
  // Modified keys (Alt+← = back, …) and auto-repeat pass through untouched.
  const onKeyDown = (e: {
    key: string; repeat: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean;
    preventDefault: () => void;
  }) => {
    const scene = sceneRef.current;
    if (!scene || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    const step = Math.PI / 4;
    if (e.key === 'ArrowLeft') scene.turnBy(-step);
    else if (e.key === 'ArrowRight') scene.turnBy(step);
    else if (e.key === 'Enter' || e.key === ' ') scene.turnBy(Math.PI);
    else return;
    e.preventDefault();
  };

  return (
    <div
      ref={hostRef}
      className={`body3d-canvas ${className}`.trim()}
      role="img"
      aria-roledescription="model 3D"
      aria-label={label}
      aria-hidden={!interactive}
      tabIndex={interactive ? 0 : -1}
      onKeyDown={onKeyDown}
      // A mouse click shouldn't focus it (then Space would turn the body
      // instead of scrolling); keyboard users reach it with Tab.
      onMouseDown={(e: { preventDefault: () => void }) => e.preventDefault()}
    />
  );
}

export default memo(Body3DCanvas);
