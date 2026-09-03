import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { PLANETS, SUN, type BodyDef } from "../data/bodies";
import {
  SURFACE_VERT,
  PLANET_FRAG,
  EARTH_FRAG,
  CLOUD_FRAG,
  SUN_FRAG,
  CORONA_FRAG,
  ATMO_FRAG,
  RING_VERT,
  RING_FRAG,
  STAR_VERT,
  STAR_FRAG,
  NEBULA_FRAG,
} from "./shaders";
import { BODY_TEXTURES, loadTextureQueue } from "./textures";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

/** placeholder 1×1 para samplers antes da chegada da textura fotográfica */
const WHITE_TEX = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 4;
  const g = c.getContext("2d")!;
  g.fillStyle = "#808080";
  g.fillRect(0, 0, 4, 4);
  return new THREE.CanvasTexture(c);
})();

/** grão de filme + vinheta (pós-produção leve, 1 passe fullscreen) */
const FilmShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.32 },
    uGrain: { value: 0.042 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    varying vec2 vUv;
    float hash21(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 q = vUv - 0.5;
      c.rgb *= clamp(1.0 - uVignette * dot(q, q) * 1.6, 0.0, 1.0);
      float g = hash21(vUv * vec2(1917.0, 1013.0) + fract(uTime) * 61.7) - 0.5;
      c.rgb += g * uGrain;
      gl_FragColor = c;
    }
  `,
};

/** Períodos de rotação (dias) — negativo = retrógrada */
const ROT_DAYS: Record<string, number> = {
  mercury: 58.65,
  venus: -243,
  earth: 0.997,
  mars: 1.026,
  jupiter: 0.414,
  saturn: 0.444,
  uranus: -0.718,
  neptune: 0.671,
};

/** Fator visual para rotação (mantém proporções entre planetas sem strobing) */
const ROT_VISUAL = 0.03;
const BASE_DAYS_PER_SEC = 8;

/** Excentricidade orbital real (Kepler) — elipses com o Sol no foco */
const ECC: Record<string, number> = {
  mercury: 0.2056,
  venus: 0.0068,
  earth: 0.0167,
  mars: 0.0934,
  jupiter: 0.0489,
  saturn: 0.0565,
  uranus: 0.0457,
  neptune: 0.0113,
};

const VARPI: Record<string, number> = {
  mercury: 77,
  venus: 131,
  earth: 103,
  mars: 336,
  jupiter: 14,
  saturn: 93,
  uranus: 173,
  neptune: 48,
};

/** Resolve M = E − e·sin(E) por Newton — com excentricidade clampada p/ estabilidade */
function solveKepler(M: number, e: number): number {
  const ec = THREE.MathUtils.clamp(e, 0, 0.9);
  let E = ec < 0.8 ? M : Math.PI;
  for (let i = 0; i < 7; i++) {
    const f = E - ec * Math.sin(E) - M;
    E -= f / Math.max(1 - ec * Math.cos(E), 0.1);
  }
  return E;
}

export interface HudData {
  fps: number;
  simDays: number;
  daysPerSec: number;
  paused: boolean;
}

export interface SolarSystemOptions {
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onHud: (h: HudData) => void;
  onTexProgress?: (done: number, total: number) => void;
}

interface BodyRT {
  id: string;
  def: BodyDef;
  isMoon: boolean;
  parentId?: string;
  anchor: THREE.Group;
  mesh: THREE.Mesh;
  orbitMat?: THREE.LineBasicMaterial;
  labelEl: HTMLDivElement;
  theta0: number;
  orbitR: number;
  periodDays: number;
  spin: number;
  ecc: number;
  varpi: number;
}

const V0 = new THREE.Vector3();
const V1 = new THREE.Vector3();
const V2 = new THREE.Vector3();

export function surfaceUniforms(src: { surface: BodyDef["surface"] }) {
  const s = src.surface;
  const palette = s.palette.map((c) => new THREE.Color(c));
  while (palette.length < 6) palette.push(new THREE.Color("#000000"));
  const u: Record<string, THREE.IUniform> = {
    uPalette: { value: palette },
    uTime: { value: 0 },
    uBandFreq: { value: THREE.MathUtils.clamp(s.bandFreq, 0, 40) },
    uBandTurb: { value: THREE.MathUtils.clamp(s.bandTurb, 0, 8) },
    uBandAmp: { value: THREE.MathUtils.clamp(s.bandAmp, 0, 1) },
    uNoiseScale: { value: THREE.MathUtils.clamp(s.noiseScale, 0.1, 30) },
    uNoiseAmp: { value: THREE.MathUtils.clamp(s.noiseAmp, 0, 1) },
    uRidgeScale: { value: THREE.MathUtils.clamp(s.ridgeScale, 0, 30) },
    uRidgeAmp: { value: THREE.MathUtils.clamp(s.ridgeAmp, 0, 1) },
    uCraterScale: { value: THREE.MathUtils.clamp(s.craterScale, 0, 30) },
    uCraterAmp: { value: THREE.MathUtils.clamp(s.craterAmp, 0, 1) },
    uPolarCap: { value: THREE.MathUtils.clamp(s.polarCap, 0, 1) },
    uSpotPos: { value: new THREE.Vector3(0, 1, 0) },
    uSpotSize: { value: THREE.MathUtils.clamp(s.spot ? s.spot.size : 0.4, 0.02, 1.2) },
    uSpotOn: { value: s.spot ? 1 : 0 },
    uSpotColor: { value: new THREE.Color(s.spot ? s.spot.color : "#000000") },
    uAtmosColor: { value: new THREE.Color(s.atmosColor) },
    uAtmosAmp: { value: THREE.MathUtils.clamp(s.atmosAmp, 0, 2) },
    uSunPos: { value: new THREE.Vector3(0, 0, 0) },
    /* textura fotográfica (chega via fila assíncrona; crossfade por uMapMix) */
    uMap: { value: WHITE_TEX },
    uMapMix: { value: 0 },
    uDetail: { value: s.earthLike ? 0.15 : s.craterAmp > 0.2 ? 0.5 : 0.35 },
  };
  if (s.spot) {
    const lat = THREE.MathUtils.degToRad(s.spot.latDeg);
    const lon = THREE.MathUtils.degToRad(s.spot.lonDeg);
    u.uSpotPos.value.set(
      Math.cos(lat) * Math.cos(lon),
      Math.sin(lat),
      Math.cos(lat) * Math.sin(lon)
    );
  }
  return u;
}

/** Vento solar: partículas radiais animadas 100% na GPU (zero escrita CPU por frame) */
const WIND_VERT = /* glsl */ `
attribute float aAng;
attribute float aRad;
attribute float aY;
attribute float aPhase;
uniform float uTime;
varying float vFade;
void main() {
  float speed = 26.0 / max(aRad, 1.0);
  float r = mod(aRad + uTime * speed, 78.0) + 6.5;
  vec3 p = vec3(cos(aAng) * r, aY, sin(aAng) * r);
  vFade = smoothstep(6.5, 14.0, r) * (1.0 - smoothstep(55.0, 84.0, r));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp((1.2 + aPhase) * (120.0 / max(-mv.z, 1.0)), 1.0, 4.0);
  gl_Position = projectionMatrix * mv;
}
`;
const WIND_FRAG = /* glsl */ `
varying float vFade;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.0, length(c)) * vFade * 0.35;
  gl_FragColor = vec4(1.0, 0.72, 0.35, a);
}
`;

export class SolarSystem {
  private container: HTMLElement;
  private labelLayer: HTMLElement;
  private opts: SolarSystemOptions;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private composer!: EffectComposer;
  private bloom!: UnrealBloomPass;

  private bodies = new Map<string, BodyRT>();
  private pickables: THREE.Object3D[] = [];
  private surfaceMats: THREE.ShaderMaterial[] = [];
  private starMat!: THREE.ShaderMaterial;
  private sunMats: THREE.ShaderMaterial[] = [];
  private windMat!: THREE.ShaderMaterial;
  private beltInner!: THREE.Group;
  private beltOuter!: THREE.Group;
  private filmPass!: ShaderPass;

  /* registros p/ aplicação das texturas fotográficas */
  private bodyMats = new Map<string, THREE.ShaderMaterial>();
  private ringMats = new Map<string, THREE.ShaderMaterial>();
  private sunMat: THREE.ShaderMaterial | null = null;
  private earthCloudMat: THREE.ShaderMaterial | null = null;
  private venusAtmoMat: THREE.ShaderMaterial | null = null;
  private fades: { mat: THREE.ShaderMaterial; uniform: string; t: number }[] = [];
  private selectedId: string | null = null;

  /* LOD: esferas unitárias compartilhadas (1 por tier) — todas as malhas
     usam scale, evitando dezenas de geometrias grandes na VRAM. */
  private sphereHi = new THREE.SphereGeometry(1, 64, 44);
  private sphereMd = new THREE.SphereGeometry(1, 44, 30);
  private sphereLo = new THREE.SphereGeometry(1, 26, 18);

  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2(-10, -10);
  private mouseMoved = false;
  private downPos = { x: 0, y: 0 };

  private simDays = 0;
  private speedMult = 4;
  private paused = false;
  private showOrbits = true;
  private showLabels = true;
  private showBelt = true;

  private hoveredId: string | null = null;

  private cam = { mode: "free" as "free" | "approach" | "follow", id: null as string | null, dist: 95 };
  private lastFollow = new THREE.Vector3();

  private raf = 0;
  private clock = new THREE.Clock();
  private wallTime = 0;
  private hudTimer = 0;
  private frames = 0;
  private fps = 60;
  /* resolução adaptativa */
  private maxDpr = Math.min(window.devicePixelRatio || 1, 2);
  private dpr: number;
  private lowStreak = 0;
  private highStreak = 0;
  private ro!: ResizeObserver;
  private disposed = false;

  constructor(container: HTMLElement, labelLayer: HTMLElement, opts: SolarSystemOptions) {
    this.container = container;
    this.labelLayer = labelLayer;
    this.opts = opts;
    this.dpr = this.maxDpr;
    this.initGL();
    this.buildScene();
    this.bindEvents();
    this.startTextures();
    this.clock.start();
    this.loop();
  }

  /** baixa as texturas fotográficas (Solar System Scope) e aplica com crossfade */
  private startTextures() {
    const jobs: { bodyId: string; job: (typeof BODY_TEXTURES)[string][number] }[] = [];
    for (const [bodyId, list] of Object.entries(BODY_TEXTURES)) {
      for (const job of list) jobs.push({ bodyId, job });
    }
    const aniso = this.renderer.capabilities.getMaxAnisotropy();
    void loadTextureQueue(jobs, aniso, (done, total) => {
      this.opts.onTexProgress?.(done, total);
    }).then((results) => {
      if (this.disposed) return;
      const fade = (m: THREE.ShaderMaterial, uniform: string) =>
        this.fades.push({ mat: m, uniform, t: 0 });

      for (const r of results) {
        if (!r.tex) continue;
        if (r.key === "map") {
          const m = this.bodyMats.get(r.bodyId);
          if (m) {
            m.uniforms.uMap.value = r.tex;
            fade(m, "uMapMix");
          }
        } else if (r.key === "sun" && this.sunMat) {
          this.sunMat.uniforms.uMap.value = r.tex;
          fade(this.sunMat, "uMapMix");
        } else if (r.key === "clouds" && this.earthCloudMat) {
          this.earthCloudMat.uniforms.uCloudMap.value = r.tex;
          this.earthCloudMat.uniforms.uCloudUseMap.value = 1;
        } else if (r.key === "atmo" && this.venusAtmoMat) {
          this.venusAtmoMat.uniforms.uCloudMap.value = r.tex;
          this.venusAtmoMat.uniforms.uCloudUseMap.value = 1;
        } else if (r.key === "ring") {
          const m = this.ringMats.get(r.bodyId);
          if (m) {
            m.uniforms.uRingMap.value = r.tex;
            m.uniforms.uRingUseMap.value = 1;
          }
        } else if (r.key === "stars") {
          this.addMilkyWay(r.tex);
        }
      }
    });
  }

  /** casca aditiva com a Via Láctea fotográfica ao fundo */
  private addMilkyWay(tex: THREE.Texture) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: tex } },
      vertexShader: SURFACE_VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying vec2 vUv;
        void main() {
          vec3 c = texture2D(uMap, vUv).rgb;
          gl_FragColor = vec4(c * 0.5, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      transparent: true,
    });
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1560, 48, 32), mat);
    shell.rotation.z = THREE.MathUtils.degToRad(62);
    shell.rotation.y = THREE.MathUtils.degToRad(20);
    shell.renderOrder = -9;
    this.scene.add(shell);
  }

  /* ---------------------------------------------------------- setup */

  private initGL() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.domElement.style.cursor = "grab";
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 5000);
    this.camera.position.set(0, 46, 94);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 1.6;
    this.controls.maxDistance = 340;
    this.controls.zoomSpeed = 0.9;

    const rt = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.setPixelRatio(this.dpr);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    /* bloom em meia resolução: idêntico visualmente para halos, ~4× mais barato */
    this.bloom = new UnrealBloomPass(new THREE.Vector2(Math.ceil(w / 2), Math.ceil(h / 2)), 0.72, 0.55, 1.0);
    this.composer.addPass(this.bloom);
    this.filmPass = new ShaderPass(FilmShader);
    this.composer.addPass(this.filmPass);
    this.composer.addPass(new OutputPass());
  }

  private makeLabel(def: { id: string; name: string; accent: string }, isMoon: boolean) {
    const el = document.createElement("div");
    el.className = "orbit-label" + (isMoon ? " is-moon" : "");
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = def.accent;
    dot.style.color = def.accent;
    const txt = document.createElement("span");
    txt.textContent = def.name;
    el.appendChild(dot);
    el.appendChild(txt);
    el.addEventListener("pointerdown", (e) => e.stopPropagation());
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      this.select(def.id);
    });
    this.labelLayer.appendChild(el);
    return el;
  }

  private orbitLine(radius: number, color: string, opacity: number): THREE.LineLoop {
    const r = Math.max(radius, 0.01);
    const pts: THREE.Vector3[] = [];
    const N = 180;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    return new THREE.LineLoop(geo, mat);
  }

  /** elipse kepleriana com o Sol no foco */
  private orbitEllipse(a: number, e: number, varpi: number, color: string, opacity: number) {
    const ec = THREE.MathUtils.clamp(e, 0, 0.9);
    const aa = Math.max(a, 0.01);
    const b = aa * Math.sqrt(Math.max(0, 1 - ec * ec));
    const cv = Math.cos(varpi);
    const sv = Math.sin(varpi);
    const pts: THREE.Vector3[] = [];
    const N = 220;
    for (let i = 0; i < N; i++) {
      const E = (i / N) * Math.PI * 2;
      const x = aa * (Math.cos(E) - ec);
      const z = b * Math.sin(E);
      pts.push(new THREE.Vector3(x * cv - z * sv, 0, x * sv + z * cv));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    return new THREE.LineLoop(geo, mat);
  }

  private setKeplerPosition(anchor: THREE.Object3D, b: BodyRT, simDays: number) {
    if (b.periodDays <= 0 || b.orbitR <= 0) return;
    const M = b.theta0 + (simDays / b.periodDays) * Math.PI * 2;
    const E = solveKepler(M % (Math.PI * 2), b.ecc);
    const aa = b.orbitR;
    const bb = aa * Math.sqrt(Math.max(0, 1 - b.ecc * b.ecc));
    const x = aa * (Math.cos(E) - b.ecc);
    const z = bb * Math.sin(E);
    const cv = Math.cos(b.varpi);
    const sv = Math.sin(b.varpi);
    anchor.position.set(x * cv - z * sv, 0, x * sv + z * cv);
  }

  private buildScene() {
    /* -------- fundo: nebulosa + estrelas -------- */
    const nebula = new THREE.Mesh(
      new THREE.SphereGeometry(1600, 32, 24),
      new THREE.ShaderMaterial({
        vertexShader: SURFACE_VERT,
        fragmentShader: NEBULA_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
    nebula.renderOrder = -10;
    this.scene.add(nebula);

    const STAR_COUNT = 2200;
    const pos = new Float32Array(STAR_COUNT * 3);
    const size = new Float32Array(STAR_COUNT);
    const phase = new Float32Array(STAR_COUNT);
    const col = new Float32Array(STAR_COUNT * 3);
    const starPalette = ["#ffffff", "#ffffff", "#cfe0ff", "#ffe9c4", "#ffc9a0", "#bcd2ff"].map(
      (c) => new THREE.Color(c)
    );
    for (let i = 0; i < STAR_COUNT; i++) {
      const r = 640 + Math.random() * 260;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph);
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      size[i] = 0.7 + Math.random() * 1.9;
      phase[i] = Math.random();
      const c = starPalette[Math.floor(Math.random() * starPalette.length)];
      const b = 0.55 + Math.random() * 0.45;
      col[i * 3] = c.r * b;
      col[i * 3 + 1] = c.g * b;
      col[i * 3 + 2] = c.b * b;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    starGeo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    starGeo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    starGeo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    this.starMat = new THREE.ShaderMaterial({
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: this.dpr },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const stars = new THREE.Points(starGeo, this.starMat);
    stars.renderOrder = -5;
    this.scene.add(stars);

    /* -------- Sol -------- */
    const sunMat = new THREE.ShaderMaterial({
      vertexShader: SURFACE_VERT,
      fragmentShader: SUN_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uMap: { value: WHITE_TEX },
        uMapMix: { value: 0 },
      },
    });
    const sunMesh = new THREE.Mesh(this.sphereHi, sunMat);
    sunMesh.scale.setScalar(SUN.sizeR);
    this.scene.add(sunMesh);
    this.sunMats.push(sunMat);
    this.sunMat = sunMat;
    this.pickables.push(sunMesh);

    const coronaMat = new THREE.ShaderMaterial({
      vertexShader: SURFACE_VERT,
      fragmentShader: CORONA_FRAG,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const corona = new THREE.Mesh(this.sphereHi, coronaMat);
    corona.scale.setScalar(SUN.sizeR * 1.32);
    corona.renderOrder = 3;
    this.scene.add(corona);
    this.sunMats.push(coronaMat);

    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = glowCanvas.height = 256;
    const g = glowCanvas.getContext("2d")!;
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, "rgba(255,190,100,0.85)");
    grad.addColorStop(0.25, "rgba(255,150,50,0.32)");
    grad.addColorStop(0.6, "rgba(255,120,30,0.08)");
    grad.addColorStop(1, "rgba(255,100,20,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    const glowTex = new THREE.CanvasTexture(glowCanvas);
    glowTex.colorSpace = THREE.SRGBColorSpace;
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    glow.scale.set(34, 34, 1);
    glow.renderOrder = 2;
    this.scene.add(glow);

    this.bodies.set("sun", {
      id: "sun",
      def: SUN,
      isMoon: false,
      anchor: new THREE.Group(),
      mesh: sunMesh,
      labelEl: this.makeLabel(SUN, false),
      theta0: 0,
      orbitR: 0,
      periodDays: 0,
      spin: 0,
      ecc: 0,
      varpi: 0,
    });

    PLANETS.forEach((def, idx) => this.buildPlanet(def, idx));

    /* -------- cinturão de asteroides (2 anéis com rotação kepleriana diferencial) -------- */
    const mkBelt = (count: number, rMin: number, rMax: number, size: number) => {
      const n = Math.max(1, count);
      const p = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const r = rMin + Math.random() * Math.max(0.1, rMax - rMin) + (Math.random() - 0.5) * 0.6;
        const a = Math.random() * Math.PI * 2;
        p[i * 3] = Math.cos(a) * r;
        p[i * 3 + 1] = (Math.random() - 0.5) * 1.0;
        p[i * 3 + 2] = Math.sin(a) * r;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(p, 3));
      const mat = new THREE.PointsMaterial({
        color: 0x8a7f70,
        size: Math.max(0.02, size),
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      });
      const pts = new THREE.Points(geo, mat);
      const grp = new THREE.Group();
      grp.add(pts);
      return grp;
    };
    this.beltInner = mkBelt(1000, 27.4, 29.2, 0.09);
    this.beltOuter = mkBelt(700, 29.2, 30.8, 0.085);
    this.scene.add(this.beltInner, this.beltOuter);

    /* -------- vento solar (GPU, nunca congela com a pausa) -------- */
    const WIND_N = 620;
    const wAng = new Float32Array(WIND_N);
    const wRad = new Float32Array(WIND_N);
    const wY = new Float32Array(WIND_N);
    const wPh = new Float32Array(WIND_N);
    const wPos = new Float32Array(WIND_N * 3);
    for (let i = 0; i < WIND_N; i++) {
      wAng[i] = Math.random() * Math.PI * 2;
      wRad[i] = Math.random() * 78;
      wY[i] = (Math.random() - 0.5) * 3.4;
      wPh[i] = Math.random() * 1.6;
      wPos[i * 3] = 0;
      wPos[i * 3 + 1] = 0;
      wPos[i * 3 + 2] = 0;
    }
    const windGeo = new THREE.BufferGeometry();
    windGeo.setAttribute("position", new THREE.BufferAttribute(wPos, 3));
    windGeo.setAttribute("aAng", new THREE.BufferAttribute(wAng, 1));
    windGeo.setAttribute("aRad", new THREE.BufferAttribute(wRad, 1));
    windGeo.setAttribute("aY", new THREE.BufferAttribute(wY, 1));
    windGeo.setAttribute("aPhase", new THREE.BufferAttribute(wPh, 1));
    this.windMat = new THREE.ShaderMaterial({
      vertexShader: WIND_VERT,
      fragmentShader: WIND_FRAG,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const wind = new THREE.Points(windGeo, this.windMat);
    wind.renderOrder = 5;
    this.scene.add(wind);
  }

  private buildPlanet(def: BodyDef, idx: number) {
    const ecc = THREE.MathUtils.clamp(ECC[def.id] ?? 0, 0, 0.9);
    const varpi = THREE.MathUtils.degToRad(VARPI[def.id] ?? 0);

    const orbitPlane = new THREE.Group();
    orbitPlane.rotation.x = THREE.MathUtils.degToRad(def.orbitInclDeg);
    this.scene.add(orbitPlane);

    const line = this.orbitEllipse(def.orbitR, ecc, varpi, def.accent, 0.2);
    orbitPlane.add(line);
    const orbitMat = line.material as THREE.LineBasicMaterial;

    const anchor = new THREE.Group();
    orbitPlane.add(anchor);

    const tiltGroup = new THREE.Group();
    tiltGroup.rotation.z = THREE.MathUtils.degToRad(def.tiltDeg);
    anchor.add(tiltGroup);

    const uniforms = surfaceUniforms(def);
    const mat = new THREE.ShaderMaterial({
      vertexShader: SURFACE_VERT,
      fragmentShader: def.surface.earthLike ? EARTH_FRAG : PLANET_FRAG,
      uniforms,
    });
    this.surfaceMats.push(mat);
    this.bodyMats.set(def.id, mat);
    const geo = def.sizeR > 2 ? this.sphereHi : this.sphereMd;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.setScalar(Math.max(0.05, def.sizeR));
    tiltGroup.add(mesh);
    this.pickables.push(mesh);

    if (def.surface.clouds) {
      const cloudMat = new THREE.ShaderMaterial({
        vertexShader: SURFACE_VERT,
        fragmentShader: CLOUD_FRAG,
        uniforms: {
          uTime: uniforms.uTime,
          uCloudAmp: { value: 0.85 },
          uSunPos: uniforms.uSunPos,
          uCloudMap: { value: WHITE_TEX },
          uCloudUseMap: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
      });
      const clouds = new THREE.Mesh(geo, cloudMat);
      clouds.scale.setScalar(Math.max(0.05, def.sizeR * 1.018));
      clouds.renderOrder = 1;
      tiltGroup.add(clouds);
      this.surfaceMats.push(cloudMat);
      this.earthCloudMat = cloudMat;
    }

    /* casca de nuvens sulfúricas de Vênus (recebe o mapa de atmosfera 8K) */
    if (def.id === "venus") {
      const vMat = new THREE.ShaderMaterial({
        vertexShader: SURFACE_VERT,
        fragmentShader: CLOUD_FRAG,
        uniforms: {
          uTime: uniforms.uTime,
          uCloudAmp: { value: 1.0 },
          uSunPos: uniforms.uSunPos,
          uCloudMap: { value: WHITE_TEX },
          uCloudUseMap: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
      });
      const shell = new THREE.Mesh(geo, vMat);
      shell.scale.setScalar(Math.max(0.05, def.sizeR * 1.045));
      shell.renderOrder = 1;
      tiltGroup.add(shell);
      this.surfaceMats.push(vMat);
      this.venusAtmoMat = vMat;
    }

    if (def.surface.atmosAmp > 0.4) {
      const atmoMat = new THREE.ShaderMaterial({
        vertexShader: SURFACE_VERT,
        fragmentShader: ATMO_FRAG,
        uniforms: {
          uColor: { value: new THREE.Color(def.surface.atmosColor) },
          uIntensity: { value: def.surface.atmosAmp * 0.75 },
          uSunPos: uniforms.uSunPos,
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const atmo = new THREE.Mesh(geo, atmoMat);
      atmo.scale.setScalar(Math.max(0.05, def.sizeR * 1.13));
      atmo.renderOrder = 2;
      anchor.add(atmo);
    }

    if (def.ring) {
      const inner = Math.max(0.1, def.ring.inner);
      const outer = Math.max(inner + 0.05, def.ring.outer);
      const ringGeo = new THREE.RingGeometry(inner, outer, 200, 1);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.ShaderMaterial({
        vertexShader: RING_VERT,
        fragmentShader: RING_FRAG,
        uniforms: {
          uInner: { value: inner },
          uOuter: { value: outer },
          uTint: { value: new THREE.Color(def.ring.tint) },
          uOpacity: { value: THREE.MathUtils.clamp(def.ring.opacity, 0, 1) },
          uSunPos: uniforms.uSunPos,
          uRingMap: { value: WHITE_TEX },
          uRingUseMap: { value: 0 },
        },
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.renderOrder = 4;
      tiltGroup.add(ring);
      this.ringMats.set(def.id, ringMat);
    }

    const theta0 = idx * 0.83 + 0.4;
    const rt: BodyRT = {
      id: def.id,
      def,
      isMoon: false,
      anchor,
      mesh,
      orbitMat,
      labelEl: this.makeLabel(def, false),
      theta0,
      orbitR: def.orbitR,
      periodDays: def.periodDays,
      spin: (1 / (ROT_DAYS[def.id] ?? 1)) * ROT_VISUAL,
      ecc,
      varpi,
    };
    this.setKeplerPosition(anchor, rt, 0);
    this.bodies.set(def.id, rt);

    def.moons.forEach((m, mi) => {
      const mOrbit = this.orbitLine(m.orbitR, m.accent, 0.14);
      anchor.add(mOrbit);

      const mAnchor = new THREE.Group();
      anchor.add(mAnchor);

      const mUniforms = surfaceUniforms({ surface: m.surface });
      const mMat = new THREE.ShaderMaterial({
        vertexShader: SURFACE_VERT,
        fragmentShader: PLANET_FRAG,
        uniforms: mUniforms,
      });
      this.surfaceMats.push(mMat);
      this.bodyMats.set(m.id, mMat);
      const mMesh = new THREE.Mesh(this.sphereLo, mMat);
      mMesh.scale.setScalar(Math.max(0.04, m.sizeR));
      mAnchor.add(mMesh);
      this.pickables.push(mMesh);

      const hitR = Math.max(0.26, m.sizeR * 2.6);
      const hit = new THREE.Mesh(
        this.sphereLo,
        new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true })
      );
      hit.scale.setScalar(hitR);
      hit.userData.id = m.id;
      mAnchor.add(hit);
      this.pickables.push(hit);

      const mTheta0 = mi * 2.17 + idx * 0.7;
      mAnchor.position.set(
        Math.cos(mTheta0) * m.orbitR,
        0,
        Math.sin(mTheta0) * m.orbitR
      );

      this.bodies.set(m.id, {
        id: m.id,
        def: { ...def, moons: [], name: m.name, accent: m.accent, sizeR: m.sizeR },
        isMoon: true,
        parentId: def.id,
        anchor: mAnchor,
        mesh: mMesh,
        labelEl: this.makeLabel(m, true),
        theta0: mTheta0,
        orbitR: m.orbitR,
        periodDays: Math.abs(m.periodDays),
        spin: 0.02,
        ecc: 0,
        varpi: 0,
      });
    });
  }

  /* ---------------------------------------------------------- eventos */

  private onPointerMove = (e: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.set(
      ((e.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
      -((e.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1
    );
    this.mouseMoved = true;
  };

  private onPointerDown = (e: PointerEvent) => {
    this.downPos = { x: e.clientX, y: e.clientY };
  };

  private onPointerUp = (e: PointerEvent) => {
    const dx = e.clientX - this.downPos.x;
    const dy = e.clientY - this.downPos.y;
    if (dx * dx + dy * dy > 36) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.set(
      ((e.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
      -((e.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1
    );
    const hit = this.raycast();
    if (hit) this.select(hit);
  };

  private onKey = (e: KeyboardEvent) => {
    if (e.code === "Space") {
      e.preventDefault();
      this.setPaused(!this.paused);
      this.opts.onHud(this.hudSnapshot());
    } else if (e.code === "Escape") {
      this.select(null);
    }
  };

  private bindEvents() {
    const el = this.renderer.domElement;
    el.addEventListener("pointermove", this.onPointerMove);
    el.addEventListener("pointerdown", this.onPointerDown);
    el.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("keydown", this.onKey);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.container);
  }

  private raycast(): string | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    for (const h of hits) {
      if (h.object.userData.id) return h.object.userData.id as string;
      for (const [id, b] of this.bodies) {
        if (b.mesh === h.object) return id;
      }
    }
    return null;
  }

  private resize() {
    if (this.disposed) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  /* ---------------------------------------------------------- API pública */

  select(id: string | null) {
    this.selectedId = id;
    for (const b of this.bodies.values()) {
      b.labelEl.classList.toggle("is-selected", b.id === id);
      if (b.orbitMat) {
        const active = b.id === id || b.parentId === id;
        b.orbitMat.opacity = active ? 0.75 : b.isMoon ? 0.14 : 0.2;
      }
    }
    if (id) this.focusBody(id);
    else this.clearFocus();
    this.opts.onSelect(id);
  }

  focusBody(id: string) {
    const b = this.bodies.get(id);
    if (!b) return;
    const dist =
      id === "sun" ? 26 : THREE.MathUtils.clamp(b.def.sizeR * (b.isMoon ? 9 : 7.5), 1.9, 60);
    this.cam = { mode: "approach", id, dist };
    b.mesh.getWorldPosition(this.lastFollow);
  }

  clearFocus() {
    this.cam = { mode: "approach", id: null, dist: 95 };
    this.lastFollow.set(0, 0, 0);
  }

  setSpeed(mult: number) {
    this.speedMult = THREE.MathUtils.clamp(mult, 0.1, 100);
  }

  setPaused(p: boolean) {
    this.paused = p;
  }

  setOrbits(v: boolean) {
    this.showOrbits = v;
    for (const b of this.bodies.values()) {
      if (b.orbitMat) b.orbitMat.visible = v;
    }
  }

  setLabels(v: boolean) {
    this.showLabels = v;
  }

  setBelt(v: boolean) {
    this.showBelt = v;
    this.beltInner.visible = v;
    this.beltOuter.visible = v;
  }

  setHovered(id: string | null) {
    if (id === this.hoveredId) return;
    for (const b of this.bodies.values()) {
      b.labelEl.classList.toggle("is-hovered", b.id === id);
    }
    this.hoveredId = id;
  }

  /* ---------------------------------------------------------- loop */

  private hudSnapshot(): HudData {
    return {
      fps: this.fps,
      simDays: this.simDays,
      daysPerSec: BASE_DAYS_PER_SEC * this.speedMult,
      paused: this.paused,
    };
  }

  /** Resolução adaptativa: alivia a GPU quando o FPS cai, recupera quando sobra margem. */
  private adaptResolution(dt: number) {
    if (this.fps > 0 && this.fps < 42) {
      this.lowStreak += dt;
      this.highStreak = 0;
    } else if (this.fps > 57) {
      this.highStreak += dt;
      this.lowStreak = 0;
    } else {
      this.lowStreak = 0;
      this.highStreak = 0;
    }
    if (this.lowStreak > 1.4 && this.dpr > 1) {
      this.dpr = Math.max(1, this.dpr - 0.25);
      this.applyDpr();
      this.lowStreak = 0;
    } else if (this.highStreak > 5 && this.dpr < this.maxDpr) {
      this.dpr = Math.min(this.maxDpr, this.dpr + 0.25);
      this.applyDpr();
      this.highStreak = 0;
    }
  }

  private applyDpr() {
    this.renderer.setPixelRatio(this.dpr);
    this.composer.setPixelRatio(this.dpr);
    this.starMat.uniforms.uPixelRatio.value = this.dpr;
    this.resize();
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.wallTime += dt;

    if (!this.paused) {
      this.simDays += dt * BASE_DAYS_PER_SEC * this.speedMult;
    }

    /* posições keplerianas + rotação */
    for (const b of this.bodies.values()) {
      if (!b.isMoon && b.periodDays > 0) {
        this.setKeplerPosition(b.anchor, b, this.simDays);
      } else if (b.isMoon && b.periodDays > 0) {
        const th = b.theta0 + (this.simDays / b.periodDays) * Math.PI * 2;
        b.anchor.position.set(Math.cos(th) * b.orbitR, 0, Math.sin(th) * b.orbitR);
      }
      b.mesh.rotation.y = this.simDays * b.spin * Math.PI * 2;
    }

    for (const m of this.surfaceMats) {
      if (m.uniforms.uTime) m.uniforms.uTime.value = this.simDays * 0.4;
    }
    for (const m of this.sunMats) m.uniforms.uTime.value = this.wallTime;
    this.starMat.uniforms.uTime.value = this.wallTime;
    this.windMat.uniforms.uTime.value = this.wallTime;
    if (this.filmPass) this.filmPass.uniforms.uTime.value = this.wallTime;

    /* crossfade procedural → fotográfico (suavizado em ~1,8 s) */
    if (this.fades.length > 0) {
      this.fades = this.fades.filter((f) => {
        f.t = Math.min(1, f.t + dt / 1.8);
        const s = f.t * f.t * (3 - 2 * f.t);
        if (f.mat.uniforms[f.uniform]) f.mat.uniforms[f.uniform].value = s;
        return f.t < 1;
      });
    }
    /* rotação diferencial kepleriana: ω ∝ r^(−3/2) */
    this.beltInner.rotation.y = (this.simDays / 1450) * Math.PI * 2;
    this.beltOuter.rotation.y = (this.simDays / 1760) * Math.PI * 2;

    this.updateCamera();
    this.controls.update();

    if (this.mouseMoved) {
      this.mouseMoved = false;
      const id = this.raycast();
      if (id !== this.hoveredId) {
        this.setHovered(id);
        this.opts.onHover(id);
      }
      this.renderer.domElement.style.cursor = id ? "pointer" : "grab";
    }

    this.updateLabels();

    this.frames++;
    this.hudTimer += dt;
    if (this.hudTimer >= 0.25) {
      this.fps = Math.round(this.frames / Math.max(this.hudTimer, 0.001));
      this.frames = 0;
      this.hudTimer = 0;
      this.opts.onHud(this.hudSnapshot());
    }
    this.adaptResolution(dt);

    this.composer.render();
  };

  private updateCamera() {
    const { mode, id, dist } = this.cam;
    if (mode === "free") return;

    const body = id ? this.bodies.get(id) : null;
    const target = body ? body.mesh.getWorldPosition(V0) : V0.set(0, 0, 0);

    if (mode === "approach") {
      V1.copy(this.camera.position).sub(target);
      if (V1.lengthSq() < 1e-6) V1.set(0.5, 0.45, 1);
      V1.normalize();
      V2.copy(target).addScaledVector(V1, dist);
      this.camera.position.lerp(V2, 0.075);
      this.controls.target.lerp(target, 0.1);
      if (
        this.camera.position.distanceTo(V2) < Math.max(0.05, dist * 0.015) &&
        this.controls.target.distanceTo(target) < Math.max(0.05, dist * 0.02)
      ) {
        this.cam.mode = body ? "follow" : "free";
        this.lastFollow.copy(target);
      }
    } else if (mode === "follow" && body) {
      body.mesh.getWorldPosition(V1);
      V2.copy(V1).sub(this.lastFollow);
      this.camera.position.add(V2);
      this.controls.target.copy(V1);
      this.lastFollow.copy(V1);
    }
  }

  private updateLabels() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    for (const b of this.bodies.values()) {
      const el = b.labelEl;
      let visible = this.showLabels;
      if (b.isMoon && visible) {
        const parent = b.parentId ? this.bodies.get(b.parentId) : null;
        const parentActive =
          b.parentId === this.hoveredId || b.parentId === this.selectedId;
        let near = false;
        if (parent) {
          parent.mesh.getWorldPosition(V1);
          near = this.camera.position.distanceTo(V1) < 16;
        }
        visible = parentActive || near || b.id === this.selectedId;
      }
      if (!visible) {
        el.classList.add("is-hidden");
        continue;
      }
      b.mesh.getWorldPosition(V1);
      V1.y += b.def.sizeR * 1.45 + 0.28;
      V1.project(this.camera);
      if (V1.z > 1 || V1.x < -1.2 || V1.x > 1.2 || V1.y < -1.2 || V1.y > 1.2) {
        el.classList.add("is-hidden");
        continue;
      }
      el.classList.remove("is-hidden");
      const x = (V1.x * 0.5 + 0.5) * w;
      const y = (-V1.y * 0.5 + 0.5) * h;
      el.style.transform = `translate(-50%, -140%) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }
  }

  /* ---------------------------------------------------------- teardown */

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    const el = this.renderer.domElement;
    el.removeEventListener("pointermove", this.onPointerMove);
    el.removeEventListener("pointerdown", this.onPointerDown);
    el.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("keydown", this.onKey);
    this.ro.disconnect();
    this.controls.dispose();
    this.scene.traverse((o) => {
      const any = o as THREE.Mesh;
      if (any.geometry) any.geometry.dispose();
      const m = any.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
      else if (m) m.dispose();
    });
    this.composer.dispose();
    this.renderer.dispose();
    el.remove();
    this.labelLayer.innerHTML = "";
  }
}
