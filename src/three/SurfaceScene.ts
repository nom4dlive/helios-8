import * as THREE from "three";
import {
  SKY_VERT,
  SKY_FRAG,
  TERRAIN_VERT,
  TERRAIN_FRAG,
  ROCK_VERT,
  ROCK_FRAG,
  NOISE_GLSL,
} from "./shaders";
import { sunAngularDeg, surfaceGravity, type ExoPlanet, type ExoSystem } from "../data/catalog";

export interface SurfaceTelemetry {
  fps: number;
  posX: number;
  posZ: number;
  headingDeg: number;
  pitchDeg: number;
  fov: number;
  moving: boolean;
}

export interface SurfaceSceneOptions {
  /** exoplaneta + sistema — o perfil é derivado automaticamente */
  planet?: ExoPlanet;
  system?: ExoSystem;
  /** perfil explícito (corpos do Sistema Solar) */
  profile?: VisitProfile;
  onTelemetry: (t: SurfaceTelemetry) => void;
}

export interface VisitProfile {
  skyTop: string;
  skyHorizon: string;
  sunColor: string;
  starDensity: number;
  cloudSea: boolean;
  seaColorA: string;
  seaColorB: string;
  terrainBase: string;
  terrainMid: string;
  terrainDark: string;
  rockA: string;
  rockB: string;
  fogColor: string;
  fogDensity: number;
  terrainAmp: number;
  glowVeins: number;
  sparkle: number;
  rocks: number;
  gravity: number;
  sunAngularDeg: number;
  bands?: { amp: number; scale: number; colorA: string; colorB: string };
  notes: string[];
}

