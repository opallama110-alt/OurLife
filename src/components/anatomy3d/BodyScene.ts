import {
  AdditiveBlending,
  CanvasTexture,
  CircleGeometry,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from 'three';
import { createBodyMaterial, rawColor, type FaceMapping } from './bodyMaterial';
import type { BodyMesh } from './bodyMesh';

// ─────────────────────────────────────────────────────────────────────────
// BodyScene — owns the WebGL renderer, the turning body and the input.
//
//   • Auto-rotates slowly; a horizontal drag/swipe turns the body under the
//     finger, a flick keeps spinning with inertia, and auto-rotation
//     resumes a moment after the user lets go.
//   • The render loop only runs while the canvas is on screen, the tab is
//     visible and something is actually moving — an idle body costs nothing.
//   • prefers-reduced-motion: no auto-rotation, no scanline drift.
//   • Everything GPU-side is released in dispose(), including the context
//     itself, so pages that mount/unmount the viewer never leak contexts.
// ─────────────────────────────────────────────────────────────────────────

// Auto-rotation lingers on the front and back (where the muscle art is
// sharpest) and moves briskly through the side views: speed follows sin².
const AUTO_SPEED_MIN = 0.26;      // rad/s, facing front/back
const AUTO_SPEED_MAX = 0.95;      // rad/s, edge-on  → one turn ≈ 14 s
const AUTO_FRAME_MS = 32;         // ~30 fps is plenty for a slow turn
const RESUME_AFTER_MS = 2500;     // idle time before auto-rotation resumes
const DRAG_GAIN = 0.011;          // rad per CSS px
const FRICTION = 3.2;             // inertia decay (1/s)
const TURN_RATE = 5.5;            // ease rate when turning to a face (1/s)
// A touch only becomes a turn once it clearly moves sideways; a mostly
// vertical start is a page scroll and leaves the body alone.
const DRAG_SLOP = 8;              // CSS px of horizontal travel to start a turn
const SCROLL_SLOP = 10;           // CSS px of vertical travel that means "scroll"
const FOV = 30;

const FLOOR_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FLOOR_FRAG = /* glsl */ `
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float glow = smoothstep(1.0, 0.0, d) * 0.35 + smoothstep(0.08, 0.0, abs(d - 0.78)) * 0.5;
  gl_FragColor = vec4(uColor * glow, glow);
}`;

export interface BodySceneOptions {
  autoRotate: boolean;
  reducedMotion: boolean;
  /** The GPU dropped the context; the host should fall back to 2D. */
  onContextLost?: () => void;
  /** A body set with setBody() has actually been drawn for the first time. */
  onFirstFrame?: () => void;
}

export class BodyScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FOV, 1, 1, 4000);
  private readonly pivot = new Group();
  private readonly floor: Mesh<CircleGeometry, ShaderMaterial>;
  private body: Mesh | null = null;
  private material: ShaderMaterial | null = null;
  private frontTex: CanvasTexture | null = null;
  private backTex: CanvasTexture | null = null;
  private bodyHeight = 520;
  private bodyWidth = 190;

  private angle = 0;
  private velocity = 0;
  /** Angle being eased to by turnTo(); null when free. */
  private target: number | null = null;
  private dragging = false;
  private dragPointer = -1;
  /** A pointer that is down but not (yet) turning the body. */
  private press: { id: number; x: number; y: number } | null = null;
  private lastX = 0;
  private lastMoveTs = 0;
  private lastInteraction = -Infinity;
  private raf = 0;
  private lastTs = 0;
  private time = 0;
  private onScreen = true;
  private disposed = false;
  /** A paint was requested while it couldn't run (off screen, hidden tab). */
  private needsPaint = false;
  /** setBody() ran and its first frame hasn't been drawn yet. */
  private awaitingFirstFrame = false;
  private readonly observer: IntersectionObserver | null;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly opts: BodySceneOptions) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
      preserveDrawingBuffer: false,
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.scene.add(this.pivot);
    const floorMat = new ShaderMaterial({
      vertexShader: FLOOR_VERT,
      fragmentShader: FLOOR_FRAG,
      uniforms: { uColor: { value: rawColor('#22D3EE') } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.floor = new Mesh(new CircleGeometry(1, 48), floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.scene.add(this.floor);

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('lostpointercapture', this.onPointerUp);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    document.addEventListener('visibilitychange', this.onVisibility);

    this.observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(entries => {
          // One target: the latest entry is the current state.
          this.onScreen = entries[entries.length - 1].isIntersecting;
          this.wake();
        })
      : null;
    this.observer?.observe(canvas);
  }

  /** Install (or replace) the body mesh and its two face textures. */
  setBody(mesh: BodyMesh, front: HTMLCanvasElement, back: HTMLCanvasElement, map: FaceMapping, base: string): void {
    this.clearBody();
    this.frontTex = this.makeTexture(front);
    this.backTex = this.makeTexture(back);
    this.material = createBodyMaterial(this.frontTex, this.backTex, map, base);
    const body = new Mesh(mesh.geometry, this.material);
    // Art space is y-down; flip it and centre the body on the turn axis.
    body.scale.y = -1;
    body.position.set(-mesh.cx, (mesh.minY + mesh.maxY) / 2, 0);
    this.body = body;
    this.pivot.add(body);

    this.bodyHeight = mesh.maxY - mesh.minY;
    this.bodyWidth = Math.max(160, this.bodyHeight * 0.36);
    const footY = -this.bodyHeight / 2 - 2;
    this.floor.position.set(0, footY, 0);
    this.floor.scale.setScalar(this.bodyHeight * 0.2);
    this.frame();
    this.awaitingFirstFrame = true;
    this.wake(true);
  }

  /** Swap in freshly rendered face textures (e.g. new highlights). */
  updateTextures(front: HTMLCanvasElement, back: HTMLCanvasElement): void {
    if (!this.frontTex || !this.backTex) return;
    this.frontTex.image = front;
    this.frontTex.needsUpdate = true;
    this.backTex.image = back;
    this.backTex.needsUpdate = true;
    this.wake(true);
  }

  /**
   * Turn the body to show its front or back (shortest way round), then
   * hold there for a moment before auto-rotation picks up again.
   */
  turnTo(face: 'front' | 'back'): void {
    const base = face === 'back' ? Math.PI : 0;
    const TAU = Math.PI * 2;
    this.target = base + Math.round((this.angle - base) / TAU) * TAU;
    this.velocity = 0;
    if (this.opts.reducedMotion) {
      this.angle = this.target;
      this.target = null;
    }
    this.lastInteraction = performance.now();
    this.wake(true);
  }

  /** Turn by `delta` radians (keyboard control), eased like turnTo(). */
  turnBy(delta: number): void {
    this.target = (this.target ?? this.angle) + delta;
    this.velocity = 0;
    if (this.opts.reducedMotion) {
      this.angle = this.target;
      this.target = null;
    }
    this.lastInteraction = performance.now();
    this.wake(true);
  }

  setAutoRotate(on: boolean): void {
    this.opts.autoRotate = on;
    this.wake();
  }

  setReducedMotion(on: boolean): void {
    this.opts.reducedMotion = on;
    this.wake(true);
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.frame();
    this.wake(true);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.observer?.disconnect();
    const c = this.canvas;
    c.removeEventListener('pointerdown', this.onPointerDown);
    c.removeEventListener('pointermove', this.onPointerMove);
    c.removeEventListener('pointerup', this.onPointerUp);
    c.removeEventListener('pointercancel', this.onPointerCancel);
    c.removeEventListener('lostpointercapture', this.onPointerUp);
    c.removeEventListener('webglcontextlost', this.onContextLost);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.clearBody();
    this.floor.geometry.dispose();
    this.floor.material.dispose();
    // Release the GPU context right away rather than waiting for GC — but a
    // context the GPU already dropped has no lose_context extension left
    // (three would log a bogus "not supported" warning).
    const lost = this.renderer.getContext().isContextLost();
    this.renderer.dispose();
    if (!lost) this.renderer.forceContextLoss();
  }

  // ── internals ──────────────────────────────────────────────────────────

  private makeTexture(source: HTMLCanvasElement): CanvasTexture {
    const t = new CanvasTexture(source);
    t.generateMipmaps = true;
    t.minFilter = LinearMipmapLinearFilter;
    t.magFilter = LinearFilter;
    t.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    return t;
  }

  private clearBody(): void {
    if (this.body) {
      this.pivot.remove(this.body);
      this.body.geometry.dispose();
    }
    this.material?.dispose();
    this.frontTex?.dispose();
    this.backTex?.dispose();
    this.body = null;
    this.material = null;
    this.frontTex = null;
    this.backTex = null;
  }

  /** Fit the whole body (with a little air) in the viewport. */
  private frame(): void {
    const halfFov = (FOV * Math.PI) / 360;
    const needH = (this.bodyHeight * 1.08) / 2 / Math.tan(halfFov);
    const needW = (this.bodyWidth * 1.12) / 2 / (Math.tan(halfFov) * this.camera.aspect);
    const dist = Math.max(needH, needW);
    this.camera.position.set(0, this.bodyHeight * 0.015, dist);
    this.camera.lookAt(0, 0, 0);
    this.camera.near = Math.max(1, dist - this.bodyHeight);
    this.camera.far = dist + this.bodyHeight;
    this.camera.updateProjectionMatrix();
  }

  private get moving(): boolean {
    if (this.dragging || this.target !== null || Math.abs(this.velocity) > 0.02) return true;
    return this.opts.autoRotate && !this.opts.reducedMotion;
  }

  /**
   * Start the loop if anything should animate. `once` asks for one paint;
   * if the canvas can't paint now (off screen, hidden tab) the request is
   * kept and honoured as soon as it is visible again.
   */
  private wake(once = false): void {
    if (once) this.needsPaint = true;
    if (this.disposed || this.raf) return;
    if (!this.onScreen || document.hidden) return;
    if (!this.moving && !this.needsPaint) return;
    this.lastTs = 0;
    this.raf = requestAnimationFrame(this.tick);
  }

  private readonly tick = (ts: number): void => {
    this.raf = 0;
    if (this.disposed) return;
    // Plain auto-rotation renders at ~30 fps (high-refresh phones would
    // otherwise burn 90–120 frames a second); drags and turns run full rate.
    const idleSpin = !this.dragging && this.target === null && Math.abs(this.velocity) <= 0.02;
    if (idleSpin && this.lastTs && ts - this.lastTs < AUTO_FRAME_MS - 2) {
      this.raf = requestAnimationFrame(this.tick);
      return;
    }
    const dt = this.lastTs ? Math.min(0.05, (ts - this.lastTs) / 1000) : 0;
    this.lastTs = ts;

    if (!this.dragging && this.target !== null) {
      this.angle += (this.target - this.angle) * (1 - Math.exp(-TURN_RATE * dt));
      if (Math.abs(this.target - this.angle) < 0.002) {
        this.angle = this.target;
        this.target = null;
        this.lastInteraction = performance.now();   // hold before spinning on
      }
    } else if (!this.dragging) {
      if (Math.abs(this.velocity) > 0.02) {
        this.angle += this.velocity * dt;
        this.velocity *= Math.exp(-FRICTION * dt);
      } else {
        this.velocity = 0;
        const idle = performance.now() - this.lastInteraction > RESUME_AFTER_MS;
        if (this.opts.autoRotate && !this.opts.reducedMotion && idle) {
          const edge = Math.sin(this.angle) ** 2;
          this.angle += (AUTO_SPEED_MIN + (AUTO_SPEED_MAX - AUTO_SPEED_MIN) * edge) * dt;
        }
      }
    }
    this.pivot.rotation.y = this.angle;
    if (!this.opts.reducedMotion) this.time += dt;
    if (this.material) this.material.uniforms.uTime.value = this.time;
    this.renderer.render(this.scene, this.camera);
    this.needsPaint = false;
    if (this.awaitingFirstFrame && this.body) {
      this.awaitingFirstFrame = false;
      this.opts.onFirstFrame?.();
    }

    if (this.moving && this.onScreen && !document.hidden) {
      this.raf = requestAnimationFrame(this.tick);
    }
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (this.dragging || (e.pointerType === 'mouse' && e.button !== 0)) return;
    // Touching the body holds it still (and pauses auto-rotation) so a
    // highlighted muscle can be inspected, even if the touch turns out to
    // be a scroll.
    this.velocity = 0;
    this.target = null;
    this.lastInteraction = performance.now();
    // A mouse has no page scroll to protect: turn right away (and capture,
    // so a release outside the canvas still ends the drag). A touch might
    // be the start of a vertical scroll, so wait for it to move sideways.
    if (e.pointerType === 'mouse') this.beginDrag(e);
    else this.press = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };

  /** The press moved clearly sideways: it's a turn, take the pointer. */
  private beginDrag(e: PointerEvent): void {
    this.press = null;
    this.dragging = true;
    this.target = null;
    this.dragPointer = e.pointerId;
    this.lastX = e.clientX;
    this.lastMoveTs = e.timeStamp;
    this.velocity = 0;
    this.lastInteraction = performance.now();
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    this.wake();
  }

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (this.press && e.pointerId === this.press.id) {
      if (e.buttons === 0) { this.press = null; return; }          // released elsewhere
      const dx = Math.abs(e.clientX - this.press.x);
      const dy = Math.abs(e.clientY - this.press.y);
      if (dy > SCROLL_SLOP && dy > dx) this.press = null;          // a scroll
      else if (dx >= DRAG_SLOP && dx >= 1.2 * dy) this.beginDrag(e);
      return;
    }
    if (!this.dragging || e.pointerId !== this.dragPointer) return;
    const dx = e.clientX - this.lastX;
    const dt = Math.max(1, e.timeStamp - this.lastMoveTs) / 1000;
    this.lastX = e.clientX;
    this.lastMoveTs = e.timeStamp;
    this.angle += dx * DRAG_GAIN;
    // Low-pass the flick speed so one jittery sample can't fling the body.
    this.velocity = this.velocity * 0.6 + ((dx * DRAG_GAIN) / dt) * 0.4;
    this.lastInteraction = performance.now();
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (this.press && e.pointerId === this.press.id) this.press = null;
    if (e.pointerId !== this.dragPointer) return;
    this.dragging = false;
    this.dragPointer = -1;
    // A finger that stopped before lifting shouldn't keep spinning.
    if (e.timeStamp - this.lastMoveTs > 80) this.velocity = 0;
    this.velocity = Math.max(-12, Math.min(12, this.velocity));
    this.lastInteraction = performance.now();
    this.wake();
  };

  /** The browser took the gesture over (e.g. scrolling): stop, don't fling. */
  private readonly onPointerCancel = (e: PointerEvent): void => {
    if (this.dragging && e.pointerId === this.dragPointer) this.velocity = 0;
    this.lastMoveTs = -Infinity;
    this.onPointerUp(e);
  };

  private readonly onVisibility = (): void => this.wake();

  // No preventDefault(): we never restore, the host falls back to 2D.
  private readonly onContextLost = (): void => {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.opts.onContextLost?.();
  };
}
