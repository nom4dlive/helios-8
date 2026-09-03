import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  EXO_SYSTEMS,
  semiMajorAxisAU,
  hzLimits,
  hzStatus,
  type ExoSystem,
  type ExoPlanet,
} from "../data/exoplanets";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { surfaceUniforms } from "./SolarSystem";
import { SURFACE_VERT, PLANET_FRAG, ATMO_FRAG, NOISE_GLSL, STAR_VERT, STAR_FRAG, NEBULA_FRAG } from "./shaders";
import type { SurfaceParams } from "../data/bodies";

/** escala visual comum (mesma lei p/ todos os sistemas → comparação justa) */
const AU_SCALE = 42;
const auScale = (au: number) => Math.pow(Math.max(au, 0.001), 0.72) * AU_SCALE;
const starR = (rSun: number) => THREE.MathUtils.clamp(Math.pow(Math.max(rSun, 0.01), 0.6) * 4.6, 1.2, 9);
const planetR = (rEarth: number) => THREE.MathUtils.clamp(Math.pow(Math.max(rEarth, 0.05), 0.78) * 1.15, 0.45, 3.4);

export interface ExoSelection {
  systemId: string;
  planetId?: string;
}

export interface ExoSystemOptions {
  onSelect: (sel: ExoSelection | null) => void;
}

const SPHERE = new THREE.SphereGeometry(1, 48, 32);
const SPHERE_LO = new THREE.SphereGeometry(1, 28, 20);

const ROCKY: SurfaceParams = {
  palette: ["#5a7c9c", "#2e6b34", "#8a7c5c", "#5a8a4a", "#e8f0f4", "#c2a36b"],
  bandFreq: 0, bandTurb: 0, bandAmp: 0,
  noiseScale: 3.4, noiseAmp: 0.6, ridgeScale: 7, ridgeAmp: 0.3,
  craterScale: 10, craterAmp: 0.2, polarCap: 0.78,
  atmosColor: "#9cc4e8", atmosAmp: 0.8, earthLike: true,
};
const DRY: SurfaceParams = {
  ...ROCKY,
  palette: ["#b0885c", "#8f6a42", "#c8a070", "#7a5a38", "#e0d0b8", "#9c7848"],
  earthLike: false, polarCap: 0, craterAmp: 0.35, atmosAmp: 0.3, atmosColor: "#c8a878",
};
const NEPTUNIAN: SurfaceParams = {
  palette: ["#3c5cb8", "#5478d0", "#2e4a9c", "#263e88", "#7c9ce0", "#4468c4"],
  bandFreq: 8, bandTurb: 2.0, bandAmp: 0.6,
  noiseScale: 4, noiseAmp: 0.2, ridgeScale: 0, ridgeAmp: 0, craterScale: 0, craterAmp: 0,
  polarCap: 0, atmosColor: "#7c9ce0", atmosAmp: 1.0,
};

