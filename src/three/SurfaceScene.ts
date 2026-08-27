import * as THREE from "three";
import type { SurfaceViewDef, SkyBodyDef } from "../data/surfaceViews";
import { NOISE_GLSL } from "./shaders";

export interface SurfaceTelemetry {
  azimuthDeg: number;
  pitchDeg: number;
  fov: number;
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
uniform float uTime;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vHeight;

float terrainH(vec2 xz) {
  vec2 p = xz * uScale;
  float h;
  if (uCloudSea > 0.5) {
    float bands = sin(xz.y * 0.045 + fbm(vec3(xz * 0.006, uTime * 0.05)) * 3.0);
    h = bands * uAmp * 0.5 + fbm(vec3(xz * 0.008, uTime * 0.04)) * uAmp * 0.6;
  } else {
    h = fbm(vec3(p, 3.7)) * uAmp;
    h += ridged(vec3(p * 0.4, 9.2)) * uAmp * 0.55;
  }
  return h;
}

void main() {
  vec3 pos = position;
  float h = terrainH(pos.xz);
  pos.y += h;
  vHeight = h / max(uAmp, 0.001);

  float e = 0.6;
  float hx = terrainH(pos.xz + vec2(e, 0.0));
  float hz = terrainH(pos.xz + vec2(0.0, e));
  vNormal = normalize(vec3(h - hx, e, h - hz));

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

    /* ---------- céu ---------- */
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

    /* ---------- terreno ---------- */
    this.terrainUniforms = {
      uBase: { value: new THREE.Color(d.terrainBase) },
      uMid: { value: new THREE.Color(d.terrainMid) },
      uDark: { value: new THREE.Color(d.terrainDark) },
      uFogColor: { value: new THREE.Color(d.fogColor) },
      uFogDensity: { value: d.fogDensity },
      uScale: { value: d.terrainScale },
      uAmp: { value: d.terrainAmp },
      uCloudSea: { value: d.cloudSea ? 1 : 0 },
      uCloudShadow: { value: d.effects === "clouds" ? 0.3 : 0 },
      uSunDir: { value: sunDir },
      uTime: { value: 0 },
      uAmbient: { value: THREE.MathUtils.clamp(r.ambient ?? 0.35, 0.02, 1) },
      uSunStrength: { value: THREE.MathUtils.clamp(r.sunStrength ?? 1.0, 0, 2.5) },
      uSunTint: { value: new THREE.Color(r.sunTint ?? "#ffffff") },
      uSparkle: { value: THREE.MathUtils.clamp(r.sparkle ?? 0, 0, 1.5) },
    };
    const terrain = new THREE.Mesh(
      new THREE.PlaneGeometry(2600, 2600, 220, 220),
      new THREE.ShaderMaterial({
        vertexShader: TERRAIN_VERT,
        fragmentShader: TERRAIN_FRAG,
        uniforms: this.terrainUniforms,
      })
    );
    terrain.geometry.rotateX(-Math.PI / 2);
    this.scene.add(terrain);
    this.eyeHeight = d.terrainAmp * 0.55 + 2.3;

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
      const core = new THREE.Sprite(coreMat);
      core.scale.set(coreScale, coreScale, 1);
      core.position.copy(sunPos);
      core.renderOrder = 4;
      this.scene.add(core);
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
      const glare = new THREE.Sprite(glareMat);
      glare.scale.set(glareScale, glareScale, 1);
      glare.position.copy(sunPos);
      glare.renderOrder = 3;
      this.scene.add(glare);
    }

    /* ---------- corpos no céu ---------- */
    for (const sb of d.visibleBodies) this.addSkyBody(sb, sunDir);

    /* ---------- poeira (Marte) ---------- */
    if (d.effects === "dust") this.addDust(d);
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
    const mat = new THREE.PointsMaterial({
      color: new THREE.Color(d.fogColor).lerp(new THREE.Color("#d8a878"), 0.5),
      size: 0.5,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    this.dust = new THREE.Points(geo, mat);
    this.scene.add(this.dust);
  }

  private bind() {
    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    el.addEventListener("wheel", this.onWheel, { passive: false });
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

    /* câmera em primeira pessoa */
    const bob = Math.sin(this.wallTime * 1.1) * 0.05;
    const py = this.eyeHeight + bob;
    this.camera.position.set(0, py, 0);
    const cp = Math.cos(this.pitch);
    this.camera.lookAt(
      cp * Math.sin(this.yaw),
      py + Math.sin(this.pitch),
      cp * Math.cos(this.yaw)
    );

    /* uniforms de tempo */
    this.skyUniforms.uTime.value = this.wallTime;
    this.terrainUniforms.uTime.value = this.wallTime;
    if (this.starUniforms.uTime) this.starUniforms.uTime.value = this.wallTime;
    if (this.dust) {
      this.dust.rotation.y += dt * 0.05;
      this.dust.position.y = Math.sin(this.wallTime * 0.3) * 0.4;
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
    this.ro.disconnect();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
    this.renderer.dispose();
    el.remove();
  }
}
