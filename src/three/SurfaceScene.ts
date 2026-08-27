import * as THREE from "three";
import type { SurfaceViewDef, SkyBodyDef } from "../data/surfaceViews";
import { NOISE_GLSL } from "./shaders";

export interface SurfaceTelemetry {
  azimuthDeg: number;
  pitchDeg: number;
  fov: number;
  fps: number;
  posX: number;
  posZ: number;
  canWalk: boolean;
  moving: boolean;
  panoActive: boolean;
}

interface SurfaceSceneOptions {
  def: SurfaceViewDef;
  onTelemetry: (t: SurfaceTelemetry) => void;
}

/* ----------------------------- shaders ----------------------------- */

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const SKY_FRAG = /* glsl */ `
${NOISE_GLSL}
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uHaze;
uniform float uHazeBoost;
uniform float uCloudMix;
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunDiffuse;
uniform float uSunGlow;
uniform float uBandsAmp;
uniform float uBandScale;
uniform float uBandDrift;
uniform vec3 uBandA;
uniform vec3 uBandB;
uniform float uMilkyWay;
varying vec3 vDir;

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;

  vec3 col = mix(uSkyHorizon, uSkyTop, pow(clamp(h, 0.0, 1.0), 0.62));
  col = mix(col * 0.55, col, smoothstep(-0.12, 0.02, h));

  // faixa de névoa no horizonte
  float hazeBand = exp(-pow(h * 5.5, 2.0));
  col = mix(col, uHaze, hazeBand * uHazeBoost);

  // faixas de nuvens / smog (gigantes gasosos, Titã, tênues em Marte)
  if (uBandsAmp > 0.001) {
    float lat = h * uBandScale;
    float warp = fbm(vec3(d.x * 1.6, h * 2.2, d.z * 1.6) + uTime * uBandDrift) - 0.5;
    float bands = sin(lat * 3.14159 + warp * 3.4);
    float b2 = fbm(vec3(d.x * 4.0, h * 5.0, d.z * 4.0) - uTime * uBandDrift * 0.6);
    float mask = smoothstep(-0.7, 0.7, bands) * (0.55 + 0.45 * b2);
    vec3 bandCol = mix(uBandB, uBandA, mask);
    float lift = smoothstep(-0.25, 0.15, h); // bandas somem abaixo do horizonte
    col = mix(col, bandCol, mask * uBandsAmp * lift * (0.4 + 0.6 * b2));
  }

  // nuvens em flocos (Terra)
  if (uCloudMix > 0.001) {
    float cn = fbm(d * 3.2 + vec3(uTime * 0.012, 0.0, uTime * 0.006));
    float cloud = smoothstep(0.55, 0.78, cn) * smoothstep(0.02, 0.28, h);
    col = mix(col, vec3(1.0) * (0.75 + 0.25 * cn), cloud * uCloudMix);
  }

  // Via Láctea em céus sem atmosfera
  if (uMilkyWay > 0.001) {
    float mw = exp(-pow(dot(d, normalize(vec3(0.42, 0.3, 0.86))) * 2.4, 2.0));
    float grain = 0.45 + 0.55 * fbm(d * 7.0 + 3.1);
    col += vec3(0.055, 0.062, 0.095) * mw * grain * uMilkyWay * (1.0 - uSunDiffuse);
  }

  // Sol: brilho difuso filtrado por nuvens (Vênus/Titã) + corona nítida
  float sd = clamp(dot(d, normalize(uSunDir)), 0.0, 1.0);
  if (uSunDiffuse > 0.001) {
    float swirl = 0.75 + 0.25 * fbm(d * 5.0 + vec3(0.0, uTime * 0.02, 0.0));
    float soft = pow(sd, 4.0) * 0.9 + pow(sd, 14.0) * 1.3;
    col += uSunColor * soft * swirl * uSunDiffuse * 0.85;
  }
  col += uSunColor * pow(sd, 320.0) * 2.2 * (1.0 - uSunDiffuse) * uSunGlow;
  col += uSunColor * pow(sd, 40.0) * 0.5 * uSunGlow;

  gl_FragColor = vec4(col, 1.0);
}
`;

const TERRAIN_VERT = /* glsl */ `
${NOISE_GLSL}
uniform float uScale;
uniform float uAmp;
uniform float uCloudSea;
uniform float uBaked;
uniform float uTime;
attribute float aHeight;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vHeight;

/* deslocamento GPU — usado apenas no mar de nuvens (gigantes gasosos) */
float terrainH(vec2 xz) {
  vec2 p = xz * uScale;
  float bands = sin(xz.y * 0.045 + fbm(vec3(xz * 0.006, uTime * 0.05)) * 3.0);
  return bands * uAmp * 0.5 + fbm(vec3(xz * 0.008, uTime * 0.04)) * uAmp * 0.6;
}

void main() {
  vec3 pos = position;
  float h;
  if (uBaked > 0.5) {
    /* terreno sólido: alturas pré-calculadas na CPU (colisão precisa) */
    h = aHeight * uAmp;
    vNormal = normalize(normal);
  } else {
    h = terrainH(pos.xz);
    pos.y += h;
    float e = 0.6;
    float hx = terrainH(pos.xz + vec2(e, 0.0));
    float hz = terrainH(pos.xz + vec2(0.0, e));
    vNormal = normalize(vec3(h - hx, e, h - hz));
  }
  vHeight = h / max(uAmp, 0.001);

  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const TERRAIN_FRAG = /* glsl */ `