/** hash determinístico do id → variação estável entre recargas */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/* paletas calibradas por classe térmica — cada planeta ganha uma identidade própria */
const TEMPERATE_PALETTES: { pal: string[]; atmo: string }[] = [
  { pal: ["#1e5f8a", "#2e7d5c", "#3f8f4a", "#8a7c4f", "#e8f2f6", "#c2a36b"], atmo: "#8fc4e8" },
  { pal: ["#234f7c", "#3c8a6e", "#5a9c54", "#a08a5a", "#e0eef4", "#b89a62"], atmo: "#9ad0e0" },
  { pal: ["#2a5a8c", "#2e6b7a", "#4a9c78", "#7c8a54", "#eef4f8", "#a8946a"], atmo: "#a8d8ea" },
  { pal: ["#1e4a70", "#2e7d6a", "#548a4a", "#9c8a5e", "#e4f0f4", "#c8a870"], atmo: "#8ab8d8" },
];
const HOT_PALETTES: { pal: string[]; atmo: string }[] = [
  { pal: ["#8a4a2e", "#c1652e", "#a05228", "#6e3a1e", "#e8d8c0", "#d98a4a"], atmo: "#e0a870" },
  { pal: ["#7c3f28", "#b85c30", "#944a26", "#5e3018", "#e0c8a8", "#cc7c42"], atmo: "#d89860" },
  { pal: ["#6e4a3a", "#a06a3c", "#c8874a", "#54382a", "#ead8c0", "#b8865a"], atmo: "#d8b088" },
];
const COLD_PALETTES: { pal: string[]; atmo: string }[] = [
  { pal: ["#7c98b8", "#a8c4d8", "#8aa8c0", "#c8dce8", "#f2f8fc", "#9cb4c8"], atmo: "#c8e0f0" },
  { pal: ["#6a88a8", "#9cb8cc", "#7c9cb8", "#bcd4e4", "#eef6fa", "#8aa4bc"], atmo: "#bcd8ec" },
  { pal: ["#8a9cb0", "#b8c8d4", "#96aabc", "#d0e0ea", "#f4f8fc", "#a4b8c8"], atmo: "#d0e4f2" },
];
const NEPTUNIAN_PALETTES: { pal: string[]; atmo: string }[] = [
  { pal: ["#3c5cb8", "#5478d0", "#2e4a9c", "#263e88", "#7c9ce0", "#4468c4"], atmo: "#7c9ce0" },
  { pal: ["#2e6ab0", "#4a8cd0", "#264f94", "#1e3e7c", "#8ab4e8", "#3a6cb8"], atmo: "#8ab8e8" },
  { pal: ["#4a5cc0", "#6478d8", "#384aa4", "#2e3c8c", "#90a4e8", "#5068cc"], atmo: "#90a8ec" },
];

/** superfície procedural única derivada das propriedades físicas do planeta */
export function planetSurfaceFor(p: ExoPlanet): SurfaceParams {
  const h = hash01(p.id);
  const flux = p.fluxEarth ?? 1;
  let base: { pal: string[]; atmo: string };
  let kind: "rocky" | "hot" | "cold" | "nep";
  if (p.radiusEarth > 1.9) kind = "nep";
  else if (flux > 1.6) kind = "hot";
  else if (flux < 0.42) kind = "cold";
  else kind = "rocky";

  const bank =
    kind === "nep" ? NEPTUNIAN_PALETTES : kind === "hot" ? HOT_PALETTES : kind === "cold" ? COLD_PALETTES : TEMPERATE_PALETTES;
  base = bank[Math.floor(h * bank.length) % bank.length];

  if (kind === "nep") {
    return {
      ...NEPTUNIAN,
      palette: base.pal,
      atmosColor: base.atmo,
      bandFreq: 6 + h * 5,
      bandTurb: 1.4 + h * 1.6,
      spot: h > 0.55 ? { latDeg: 18 - h * 30, lonDeg: h * 300, size: 0.3 + h * 0.2, color: base.pal[4] } : undefined,
    };
  }
  if (kind === "hot") {
    return {
      palette: base.pal,
      bandFreq: 0, bandTurb: 0, bandAmp: 0,
      noiseScale: 3 + h * 3, noiseAmp: 0.55 + h * 0.2,
      ridgeScale: 6 + h * 6, ridgeAmp: 0.35 + h * 0.25,
      craterScale: 9 + h * 6, craterAmp: 0.28,
      polarCap: 0, atmosColor: base.atmo, atmosAmp: 0.35,
    };
  }
  if (kind === "cold") {
    return {
      palette: base.pal,
      bandFreq: 0, bandTurb: 0, bandAmp: 0,
      noiseScale: 3.4, noiseAmp: 0.4,
      ridgeScale: 5 + h * 5, ridgeAmp: 0.3 + h * 0.3,
      craterScale: 10 + h * 6, craterAmp: 0.4,
      polarCap: 0.55 + h * 0.2, atmosColor: base.atmo, atmosAmp: 0.5,
    };
  }
  /* temperado: mundos potencialmente habitáveis — oceanos + continentes */
  return {
    palette: base.pal,
    bandFreq: 0, bandTurb: 0, bandAmp: 0,
    noiseScale: 3.2 + h * 1.2, noiseAmp: 0.6,
    ridgeScale: 7, ridgeAmp: 0.28,
    craterScale: 10, craterAmp: 0.16,
    polarCap: 0.74 + h * 0.08,
    atmosColor: base.atmo, atmosAmp: 0.85,
    earthLike: true,
  };
}

