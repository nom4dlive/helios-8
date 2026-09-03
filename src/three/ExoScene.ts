import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import {
  EXO_SYSTEMS,
  CLASS_META,
  semiMajorAxisAU,
  hzLimits,
  solveKepler,
  type ExoSystem,
  type ExoPlanet,
  type WorldClass,
} from "../data/catalog";
import {
  SURFACE_VERT,
  PLANET_FRAG,
  STAR_FRAG,
  HALO_FRAG,
  NEBULA_FRAG,
  STAR_PT_VERT,
  STAR_PT_FRAG,
} from "./shaders";

export interface ExoSelection {
  systemId: string;
  planetId?: string;
}

export interface ExoSceneOptions {
  onSelect: (sel: ExoSelection) => void;
}

/* escalas visuais comuns — mesmas leis p/ todos os sistemas (comparação justa) */
const auScale = (au: number) => {
  const a = Math.max(au, 0.005);
  const base = 42 * Math.pow(Math.min(a, 2.5), 0.72);
  return base + 30 * Math.sqrt(Math.max(0, a - 2.5));
};
const starR = (rSun: number, pulsar: boolean) =>
  pulsar ? 0.55 : THREE.MathUtils.clamp(Math.pow(Math.max(rSun, 0.01), 0.6) * 4.6, 1.2, 9);
const planetR = (rEarth: number) =>
  THREE.MathUtils.clamp(Math.pow(Math.max(rEarth, 0.05), 0.78) * 1.15, 0.45, 3.4);

/** hash determinístico 0..1 a partir do id → variação única por planeta */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}
const mixHex = (a: string, b: string, t: number) =>
  "#" + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();

interface SurfaceDef {
  palette: string[];
  bandFreq: number;
  bandTurb: number;
  bandAmp: number;
  noiseScale: number;
  noiseAmp: number;
  ridgeScale: number;
  ridgeAmp: number;
  craterScale: number;
  craterAmp: number;
  polarCap: number;
  atmosColor: string;
  atmosAmp: number;
  glow: number;
  spec: number;
}

