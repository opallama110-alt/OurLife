import { ShaderMaterial, Texture, Vector2, Vector3, Vector4 } from 'three';
import { ART_H, ART_W } from './bodyArt';

// ─────────────────────────────────────────────────────────────────────────
// bodyMaterial — the hologram skin of the 3D body.
//
// The front and back illustrations are projected onto the body straight
// along z (front) and -z (back, mirrored and fitted to the front art by an
// affine map), blended by the surface's facing. Where one projection has no
// art (the two illustrations' outlines differ slightly) the other one
// fills in, so the sides never show holes. Lambert + fresnel rim + faint
// scanlines give the Solo Leveling HUD look.
//
// Colour is handled in display (sRGB) space end to end: textures are
// uploaded raw and the shader writes raw values — the art's colours come
// out exactly as designed, with no linear/sRGB round trip.
// ─────────────────────────────────────────────────────────────────────────

const VERT = /* glsl */ `
attribute vec2 aArt;
varying vec2 vArt;
varying vec3 vNObj;
varying vec3 vNView;
varying vec3 vView;
void main() {
  vArt = aArt;
  vNObj = normal;
  vNView = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform sampler2D uFront;
uniform sampler2D uBack;
uniform vec2 uArt;      // art size (432, 648)
uniform vec4 uMapX;     // front cx, back cx, x scale, unused
uniform vec4 uMapY;     // front y0, back y0, y scale, unused
uniform vec3 uBase;     // body colour where neither face has art
uniform vec3 uRim;
uniform float uTime;
varying vec2 vArt;
varying vec3 vNObj;
varying vec3 vNView;
varying vec3 vView;

void main() {
  vec2 uvF = vec2(vArt.x / uArt.x, 1.0 - vArt.y / uArt.y);
  float xb = uMapX.y - (vArt.x - uMapX.x) * uMapX.z;
  float yb = uMapY.y + (vArt.y - uMapY.x) * uMapY.z;
  vec2 uvB = vec2(xb / uArt.x, 1.0 - yb / uArt.y);
  vec4 f = texture2D(uFront, uvF);
  vec4 b = texture2D(uBack, uvB);

  vec3 nObj = normalize(vNObj);
  float facing = smoothstep(-0.22, 0.22, nObj.z);
  float wf = facing * f.a;
  float wb = (1.0 - facing) * b.a;
  float sum = wf + wb;
  vec3 skin = sum > 0.001 ? (f.rgb * wf + b.rgb * wb) / sum : uBase;
  // Planar projections stretch on surfaces seen edge-on; ease to the base
  // colour there instead of showing smeared streaks.
  float edgeOn = 1.0 - abs(nObj.z);
  skin = mix(skin, uBase, smoothstep(0.62, 1.0, edgeOn) * 0.6);

  vec3 n = normalize(vNView);
  vec3 v = normalize(vView);
  vec3 l = normalize(vec3(-0.35, 0.55, 0.78));
  float lambert = 0.5 + 0.5 * max(dot(n, l), 0.0);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 2.4);
  vec3 col = skin * lambert + uRim * rim * 0.6;

  // Faint drifting scanlines (screen space) sell the hologram.
  col *= 0.97 + 0.03 * sin(gl_FragCoord.y * 1.4 - uTime * 2.4);
  gl_FragColor = vec4(col, 1.0);
}`;

export interface FaceMapping {
  frontCx: number;
  backCx: number;
  scaleX: number;
  frontY0: number;
  backY0: number;
  scaleY: number;
}

/** '#rrggbb' → raw 0..1 components (no colour management: see header). */
export const rawColor = (hex: string): Vector3 => {
  const n = parseInt(hex.slice(1), 16);
  return new Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

export function createBodyMaterial(front: Texture, back: Texture, map: FaceMapping, base: string): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uFront: { value: front },
      uBack: { value: back },
      uArt: { value: new Vector2(ART_W, ART_H) },
      uMapX: { value: new Vector4(map.frontCx, map.backCx, map.scaleX, 0) },
      uMapY: { value: new Vector4(map.frontY0, map.backY0, map.scaleY, 0) },
      uBase: { value: rawColor(base) },
      uRim: { value: rawColor('#67E8F9') },
      uTime: { value: 0 },
    },
  });
}
