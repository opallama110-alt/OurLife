import type { BodyGender } from '../hud/BodyAnatomy';

// ─────────────────────────────────────────────────────────────────────────
// bodyArt — turns the 2D anatomy SVGs into what the 3D body needs:
//   • a themed raster of each face (front/back) used as the body texture,
//     with highlighted muscle groups tinted red, and
//   • the front silhouette as per-row runs, used to loft the 3D mesh.
//
// The same SVGs as the Dashboard (`/assets/body-*.svg`) are used, so every
// muscle id / MUSCLE_MAP prefix works unchanged and both genders come for
// free. Rasterizing happens through an <img> of a Blob URL — no foreign
// content, so the canvas stays untainted and can be uploaded to WebGL.
// ─────────────────────────────────────────────────────────────────────────

export type Face = 'front' | 'back';

/** Art coordinate space shared by every body SVG (viewBox 0 0 432 648). */
export const ART_W = 432;
export const ART_H = 648;

const SVG_URLS: Record<BodyGender, Record<Face, string>> = {
  male:   { front: '/assets/body-front.svg',        back: '/assets/body-back.svg' },
  female: { front: '/assets/body-female-front.svg', back: '/assets/body-female-back.svg' },
};

const textCache = new Map<string, Promise<string>>();

/** Fetch an SVG once per gender+face (failed fetches are evicted for retry). */
export function loadBodySvg(gender: BodyGender, face: Face): Promise<string> {
  const url = SVG_URLS[gender][face];
  let p = textCache.get(url);
  if (!p) {
    p = fetch(url).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
      return r.text();
    });
    p.catch(() => textCache.delete(url));
    textCache.set(url, p);
  }
  return p;
}

// ── Theme ─────────────────────────────────────────────────────────────────
// The two Illustrator exports use the same class names for different roles
// (front: .ba-0 = silhouette, .ba-1 = muscle; back: .ba-1 = silhouette,
// .ba-2 = muscle), so each face gets its own role map. Light roles use
// currentColor — a highlighted group only has to change `color` and all of
// its layers (plus the female fat overlays) follow.
const BODY = '#67E8F9';
const HIGHLIGHT = '#EF4444';
const SHADOW = '#04101c';
const DEEP = '#071722';

/** Mix two '#rrggbb' colours (t = 0 → a, 1 → b). */
function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/**
 * Solid body colour under the muscles. It must be opaque — the shader
 * treats texture alpha as "art coverage" — and is a touch brighter for the
 * female body, whose softer definition (subcutaneous fat) the 2D art
 * builds with an extra layer that the 3D skin replaces with this tone.
 */
export const bodyBaseColor = (gender: BodyGender): string =>
  mixHex(DEEP, BODY, gender === 'female' ? 0.6 : 0.42);

const FACE_CSS: Record<Face, string> = {
  front: `
    .ba-0{fill:BASE;opacity:1}
    .ba-1{fill:currentColor;opacity:.82}
    .ba-2{fill:currentColor;opacity:.2}
    .ba-3{fill:currentColor;opacity:.55}
    .ba-4,.ba-7{fill:currentColor;opacity:.3}
    .ba-5{fill:${SHADOW};opacity:.3}
    .ba-6{fill:${SHADOW};opacity:.22}`,
  back: `
    .ba-0{display:none}
    .ba-1{fill:BASE;opacity:1}
    .ba-2{fill:currentColor;opacity:.82}
    .ba-3{fill:currentColor;opacity:.22}
    .ba-4{fill:${SHADOW};opacity:.3}
    .ba-5{fill:${SHADOW};opacity:.2}
    .ba-6,.ba-7{fill:currentColor;opacity:.3}
    .ba-8{fill:currentColor;opacity:.55}`,
};

const cssEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/** Main muscle-fill class per face (see FACE_CSS). */
const MUSCLE_CLASS: Record<Face, string> = { front: 'ba-1', back: 'ba-2' };