${NOISE_GLSL}
uniform vec3 uBase;
uniform vec3 uMid;
uniform vec3 uDark;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uCloudSea;
uniform float uCloudShadow;
uniform float uTime;
uniform vec3 uSunDir;
uniform float uAmbient;
uniform float uSunStrength;
uniform vec3 uSunTint;
uniform float uSparkle;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vHeight;

void main() {
  vec3 N = normalize(vNormal);
  vec3 L = normalize(uSunDir);

  float detail;
  vec3 col;
  if (uCloudSea > 0.5) {
    detail = fbm(vec3(vWorldPos.xz * 0.02, uTime * 0.05));
    float bands = 0.5 + 0.5 * sin(vWorldPos.z * 0.09 + detail * 4.0);
    col = mix(uDark, uBase, bands);
    col = mix(col, uMid, smoothstep(0.4, 0.9, detail));
  } else {
    // domain warp para manchas orgânicas (basalto, enxofre, dunas)
    vec2 w = vWorldPos.xz * 0.02;
    vec2 warp = vec2(fbm(vec3(w, 2.2)), fbm(vec3(w + 5.3, 8.4))) - 0.5;
    detail = fbm(vec3(vWorldPos.xz * 0.09 + warp * 3.0, 1.3));
    float fine = fbm(vec3(vWorldPos.xz * 0.5, 7.7));
    col = mix(uDark, uBase, smoothstep(-0.4, 0.7, vHeight));
    col = mix(col, uMid, smoothstep(0.35, 0.8, detail) * 0.7);
    col *= 0.82 + 0.36 * fine;
  }

  // iluminação direcional com contraste configurável por corpo
  float dif = clamp(dot(N, L), 0.0, 1.0);
  float wrap = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
  col *= uAmbient + uSunStrength * mix(wrap, dif, 0.72);
  col *= mix(vec3(1.0), uSunTint, clamp(uSunStrength, 0.0, 1.0) * 0.5);

  // cintilação de regolito: grãos vítreos refletem o Sol (Apollo/MESSENGER)
  if (uSparkle > 0.001) {
    vec2 cell = floor(vWorldPos.xz * 22.0);
    float sp = pow(hash1(vec3(cell, 3.7)), 30.0);
    col += vec3(1.0, 0.98, 0.92) * sp * uSparkle * dif * 1.6;
  }

  // brilho especular do Sol sobre o topo das nuvens (gigantes gasosos)
  if (uCloudSea > 0.5) {
    float sh = pow(clamp(dot(N, L), 0.0, 1.0), 3.0);
    col += uSunTint * sh * 0.22;
  }

  if (uCloudShadow > 0.001) {
    float cs = fbm(vec3(vWorldPos.xz * 0.008 + uTime * 0.02, 4.4));
    col *= 1.0 - smoothstep(0.55, 0.8, cs) * uCloudShadow;
  }

  float dist = distance(vWorldPos, cameraPosition);
  float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
  col = mix(col, uFogColor, clamp(fog, 0.0, 1.0));

  gl_FragColor = vec4(col, 1.0);
}
`;

const BODY_VERT = /* glsl */ `
varying vec3 vObjPos;
varying vec3 vWorldNormal;
void main() {
  vObjPos = position;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
`;

/** Disco planetário no céu: 0 = gigante gasoso, 1 = Terra, 2 = Marte */
const BODY_FRAG = /* glsl */ `
${NOISE_GLSL}
uniform int uKind;
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uColC;
uniform float uBandFreq;
uniform float uBandAmp;
uniform float uSpotOn;
uniform vec3 uSunDir;
varying vec3 vObjPos;
varying vec3 vWorldNormal;

void main() {
  vec3 p = normalize(vObjPos);
  float lat = p.y;

  vec3 col = uColA;
  if (uKind == 1) {
    float land = smoothstep(0.52, 0.56, fbm(p * 3.6 + 2.2));
    col = mix(uColA, uColB, land);
    float cap = smoothstep(0.72, 0.85, abs(lat));
    col = mix(col, vec3(1.0), cap);
    float cloud = smoothstep(0.58, 0.8, fbm(p * 5.0 + 8.8));
    col = mix(col, vec3(1.0) * 0.95, cloud * 0.7);
  } else if (uKind == 2) {
    float dark = smoothstep(0.45, 0.7, fbm(p * 3.0 + 4.4));
    col = mix(uColA, uColB, dark * 0.8);
    float cap = smoothstep(0.8, 0.9, abs(lat));
    col = mix(col, vec3(0.98), cap);
  } else {
    float bands = sin(lat * uBandFreq + (fbm(p * 3.0) - 0.5) * 2.5);
    col = mix(uColA, uColB, smoothstep(-0.8, 0.8, bands) * uBandAmp);
    col = mix(col, uColC, smoothstep(0.5, 0.95, fbm(p * 6.0 + 1.1)) * 0.35);
    if (uSpotOn > 0.5) {
      float d = distance(p, normalize(vec3(0.4, -0.25, 0.85)));
      float spot = 1.0 - smoothstep(0.1, 0.3, d);
      col = mix(col, vec3(0.75, 0.3, 0.18), spot * 0.8);
    }
  }

  vec3 N = normalize(vWorldNormal);
  float dif = clamp(dot(N, normalize(uSunDir)), 0.0, 1.0);
  col *= 0.16 + 1.05 * dif;
  float rim = pow(1.0 - abs(dot(N, normalize(cameraPosition - vObjPos))), 2.0);
  col += uColC * rim * 0.12;

  gl_FragColor = vec4(col, 1.0);
}
`;

const STAR_VERT_LOCAL = /* glsl */ `
attribute float aSize;
attribute float aPhase;
uniform float uTime;
uniform float uPixelRatio;
uniform float uDensity;
varying float vAlpha;

void main() {
  vAlpha = uDensity;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float tw = 0.7 + 0.3 * sin(uTime * (0.5 + aPhase * 1.5) + aPhase * 30.0);
  gl_PointSize = aSize * uPixelRatio * tw * (300.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

const STAR_FRAG_LOCAL = /* glsl */ `
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.0, length(c));
  gl_FragColor = vec4(vec3(0.9, 0.94, 1.0), a * a * vAlpha);
}
`;

/* ----------------------------- helpers ----------------------------- */

const rad = THREE.MathUtils.degToRad;

function dirFromAzEl(azDeg: number, elDeg: number, out: THREE.Vector3): THREE.Vector3 {
  const az = rad(azDeg);
  const el = rad(elDeg);
  return out.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
}

function makeSunTexture(color: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const col = new THREE.Color(color);
  const css = `rgb(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0})`;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.12, css);
  grad.addColorStop(0.3, css.replace("rgb", "rgba").replace(")", ",0.5)"));
  grad.addColorStop(0.65, css.replace("rgb", "rgba").replace(")", ",0.14)"));
  grad.addColorStop(1, css.replace("rgb", "rgba").replace(")", ",0)"));
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const BODY_PRESETS: Record<
  string,
  { kind: number; a: string; b: string; c: string; bandFreq: number; bandAmp: number; spot: boolean }
> = {
  jupiter: { kind: 0, a: "#d8c0a0", b: "#a07f5c", c: "#efe4c8", bandFreq: 16, bandAmp: 0.85, spot: true },
  saturn: { kind: 0, a: "#e8d8b0", b: "#c2a878", c: "#f2e8cc", bandFreq: 11, bandAmp: 0.5, spot: false },
  uranus: { kind: 0, a: "#a8d8dc", b: "#8fc4ca", c: "#c4e8ea", bandFreq: 5, bandAmp: 0.22, spot: false },
  neptune: { kind: 0, a: "#3a5ab8", b: "#27418c", c: "#5a7ad0", bandFreq: 7, bandAmp: 0.4, spot: true },
  earth: { kind: 1, a: "#1a4fb0", b: "#3d7a3a", c: "#bcd8f0", bandFreq: 0, bandAmp: 0, spot: false },
  mars: { kind: 2, a: "#b06a3f", b: "#6e3f22", c: "#d89a6a", bandFreq: 0, bandAmp: 0, spot: false },
};

/* ------------------- ruído JS (espelho do GLSL) ------------------- */

function hash3(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return s - Math.floor(s);
}

function vnoise(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);
  const c000 = hash3(xi, yi, zi),     c100 = hash3(xi + 1, yi, zi);
  const c010 = hash3(xi, yi + 1, zi), c110 = hash3(xi + 1, yi + 1, zi);
  const c001 = hash3(xi, yi, zi + 1), c101 = hash3(xi + 1, yi, zi + 1);
  const c011 = hash3(xi, yi + 1, zi + 1), c111 = hash3(xi + 1, yi + 1, zi + 1);
  const x00 = c000 + (c100 - c000) * u, x10 = c010 + (c110 - c010) * u;
  const x01 = c001 + (c101 - c001) * u, x11 = c011 + (c111 - c011) * u;
  const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}

function fbm(x: number, y: number, z: number): number {
  let a = 0.5, s = 0;
  for (let i = 0; i < 5; i++) {
    s += a * vnoise(x, y, z);
    x *= 2.02; y *= 2.02; z *= 2.02;
    a *= 0.5;
  }
  return s;
}

function ridged(x: number, y: number, z: number): number {
  let a = 0.5, s = 0;
  for (let i = 0; i < 4; i++) {
    const n = 1 - Math.abs(2 * vnoise(x, y, z) - 1);
    s += a * n * n;
    x *= 2.1; y *= 2.1; z *= 2.1;
    a *= 0.5;
  }
  return s;
}

/**
 * Altura do terreno sólido (unidades de mundo). Mesma fonte de verdade
 * usada para assar a geometria, posicionar rochas e seguir o chão na
 * caminhada WASD — por isso a colisão é exata.
 */
function terrainHeight(
  x: number,
  z: number,
  amp: number,
  dunes: number
): number {
  let h = fbm(x * 0.006, 3.7, z * 0.006) * amp * 3.1;
  h += ridged(x * 0.0028, 9.2, z * 0.0028) * amp * 2.3;
  h += fbm(x * 0.045, 17.9, z * 0.045) * amp * 0.55;

  /* afloramentos rochosos / bordas de cratera (estilo Pathfinder) */
  const rock = fbm(x * 0.016, 55.3, z * 0.016);
  if (rock > 0.72) h += (rock - 0.72) * 60;

  /* campo de dunas com orientação rotacionada e envelope irregular */
  if (dunes > 0) {
    const w = fbm(x * 0.012, 77.1, z * 0.012);
    const dir = x * 0.86 + z * 0.5;
    const env = 0.35 + 0.65 * fbm(x * 0.02, 31.7, z * 0.02);
    h += Math.sin(dir * 0.13 + w * 3.2) * amp * 0.62 * dunes * env;
  }
  return h;
}

/* --------------------------- shader rochas --------------------------- */

const ROCK_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vWp;
varying vec3 vTint;

void main() {
  vec3 tint = vec3(1.0);
  #ifdef USE_INSTANCING_COLOR
    tint = instanceColor;
  #endif
  vTint = tint;

  vec4 p = vec4(position, 1.0);
  vec3 n = normal;
  #ifdef USE_INSTANCING
    p = instanceMatrix * p;
    n = mat3(instanceMatrix) * n;
  #endif

  vec4 wp = modelMatrix * p;
  vWp = wp.xyz;
  vN = normalize(mat3(modelMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const ROCK_FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform float uAmbient;
uniform float uSunStrength;
uniform vec3 uSunTint;
uniform vec3 uFogColor;
uniform float uFogDensity;
varying vec3 vN;
varying vec3 vWp;
varying vec3 vTint;

void main() {
  vec3 N = normalize(vN);
  vec3 L = normalize(uSunDir);
  float dif = clamp(dot(N, L), 0.0, 1.0);
  float wrap = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = vTint * (uAmbient + uSunStrength * mix(wrap, dif, 0.7));
  col *= mix(vec3(1.0), uSunTint, 0.4);

  float dist = distance(vWp, cameraPosition);
  float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
  col = mix(col, uFogColor, clamp(fog, 0.0, 1.0));

  gl_FragColor = vec4(col, 1.0);
}
`;

/* ----------------------------- classe ----------------------------- */

export class SurfaceScene {
  private container: HTMLElement;
  private opts: SurfaceSceneOptions;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;

  private raf = 0;
  private clock = new THREE.Clock();
  private wallTime = 0;
  private disposed = false;
  private ro!: ResizeObserver;

  private yaw = 0;
  private pitch = 0.08;
  private fov = 70;
  private targetFov = 70;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private lastInteract = 0;
  private eyeHeight = 2.2;
  private teleTimer = 0;

  /* caminhada WASD + colisão com o terreno */
  private keys = new Set<string>();
  private walkX = 0;
  private walkZ = 0;
  private camY = 2.2;
  private moving = false;
  private canWalk = true;
  private heightAt: (x: number, z: number) => number = () => 0;
  private frames = 0;
  private fpsTimer = 0;
  private fps = 60;
  private panoActive = false;
  private sunCore: THREE.Sprite | null = null;
  private sunGlare: THREE.Sprite | null = null;
  private dustMat: THREE.PointsMaterial | null = null;

  private skyUniforms: Record<string, THREE.IUniform> = {};
  private terrainUniforms: Record<string, THREE.IUniform> = {};
  private starUniforms: Record<string, THREE.IUniform> = {};
  private bodyMats: THREE.ShaderMaterial[] = [];
  private dust: THREE.Points | null = null;
  private dustUniforms: Record<string, THREE.IUniform> | null = null;

  constructor(container: HTMLElement, opts: SurfaceSceneOptions) {
    this.container = container;
    this.opts = opts;
    this.initGL();
    this.build();
    this.bind();
    this.clock.start();
    this.loop();
  }

  private initGL() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.style.cursor = "grab";
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.fov, w / h, 0.1, 4000);
  }

  private build() {
    const d = this.opts.def;
    const r = d.realism ?? {};
    const sunDiffuse = THREE.MathUtils.clamp(r.sunDiffuse ?? 0, 0, 1);
    const glareBoost = THREE.MathUtils.clamp(r.glareBoost ?? 1, 0, 8);
    const bands = r.skyBands;

    /* direção do Sol (para iluminação) */
    const sunDir = new THREE.Vector3();
    dirFromAzEl(d.sunAzimuthDeg, d.sunElevationDeg, sunDir);

    /* ---------- céu: panorama equiretangular 360° ou procedural ---------- */
    if (d.panorama) this.addPanorama(d);
    else this.buildSky(d, sunDir, sunDiffuse, glareBoost);

    /* ---------- terreno ---------- */
    const duneAmp = THREE.MathUtils.clamp(r.dunes ?? 0, 0, 3);
    this.canWalk = !d.cloudSea;
    this.heightAt = (x, z) => terrainHeight(x, z, d.terrainAmp, duneAmp);

    this.terrainUniforms = {
      uBase: { value: new THREE.Color(d.terrainBase) },
      uMid: { value: new THREE.Color(d.terrainMid) },
      uDark: { value: new THREE.Color(d.terrainDark) },
      uFogColor: { value: new THREE.Color(d.fogColor) },
      uFogDensity: { value: d.fogDensity },
      uScale: { value: d.terrainScale },
      uAmp: { value: d.terrainAmp },
      uCloudSea: { value: d.cloudSea ? 1 : 0 },
      uBaked: { value: 0 },
      uCloudShadow: { value: d.effects === "clouds" ? 0.3 : 0 },
      uSunDir: { value: sunDir },
      uTime: { value: 0 },
      uAmbient: { value: THREE.MathUtils.clamp(r.ambient ?? 0.35, 0.02, 1) },
      uSunStrength: { value: THREE.MathUtils.clamp(r.sunStrength ?? 1.0, 0, 2.5) },
      uSunTint: { value: new THREE.Color(r.sunTint ?? "#ffffff") },
      uSparkle: { value: THREE.MathUtils.clamp(r.sparkle ?? 0, 0, 1.5) },
    };

    let terrainGeo: THREE.BufferGeometry;
    if (this.canWalk) {
      /* sólido: alturas assadas na CPU → colisão exata para caminhada WASD */
      terrainGeo = new THREE.PlaneGeometry(2000, 2000, 176, 176);
      terrainGeo.rotateX(-Math.PI / 2);
      const pos = terrainGeo.attributes.position as THREE.BufferAttribute;
      const heights = new Float32Array(pos.count);
      const normAmp = Math.max(d.terrainAmp * 5.5, 1);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const h = this.heightAt(x, z);
        pos.setY(i, h);
        heights[i] = h / normAmp;
      }
      terrainGeo.setAttribute("aHeight", new THREE.BufferAttribute(heights, 1));
      terrainGeo.computeVertexNormals();
      this.terrainUniforms.uAmp.value = normAmp;
      this.terrainUniforms.uBaked.value = 1;
      this.eyeHeight = 2.2;
      this.camY = this.heightAt(0, 0) + this.eyeHeight;
    } else {
      /* mar de nuvens: deslocamento animado na GPU */
      terrainGeo = new THREE.PlaneGeometry(2600, 2600, 220, 220);
      terrainGeo.rotateX(-Math.PI / 2);
      this.eyeHeight = d.terrainAmp * 0.55 + 2.3;
    }
    const terrain = new THREE.Mesh(
      terrainGeo,
      new THREE.ShaderMaterial({
        vertexShader: TERRAIN_VERT,
        fragmentShader: TERRAIN_FRAG,
        uniforms: this.terrainUniforms,
      })
    );
    this.scene.add(terrain);

    /* ---------- campo de rochas 3D ---------- */
    if (this.canWalk && r.rockField) this.addRocks(r.rockField);

    /* ---------- estrelas ---------- */
    if (d.starsVisible && d.starDensity > 0) {
      const N = 900;
      const pos = new Float32Array(N * 3);
      const size = new Float32Array(N);
      const phase = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const az = Math.random() * Math.PI * 2;
        const el = Math.acos(Math.random()); // hemisfério superior
        const r = 1650;
        pos[i * 3] = r * Math.cos(el) * Math.sin(az);
        pos[i * 3 + 1] = r * Math.sin(el);
        pos[i * 3 + 2] = r * Math.cos(el) * Math.cos(az);
        size[i] = 0.8 + Math.random() * 1.8;
        phase[i] = Math.random();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
      geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
      this.starUniforms = {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uDensity: { value: d.starDensity },
      };
      const stars = new THREE.Points(
        geo,
        new THREE.ShaderMaterial({
          vertexShader: STAR_VERT_LOCAL,
          fragmentShader: STAR_FRAG_LOCAL,
          uniforms: this.starUniforms,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      stars.renderOrder = -5;
      this.scene.add(stars);
    }

    /* ---------- Sol: núcleo nítido + halo de glare (série Ron Miller) ---------- */
    const sunTex = makeSunTexture(d.sunColor);
    const sunPos = sunDir.clone().multiplyScalar(1500);

    // núcleo — disco solar real; encolhe quando o Sol é difuso (Vênus/Titã)
    const coreScale = THREE.MathUtils.clamp(
      1500 * Math.tan(rad(d.sunAngularDeg / 2)) * 2.4 * (1 - sunDiffuse),
      0,
      220
    );
    if (coreScale > 0.4 && d.sunVisible) {
      const coreMat = new THREE.SpriteMaterial({
        map: sunTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 1,
      });
      this.sunCore = new THREE.Sprite(coreMat);
      this.sunCore.scale.set(coreScale, coreScale, 1);
      this.sunCore.position.copy(sunPos);
      this.sunCore.renderOrder = 4;
      this.scene.add(this.sunCore);
    }

    // halo de glare — ofuscamento atmosférico / brilho de ponto estelar
    const glareScale = THREE.MathUtils.clamp(
      Math.max(26, 1500 * Math.tan(rad(d.sunAngularDeg / 2)) * 9.5) *
        (0.55 + 0.45 * glareBoost) *
        (1 - sunDiffuse * 0.72),
      0,
      620
    );
    if (glareScale > 1 && d.sunVisible) {
      const glareMat = new THREE.SpriteMaterial({
        map: sunTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: THREE.MathUtils.clamp(0.42 * glareBoost, 0, 1),
      });
      this.sunGlare = new THREE.Sprite(glareMat);
      this.sunGlare.scale.set(glareScale, glareScale, 1);
      this.sunGlare.position.copy(sunPos);
      this.sunGlare.renderOrder = 3;
      this.scene.add(this.sunGlare);
    }

    /* ---------- corpos no céu ---------- */
    for (const sb of d.visibleBodies) this.addSkyBody(sb, sunDir);

    /* ---------- poeira (Marte) ---------- */
    if (d.effects === "dust") this.addDust(d);
  }

  /** Céu procedural em gradiente (fallback / corpos sem panorama) */
  private buildSky(
    d: SurfaceViewDef,
    sunDir: THREE.Vector3,
    sunDiffuse: number,
    glareBoost: number
  ) {
    const r = d.realism ?? {};
    const bands = r.skyBands;
    this.skyUniforms = {
      uSkyTop: { value: new THREE.Color(d.skyTop) },
      uSkyHorizon: { value: new THREE.Color(d.skyHorizon) },
      uHaze: { value: new THREE.Color(d.fogColor) },
      uHazeBoost: { value: d.effects === "haze" ? 0.85 : 0.45 },
      uCloudMix: { value: d.effects === "clouds" ? 0.55 : 0 },
      uTime: { value: 0 },
      uSunDir: { value: sunDir.clone() },
      uSunColor: { value: new THREE.Color(d.sunColor) },
      uSunDiffuse: { value: sunDiffuse },
      uSunGlow: { value: glareBoost * 0.45 },
      uBandsAmp: { value: bands ? THREE.MathUtils.clamp(bands.amp, 0, 1) : 0 },
      uBandScale: { value: bands ? Math.max(0.5, bands.scale) : 3 },
      uBandDrift: { value: bands ? Math.max(0, bands.drift) : 0.02 },
      uBandA: { value: new THREE.Color(bands ? bands.colorA : "#ffffff") },
      uBandB: { value: new THREE.Color(bands ? bands.colorB : "#cccccc") },
      uMilkyWay: { value: THREE.MathUtils.clamp(r.milkyWay ?? 0, 0, 1) },
    };
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(1800, 40, 24),
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        uniforms: this.skyUniforms,
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
    sky.renderOrder = -10;
    this.scene.add(sky);
  }

  /**
   * Cúpula com panorama equiretangular 360° (estilo Blockade Labs Skybox AI).
   * Tenta as URLs em ordem — aceita um skybox local em public/panos/mars.jpg
   * ou o ativo remoto — e calibra a cena em runtime:
   *  1. detecta o Sol gravado na imagem (pixel mais brilhante do céu);
   *  2. gira a cúpula para alinhar esse Sol à direção de iluminação do terreno;
   *  3. amostra a cor média da faixa do horizonte e a usa como névoa,
   *     para o terreno procedural emendar sem costura no fundo fotorreal.
   */
  private addPanorama(d: SurfaceViewDef) {
    const urls = d.panorama?.urls ?? [];
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    const tryLoad = (i: number) => {
      if (i >= urls.length) {
        const sunDir = new THREE.Vector3();
        dirFromAzEl(d.sunAzimuthDeg, d.sunElevationDeg, sunDir);
        this.buildSky(d, sunDir, 0, 1.15);
        return;
      }
      loader.load(
        urls[i],
        (tex) => this.onPanoramaLoaded(tex, d),
        undefined,
        () => tryLoad(i + 1)
      );
    };
    tryLoad(0);
  }

  private onPanoramaLoaded(tex: THREE.Texture, d: SurfaceViewDef) {
    if (this.disposed) return;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.max(1, this.renderer.capabilities.getMaxAnisotropy());

    const geo = new THREE.SphereGeometry(1750, 64, 32);
    geo.scale(-1, 1, 1); // panorama visto por dentro, sem espelhamento
    const dome = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.FrontSide, fog: false, depthWrite: false })
    );
    dome.renderOrder = -9;
    this.scene.add(dome);
    this.panoActive = true;

    /* ---- calibração: Sol da imagem → direção de iluminação da cena ---- */
    try {
      const img = tex.image as TexImageSource & { width: number; height: number };
      const cw = 512;
      const ch = 256;
      const cv = document.createElement("canvas");
      cv.width = cw;
      cv.height = ch;
      const ctx = cv.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img as CanvasImageSource, 0, 0, cw, ch);
      const data = ctx.getImageData(0, 0, cw, ch).data;

      /* Sol: centróide dos pixels mais brilhantes na metade superior (céu) */
      let maxL = 0;
      for (let y = 0; y < ch * 0.55; y++) {
        for (let x = 0; x < cw; x++) {
          const i = (y * cw + x) * 4;
          const l = data[i] + data[i + 1] + data[i + 2];
          if (l > maxL) maxL = l;
        }
      }
      const thr = maxL * 0.86;
      let sx = 0;
      let sy = 0;
      let sn = 0;
      for (let y = 0; y < ch * 0.55; y++) {
        for (let x = 0; x < cw; x++) {
          const i = (y * cw + x) * 4;
          const l = data[i] + data[i + 1] + data[i + 2];
          if (l >= thr) {
            sx += x;
            sy += y;
            sn++;
          }
        }
      }
      if (sn > 20 && maxL > 500) {
        const u = sx / sn / cw;
        const v = sy / sn / ch;
        const azPano = (u - 0.25) * 360;
        const elPano = (0.5 - v) * 180;
        const dirPano = dirFromAzEl(azPano, elPano, new THREE.Vector3()).normalize();
        const elTarget = THREE.MathUtils.clamp(elPano, 8, 60);
        const dirTarget = dirFromAzEl(d.sunAzimuthDeg, elTarget, new THREE.Vector3());

        dome.quaternion.setFromUnitVectors(dirPano, dirTarget.clone().normalize());
        (this.terrainUniforms.uSunDir.value as THREE.Vector3).copy(dirTarget);

        /* o panorama já traz o Sol e o glare — esconde os sprites procedurais */
        if (this.sunCore) this.sunCore.visible = false;
        if (this.sunGlare) this.sunGlare.visible = false;
      }

      /* ---- névoa adaptativa: cor média da faixa do horizonte do panorama ---- */
      let hr = 0;
      let hg = 0;
      let hb = 0;
      let hn = 0;
      const y0 = Math.floor(ch * 0.44);
      const y1 = Math.floor(ch * 0.56);
      for (let y = y0; y < y1; y += 2) {
        for (let x = 0; x < cw; x += 2) {
          const i = (y * cw + x) * 4;
          hr += data[i];
          hg += data[i + 1];
          hb += data[i + 2];
          hn++;
        }
      }
      if (hn > 0) {
        const horizon = new THREE.Color(hr / hn / 255, hg / hn / 255, hb / hn / 255)
          .convertSRGBToLinear()
          .multiplyScalar(0.94);
        (this.terrainUniforms.uFogColor.value as THREE.Color).copy(horizon);
        if (this.dustMat) this.dustMat.color.copy(horizon.clone().multiplyScalar(1.25));
      }
    } catch {
      /* imagem protegida por CORS: mantém a cúpula sem calibração */
    }
  }

  private addSkyBody(sb: SkyBodyDef, sunDir: THREE.Vector3) {
    const preset = BODY_PRESETS[sb.type] ?? BODY_PRESETS.jupiter;
    const dist = 900;
    const radius = Math.max(1.2, dist * Math.tan(rad(sb.angularDeg / 2)));
    const mat = new THREE.ShaderMaterial({
      vertexShader: BODY_VERT,
      fragmentShader: BODY_FRAG,
      uniforms: {
        uKind: { value: preset.kind },
        uColA: { value: new THREE.Color(preset.a) },
        uColB: { value: new THREE.Color(preset.b) },
        uColC: { value: new THREE.Color(preset.c) },
        uBandFreq: { value: preset.bandFreq },
        uBandAmp: { value: preset.bandAmp },
        uSpotOn: { value: preset.spot ? 1 : 0 },
        uSunDir: { value: sunDir.clone() },
      },
    });
    this.bodyMats.push(mat);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), mat);
    dirFromAzEl(sb.azimuthDeg, sb.elevationDeg, mesh.position).multiplyScalar(dist);
    this.scene.add(mesh);
  }

  private addDust(d: SurfaceViewDef) {
    const N = 500;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 8 + Math.random() * 140;
      const a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.random() * 14;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.dustUniforms = { uTime: { value: 0 } };
    this.dustMat = new THREE.PointsMaterial({
      color: new THREE.Color(d.fogColor).lerp(new THREE.Color("#d8a878"), 0.5),
      size: 0.5,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    this.dust = new THREE.Points(geo, this.dustMat);
    this.scene.add(this.dust);
  }

  /** rochas espalhadas pelo terreno (dodecaedros instanciados, flat-shaded) */
  private addRocks(rf: { count: number; maxScale: number; colorA: string; colorB: string }) {
    const count = Math.max(1, Math.min(rf.count, 600));
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const mat = new THREE.ShaderMaterial({
      vertexShader: ROCK_VERT,
      fragmentShader: ROCK_FRAG,
      uniforms: {
        uSunDir: this.terrainUniforms.uSunDir,
        uAmbient: this.terrainUniforms.uAmbient,
        uSunStrength: this.terrainUniforms.uSunStrength,
        uSunTint: this.terrainUniforms.uSunTint,
        uFogColor: this.terrainUniforms.uFogColor,
        uFogDensity: this.terrainUniforms.uFogDensity,
      },
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();
    const colA = new THREE.Color(rf.colorA);
    const colB = new THREE.Color(rf.colorB);
    const tmp = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      /* mais densas perto do visitante, esparsas ao longe */
      const radius = 7 + 690 * Math.pow(Math.random(), 1.55);
      const x = Math.cos(ang) * radius;
      const z = Math.sin(ang) * radius;
      const scale = 0.45 + Math.pow(Math.random(), 2.2) * rf.maxScale;

      dummy.position.set(x, this.heightAt(x, z) - scale * 0.32, z);
      dummy.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      dummy.scale.set(
        scale,
        scale * (0.5 + Math.random() * 0.4),
        scale * (0.75 + Math.random() * 0.45)
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      tmp.copy(colA).lerp(colB, Math.random()).multiplyScalar(0.72 + Math.random() * 0.55);
      mesh.setColorAt(i, tmp);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.scene.add(mesh);
  }

  private bind() {
    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    el.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.container);

    /* orientação inicial voltada ao corpo celeste principal / Sol */
    const d = this.opts.def;
    const focus = d.visibleBodies[0];
    const az = focus ? focus.azimuthDeg : d.sunAzimuthDeg;
    const elv = focus ? focus.elevationDeg : d.sunElevationDeg;
    this.yaw = rad(az);
    this.pitch = THREE.MathUtils.clamp(rad(elv) * 0.5, 0, 0.6);
    this.lastInteract = 0;
  }

  private onDown = (e: PointerEvent) => {
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.lastInteract = this.wallTime;
    this.renderer.domElement.style.cursor = "grabbing";
  };

  private onMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.yaw -= dx * 0.0035;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.003, -1.45, 1.5);
    this.lastInteract = this.wallTime;
  };

  private onUp = () => {
    this.dragging = false;
    this.renderer.domElement.style.cursor = "grab";
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.targetFov = THREE.MathUtils.clamp(this.targetFov + e.deltaY * 0.05, 35, 100);
    this.lastInteract = this.wallTime;
  };

  private static MOVE_KEYS = new Set([
    "KeyW", "KeyA", "KeyS", "KeyD",
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    "ShiftLeft", "ShiftRight",
  ]);

  private onKeyDown = (e: KeyboardEvent) => {
    if (SurfaceScene.MOVE_KEYS.has(e.code)) {
      this.keys.add(e.code);
      if (e.code.startsWith("Arrow")) e.preventDefault();
      this.lastInteract = this.wallTime;
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onBlur = () => {
    this.keys.clear();
  };

  private resize() {
    if (this.disposed) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.wallTime += dt;

    /* deriva automática quando ocioso */
    if (!this.dragging && this.wallTime - this.lastInteract > 3) {
      this.yaw += dt * 0.02;
    }

    /* fov suave */
    this.fov += (this.targetFov - this.fov) * Math.min(1, dt * 8);
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();

    /* caminhada WASD + colisão com o terreno */
    const d = this.opts.def;
    if (this.canWalk) {
      let f = 0;
      let s = 0;
      if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) f += 1;
      if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) f -= 1;
      if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) s += 1;
      if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) s -= 1;
      const sprint = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");

      if (f !== 0 || s !== 0) {
        /* passada mais larga em gravidade baixa — saltitar na Lua! */
        const base = 11 * Math.pow(9.81 / Math.max(d.gravityMs2, 0.05), 0.3);
        const sp = base * (sprint ? 2.6 : 1) * dt;
        const sinY = Math.sin(this.yaw);
        const cosY = Math.cos(this.yaw);
        let nx = this.walkX + (sinY * f - cosY * s) * sp;
        let nz = this.walkZ + (cosY * f + sinY * s) * sp;
        const rr = Math.hypot(nx, nz);
        if (rr > 900) {
          nx *= 900 / rr;
          nz *= 900 / rr;
        }
        this.walkX = nx;
        this.walkZ = nz;
        this.moving = true;
        this.lastInteract = this.wallTime;
      } else {
        this.moving = false;
      }

      const bob = this.moving ? Math.sin(this.wallTime * 7.5) * 0.1 : 0;
      const targetY = this.heightAt(this.walkX, this.walkZ) + this.eyeHeight + bob;
      this.camY += (targetY - this.camY) * Math.min(1, dt * 6);
    } else {
      /* flutuando sobre o mar de nuvens */
      this.camY = this.eyeHeight + Math.sin(this.wallTime * 1.1) * 0.05;
    }

    /* câmera em primeira pessoa */
    const py = this.camY;
    this.camera.position.set(this.walkX, py, this.walkZ);
    const cp = Math.cos(this.pitch);
    this.camera.lookAt(
      this.walkX + cp * Math.sin(this.yaw),
      py + Math.sin(this.pitch),
      this.walkZ + cp * Math.cos(this.yaw)
    );

    /* uniforms de tempo */
    if (this.skyUniforms.uTime) this.skyUniforms.uTime.value = this.wallTime;
    this.terrainUniforms.uTime.value = this.wallTime;
    if (this.starUniforms.uTime) this.starUniforms.uTime.value = this.wallTime;
    if (this.dust) {
      this.dust.rotation.y += dt * 0.05;
      this.dust.position.y = Math.sin(this.wallTime * 0.3) * 0.4;
    }

    /* FPS (média de 1 s) */
    this.frames++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 1) {
      this.fps = Math.round(this.frames / this.fpsTimer);
      this.frames = 0;
      this.fpsTimer = 0;
    }

    /* telemetria ~10 Hz */
    this.teleTimer += dt;
    if (this.teleTimer >= 0.1) {
      this.teleTimer = 0;
      const azDeg = ((THREE.MathUtils.radToDeg(this.yaw) % 360) + 360) % 360;
      this.opts.onTelemetry({
        azimuthDeg: azDeg,
        pitchDeg: THREE.MathUtils.radToDeg(this.pitch),
        fov: this.fov,
        fps: this.fps,
        posX: this.walkX,
        posZ: this.walkZ,
        canWalk: this.canWalk,
        moving: this.moving,
        panoActive: this.panoActive,
      });
    }

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onDown);
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
    el.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.ro.disconnect();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) {
        const anyMat = mat as THREE.Material & { map?: THREE.Texture | null };
        if (anyMat.map) anyMat.map.dispose();
        mat.dispose();
      }
    });
    this.renderer.dispose();
    el.remove();
  }
}