/** textura de glow (canvas) para a coroa estelar */
function makeGlowTexture(color: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, color);
  grad.addColorStop(0.22, color + "66");
  grad.addColorStop(0.55, color + "1e");
  grad.addColorStop(1, color + "00");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** superfície estelar: granulação animada + escurecimento de limbo (HDR p/ bloom) */
const STAR_SURFACE_FRAG = /* glsl */ `
${NOISE_GLSL}
uniform vec3 uColor;
uniform float uTime;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vObjPos;

void main() {
  vec3 p = normalize(vObjPos);
  float t = uTime;
  float g1 = fbm(p * 5.0 + vec3(0.0, t * 0.06, t * 0.04));
  float g2 = fbm(p * 11.0 - vec3(t * 0.09, 0.0, t * 0.05));
  float cells = vnoise(p * 26.0 + vec3(0.0, t * 0.3, 0.0));
  float m = g1 * 0.5 + g2 * 0.32 + cells * 0.18;

  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float mu = clamp(dot(N, V), 0.0, 1.0);

  vec3 hot = mix(uColor, vec3(1.0), 0.55);
  vec3 col = mix(uColor * 0.82, hot, smoothstep(0.25, 0.85, m));
  /* manchas escuras ocasionais (atividade estelar) */
  col *= 1.0 - smoothstep(0.72, 0.8, fbm(p * 3.0 + 17.7)) * 0.25;
  col *= 0.5 + 0.72 * pow(mu, 0.62);
  col *= 1.75 + 0.85 * m;
  gl_FragColor = vec4(col, 1.0);
}
`;

const HALO_FRAG = /* glsl */ `
uniform vec3 uColor;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float mu = clamp(dot(N, V), 0.0, 1.0);
  float rim = pow(1.0 - mu, 2.4);
  gl_FragColor = vec4(uColor * rim * 1.4, rim);
}
`;

export class ExoSystemScene {
  private mount: HTMLElement;
  private labelLayer: HTMLElement;
  private opts: ExoSystemOptions;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;

  private planetAnims: { anchor: THREE.Object3D; r: number; period: number; phase: number; mesh: THREE.Mesh }[] = [];
  private pickables: THREE.Object3D[] = [];
  private labels: { el: HTMLDivElement; obj: THREE.Object3D }[] = [];
  private sel: ExoSelection | null = null;
  private showCompare = true;

  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private downPos = { x: 0, y: 0 };

  private composer!: EffectComposer;
  private starMats: THREE.ShaderMaterial[] = [];
  private starMatPoints!: THREE.ShaderMaterial;

  /* controles de simulação */
  private paused = false;
  private speedMult = 1;
  private spinMult = 1;

  private raf = 0;
  private clock = new THREE.Clock();
  private wallTime = 0;
  private simDays = 0;
  private ro!: ResizeObserver;
  private disposed = false;

