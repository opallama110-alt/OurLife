import { BufferGeometry, Float32BufferAttribute } from 'three';
import type { BodyGender } from '../hud/BodyAnatomy';
import type { Silhouette } from './bodyArt';

// ─────────────────────────────────────────────────────────────────────────
// bodyMesh — lofts a 3D body out of the FRONT silhouette of the 2D art.
//
// Every scanned row gives the body's width; depth comes from anatomical
// front/back profiles. The body is split into five overlapping tubes
// (head+torso, two arms, two legs) so armpits and the crotch need no
// fiddly branching topology: arm and leg tubes start a little inside the
// torso and the overlap is hidden by the depth buffer.
//
// Geometry stays in art units (x right, y down in the SVG) and carries the
// art coordinate of every vertex in `aArt`, which the material uses to
// sample the front/back textures. The world transform (centre, flip y,
// scale) is applied by the scene.
// ─────────────────────────────────────────────────────────────────────────

interface Ring { y: number; l: number; r: number }

/** Texture lookups are pulled this far toward each ring's centre. */
const ART_PULL = 0.94;
/** Rows above the armpit over which the deltoid hands over to the arm tube. */
const SHOULDER_BLEND = 42;
/** Rows above the crotch over which the torso tucks into the thighs. */
const HIP_TUCK = 18;
type PartKind = 'torso' | 'arm' | 'leg';

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Piecewise-linear lookup in a [y, value] table. */
function lut(table: ReadonlyArray<readonly [number, number]>, y: number): number {
  if (y <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (y <= table[i][0]) {
      const [y0, v0] = table[i - 1];
      const [y1, v1] = table[i];
      const t = (y - y0) / (y1 - y0);
      return v0 + (v1 - v0) * t;
    }
  }
  return table[table.length - 1][1];
}

// Torso half-depths in art units (front, back), measured against a body
// ~505 units tall (≈ 2.9 units/cm). Clamped by width near the head top.
const TORSO_FRONT: ReadonlyArray<readonly [number, number]> = [
  [60, 10], [80, 23], [96, 27], [112, 25], [122, 16], [136, 16], [152, 25],
  [175, 33], [205, 35], [235, 31], [262, 30], [290, 32], [318, 33], [345, 29],
];
const TORSO_BACK: ReadonlyArray<readonly [number, number]> = [
  [60, 10], [80, 27], [96, 31], [112, 27], [122, 18], [136, 19], [152, 27],
  [175, 31], [205, 31], [235, 28], [262, 28], [290, 33], [318, 38], [345, 36],
];

/** A soft-tissue mound (breast / buttock), one each side of the midline. */
interface Mound {
  height: number;  // peak projection in art units (≈ 2.9 per cm)
  cxOff: number;   // centre's distance from the midline
  halfW: number;   // half-width
  cy: number;      // row of fullest projection
  up: number;      // rows above cy over which it rises
  down: number;    // rows below cy down to the fold
  lower: number;   // lower-pole exponent: smaller = rounder, crisper fold
}
interface GenderShape {
  torsoDepth: number;  // overall torso depth multiplier
  lumbar: number;      // inward curve of the lower back (lordosis)
  chest: Mound;
  glute: Mound;
}
const SHAPE: Record<BodyGender, GenderShape> = {
  male: {
    torsoDepth: 1,
    lumbar: 2,
    chest: { height: 6, cxOff: 20, halfW: 17, cy: 196, up: 24, down: 14, lower: 0.7 },
    glute: { height: 7, cxOff: 21, halfW: 18, cy: 338, up: 44, down: 26, lower: 0.75 },
  },
  female: {
    torsoDepth: 0.94,
    lumbar: 5,
    chest: { height: 19, cxOff: 21, halfW: 15.5, cy: 213, up: 32, down: 16, lower: 0.6 },
    glute: { height: 17, cxOff: 21.5, halfW: 18.5, cy: 340, up: 48, down: 30, lower: 0.75 },
  },
};

/**
 * 0‥1 mound profile. Seen from the side it rises gently from above (zero
 * slope at the top edge, like breast tissue below the collarbone or the
 * buttock out of the lower back) and ends in a round, sphere-like lower
 * pole whose tangent turns vertical at the fold (inframammary / gluteal).
 */
function mound(m: Mound, dx: number, y: number): number {
  const u = (Math.abs(dx) - m.cxOff) / m.halfW;
  const v = (y - m.cy) / (y < m.cy ? m.up : m.down);
  const r2 = u * u + v * v;
  if (r2 >= 1) return 0;
  const p = 1.35 + (m.lower - 1.35) * smoothstep(-0.35, 0.35, v);
  return Math.pow(1 - r2, p);
}