/** superfície procedural por classe de mundo + variação determinística por id */
export function classSurface(planet: ExoPlanet): SurfaceDef {
  const v = hash01(planet.id);
  const shift = (base: SurfaceDef): SurfaceDef => ({
    ...base,
    palette: base.palette.map((c, i) =>
      i < 4 ? mixHex(c, i % 2 === 0 ? "#ffffff" : "#000000", (v - 0.5) * 0.16) : c
    ),
    noiseScale: base.noiseScale * (0.8 + v * 0.4),
    bandFreq: base.bandFreq * (0.85 + v * 0.3),
  });
  switch (planet.cls) {
    case "temperate":
      return shift({
        palette: ["#1c4a8a", "#2e6b34", "#8a7c5c", "#4a7a3a", "#e8f0f4", "#c2a36b"],
        bandFreq: 0, bandTurb: 0, bandAmp: 0, noiseScale: 3.4, noiseAmp: 0.75,
        ridgeScale: 7, ridgeAmp: 0.22, craterScale: 9, craterAmp: 0.14, polarCap: 0.8,
        atmosColor: "#7fb8ff", atmosAmp: 1.0, glow: 0, spec: 0.55,
      });
    case "ocean":
      return shift({
        palette: ["#0e2e6b", "#1c55a8", "#2a6bc0", "#16407e", "#dfeef8", "#3a7fd0"],
        bandFreq: 0, bandTurb: 0, bandAmp: 0, noiseScale: 4.2, noiseAmp: 0.3,
        ridgeScale: 6, ridgeAmp: 0.1, craterScale: 0, craterAmp: 0, polarCap: 0.86,
        atmosColor: "#9cd0ff", atmosAmp: 1.1, glow: 0, spec: 1.0,
      });
    case "hycean":
      return shift({
        palette: ["#0d4a5e", "#17687c", "#2a8a96", "#0f5a6e", "#e0f2f2", "#3aa0ac"],
        bandFreq: 5, bandTurb: 1.2, bandAmp: 0.22, noiseScale: 3.8, noiseAmp: 0.35,
        ridgeScale: 0, ridgeAmp: 0, craterScale: 0, craterAmp: 0, polarCap: 0.9,
        atmosColor: "#a8e0dc", atmosAmp: 1.2, glow: 0, spec: 0.8,
      });
    case "desert":
      return shift({
        palette: ["#b0885c", "#8f6a42", "#c8a070", "#7a5a38", "#e8d8c0", "#9c7848"],
        bandFreq: 0, bandTurb: 0, bandAmp: 0, noiseScale: 4.5, noiseAmp: 0.6,
        ridgeScale: 8, ridgeAmp: 0.3, craterScale: 11, craterAmp: 0.35, polarCap: 0,
        atmosColor: "#c8a878", atmosAmp: 0.3, glow: 0, spec: 0,
      });
    case "lava":
      return shift({
        palette: ["#2a1a14", "#1a1210", "#3a2418", "#120c0a", "#4a3020", "#241610"],
        bandFreq: 0, bandTurb: 0, bandAmp: 0, noiseScale: 5.5, noiseAmp: 0.5,
        ridgeScale: 4.5, ridgeAmp: 0.45, craterScale: 12, craterAmp: 0.25, polarCap: 0,
        atmosColor: "#ff8050", atmosAmp: 0.22, glow: 0.95, spec: 0,
      });
    case "super-earth":
      return shift({
        palette: ["#5a6a5a", "#4a5a4a", "#7a8a70", "#3e4e40", "#e0e8e0", "#8a9a80"],
        bandFreq: 0, bandTurb: 0, bandAmp: 0, noiseScale: 3.8, noiseAmp: 0.65,
        ridgeScale: 7.5, ridgeAmp: 0.35, craterScale: 10, craterAmp: 0.3, polarCap: 0.74,
        atmosColor: "#b8d8c8", atmosAmp: 0.5, glow: 0, spec: 0.2,
      });
    case "mini-neptune":
      return shift({
        palette: ["#5a78a8", "#7090c0", "#4a68a0", "#8aa8d0", "#c8d8ec", "#6080b8"],
        bandFreq: 8, bandTurb: 2.2, bandAmp: 0.55, noiseScale: 4, noiseAmp: 0.2,
        ridgeScale: 0, ridgeAmp: 0, craterScale: 0, craterAmp: 0, polarCap: 0,
        atmosColor: "#a8c8f0", atmosAmp: 1.2, glow: 0, spec: 0,
      });
    case "hot-jupiter":
      return shift({
        palette: ["#c89050", "#e8b070", "#a87038", "#f0c890", "#f8e0b8", "#d8a060"],
        bandFreq: 11, bandTurb: 3.0, bandAmp: 0.7, noiseScale: 4.5, noiseAmp: 0.25,
        ridgeScale: 0, ridgeAmp: 0, craterScale: 0, craterAmp: 0, polarCap: 0,
        atmosColor: "#f0c890", atmosAmp: 1.0, glow: 0.28, spec: 0,
      });
    case "gas-giant":
      return shift({
        palette: ["#c8b890", "#e0d0a8", "#a89870", "#ece0c0", "#f4ecd8", "#d0c098"],
        bandFreq: 9, bandTurb: 2.4, bandAmp: 0.6, noiseScale: 4, noiseAmp: 0.2,
        ridgeScale: 0, ridgeAmp: 0, craterScale: 0, craterAmp: 0, polarCap: 0,
        atmosColor: "#e8dcc0", atmosAmp: 0.9, glow: 0, spec: 0,
      });
    case "imaged-giant":
      return shift({
        palette: ["#b06830", "#d08848", "#8a4e22", "#e0a060", "#f0c090", "#c07838"],
        bandFreq: 7, bandTurb: 2.0, bandAmp: 0.5, noiseScale: 4.2, noiseAmp: 0.3,
        ridgeScale: 0, ridgeAmp: 0, craterScale: 0, craterAmp: 0, polarCap: 0,
        atmosColor: "#f0b070", atmosAmp: 0.8, glow: 0.5, spec: 0,
      });
    case "pulsar-world":
      return shift({
        palette: ["#3a3e48", "#2a2e38", "#4a4e58", "#1e222c", "#606878", "#343a46"],
        bandFreq: 0, bandTurb: 0, bandAmp: 0, noiseScale: 5, noiseAmp: 0.55,
        ridgeScale: 6, ridgeAmp: 0.3, craterScale: 12, craterAmp: 0.45, polarCap: 0,
        atmosColor: "#8090c0", atmosAmp: 0.1, glow: 0.12, spec: 0,
      });
  }
}