  constructor(
    mount: HTMLElement,
    labelLayer: HTMLElement,
    opts: ExoSystemOptions,
    initialSystemId?: string
  ) {
    this.mount = mount;
    this.labelLayer = labelLayer;
    this.opts = opts;
    this.initGL();
    this.bind();
    this.build(initialSystemId ?? EXO_SYSTEMS[0].id);
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
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.style.cursor = "grab";
    this.mount.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(48, w / h, 0.1, 4000);
    this.camera.position.set(0, 55, 120);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 420;

    /* pós-produção: bloom em meia resolução + saída tonemapeada */
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(Math.ceil(w / 2), Math.ceil(h / 2)), 0.6, 0.5, 1.0));
    this.composer.addPass(new OutputPass());

    /* ---------- fundo vivo: nebulosa + estrelas cintilantes ---------- */
    const nebula = new THREE.Mesh(
      new THREE.SphereGeometry(1500, 32, 24),
      new THREE.ShaderMaterial({
        vertexShader: SURFACE_VERT,
        fragmentShader: NEBULA_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
    nebula.renderOrder = -10;
    nebula.userData.keep = true;
    this.scene.add(nebula);

    const N = 1500;
    const p = new Float32Array(N * 3);
    const sz = new Float32Array(N);
    const ph = new Float32Array(N);
    const col = new Float32Array(N * 3);
    const pal = ["#ffffff", "#ffffff", "#cfe0ff", "#ffe9c4", "#bcd2ff"].map((c) => new THREE.Color(c));
    for (let i = 0; i < N; i++) {
      const r = 800 + Math.random() * 300;
      const th = Math.random() * Math.PI * 2;
      const phv = Math.acos(2 * Math.random() - 1);
      p[i * 3] = r * Math.sin(phv) * Math.cos(th);
      p[i * 3 + 1] = r * Math.cos(phv);
      p[i * 3 + 2] = r * Math.sin(phv) * Math.sin(th);
      sz[i] = 0.7 + Math.random() * 1.8;
      ph[i] = Math.random();
      const c = pal[Math.floor(Math.random() * pal.length)];
      const b = 0.5 + Math.random() * 0.5;
      col[i * 3] = c.r * b;
      col[i * 3 + 1] = c.g * b;
      col[i * 3 + 2] = c.b * b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(sz, 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(ph, 1));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    this.starMatPoints = new THREE.ShaderMaterial({
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const stars = new THREE.Points(g, this.starMatPoints);
    stars.renderOrder = -5;
    stars.userData.keep = true;
    this.scene.add(stars);
  }

  /* -------------------------------------------------- construção */

  private makeLabel(text: string, accent: string): HTMLDivElement {
    const el = document.createElement("div");
    el.className = "orbit-label is-static";
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = accent;
    dot.style.color = accent;
    const t = document.createElement("span");
    t.textContent = text;
    el.appendChild(dot);
    el.appendChild(t);
    this.labelLayer.appendChild(el);
    return el;
  }

  private makeStar(radius: number, color: string, parent: THREE.Group): THREE.Mesh {
    const mat = new THREE.ShaderMaterial({
      vertexShader: SURFACE_VERT,
      fragmentShader: STAR_SURFACE_FRAG,
      uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 } },
    });
    this.starMats.push(mat);
    const mesh = new THREE.Mesh(SPHERE, mat);
    mesh.scale.setScalar(Math.max(0.2, radius));
    parent.add(mesh);

    /* halo de limbo (fresnel) */
    const haloMat = new THREE.ShaderMaterial({
      vertexShader: SURFACE_VERT,
      fragmentShader: HALO_FRAG,
      uniforms: { uColor: { value: new THREE.Color(color) } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const halo = new THREE.Mesh(SPHERE, haloMat);
    halo.scale.setScalar(Math.max(0.2, radius) * 1.45);
    parent.add(halo);

    /* coroa larga em sprite (alimenta o bloom) */
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture(color),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.85,
      })
    );
    const gs = Math.max(0.2, radius) * 7;
    glow.scale.set(gs, gs, 1);
    glow.renderOrder = 2;
    parent.add(glow);
    return mesh;
  }

  private makePlanetMesh(
    planet: ExoPlanet,
    starPos: THREE.Vector3,
    parent: THREE.Object3D
  ): THREE.Mesh {
    const surface = planetSurfaceFor(planet);
    const u = surfaceUniforms({ surface });
    u.uSunPos.value = starPos;
    const mat = new THREE.ShaderMaterial({
      vertexShader: SURFACE_VERT,
      fragmentShader: surface.earthLike ? PLANET_FRAG : PLANET_FRAG,
      uniforms: u,
    });
    const r = planetR(planet.radiusEarth);
    const mesh = new THREE.Mesh(planet.radiusEarth > 1.8 ? SPHERE : SPHERE_LO, mat);
    mesh.scale.setScalar(r);
    /* inclinação axial variada (determinística) */
    mesh.rotation.z = (hash01(planet.id + "tilt") - 0.5) * 0.6;
    parent.add(mesh);

    /* halo atmosférico para mundos com atmosfera relevante */
    if (surface.atmosAmp > 0.4) {
      const atmoMat = new THREE.ShaderMaterial({
        vertexShader: SURFACE_VERT,
        fragmentShader: ATMO_FRAG,
        uniforms: {
          uColor: { value: new THREE.Color(surface.atmosColor) },
          uIntensity: { value: surface.atmosAmp * 0.8 },
          uSunPos: u.uSunPos,
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const atmo = new THREE.Mesh(SPHERE_LO, atmoMat);
      atmo.scale.setScalar(r * 1.14);
      atmo.renderOrder = 2;
      parent.add(atmo);
    }
    return mesh;
  }

  build(systemId: string) {
    /* limpa cena anterior (preserva nebulosa + estrelas de fundo) */
    for (const o of [...this.scene.children]) {
      if (o.userData.keep) continue;
      o.traverse((c) => {
        const mm = c as THREE.Mesh;
        if (mm.geometry && mm.geometry !== SPHERE && mm.geometry !== SPHERE_LO) mm.geometry.dispose();
        const mat = mm.material as THREE.Material | THREE.Material[] | undefined;
        const kill = (x: THREE.Material) => {
          const withMap = x as THREE.Material & { map?: THREE.Texture | null };
          if (withMap.map) withMap.map.dispose();
          x.dispose();
        };
        if (Array.isArray(mat)) mat.forEach(kill);
        else if (mat) kill(mat);
      });
      this.scene.remove(o);
    }
    this.planetAnims = [];
    this.pickables = [];
    this.starMats = [];
    this.labels.forEach((l) => l.el.remove());
    this.labels = [];

    const sys = EXO_SYSTEMS.find((s) => s.id === systemId) ?? EXO_SYSTEMS[0];
    /* mantém a seleção sincronizada (o toggle de comparação depende dela) */
    this.sel = { systemId: sys.id };

    /* ---------- sistema exoplanetário ---------- */
    const group = new THREE.Group();
    this.scene.add(group);
    const starPos = new THREE.Vector3(0, 0, 0);

    const sMesh = this.makeStar(starR(sys.spectral.radiusSun), sys.spectral.color, group);
    sMesh.userData.sel = { systemId: sys.id } as ExoSelection;
    this.pickables.push(sMesh);
    this.labels.push({ el: this.makeLabel(sys.starName, sys.spectral.color), obj: sMesh });

    const hz = hzLimits(sys.spectral.luminositySun);
    const hzGeo = new THREE.RingGeometry(
      Math.max(0.1, auScale(hz.inner)),
      Math.max(auScale(hz.inner) + 0.2, auScale(hz.outer)),
      128,
      1
    );
    hzGeo.rotateX(-Math.PI / 2);
    const hzMesh = new THREE.Mesh(
      hzGeo,
      new THREE.MeshBasicMaterial({
        color: 0x3fae6a,
        transparent: true,
        opacity: 0.07,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    group.add(hzMesh);

    sys.planets.forEach((planet, i) => {
      const a = semiMajorAxisAU(planet.periodDays, sys.spectral.massSun);
      const r = Math.max(auScale(a), starR(sys.spectral.radiusSun) + 2 + i * 0.6);

      const pts: THREE.Vector3[] = [];
      for (let k = 0; k < 128; k++) {
        const ang = (k / 128) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(ang) * r, 0, Math.sin(ang) * r));
      }
      const orbitGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const status = hzStatus(planet.fluxEarth);
      const orbitColor = status === "conservative" ? 0x3fae6a : status === "optimistic" ? 0x8fae5a : 0x5a6a84;
      group.add(
        new THREE.LineLoop(
          orbitGeo,
          new THREE.LineBasicMaterial({ color: orbitColor, transparent: true, opacity: 0.3 })
        )
      );

      const anchor = new THREE.Group();
      group.add(anchor);
      const mesh = this.makePlanetMesh(planet, starPos, anchor);
      mesh.userData.sel = { systemId: sys.id, planetId: planet.id } as ExoSelection;
      this.pickables.push(mesh);

      const labelColor = status === "conservative" ? "#5fd08a" : status === "optimistic" ? "#a8c86a" : "#8b93a7";
      this.labels.push({ el: this.makeLabel(planet.name, labelColor), obj: mesh });

      this.planetAnims.push({
        anchor,
        r,
        period: planet.periodDays,
        phase: i * 1.31 + 0.5,
        mesh,
      });
    });

    /* ---------- comparação: Sistema Solar (mesma escala) ---------- */
    if (this.showCompare) {
      const solGroup = new THREE.Group();
      solGroup.position.set(118, 0, 0);
      this.scene.add(solGroup);

      const sunMesh = this.makeStar(4.6, "#fff2cc", solGroup);
      this.labels.push({ el: this.makeLabel("Sol", "#f5b342"), obj: sunMesh });

      const rocky = [
        { name: "Mercúrio", au: 0.39, period: 87.97, rE: 0.38, color: "#a89a8a", sur: DRY },
        { name: "Vênus", au: 0.72, period: 224.7, rE: 0.95, color: "#e8c890", sur: DRY },
        { name: "Terra", au: 1.0, period: 365.25, rE: 1.0, color: "#5b9bd5", sur: ROCKY },
        { name: "Marte", au: 1.52, period: 686.98, rE: 0.53, color: "#d97757", sur: DRY },
      ];
      const solStarPos = solGroup.position.clone();
      rocky.forEach((p, i) => {
        const r = auScale(p.au);
        const pts: THREE.Vector3[] = [];
        for (let k = 0; k < 128; k++) {
          const ang = (k / 128) * Math.PI * 2;
          pts.push(new THREE.Vector3(Math.cos(ang) * r, 0, Math.sin(ang) * r));
        }
        solGroup.add(
          new THREE.LineLoop(
            new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineBasicMaterial({ color: p.color, transparent: true, opacity: 0.28 })
          )
        );
        const u = surfaceUniforms({ surface: p.sur });
        u.uSunPos.value = solStarPos;
        const mesh = new THREE.Mesh(SPHERE_LO, new THREE.ShaderMaterial({
          vertexShader: SURFACE_VERT,
          fragmentShader: PLANET_FRAG,
          uniforms: u,
        }));
        mesh.scale.setScalar(planetR(p.rE));
        const anchor = new THREE.Group();
        solGroup.add(anchor);
        anchor.add(mesh);
        this.labels.push({ el: this.makeLabel(p.name, p.color), obj: mesh });
        this.planetAnims.push({ anchor, r, period: p.period, phase: i * 0.9, mesh });
      });
    }

    /* câmera */
    const maxR = Math.max(
      ...this.planetAnims.filter((a) => a.r < 110).map((a) => a.r),
      20
    );
    this.controls.target.set(this.showCompare ? 40 : 0, 0, 0);
    this.camera.position.set(this.showCompare ? 40 : 0, maxR * 0.95 + 18, maxR * 1.35 + 26);
  }

  setShowCompare(v: boolean) {
    if (v === this.showCompare) return;
    this.showCompare = v;
    this.build(this.sel?.systemId ?? EXO_SYSTEMS[0].id);
  }

  /* -------------------------------------------------- eventos */

  private onDown = (e: PointerEvent) => {
    this.downPos = { x: e.clientX, y: e.clientY };
  };
  private onUp = (e: PointerEvent) => {
    const dx = e.clientX - this.downPos.x;
    const dy = e.clientY - this.downPos.y;
    if (dx * dx + dy * dy > 36) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.set(
      ((e.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
      -((e.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1
    );
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    if (hits.length > 0 && hits[0].object.userData.sel) {
      this.sel = hits[0].object.userData.sel as ExoSelection;
      this.opts.onSelect(this.sel);
    }
  };

  private bind() {
    this.renderer.domElement.addEventListener("pointerdown", this.onDown);
    this.renderer.domElement.addEventListener("pointerup", this.onUp);
    this.ro = new ResizeObserver(() => {
      if (this.disposed) return;
      const w = Math.max(1, this.mount.clientWidth);
      const h = Math.max(1, this.mount.clientHeight);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.composer.setSize(w, h);
    });
    this.ro.observe(this.mount);
  }

  /* -------------------------------------------------- loop */

  private V = new THREE.Vector3();

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.wallTime += dt;

    /* ~365 dias a cada 12 s (na velocidade 1×): anos curtos giram rápido, longos perceptíveis */
    if (!this.paused) {
      this.simDays += dt * (365.25 / 12) * this.speedMult;
    }

    for (const a of this.planetAnims) {
      const th = a.phase + (this.simDays / Math.max(a.period, 0.05)) * Math.PI * 2;
      a.anchor.position.set(Math.cos(th) * a.r, 0, Math.sin(th) * a.r);
      if (!this.paused) a.mesh.rotation.y += dt * 0.4 * this.spinMult;
    }

    /* granulação estelar + cintilação do fundo (não congelam com a pausa) */
    for (const m of this.starMats) m.uniforms.uTime.value = this.wallTime;
    this.starMatPoints.uniforms.uTime.value = this.wallTime;

    this.controls.update();

    const w = this.mount.clientWidth;
    const h = this.mount.clientHeight;
    for (const l of this.labels) {
      l.obj.getWorldPosition(this.V);
      this.V.y += 1.6;
      this.V.project(this.camera);
      if (this.V.z > 1 || Math.abs(this.V.x) > 1.15 || Math.abs(this.V.y) > 1.15) {
        l.el.classList.add("is-hidden");
        continue;
      }
      l.el.classList.remove("is-hidden");
      const x = (this.V.x * 0.5 + 0.5) * w;
      const y = (-this.V.y * 0.5 + 0.5) * h;
      l.el.style.transform = `translate(-50%, -140%) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }

    this.composer.render();
  };

  /* -------------------------------------------------- API de simulação */

  setPaused(p: boolean) {
    this.paused = p;
  }

  setSpeed(mult: number) {
    this.speedMult = THREE.MathUtils.clamp(mult, 0.1, 12);
  }

  setSpin(mult: number) {
    this.spinMult = THREE.MathUtils.clamp(mult, 0, 4);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.renderer.domElement.removeEventListener("pointerdown", this.onDown);
    this.renderer.domElement.removeEventListener("pointerup", this.onUp);
    this.ro.disconnect();
    this.controls.dispose();
    this.scene.traverse((o) => {
      const mm = o as THREE.Mesh;
      if (mm.geometry) mm.geometry.dispose();
      const mat = mm.material as THREE.Material | THREE.Material[] | undefined;
      const kill = (x: THREE.Material) => {
        const withMap = x as THREE.Material & { map?: THREE.Texture | null };
        if (withMap.map) withMap.map.dispose();
        x.dispose();
      };
      if (Array.isArray(mat)) mat.forEach(kill);
      else if (mat) kill(mat);
    });
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.forEach((l) => l.el.remove());
  }
}