/** Half-depths (front, back) of a limb ring at art row y. */
function limbDepth(kind: 'arm' | 'leg', a: number, y: number, wristY: number): [number, number] {
  if (kind === 'arm') {
    if (y > wristY) return [a * 0.45, a * 0.45];            // flat hand
    const k = y < 280 ? 0.95 : 0.85;                        // upper arm / forearm
    return [a * k, a * k];
  }
  if (y < 420) return [a * 0.92, a * 0.98];                 // thigh
  if (y < 450) return [a * 0.88, a * 0.85];                 // knee
  if (y < 515) return [a * 0.78, a * 1.05];                 // calf bulges backwards
  // Ankle → foot: the front view shows the foot end-on, so stretch the
  // lowest rings forward into a foot and keep a small heel behind.
  const t = smoothstep(536, 562, y);
  return [a * 0.85 + (44 - a * 0.85) * t, a * 0.85 + (12 - a * 0.85) * t];
}

/** Bridge noise: limit how fast a run edge may move between rows. */
function stabilise(rings: Ring[], maxStep: number): Ring[] {
  for (let i = 1; i < rings.length; i++) {
    const p = rings[i - 1], c = rings[i];
    if (c.l < p.l - maxStep) c.l = p.l - maxStep;
    if (c.r > p.r + maxStep) c.r = p.r + maxStep;
  }
  return rings;
}

/** 3-tap moving average of the edges (ends kept). */
function smooth(rings: Ring[]): Ring[] {
  if (rings.length < 3) return rings;
  return rings.map((r, i) => {
    if (i === 0 || i === rings.length - 1) return r;
    const a = rings[i - 1], b = rings[i + 1];
    return { y: r.y, l: (a.l + r.l + b.l) / 3, r: (a.r + r.r + b.r) / 3 };
  });
}

interface Parts {
  torso: Ring[];
  armL: Ring[]; armR: Ring[];
  legL: Ring[]; legR: Ring[];
  cx: number;
  wristY: number;
}

/** Classify every silhouette run into head/torso, arms and legs. */
function splitParts(sil: Silhouette): Parts {
  const cx = (sil.minX + sil.maxX) / 2;
  const torso: Ring[] = [], armL: Ring[] = [], armR: Ring[] = [], legL: Ring[] = [], legR: Ring[] = [];
  let crotched = false;
  for (const row of sil.rows) {
    const { y, runs } = row;
    const central = crotched ? undefined : runs.find(r => r[0] <= cx && r[1] >= cx);
    if (central) {
      torso.push({ y, l: central[0], r: central[1] });
      const left = runs.filter(r => r[1] < central[0]);
      const right = runs.filter(r => r[0] > central[1]);
      if (left.length) armL.push({ y, l: left[0][0], r: left[left.length - 1][1] });
      if (right.length) armR.push({ y, l: right[0][0], r: right[right.length - 1][1] });
      continue;
    }
    // Below the crotch (or a midline gap after the torso began): legs, plus
    // the hands for the rows where they hang beside the thighs.
    if (torso.length && y > torso[torso.length - 1].y && y > sil.minY + (sil.maxY - sil.minY) * 0.45) crotched = true;
    if (!crotched) continue;
    // Inner thighs can touch again just below the crotch: split such a run
    // on the midline so each leg keeps its own half.
    const split = runs.flatMap((r): Array<[number, number]> =>
      r[0] < cx && r[1] > cx ? [[r[0], cx - 0.5], [cx + 0.5, r[1]]] : [r]);
    const left = split.filter(r => (r[0] + r[1]) / 2 < cx);
    const right = split.filter(r => (r[0] + r[1]) / 2 >= cx);
    if (left.length) {
      const leg = left[left.length - 1];                    // run nearest the midline
      legL.push({ y, l: leg[0], r: leg[1] });
      const hand = left.slice(0, -1);
      if (hand.length) armL.push({ y, l: hand[0][0], r: hand[hand.length - 1][1] });
    }
    if (right.length) {
      const leg = right[0];
      legR.push({ y, l: leg[0], r: leg[1] });
      const hand = right.slice(1);
      if (hand.length) armR.push({ y, l: hand[0][0], r: hand[hand.length - 1][1] });
    }
  }
  // Arms are only trusted as a contiguous run from the armpit down; stray
  // detached bits (ear lobes, hair) above the armpit would start them early.
  const contiguous = (rings: Ring[]) => {
    let start = 0;
    for (let i = 1; i < rings.length; i++) if (rings[i].y - rings[i - 1].y > 6) start = i;
    return rings.slice(start);
  };
  const aL = contiguous(armL), aR = contiguous(armR);
  // Wrist ≈ where the hand starts: two thirds of the way down the hanging arm.
  const armTop = aL.length ? aL[0].y : 216;
  const armBottom = aL.length ? aL[aL.length - 1].y : 370;
  const wristY = armTop + (armBottom - armTop) * 0.76;
  return {
    torso: smooth(torso),
    armL: smooth(stabilise(aL, 3)),
    armR: smooth(stabilise(aR.map(r => ({ y: r.y, l: -r.r, r: -r.l })), 3).map(r => ({ y: r.y, l: -r.r, r: -r.l }))),
    legL: smooth(stabilise(legL, 4)),
    legR: smooth(stabilise(legR.map(r => ({ y: r.y, l: -r.r, r: -r.l })), 4).map(r => ({ y: r.y, l: -r.r, r: -r.l }))),
    cx,
    wristY,
  };
}