function surfaceUniforms(s: SurfaceDef, sunPos: THREE.Vector3) {
  const palette = s.palette.map((c) => new THREE.Color(c));
  while (palette.length < 6) palette.push(new THREE.Color("#000000"));
  return {
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
    uSpotSize: { value: 0.4 },
    uSpotOn: { value: 0 },
    uSpotColor: { value: new THREE.Color("#000000") },
    uAtmosColor: { value: new THREE.Color(s.atmosColor) },
    uAtmosAmp: { value: THREE.MathUtils.clamp(s.atmosAmp, 0, 2) },
    uGlow: { value: THREE.MathUtils.clamp(s.glow, 0, 1.5) },
    uSpec: { value: THREE.MathUtils.clamp(s.spec, 0, 1.5) },
    uSunPos: { value: sunPos },
  };
}

const SPHERE = new THREE.SphereGeometry(1, 52, 36);
const SPHERE_LO = new THREE.SphereGeometry(1, 28, 20);

const SOLAR_ROCKY = [
  { name: "Mercúrio", au: 0.39, period: 87.97, rE: 0.38, cls: "desert" as WorldClass },
  { name: "Vênus", au: 0.72, period: 224.7, rE: 0.95, cls: "desert" as WorldClass },
  { name: "Terra", au: 1.0, period: 365.25, rE: 1.0, cls: "temperate" as WorldClass },
  { name: "Marte", au: 1.52, period: 686.98, rE: 0.53, cls: "desert" as WorldClass },
];

interface Anim {
  anchor: THREE.Object3D;
  mesh: THREE.Mesh;
  phase: number;
  varpi: number;
  ecc: number;
  r: number;
  displayPeriod: number;
  spinBase: number;
}

export class ExoScene {
  private mount: HTMLElement;
  private labelLayer: HTMLElement;
  private opts: ExoSceneOptions;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private composer!: EffectComposer;

  private anims: Anim[] = [];
  private pickables: THREE.Object3D[] = [];
  private starMats: THREE.ShaderMaterial[] = [];
  private planetMats: THREE.ShaderMaterial[] = [];
  private labels: { el: HTMLDivElement; obj: THREE.Object3D }[] = [];
  private ptMat!: THREE.ShaderMaterial;

  private sel: ExoSelection | null = null;
  private showCompare = true;
  private paused = false;
  private speedMult = 1;
  private spinMult = 1;
  private elapsed = 0;

  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private downPos = { x: 0, y: 0 };
  private V = new THREE.Vector3();

  private raf = 0;
  private clock = new THREE.Clock();
  private ro!: ResizeObserver;
  private disposed = false;