function themeCss(face: Face, gender: BodyGender, highlighted: readonly string[]): string {
  // Any element, not just <g>: some muscles are a bare <path> with the id
  // (e.g. Thoracolumbar, the lower back).
  const groups = highlighted.map(id => `[id^="${cssEscape(id)}"]`);
  // A lit muscle shows at full strength even where the female art fades
  // its fill with an inline opacity (abs, flanks, quads).
  const muscle = MUSCLE_CLASS[face];
  const tint = groups.length
    ? `${groups.join(',')}{color:${HIGHLIGHT}}`
      + `${groups.map(g => `${g} .${muscle},${g}.${muscle}`).join(',')}{opacity:.9!important}`
    : '';
  // Unclassed paths without a fill are the black outline art; soften them for
  // the hologram (the female overlays carry their own fill and are untouched).
  // The female subcutaneous layer is replaced by the brighter base colour.
  return `svg{color:${BODY}}`
    + 'path:not([class]):not([fill]){opacity:.55}#Soft_tissue_female{display:none}'
    + FACE_CSS[face].replace(/BASE/g, bodyBaseColor(gender)) + tint;
}

// Mask: every shape solid white, so alpha = "inside the body". The back art
// carries a hidden stray Illustrator stroke (.ba-0) outside the figure.
// The translucent female breast overlay is excluded: it reaches past the
// chest edge and would bridge the arm/chest gap, merging arm and torso.
const MASK_CSS: Record<Face, string> = {
  front: '*{fill:#fff!important;stroke:none!important;opacity:1!important}#Pecs_female_breasts{display:none!important}',
  back: '*{fill:#fff!important;stroke:none!important;opacity:1!important}.ba-0{display:none!important}',
};

function withStyle(svg: string, css: string, w: number, h: number): string {
  return svg
    .replace(/<\?xml[^>]*>/, '')
    .replace(/<svg\b([^>]*)>/, (_m, attrs: string) => {
      const clean = attrs.replace(/\s(width|height)="[^"]*"/g, '');
      return `<svg${clean} width="${w}" height="${h}"><style>${css}</style>`;
    });
}

async function rasterize(svg: string, css: string, scale: number, readBack = false): Promise<HTMLCanvasElement> {
  const w = Math.round(ART_W * scale);
  const h = Math.round(ART_H * scale);
  const blob = new Blob([withStyle(svg, css, w, h)], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    // A canvas we read pixels back from stays CPU-side: a GPU-backed one
    // makes getImageData a slow, synchronous readback (~0.5 s measured).
    const ctx = canvas.getContext('2d', readBack ? { willReadFrequently: true } : undefined);
    if (!ctx) throw new Error('2D canvas unavailable');
    ctx.drawImage(img, 0, 0, w, h);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Themed texture of one face with the given muscle id prefixes tinted. */
export function renderFace(
  svg: string,
  face: Face,
  gender: BodyGender,
  highlighted: readonly string[],
  scale: number,
): Promise<HTMLCanvasElement> {
  return rasterize(svg, themeCss(face, gender, highlighted), scale);
}

// ── Silhouette ────────────────────────────────────────────────────────────

/** Filled horizontal runs of the silhouette at one art-space row. */
export interface SilhouetteRow {
  y: number;
  runs: Array<[number, number]>;
}

export interface Silhouette {
  rows: SilhouetteRow[];
  /** Bounding box of the body in art units. */
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Scan an SVG's silhouette into runs, one row per `step` art units.
 * Gaps narrower than `minGap` (anti-aliasing, finger slits) are bridged.
 */
export async function extractSilhouette(svg: string, face: Face, step = 2, minGap = 1.5): Promise<Silhouette> {
  const SCALE = 2;
  const canvas = await rasterize(svg, MASK_CSS[face], SCALE, true);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas unavailable');
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  const rows: SilhouetteRow[] = [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let y = 0; y < ART_H; y += step) {
    const py = Math.min(height - 1, Math.round(y * SCALE));
    const runs: Array<[number, number]> = [];
    let start = -1;
    for (let px = 0; px <= width; px++) {
      const inside = px < width && data[(py * width + px) * 4 + 3] > 127;
      if (inside && start < 0) start = px;
      if (!inside && start >= 0) {
        const a = start / SCALE, b = px / SCALE;
        const last = runs[runs.length - 1];
        if (last && a - last[1] < minGap) last[1] = b;
        else runs.push([a, b]);
        start = -1;
      }
    }
    if (runs.length) {
      rows.push({ y, runs });
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minX = Math.min(minX, runs[0][0]);
      maxX = Math.max(maxX, runs[runs.length - 1][1]);
    }
  }
  return { rows, minX, maxX, minY, maxY };
}