class GeometryBuilder {
  positions: number[] = [];
  art: number[] = [];
  indices: number[] = [];

  /** One closed tube through the rings, capped at both ends. */
  tube(rings: Ring[], segs: number, ringAt: (ring: Ring, s: number, c: number) => [number, number]): void {
    if (rings.length < 2) return;
    const base = this.positions.length / 3;
    for (const ring of rings) {
      const mid = (ring.l + ring.r) / 2;
      for (let i = 0; i < segs; i++) {
        const th = (i / segs) * Math.PI * 2;
        const [x, z] = ringAt(ring, Math.sin(th), Math.cos(th));
        this.positions.push(x, ring.y, z);
        // Sample the art slightly inside the outline: seen edge-on, the
        // outline pixels would otherwise smear into a dark band.
        this.art.push(mid + (x - mid) * ART_PULL, ring.y);
      }
    }
    for (let k = 0; k < rings.length - 1; k++) {
      const a = base + k * segs, b = a + segs;
      for (let i = 0; i < segs; i++) {
        const i2 = (i + 1) % segs;
        // Art space has y pointing down; this winding faces outwards once
        // the scene flips y.
        this.indices.push(a + i, a + i2, b + i, b + i, a + i2, b + i2);
      }
    }
    this.cap(rings[0], base, segs, false);
    this.cap(rings[rings.length - 1], base + (rings.length - 1) * segs, segs, true);
  }