  constructor(mount: HTMLElement, labelLayer: HTMLElement, opts: ExoSceneOptions) {
    this.mount = mount;
    this.labelLayer = labelLayer;
    this.opts = opts;
    this.initGL();
    this.bind();
    this.build(EXO_SYSTEMS[1].id);
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
    this.camera = new THREE.PerspectiveCamera(48, w / h, 0.1, 5000);
    this.camera.position.set(0, 60, 140);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 1400;

    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(
      new UnrealBloomPass(new THREE.Vector2(Math.ceil(w / 2), Math.ceil(h / 2)), 0.68, 0.55, 0.92)
    );
    this.composer.addPass(new OutputPass());

    /* fundo: nebulosa + estrelas cintilantes */
    const nebula = new THREE.Mesh(
      new THREE.SphereGeometry(2400, 32, 24),
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

    const N = 1600;
    const pos = new Float32Array(N * 3);
    const size = new Float32Array(N);
    const phase = new Float32Array(N);
    const col = new Float32Array(N * 3);
    const pal = ["#ffffff", "#ffffff", "#cfe0ff", "#ffe9c4", "#ffc9a0", "#bcd2ff"].map(
      (c) => new THREE.Color(c)
    );
    for (let i = 0; i < N; i++) {
      const r = 1500 + Math.random() * 600;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph);
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      size[i] = 0.7 + Math.random() * 1.9;
      phase[i] = Math.random();
      const c = pal[Math.floor(Math.random() * pal.length)];
      const b = 0.55 + Math.random() * 0.45;
      col[i * 3] = c.r * b;
      col[i * 3 + 1] = c.g * b;
      col[i * 3 + 2] = c.b * b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    this.ptMat = new THREE.ShaderMaterial({
      vertexShader: STAR_PT_VERT,
      fragmentShader: STAR_PT_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const stars = new THREE.Points(g, this.ptMat);
    stars.renderOrder = -5;
    stars.userData.keep = true;
    this.scene.add(stars);
  }

  /* -------------------------------------------------- construção */

  private makeLabel(text: string, accent: string): HTMLDivElement {
    const el = document.createElement("div");
    el.className = "orbit-label";
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

  private makeStar(radiusSun: number, color: string, pulsar: boolean, parent: THREE.Group): THREE.Mesh {
    const mat = new THREE.ShaderMaterial({
      vertexShader: SURFACE_VERT,
      fragmentShader: STAR_FRAG,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uTime: { value: 0 },
        uPulse: { value: pulsar ? 1 : 0 },
      },
    });
    const mesh = new THREE.Mesh(SPHERE, mat);
    mesh.scale.setScalar(starR(radiusSun, pulsar));
    parent.add(mesh);
    this.starMats.push(mat);

    const haloMat = new THREE.ShaderMaterial({
      vertexShader: SURFACE_VERT,
      fragmentShader: HALO_FRAG,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uIntensity: { value: pulsar ? 2.4 : 1.3 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const halo = new THREE.Mesh(SPHERE, haloMat);
    halo.scale.setScalar(starR(radiusSun, pulsar) * (pulsar ? 2.6 : 1.5));
    parent.add(halo);
    return mesh;
  }

  private makePlanetMesh(
    planet: ExoPlanet,
    starPos: THREE.Vector3,
    parent: THREE.Object3D
  ): THREE.Mesh {
    const s = classSurface(planet);
    const mat = new THREE.ShaderMaterial({
      vertexShader: SURFACE_VERT,
      fragmentShader: PLANET_FRAG,
      uniforms: surfaceUniforms(s, starPos),
    });
    this.planetMats.push(mat);
    const mesh = new THREE.Mesh(planet.radiusEarth > 1.8 ? SPHERE : SPHERE_LO, mat);
    mesh.scale.setScalar(planetR(planet.radiusEarth));
    mesh.rotation.z = THREE.MathUtils.degToRad((hash01(planet.id) - 0.5) * 46);
    parent.add(mesh);

    if (s.atmosAmp > 0.35) {
      const haloMat = new THREE.ShaderMaterial({
        vertexShader: SURFACE_VERT,
        fragmentShader: HALO_FRAG,
        uniforms: {
          uColor: { value: new THREE.Color(s.atmosColor) },
          uIntensity: { value: s.atmosAmp * 0.75 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const halo = new THREE.Mesh(SPHERE_LO, haloMat);
      halo.scale.setScalar(planetR(planet.radiusEarth) * 1.14);
      parent.add(halo);
    }
    return mesh;
  }

  private orbitEllipsePoints(r: number, ecc: number, varpi: number): THREE.Vector3[] {
    const e = THREE.MathUtils.clamp(ecc, 0, 0.9);
    const b = r * Math.sqrt(Math.max(0, 1 - e * e));
    const cv = Math.cos(varpi);
    const sv = Math.sin(varpi);
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k < 160; k++) {
      const E = (k / 160) * Math.PI * 2;
      const x = r * (Math.cos(E) - e);
      const z = b * Math.sin(E);
      pts.push(new THREE.Vector3(x * cv - z * sv, 0, x * sv + z * cv));
    }
    return pts;
  }

  build(systemId: string) {
    for (const o of [...this.scene.children]) {
      if (o.userData.keep) continue;
      o.traverse((c) => {
        const mm = c as THREE.Mesh;
        if (mm.geometry && mm.geometry !== SPHERE && mm.geometry !== SPHERE_LO) mm.geometry.dispose();
        const mat = mm.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) mat.dispose();
      });
      this.scene.remove(o);
    }
    this.anims = [];
    this.pickables = [];
    this.starMats = [];
    this.planetMats = [];
    this.labels.forEach((l) => l.el.remove());
    this.labels = [];

    const sys = EXO_SYSTEMS.find((s) => s.id === systemId) ?? EXO_SYSTEMS[1];
    this.sel = { systemId: sys.id };
    const pulsar = sys.kind === "pulsar";

    /* ---------- sistema exoplanetário ---------- */
    const group = new THREE.Group();
    this.scene.add(group);
    const starPos = new THREE.Vector3(0, 0, 0);

    const sMesh = this.makeStar(sys.spectral.radiusSun, sys.spectral.color, pulsar, group);
    sMesh.userData.sel = { systemId: sys.id } as ExoSelection;
    this.pickables.push(sMesh);
    this.labels.push({ el: this.makeLabel(sys.starName, sys.spectral.color), obj: sMesh });

    /* zona habitável (Kopparapu) */
    if (!pulsar) {
      const hz = hzLimits(sys.spectral.luminositySun);
      const hzGeo = new THREE.RingGeometry(
        Math.max(0.1, auScale(hz.inner)),
        Math.max(auScale(hz.inner) + 0.2, auScale(hz.outer)),
        128,
        1
      );
      hzGeo.rotateX(-Math.PI / 2);
      group.add(
        new THREE.Mesh(
          hzGeo,
          new THREE.MeshBasicMaterial({
            color: 0x3fae6a,
            transparent: true,
            opacity: 0.07,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        )
      );
    }

    const starRad = starR(sys.spectral.radiusSun, pulsar);
    sys.planets.forEach((planet, i) => {
      const a = semiMajorAxisAU(planet.periodDays, sys.spectral.massSun);
      const r = Math.max(auScale(a), starRad + 1.6 + i * 0.7);
      const ecc = THREE.MathUtils.clamp(planet.ecc ?? 0, 0, 0.6);
      const varpi = hash01(planet.id + "w") * Math.PI * 2;

      const orbitGeo = new THREE.BufferGeometry().setFromPoints(
        this.orbitEllipsePoints(r, ecc, varpi)
      );
      const habitable = planet.habitable === true;
      group.add(
        new THREE.LineLoop(
          orbitGeo,
          new THREE.LineBasicMaterial({
            color: habitable ? 0x3fae6a : 0x4a5a74,
            transparent: true,
            opacity: habitable ? 0.5 : 0.26,
          })
        )
      );

      const anchor = new THREE.Group();
      group.add(anchor);
      const mesh = this.makePlanetMesh(planet, starPos, anchor);
      mesh.userData.sel = { systemId: sys.id, planetId: planet.id } as ExoSelection;
      this.pickables.push(mesh);

      this.labels.push({
        el: this.makeLabel(planet.name.split("(")[0].trim(), CLASS_META[planet.cls].color),
        obj: mesh,
      });

      this.anims.push({
        anchor,
        mesh,
        phase: i * 1.31 + 0.5,
        varpi,
        ecc,
        r,
        displayPeriod: 8 * Math.sqrt(Math.max(planet.periodDays, 0.2)),
        spinBase: planet.radiusEarth > 4 ? 0.9 : 0.45,
      });
    });

    /* ---------- comparação: Sistema Solar na mesma escala ---------- */
    if (this.showCompare && !pulsar) {
      const sol = new THREE.Group();
      sol.position.set(130, 0, 0);
      this.scene.add(sol);

      const sunMesh = this.makeStar(1, "#fff2cc", false, sol);
      this.labels.push({ el: this.makeLabel("Sol", "#f5b342"), obj: sunMesh });
      const solPos = sol.position.clone();

      SOLAR_ROCKY.forEach((p, i) => {
        const r = auScale(p.au);
        sol.add(
          new THREE.LineLoop(
            new THREE.BufferGeometry().setFromPoints(this.orbitEllipsePoints(r, 0, 0)),
            new THREE.LineBasicMaterial({ color: 0x4a5a74, transparent: true, opacity: 0.26 })
          )
        );
        const anchor = new THREE.Group();
        sol.add(anchor);
        const mesh = this.makePlanetMesh(
          {
            id: `sol-${p.name}`,
            name: p.name,
            cls: p.cls,
            radiusEarth: p.rE,
            periodDays: p.period,
            method: "Trânsito",
            year: 0,
            note: "",
          },
          solPos,
          anchor
        );
        this.labels.push({
          el: this.makeLabel(p.name, CLASS_META[p.cls].color),
          obj: mesh,
        });
        this.anims.push({
          anchor,
          mesh,
          phase: i * 0.9,
          varpi: 0,
          ecc: 0,
          r,
          displayPeriod: 8 * Math.sqrt(p.period),
          spinBase: 0.45,
        });
      });
    }

    /* câmera */
    const maxR = Math.max(...this.anims.map((a) => a.r), 24);
    this.controls.target.set(this.showCompare && !pulsar ? 50 : 0, 0, 0);
    this.camera.position.set(
      this.showCompare && !pulsar ? 50 : 0,
      maxR * 0.95 + 18,
      maxR * 1.35 + 26
    );
  }

  setShowCompare(v: boolean) {
    if (v === this.showCompare) return;
    this.showCompare = v;
    this.build(this.sel?.systemId ?? EXO_SYSTEMS[1].id);
  }
  setPaused(p: boolean) {
    this.paused = p;
  }
  setSpeed(m: number) {
    this.speedMult = THREE.MathUtils.clamp(m, 0.1, 12);
  }
  setSpin(m: number) {
    this.spinMult = THREE.MathUtils.clamp(m, 0, 4);
  }

  /** reenquadra o sistema inteiro */
  resetCamera() {
    const sysId = this.sel?.systemId ?? EXO_SYSTEMS[1].id;
    const sys = EXO_SYSTEMS.find((s) => s.id === sysId) ?? EXO_SYSTEMS[1];
    const pulsar = sys.kind === "pulsar";
    const maxR = Math.max(...this.anims.map((a) => a.r), 24);
    const cx = this.showCompare && !pulsar ? 50 : 0;
    this.controls.target.set(cx, 0, 0);
    this.camera.position.set(cx, maxR * 0.95 + 18, maxR * 1.35 + 26);
  }

  /** aproxima (<1) ou afasta (>1) a câmera do alvo */
  zoomBy(f: number) {
    const dir = this.camera.position.clone().sub(this.controls.target);
    const len = THREE.MathUtils.clamp(dir.length() * Math.max(f, 0.05), 6, 1200);
    this.camera.position.copy(this.controls.target).addScaledVector(dir.normalize(), len);
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

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    if (!this.paused) this.elapsed += dt * this.speedMult;

    for (const a of this.anims) {
      const M = a.phase + (this.elapsed / Math.max(a.displayPeriod, 0.5)) * Math.PI * 2;
      const E = solveKepler(M % (Math.PI * 2), a.ecc);
      const b = a.r * Math.sqrt(Math.max(0, 1 - a.ecc * a.ecc));
      const x = a.r * (Math.cos(E) - a.ecc);
      const z = b * Math.sin(E);
      const cv = Math.cos(a.varpi);
      const sv = Math.sin(a.varpi);
      a.anchor.position.set(x * cv - z * sv, 0, x * sv + z * cv);
      a.mesh.rotation.y += dt * a.spinBase * this.spinMult * (this.paused ? 0 : this.speedMult);
    }

    for (const m of this.starMats) m.uniforms.uTime.value += dt;
    for (const m of this.planetMats) if (m.uniforms.uTime) m.uniforms.uTime.value += dt * 0.35;
    this.ptMat.uniforms.uTime.value += dt;

    this.controls.update();

    const w = this.mount.clientWidth;
    const h = this.mount.clientHeight;
    for (const l of this.labels) {
      l.obj.getWorldPosition(this.V);
      this.V.y += 1.7;
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

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.renderer.domElement.removeEventListener("pointerdown", this.onDown);
    this.renderer.domElement.removeEventListener("pointerup", this.onUp);
    this.ro.disconnect();
    this.controls.dispose();
    this.scene.traverse((o) => {
      const mm = o as THREE.Mesh;
      /* preserva as geometrias compartilhadas de módulo */
      if (mm.geometry && mm.geometry !== SPHERE && mm.geometry !== SPHERE_LO) mm.geometry.dispose();
      const mat = mm.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.forEach((l) => l.el.remove());
  }
}