/* ---------- ruído JS (espelho do GLSL p/ terreno assado) ---------- */
function hash2(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise2(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm2(x: number, y: number): number {
  let amp = 0.5;
  let s = 0;
  let px = x;
  let py = y;
  for (let i = 0; i < 5; i++) {
    s += amp * vnoise2(px, py);
    px *= 2.02;
    py *= 2.02;
    amp *= 0.5;
  }
  return s;
}

const CLOUDSEA_VERT = /* glsl */ `
${NOISE_GLSL}
uniform float uTime;
uniform float uAmp;
varying vec3 vWorldPos;
varying vec3 vNormal;
void main() {
  vec3 p = position;
  float h = (fbm(vec3(p.xz * 0.004 + uTime * 0.01, 3.3)) - 0.5) * uAmp * 2.0;
  h += sin(p.x * 0.008 + uTime * 0.05) * cos(p.z * 0.006) * uAmp * 0.6;
  p.y += h;
  float e = 2.0;
  float hx = (fbm(vec3((p.xz + vec2(e, 0.0)) * 0.004 + uTime * 0.01, 3.3)) - 0.5) * uAmp * 2.0;
  float hz = (fbm(vec3((p.xz + vec2(0.0, e)) * 0.004 + uTime * 0.01, 3.3)) - 0.5) * uAmp * 2.0;
  vNormal = normalize(vec3(h - hx, e, h - hz));
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const CLOUDSEA_FRAG = /* glsl */ `
${NOISE_GLSL}
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform vec3 uSunDir;
varying vec3 vWorldPos;
varying vec3 vNormal;
void main() {
  vec3 N = normalize(vNormal);
  float detail = fbm(vec3(vWorldPos.xz * 0.02, 1.3));
  float bands = 0.5 + 0.5 * sin(vWorldPos.z * 0.09 + detail * 4.0);
  vec3 col = mix(uColorA, uColorB, bands);
  col = mix(col, uColorB * 1.15, smoothstep(0.4, 0.9, detail));
  float dif = clamp(dot(N, normalize(uSunDir)) * 0.5 + 0.5, 0.0, 1.0);
  col *= 0.3 + 1.0 * dif;
  float dist = distance(vWorldPos, cameraPosition);
  float fogF = 1.0 - exp(-pow(dist * max(uFogDensity, 0.0), 1.35));
  col = mix(col, uFogColor, clamp(fogF, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}
`;

/** perfil de visita por classe de mundo — céu, solo e física */
export function visitProfile(planet: ExoPlanet, sys: ExoSystem): VisitProfile {
  const sun = sunAngularDeg(sys, planet);
  const gravity = surfaceGravity(planet);
  const starCol = sys.spectral.color;
  const base: Omit<VisitProfile, "notes"> = {
    skyTop: "#0a1a3a",
    skyHorizon: "#6a8ab8",
    sunColor: starCol,
    starDensity: 0.2,
    cloudSea: false,
    seaColorA: "#8a7a5c",
    seaColorB: "#c0a878",
    terrainBase: "#8a7a5c",
    terrainMid: "#6a5a40",
    terrainDark: "#3e3428",
    rockA: "#5a4e3c",
    rockB: "#8a7c64",
    fogColor: "#8a7a60",
    fogDensity: 0.004,
    terrainAmp: 3,
    glowVeins: 0,
    sparkle: 0,
    rocks: 120,
    gravity,
    sunAngularDeg: sun,
  };
  switch (planet.cls) {
    case "temperate":
      return {
        ...base,
        skyTop: "#1c5fae", skyHorizon: "#a8d0f0", sunColor: starCol, starDensity: 0.12,
        terrainBase: "#5a7a4a", terrainMid: "#7a8a5a", terrainDark: "#3a4e30",
        rockA: "#5a5e52", rockB: "#8a8e80", fogColor: "#a8c4dc", fogDensity: 0.0028, terrainAmp: 3.4, rocks: 90,
        notes: [
          "Céu azul porque a atmosfera espalha a luz — igual à Terra.",
          `O Sol daqui ocupa ${sun < 0.5 ? sun.toFixed(2) : sun.toFixed(1)}° do céu (o da Terra: 0,53°).`,
        ],
      };
    case "super-earth":
      return {
        ...base,
        skyTop: "#2a4e7e", skyHorizon: "#90b0c8", starDensity: 0.15,
        terrainBase: "#6a7a6a", terrainMid: "#8a9a80", terrainDark: "#44523f",
        rockA: "#5e665a", rockB: "#96a08c", fogColor: "#9ab0c0", fogDensity: 0.003, terrainAmp: 4.6, rocks: 150,
        notes: [
          `Gravidade ${(gravity / 9.81).toFixed(1).replace(".", ",")}g: cada passo pesa mais que na Terra.`,
          "Montanhas mais baixas que as terrestres — a gravidade não deixa a crosta empilhar tanto.",
        ],
      };
    case "desert":
      return {
        ...base,
        skyTop: "#5a4030", skyHorizon: "#cf9a66", sunColor: "#f5e8d0", starDensity: 0.1,
        terrainBase: "#c1512a", terrainMid: "#8a4a26", terrainDark: "#5e3018",
        rockA: "#6e3a20", rockB: "#a45c34", fogColor: "#cf9a66", fogDensity: 0.0042, terrainAmp: 2.8, rocks: 190, sparkle: 0.3,
        bands: { amp: 0.08, scale: 5, colorA: "#f0cdb0", colorB: "#c99873" },
        notes: [
          "Poeira suspensa deixa o horizonte luminoso e o céu cor de caramelo.",
          "Ao entardecer, o céu perto do Sol fica AZULADO — o oposto da Terra.",
        ],
      };
    case "lava":
      return {
        ...base,
        skyTop: "#140a08", skyHorizon: "#4a1a08", sunColor: "#ffe0b0", starDensity: 0.9,
        terrainBase: "#241610", terrainMid: "#3a2418", terrainDark: "#120c0a",
        rockA: "#1e1410", rockB: "#46301e", fogColor: "#301408", fogDensity: 0.005, terrainAmp: 3.8, rocks: 160,
        glowVeins: 0.85,
        notes: [
          "Veios de lava brilham no chão — a crosta é fina e quente.",
          planet.teqK ? `Temperatura de equilíbrio: ${Math.round(planet.teqK)} K (${Math.round(planet.teqK - 273)} °C).` : "Calor extremo medido em infravermelho.",
        ],
      };
    case "ocean":
      return {
        ...base,
        skyTop: "#0e3e8a", skyHorizon: "#8fc0e8", starDensity: 0.15,
        terrainBase: "#2e5e96", terrainMid: "#1e4a80", terrainDark: "#123058",
        rockA: "#2a4e7e", rockB: "#5a84b4", fogColor: "#7fb0d8", fogDensity: 0.0026, terrainAmp: 1.6, rocks: 40, sparkle: 0.9,
        notes: [
          "Um oceano global — você caminha sobre plataformas de gelo rochoso.",
          "Sem continentes: a vida, se existir, mora inteira na água.",
        ],
      };
    case "hycean":
      return {
        ...base,
        skyTop: "#0e4e5e", skyHorizon: "#7fc0bc", starDensity: 0.2, cloudSea: true,
        seaColorA: "#17687c", seaColorB: "#2a8a96",
        fogColor: "#6ab0ac", fogDensity: 0.0034, terrainAmp: 4,
        notes: [
          "Você flutua sobre o oceano de um mundo hycean: água global sob céu de hidrogênio.",
          "O vapor d'água detectado pelo James Webb vem daqui de baixo.",
        ],
      };
    case "mini-neptune":
      return {
        ...base,
        skyTop: "#1a2e5e", skyHorizon: "#7090c0", starDensity: 0.25, cloudSea: true,
        seaColorA: "#4a68a0", seaColorB: "#7090c0",
        fogColor: "#5a78a8", fogDensity: 0.0038, terrainAmp: 5,
        bands: { amp: 0.25, scale: 4, colorA: "#8aa8d0", colorB: "#4a68a0" },
        notes: [
          "Não há chão: só camadas de nuvens cada vez mais densas até virar fluido supercrítico.",
          "A pressão dobra a cada poucos quilômetros descendo.",
        ],
      };
    case "hot-jupiter":
      return {
        ...base,
        skyTop: "#3a2410", skyHorizon: "#e8b070", sunColor: "#fff2d0", starDensity: 0.05, cloudSea: true,
        seaColorA: "#c89050", seaColorB: "#e8b070",
        fogColor: "#d8a060", fogDensity: 0.004, terrainAmp: 6,
        bands: { amp: 0.45, scale: 5.5, colorA: "#f0c890", colorB: "#a87038" },
        notes: [
          `O Sol ocupa ${(sun).toFixed(1)}° do céu — ${(sun / 0.53).toFixed(0)}× maior que visto da Terra.`,
          "Ventos de 8.000 km/h movem o calor do lado diurno para o noturno.",
        ],
      };
    case "gas-giant":
      return {
        ...base,
        skyTop: "#2e2418", skyHorizon: "#c0a878", starDensity: 0.15, cloudSea: true,
        seaColorA: "#c8b890", seaColorB: "#e0d0a8",
        fogColor: "#c8b890", fogDensity: 0.0032, terrainAmp: 5,
        bands: { amp: 0.3, scale: 4, colorA: "#ece0c0", colorB: "#a89870" },
        notes: [
          "Um mar de nuvens de amônia em faixas creme e caramelo.",
          "Tempestades aqui duram décadas — às vezes séculos.",
        ],
      };
    case "imaged-giant":
      return {
        ...base,
        skyTop: "#2a1608", skyHorizon: "#d08848", starDensity: 0.5, cloudSea: true,
        seaColorA: "#b06830", seaColorB: "#d08848",
        fogColor: "#c07838", fogDensity: 0.003, terrainAmp: 6,
        bands: { amp: 0.35, scale: 5, colorA: "#e0a060", colorB: "#8a4e22" },
        notes: [
          "Um gigante JOVEM e ainda incandescente — brilha no infravermelho desde que nasceu.",
          "Foi fotografado diretamente: um pontinho de luz ao lado da estrela.",
        ],
      };
    case "pulsar-world":
      return {
        ...base,
        skyTop: "#03040a", skyHorizon: "#0a0e1c", sunColor: "#dce8ff", starDensity: 2.4,
        terrainBase: "#2a2e38", terrainMid: "#3a3e48", terrainDark: "#161a24",
        rockA: "#262a34", rockB: "#4a4e58", fogColor: "#0e1220", fogDensity: 0.002, terrainAmp: 2.4, rocks: 140,
        sparkle: 0.7, glowVeins: 0.1,
        notes: [
          "O 'Sol' é um farol: um pulsar de 20 km girando centenas de vezes por segundo.",
          "Cada rotação varre o céu com um pulso de radiação — aqui, o dia dura milissegundos.",
        ],
      };
  }
}

export class SurfaceScene {
  private mount: HTMLElement;
  private opts: SurfaceSceneOptions;
  private prof: VisitProfile;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;

  private timeUniforms: THREE.IUniform[] = [];
  private yaw = 0;
  private pitch = 0.1;
  private fov = 70;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private keys = new Set<string>();
  private walkX = 0;
  private walkZ = 0;
  private camY = 2;
  private eyeHeight = 2.2;
  private moving = false;

  private heightAt: (x: number, z: number) => number = () => 0;
  private lookTmp = new THREE.Vector3();

  private raf = 0;
  private clock = new THREE.Clock();
  private wallTime = 0;
  private teleTimer = 0;
  private frames = 0;
  private fpsTimer = 0;
  private fps = 60;
  private ro!: ResizeObserver;
  private disposed = false;

  constructor(mount: HTMLElement, opts: SurfaceSceneOptions) {
    this.mount = mount;
    this.opts = opts;
    this.prof = opts.profile ?? visitProfile(opts.planet!, opts.system!);
    this.initGL();
    this.build();
    this.bind();
    /* começa olhando para o Sol */
    this.yaw = Math.PI * 0.85;
    this.clock.start();
    this.loop();
  }

  private initGL() {
    const w = Math.max(1, this.mount.clientWidth);
    const h = Math.max(1, this.mount.clientHeight);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.style.cursor = "grab";
    this.mount.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.fov, w / h, 0.1, 4500);
  }

  private build() {
    const p = this.prof;
    const sunElev = THREE.MathUtils.degToRad(32);
    /* azimute alinhado com a direção inicial da câmera (Sol nasce à frente) */
    const sunAz = Math.atan2(-Math.sin(Math.PI * 0.85), -Math.cos(Math.PI * 0.85));
    const sunDir = new THREE.Vector3(
      Math.cos(sunElev) * Math.sin(sunAz),
      Math.sin(sunElev),
      Math.cos(sunElev) * Math.cos(sunAz)
    ).normalize();
    const isPulsar = this.opts.system?.kind === "pulsar";

    /* céu */
    const skyU = {
      uSkyTop: { value: new THREE.Color(p.skyTop) },
      uSkyHorizon: { value: new THREE.Color(p.skyHorizon) },
      uSunDir: { value: sunDir },
      uSunColor: { value: new THREE.Color(p.sunColor) },
      uSunSize: { value: Math.cos(THREE.MathUtils.degToRad(Math.min(p.sunAngularDeg, 120) / 2)) },
      uStarDensity: { value: THREE.MathUtils.clamp(p.starDensity, 0, 3) },
      uTime: { value: 0 },
      uBandAmp: { value: p.bands ? p.bands.amp : 0 },
      uBandScale: { value: p.bands ? p.bands.scale : 3 },
      uBandDrift: { value: 0.02 },
      uBandColorA: { value: new THREE.Color(p.bands?.colorA ?? "#ffffff") },
      uBandColorB: { value: new THREE.Color(p.bands?.colorB ?? "#cccccc") },
      uPulseStar: { value: isPulsar ? 1 : 0 },
    };
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(2100, 48, 32),
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        uniforms: skyU,
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
    sky.renderOrder = -10;
    this.scene.add(sky);
    this.timeUniforms.push(skyU.uTime);

    /* solo */
    if (p.cloudSea) {
      const seaU = {
        uTime: { value: 0 },
        uAmp: { value: Math.max(p.terrainAmp, 0.5) },
        uColorA: { value: new THREE.Color(p.seaColorA) },
        uColorB: { value: new THREE.Color(p.seaColorB) },
        uFogColor: { value: new THREE.Color(p.fogColor) },
        uFogDensity: { value: p.fogDensity },
        uSunDir: { value: sunDir },
      };
      const sea = new THREE.Mesh(
        new THREE.PlaneGeometry(2400, 2400, 140, 140),
        new THREE.ShaderMaterial({
          vertexShader: CLOUDSEA_VERT,
          fragmentShader: CLOUDSEA_FRAG,
          uniforms: seaU,
        })
      );
      sea.geometry.rotateX(-Math.PI / 2);
      this.scene.add(sea);
      this.timeUniforms.push(seaU.uTime);
      this.heightAt = () => 0;
    } else {
      const amp = Math.max(p.terrainAmp, 0.4);
      const heightFn = (x: number, z: number): number => {
        const base = fbm2(x * 0.0042 + 1.7, z * 0.0042 + 9.2) - 0.5;
        const mid = fbm2(x * 0.0016 + 5.5, z * 0.0016 + 3.3) - 0.5;
        const rough = fbm2(x * 0.021 + 9.9, z * 0.021 + 7.1) - 0.5;
        let h = base * amp + mid * amp * 2.4 + rough * amp * 0.35;
        const rockN = fbm2(x * 0.0009 + 14.4, z * 0.0009 + 2.2);
        h += Math.max(0, (rockN - 0.62) / 0.23) ** 1.4 * amp * 1.5;
        return h;
      };
      this.heightAt = heightFn;

      const SIZE = 2000;
      const SEGS = 168;
      const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS);
      geo.rotateX(-Math.PI / 2);
      const posAttr = geo.attributes.position as THREE.BufferAttribute;
      const nrmAttr = geo.attributes.normal as THREE.BufferAttribute;
      const H = new Float32Array(posAttr.count);
      for (let i = 0; i < posAttr.count; i++) H[i] = heightFn(posAttr.getX(i), posAttr.getZ(i));
      const e = SIZE / SEGS;
      const idx = (ix: number, iz: number) => iz * (SEGS + 1) + ix;
      for (let iz = 0; iz <= SEGS; iz++) {
        for (let ix = 0; ix <= SEGS; ix++) {
          const i = idx(ix, iz);
          const hL = H[idx(Math.max(ix - 1, 0), iz)];
          const hR = H[idx(Math.min(ix + 1, SEGS), iz)];
          const hD = H[idx(ix, Math.max(iz - 1, 0))];
          const hU = H[idx(ix, Math.min(iz + 1, SEGS))];
          posAttr.setY(i, H[i]);
          nrmAttr.setXYZ(i, hL - hR, 2 * e, hD - hU);
        }
      }
      nrmAttr.needsUpdate = true;
      posAttr.needsUpdate = true;
      geo.computeBoundingSphere();

      const terrainU = {
        uBase: { value: new THREE.Color(p.terrainBase) },
        uMid: { value: new THREE.Color(p.terrainMid) },
        uDark: { value: new THREE.Color(p.terrainDark) },
        uFogColor: { value: new THREE.Color(p.fogColor) },
        uFogDensity: { value: p.fogDensity },
        uSunDir: { value: sunDir },
        uAmbient: { value: isPulsar ? 0.22 : 0.3 },
        uSunStrength: { value: 1.05 },
        uSparkle: { value: p.sparkle },
        uGlowVeins: { value: p.glowVeins },
      };
      this.scene.add(
        new THREE.Mesh(
          geo,
          new THREE.ShaderMaterial({ vertexShader: TERRAIN_VERT, fragmentShader: TERRAIN_FRAG, uniforms: terrainU })
        )
      );
      this.camY = heightFn(0, 0) + this.eyeHeight;

      /* rochas instanciadas */
      if (p.rocks > 0) {
        const rockMat = new THREE.ShaderMaterial({
          vertexShader: ROCK_VERT,
          fragmentShader: ROCK_FRAG,
          uniforms: {
            uColorA: { value: new THREE.Color(p.rockA) },
            uColorB: { value: new THREE.Color(p.rockB) },
            uSunDir: { value: sunDir },
            uAmbient: terrainU.uAmbient,
            uSunStrength: terrainU.uSunStrength,
            uFogColor: terrainU.uFogColor,
            uFogDensity: terrainU.uFogDensity,
          },
        });
        const inst = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), rockMat, Math.max(1, p.rocks));
        const M = new THREE.Matrix4();
        const Q = new THREE.Quaternion();
        const S = new THREE.Vector3();
        const P = new THREE.Vector3();
        const E = new THREE.Euler();
        for (let i = 0; i < p.rocks; i++) {
          const ang = Math.random() * Math.PI * 2;
          const dist = 6 + Math.pow(Math.random(), 1.6) * 340;
          const x = Math.cos(ang) * dist;
          const z = Math.sin(ang) * dist;
          const s = 0.25 + Math.pow(Math.random(), 2.4) * 3.6;
          P.set(x, heightFn(x, z) + s * 0.32, z);
          E.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
          Q.setFromEuler(E);
          S.set(s * (0.7 + Math.random() * 0.6), s * (0.5 + Math.random() * 0.5), s * (0.7 + Math.random() * 0.6));
          M.compose(P, Q, S);
          inst.setMatrixAt(i, M);
        }
        inst.instanceMatrix.needsUpdate = true;
        this.scene.add(inst);
      }
    }
  }

  /* -------------------------------------------------- eventos */

  private onPointerDown = (e: PointerEvent) => {
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.renderer.domElement.style.cursor = "grabbing";
  };
  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.yaw -= (e.clientX - this.lastX) * 0.0034;
    this.pitch = THREE.MathUtils.clamp(this.pitch - (e.clientY - this.lastY) * 0.003, -1.45, 1.45);
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };
  private onPointerUp = () => {
    this.dragging = false;
    this.renderer.domElement.style.cursor = "grab";
  };
  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.fov = THREE.MathUtils.clamp(this.fov + e.deltaY * 0.03, 35, 100);
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
  };
  private onKeyDown = (e: KeyboardEvent) => this.keys.add(e.key.toLowerCase());
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());

  private bind() {
    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    el.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.ro = new ResizeObserver(() => {
      if (this.disposed) return;
      const w = Math.max(1, this.mount.clientWidth);
      const h = Math.max(1, this.mount.clientHeight);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
    this.ro.observe(this.mount);
  }

  /* -------------------------------------------------- loop */

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.wallTime += dt;
    for (const u of this.timeUniforms) u.value = this.wallTime;

    this.moving = false;
    if (!this.prof.cloudSea) {
      const g = Math.max(0.5, this.prof.gravity);
      const baseSpeed = 5.5 * THREE.MathUtils.clamp(Math.sqrt(9.81 / g), 0.45, 3.2);
      const speed = (this.keys.has("shift") ? baseSpeed * 2.3 : baseSpeed) * dt;
      const fx = -Math.sin(this.yaw);
      const fz = -Math.cos(this.yaw);
      let dx = 0;
      let dz = 0;
      if (this.keys.has("w") || this.keys.has("arrowup")) { dx += fx * speed; dz += fz * speed; }
      if (this.keys.has("s") || this.keys.has("arrowdown")) { dx -= fx * speed; dz -= fz * speed; }
      if (this.keys.has("a") || this.keys.has("arrowleft")) { dx += fz * speed; dz -= fx * speed; }
      if (this.keys.has("d") || this.keys.has("arrowright")) { dx -= fz * speed; dz += fx * speed; }
      if (dx !== 0 || dz !== 0) {
        this.moving = true;
        this.walkX = THREE.MathUtils.clamp(this.walkX + dx, -920, 920);
        this.walkZ = THREE.MathUtils.clamp(this.walkZ + dz, -920, 920);
      }
      const targetY = this.heightAt(this.walkX, this.walkZ) + this.eyeHeight;
      this.camY += (targetY - this.camY) * Math.min(1, dt * 9);
    } else {
      this.camY = 4.5 + Math.sin(this.wallTime * 0.4) * 0.5;
    }

    this.camera.position.set(this.walkX, this.camY, this.walkZ);
    this.lookTmp.set(
      this.walkX - Math.sin(this.yaw) * Math.cos(this.pitch),
      this.camY + Math.sin(this.pitch),
      this.walkZ - Math.cos(this.yaw) * Math.cos(this.pitch)
    );
    this.camera.lookAt(this.lookTmp);

    this.frames++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 1) {
      this.fps = Math.round(this.frames / Math.max(this.fpsTimer, 0.001));
      this.frames = 0;
      this.fpsTimer = 0;
    }
    this.teleTimer += dt;
    if (this.teleTimer >= 0.1) {
      this.teleTimer = 0;
      this.opts.onTelemetry({
        fps: this.fps,
        posX: this.walkX,
        posZ: this.walkZ,
        headingDeg: ((THREE.MathUtils.radToDeg(this.yaw) % 360) + 360) % 360,
        pitchDeg: THREE.MathUtils.radToDeg(this.pitch),
        fov: this.fov,
        moving: this.moving,
      });
    }

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    el.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.ro.disconnect();
    this.scene.traverse((o) => {
      const any = o as THREE.Mesh;
      if (any.geometry) any.geometry.dispose();
      const m = any.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
      else if (m) m.dispose();
    });
    this.renderer.dispose();
    el.remove();
  }
}