  private cap(ring: Ring, start: number, segs: number, bottom: boolean): void {
    const centre = this.positions.length / 3;
    let x = 0, z = 0;
    for (let i = 0; i < segs; i++) {
      x += this.positions[(start + i) * 3];
      z += this.positions[(start + i) * 3 + 2];
    }
    x /= segs; z /= segs;
    this.positions.push(x, ring.y, z);
    this.art.push(x, ring.y);
    for (let i = 0; i < segs; i++) {
      const i2 = (i + 1) % segs;
      if (bottom) this.indices.push(start + i, start + i2, centre);
      else this.indices.push(start + i2, start + i, centre);
    }
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    g.setAttribute('aArt', new Float32BufferAttribute(this.art, 2));
    g.setIndex(this.indices);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

/** Superellipse point: p > 2 squares the section off a little. */
const superE = (s: number, c: number, p: number): [number, number] => [
  Math.sign(s) * Math.pow(Math.abs(s), 2 / p),
  Math.sign(c) * Math.pow(Math.abs(c), 2 / p),
];

export interface BodyMesh {
  geometry: BufferGeometry;
  /** Body midline in art units (x). */
  cx: number;
  minY: number;
  maxY: number;
}

/** Build the 3D body for one gender from its front silhouette. */
export function buildBodyMesh(sil: Silhouette, gender: BodyGender): BodyMesh {
  const parts = splitParts(sil);
  const { cx, wristY } = parts;
  const shape = SHAPE[gender];
  const gb = new GeometryBuilder();

  // ── Shoulders: above the armpit the silhouette merges deltoid and torso.
  // Hand the deltoid over to the arm tube there — the torso narrows to the
  // chest edge while each arm tube climbs along the outer shoulder line —
  // so there is no shelf where the arms separate. ──
  const armTop = (arm: Ring[]) => (arm.length ? arm[0] : null);
  const topL = armTop(parts.armL), topR = armTop(parts.armR);
  const torsoAt = (y: number) => parts.torso.find(r => r.y >= y);
  const chestL = topL ? torsoAt(topL.y)?.l ?? null : null;
  const chestR = topR ? torsoAt(topR.y)?.r ?? null : null;
  const leadL: Ring[] = [], leadR: Ring[] = [];
  const torsoRings = parts.torso.map(r => {
    const out = { ...r };
    if (topL && chestL !== null && r.y < topL.y && r.y >= topL.y - SHOULDER_BLEND) {
      const t = smoothstep(topL.y - SHOULDER_BLEND, topL.y, r.y);
      const w = (topL.r - topL.l) * (0.8 + 0.2 * t);
      leadL.push({ y: r.y, l: r.l, r: r.l + w });
      out.l = r.l + (chestL - r.l) * t;
    }
    if (topR && chestR !== null && r.y < topR.y && r.y >= topR.y - SHOULDER_BLEND) {
      const t = smoothstep(topR.y - SHOULDER_BLEND, topR.y, r.y);
      const w = (topR.r - topR.l) * (0.8 + 0.2 * t);
      leadR.push({ y: r.y, l: r.r - w, r: r.r });
      out.r = r.r + (chestR - r.r) * t;
    }
    return out;
  });

  // ── Head + torso ──
  const crotchY = parts.torso.length ? parts.torso[parts.torso.length - 1].y : 340;
  /** Torso half-depth without mounds (front if c ≥ 0, else back). */
  const torsoBase = (y: number, a: number, c: number): number => {
    const cap = Math.max(4, a * 1.2);
    if (c >= 0) return Math.min(cap, lut(TORSO_FRONT, y) * shape.torsoDepth);
    const lordosis = shape.lumbar * Math.exp(-(((y - 292) / 18) ** 2));
    return Math.min(cap, lut(TORSO_BACK, y) * shape.torsoDepth) - lordosis;
  };
  /** Breast (front) or buttock (back) projection at art x, row y. */
  const moundAt = (x: number, y: number, c: number): number => c >= 0
    ? shape.chest.height * mound(shape.chest, x - cx, y) * Math.sqrt(c)
    : shape.glute.height * mound(shape.glute, x - cx, y) * Math.sqrt(-c);

  gb.tube(torsoRings, 80, (ring, s, c) => {
    const a0 = (ring.r - ring.l) / 2;
    const mid = (ring.l + ring.r) / 2;
    // Tuck the bottom of the torso inside the thighs (which carry the hip
    // and buttock surface from here down) so its rim never shows.
    const tuck = smoothstep(crotchY - HIP_TUCK, crotchY, ring.y);
    const a = a0 * (1 - 0.3 * tuck);
    // Shoulders/torso read squarer than the round head and neck.
    const p = ring.y > 140 ? 2.35 : 2;
    const [ex, ez] = superE(s, c, p);
    const x = mid + a * ex;
    const depth = (Math.abs(ez) * torsoBase(ring.y, a0, c) + moundAt(x, ring.y, c)) * (1 - 0.25 * tuck);
    return [x, ez >= 0 ? depth : -depth];
  });
  const hip = parts.torso[parts.torso.length - 1];
  const hipA = hip ? (hip.r - hip.l) / 2 : 50;

  // ── Arms (from the deltoid down) and legs ──
  const limb = (kind: 'arm' | 'leg', rings: Ring[], lead: Ring[]) => {
    gb.tube(smooth(smooth([...lead, ...rings])), kind === 'leg' ? 36 : 28, (ring, s, c) => {
      const a = (ring.r - ring.l) / 2;
      const mid = (ring.l + ring.r) / 2;
      const x = mid + a * s;
      const [zf, zb] = limbDepth(kind, a, ring.y, wristY);
      if (kind === 'arm') return [x, c >= 0 ? c * zf : c * zb];
      // Upper thighs grow out of the hips: take the torso's depth there,
      // easing into the leg's own profile further down (no ledge at the
      // crotch). The buttocks ride on top at full strength down to the
      // gluteal fold, which sits below the crotch.
      const w = smoothstep(crotchY, crotchY + 46, ring.y);
      const k = Math.sqrt(Math.max(0, 1 - ((x - cx) / (hipA * 1.04)) ** 2));
      const y = Math.min(ring.y, crotchY);
      if (c >= 0) return [x, c * (zf * w + torsoBase(y, hipA, 1) * k * (1 - w))];
      const back = zb * w + torsoBase(y, hipA, -1) * k * (1 - w);
      return [x, c * back - moundAt(x, ring.y, c)];
    });
  };
  limb('arm', parts.armL, leadL);
  limb('arm', parts.armR, leadR);

  // ── Legs: begin inside the hips, from each half of the lowest torso rows ──
  const hips = parts.torso.filter(r => r.y > crotchY - HIP_TUCK - 14);
  const legLead = (side: 'l' | 'r') => hips.map(r => side === 'l'
    ? { y: r.y, l: r.l + 0.5, r: cx - 0.5 }
    : { y: r.y, l: cx + 0.5, r: r.r - 0.5 });
  limb('leg', parts.legL, legLead('l'));
  limb('leg', parts.legR, legLead('r'));

  return { geometry: gb.build(), cx, minY: sil.minY, maxY: sil.maxY };
}
