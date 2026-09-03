import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import {
  SOLAR_PLANETS,
  SOLAR_MOONS,
  SOLAR_STAR,
  type SolarPlanet,
  type SolarMoon,
  type SurfaceParams,
} from "../data/solarSystem";
import { solveKepler } from "../data/catalog";
import {
  SURFACE_VERT,
  PLANET_FRAG,
  EARTH_FRAG,
  CLOUD_SHELL_FRAG,
  RING_VERT,
  RING_FRAG,
  STAR_FRAG,
  HALO_FRAG,
  NEBULA_FRAG,
  STAR_PT_VERT,
  STAR_PT_FRAG,
} from "./shaders";

export interface SolarSelection {
  kind: "star" | "planet" | "moon";
  id: string;
  planetId?: string;
}

export interface SolarSceneOptions {
  onSelect: (sel: SolarSelection) => void;
}

const BASE_DAYS_PER_SEC = 12;
const ROT_DAYS: Record<string, number> = {
  sun: 25.4, mercury: 58.65, venus: -243, earth: 0.997, mars: 1.026,
  jupiter: 0.414, saturn: 0.444, uranus: -0.718, neptune: 0.671,
};
const ROT_VISUAL = 0.03;

const auScale = (au: number) => 10 + 27 * Math.sqrt(Math.max(au, 0.01));
const planetVisR = (rKm: number) =>
  THREE.MathUtils.clamp(Math.pow(Math.max(rKm, 10) / 6371, 0.42) * 1.15, 0.6, 3.2);
const moonVisR = (rKm: number) =>
  THREE.MathUtils.clamp(0.14 + 0.5 * Math.sqrt(Math.max(rKm, 4) / 2634), 0.12, 0.55);

const SPHERE = new THREE.SphereGeometry(1, 64, 44);
const SPHERE_LO = new THREE.SphereGeometry(1, 40, 28);

function surfaceUniforms(s: SurfaceParams, sunPos: THREE.Vector3) {
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
    uGlow: { value: THREE.MathUtils.clamp(s.glow, 0, 1.5) },
    uSpec: { value: THREE.MathUtils.clamp(s.spec, 0, 1.5) },
    uSunPos: { value: sunPos },
  };
  if (s.spot) {
    const lat = THREE.MathUtils.degToRad(s.spot.latDeg);
    const lon = THREE.MathUtils.degToRad(s.spot.lonDeg);
    u.uSpotPos.value.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
  }
  return u;
}

interface Anim {
  anchor: THREE.Object3D;
  mesh: THREE.Mesh;
  phase: number;
  varpi: number;
  ecc: number;
  r: number;
  periodDays: number;
  rotDays: number;
  retro: boolean;
}

interface MoonAnim {
  anchor: THREE.Object3D;
  mesh: THREE.Mesh;
  phase: number;
  r: number;
  periodDays: number;
  parentMesh: THREE.Object3D;
}

export class SolarScene {
  private mount: HTMLElement;
  private labelLayer: HTMLElement;
  private opts: SolarSceneOptions;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private composer!: EffectComposer;

  private anims: Anim[] = [];
  private moonAnims: MoonAnim[] = [];
  private pickables: THREE.Object3D[] = [];
  private planetMats: THREE.ShaderMaterial[] = [];
  private starMats: THREE.ShaderMaterial[] = [];
  private orbitMats = new Map<string, THREE.LineBasicMaterial>();
  private labels: { el: HTMLDivElement; obj: THREE.Object3D; id: string; kind: "planet" | "moon"; parentAnchor?: THREE.Object3D }[] = [];
  private ptMat!: THREE.ShaderMaterial;
  private beltInner!: THREE.Points;
  private beltOuter!: THREE.Points;
  private sunMesh!: THREE.Mesh;

  private sel: SolarSelection | null = null;
  private hovered: string | null = null;
  private paused = false;
  private speedMult = 1;
  private spinMult = 1;
  private simDays = 0;

  private cam = { mode: "free" as "free" | "approach" | "follow", target: null as THREE.Object3D | null, dist: 120 };
  private lastFollow = new THREE.Vector3();

  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private downPos = { x: 0, y: 0 };
  private V = new THREE.Vector3();
  private V2 = new THREE.Vector3();

  private raf = 0;
  private clock = new THREE.Clock();
  private ro!: ResizeObserver;
  private disposed = false;

  constructor(mount: HTMLElement, labelLayer: HTMLElement, opts: SolarSceneOptions) {
    this.mount = mount;
    this.labelLayer = labelLayer;
    this.opts = opts;
    this.initGL();
    this.bind();
    this.build();
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
    this.camera.position.set(0, 62, 132);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 2.2;
    this.controls.maxDistance = 700;

    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(
      new UnrealBloomPass(new THREE.Vector2(Math.ceil(w / 2), Math.ceil(h / 2)), 0.72, 0.55, 0.92)
    );
    this.composer.addPass(new OutputPass());

    /* fundo */
    const nebula = new THREE.Mesh(
      new THREE.SphereGeometry(2400, 32, 24),
      new THREE.ShaderMaterial({ vertexShader: SURFACE_VERT, fragmentShader: NEBULA_FRAG, side: THREE.BackSide, depthWrite: false })
    );
    nebula.renderOrder = -10;
    this.scene.add(nebula);

    const N = 1800;
    const pos = new Float32Array(N * 3);
    const size = new Float32Array(N);
    const phase = new Float32Array(N);
    const col = new Float32Array(N * 3);
    const pal = ["#ffffff", "#ffffff", "#cfe0ff", "#ffe9c4", "#ffc9a0", "#bcd2ff"].map((c) => new THREE.Color(c));
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
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const stars = new THREE.Points(g, this.ptMat);
    stars.renderOrder = -5;
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

  private orbitLine(r: number, e: number, varpi: number, color: string, opacity: number): THREE.LineLoop {
    const ec = THREE.MathUtils.clamp(e, 0, 0.9);
    const b = r * Math.sqrt(Math.max(0, 1 - ec * ec));
    const cv = Math.cos(varpi);
    const sv = Math.sin(varpi);
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k < 180; k++) {
      const E = (k / 180) * Math.PI * 2;
      const x = r * (Math.cos(E) - ec);
      const z = b * Math.sin(E);
      pts.push(new THREE.Vector3(x * cv - z * sv, 0, x * sv + z * cv));
    }
    return new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity })
    );
  }

  private build() {
    const sunPos = new THREE.Vector3(0, 0, 0);

    /* ---------- Sol ---------- */
    const sunMat = new THREE.ShaderMaterial({
      vertexShader: SURFACE_VERT,
      fragmentShader: STAR_FRAG,
      uniforms: { uColor: { value: new THREE.Color(SOLAR_STAR.spectral.color) }, uTime: { value: 0 }, uPulse: { value: 0 } },
    });
    this.sunMesh = new THREE.Mesh(SPHERE, sunMat);
    this.sunMesh.scale.setScalar(5);
    this.sunMesh.userData.sel = { kind: "star", id: "sun" } as SolarSelection;
    this.scene.add(this.sunMesh);
    this.pickables.push(this.sunMesh);
    this.starMats.push(sunMat);

    const haloMat = new THREE.ShaderMaterial({
      vertexShader: SURFACE_VERT,
      fragmentShader: HALO_FRAG,
      uniforms: { uColor: { value: new THREE.Color("#ffcc66") }, uIntensity: { value: 1.5 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const halo = new THREE.Mesh(SPHERE, haloMat);
    halo.scale.setScalar(7.6);
    this.scene.add(halo);
    const halo2 = new THREE.Mesh(SPHERE, new THREE.ShaderMaterial({
      vertexShader: SURFACE_VERT,
      fragmentShader: HALO_FRAG,
      uniforms: { uColor: { value: new THREE.Color("#ff9944") }, uIntensity: { value: 0.55 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    halo2.scale.setScalar(11.5);
    this.scene.add(halo2);
    this.labels.push({ el: this.makeLabel("Sol", SOLAR_STAR.spectral.color), obj: this.sunMesh, id: "sun", kind: "planet" });

    /* ---------- planetas + luas ---------- */
    SOLAR_PLANETS.forEach((planet, idx) => {
      const r = auScale(planet.auDist);
      const varpi = THREE.MathUtils.degToRad(planet.varpiDeg);
      const e = THREE.MathUtils.clamp(planet.ecc, 0, 0.5);

      const incl = new THREE.Group();
      incl.rotation.x = THREE.MathUtils.degToRad(planet.inclDeg);
      this.scene.add(incl);

      const line = this.orbitLine(r, e, varpi, planet.accent, 0.22);
      incl.add(line);
      this.orbitMats.set(planet.id, line.material as THREE.LineBasicMaterial);

      const anchor = new THREE.Group();
      incl.add(anchor);

      const tilt = new THREE.Group();
      tilt.rotation.z = THREE.MathUtils.degToRad(planet.tiltDeg);
      anchor.add(tilt);

      const visR = planetVisR(planet.radiusKm);
      const uniforms = surfaceUniforms(planet.surface, sunPos);
      const mat = new THREE.ShaderMaterial({
        vertexShader: SURFACE_VERT,
        fragmentShader: planet.surface.earthLike ? EARTH_FRAG : PLANET_FRAG,
        uniforms,
      });
      this.planetMats.push(mat);
      const mesh = new THREE.Mesh(visR > 1.8 ? SPHERE : SPHERE_LO, mat);
      mesh.scale.setScalar(visR);
      mesh.userData.sel = { kind: "planet", id: planet.id } as SolarSelection;
      tilt.add(mesh);
      this.pickables.push(mesh);

      /* halo atmosférico */
      if (planet.surface.atmosAmp > 0.2) {
        const hm = new THREE.ShaderMaterial({
          vertexShader: SURFACE_VERT,
          fragmentShader: HALO_FRAG,
          uniforms: { uColor: { value: new THREE.Color(planet.surface.atmosColor) }, uIntensity: { value: planet.surface.atmosAmp * 0.8 } },
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        });
        const h = new THREE.Mesh(SPHERE_LO, hm);
        h.scale.setScalar(visR * 1.14);
        tilt.add(h);
      }

      /* camada de nuvens */
      if (planet.surface.clouds) {
        const cm = new THREE.ShaderMaterial({
          vertexShader: SURFACE_VERT,
          fragmentShader: CLOUD_SHELL_FRAG,
          uniforms: {
            uTime: uniforms.uTime,
            uAmp: { value: planet.surface.clouds.amp },
            uSpeed: { value: 1 },
            uTint: { value: new THREE.Color(planet.surface.clouds.tint) },
            uSunPos: uniforms.uSunPos,
          },
          transparent: true, depthWrite: false,
        });
        const clouds = new THREE.Mesh(planet.surface.earthLike ? SPHERE : SPHERE_LO, cm);
        clouds.scale.setScalar(visR * 1.02);
        clouds.renderOrder = 1;
        tilt.add(clouds);
        this.planetMats.push(cm);
      }

      /* anéis */
      if (planet.surface.ring) {
        const rg = planet.surface.ring;
        const inner = Math.max(0.1, visR * rg.inner);
        const outer = Math.max(inner + 0.1, visR * rg.outer);
        const geo = new THREE.RingGeometry(inner, outer, 200, 1);
        geo.rotateX(-Math.PI / 2);
        const rm = new THREE.ShaderMaterial({
          vertexShader: RING_VERT,
          fragmentShader: RING_FRAG,
          uniforms: {
            uInner: { value: inner },
            uOuter: { value: outer },
            uTint: { value: new THREE.Color(rg.tint) },
            uOpacity: { value: THREE.MathUtils.clamp(rg.opacity, 0, 1) },
            uSunPos: uniforms.uSunPos,
          },
          transparent: true, side: THREE.DoubleSide, depthWrite: false,
        });
        const ring = new THREE.Mesh(geo, rm);
        ring.renderOrder = 2;
        tilt.add(ring);
      }

      const phase = idx * 0.87 + 0.35;
      this.setKepler(anchor, r, e, varpi, phase, planet.periodDays, 0);

      this.anims.push({
        anchor, mesh, phase, varpi, ecc: e, r,
        periodDays: planet.periodDays,
        rotDays: ROT_DAYS[planet.id] ?? 1,
        retro: (ROT_DAYS[planet.id] ?? 1) < 0,
      });

      this.labels.push({ el: this.makeLabel(planet.name, planet.accent), obj: mesh, id: planet.id, kind: "planet" });

      /* luas */
      const moons = SOLAR_MOONS.filter((m) => m.planetId === planet.id);
      moons.forEach((moon, mi) => {
        const mr = visR + 0.95 + mi * 0.82;
        const mLine = this.orbitLine(mr, 0, 0, moon.accent, 0.12);
        anchor.add(mLine);
        this.orbitMats.set(moon.id, mLine.material as THREE.LineBasicMaterial);

        const mAnchor = new THREE.Group();
        anchor.add(mAnchor);

        const mVis = moonVisR(moon.radiusKm);
        const mUniforms = surfaceUniforms(moon.surface, sunPos);
        const mMat = new THREE.ShaderMaterial({
          vertexShader: SURFACE_VERT,
          fragmentShader: PLANET_FRAG,
          uniforms: mUniforms,
        });
        this.planetMats.push(mMat);
        const mMesh = new THREE.Mesh(SPHERE_LO, mMat);
        mMesh.scale.setScalar(mVis);
        mAnchor.add(mMesh);

        /* área de clique generosa p/ luas pequenas */
        const hit = new THREE.Mesh(
          new THREE.SphereGeometry(Math.max(0.4, mVis * 2.4), 10, 8),
          new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true })
        );
        hit.userData.sel = { kind: "moon", id: moon.id, planetId: planet.id } as SolarSelection;
        mAnchor.add(hit);
        this.pickables.push(hit);

        const mPhase = mi * 2.1 + idx * 0.8;
        const period = moon.periodDays; /* negativo → retrógrada (Tritão) */
        mAnchor.position.set(Math.cos(mPhase) * mr, 0, Math.sin(mPhase) * mr);

        this.moonAnims.push({ anchor: mAnchor, mesh: mMesh, phase: mPhase, r: mr, periodDays: period, parentMesh: mesh });

        this.labels.push({
          el: this.makeLabel(moon.name, moon.accent),
          obj: mMesh, id: moon.id, kind: "moon", parentAnchor: anchor,
        });
      });
    });

    /* ---------- cinturão de asteroides ---------- */
    this.beltInner = this.makeBelt(900, 46, 52);
    this.beltOuter = this.makeBelt(700, 52, 57);
    this.scene.add(this.beltInner, this.beltOuter);
  }

  private makeBelt(count: number, rMin: number, rMax: number): THREE.Points {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = rMin + Math.random() * (rMax - rMin);
      const a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 1.4;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(
      g,
      new THREE.PointsMaterial({
        color: 0x9a8a74, size: 0.14, sizeAttenuation: true,
        transparent: true, opacity: 0.7, depthWrite: false,
      })
    );
  }

  private setKepler(anchor: THREE.Object3D, r: number, e: number, varpi: number, phase: number, periodDays: number, simDays: number) {
    const M = phase + (simDays / Math.max(periodDays, 0.5)) * Math.PI * 2;
    const E = solveKepler(M % (Math.PI * 2), e);
    const b = r * Math.sqrt(Math.max(0, 1 - e * e));
    const x = r * (Math.cos(E) - e);
    const z = b * Math.sin(E);
    const cv = Math.cos(varpi);
    const sv = Math.sin(varpi);
    anchor.position.set(x * cv - z * sv, 0, x * sv + z * cv);
  }

  /* -------------------------------------------------- API */

  select(sel: SolarSelection | null) {
    this.sel = sel;
    for (const [id, mat] of this.orbitMats) {
      const active = sel && (sel.id === id || sel.planetId === id);
      mat.opacity = active ? 0.7 : id.length > 6 ? 0.12 : 0.22;
    }
    for (const l of this.labels) l.el.classList.toggle("is-selected", l.id === sel?.id);
    if (sel) this.focusSel(sel);
    else this.clearFocus();
  }

  private focusSel(sel: SolarSelection) {
    let target: THREE.Object3D | null = null;
    let dist = 120;
    if (sel.kind === "star") {
      target = this.sunMesh;
      dist = 26;
    } else if (sel.kind === "planet") {
      const a = this.anims.find((x) => (x.mesh.userData.sel as SolarSelection).id === sel.id);
      if (a) {
        target = a.mesh;
        dist = THREE.MathUtils.clamp(a.mesh.scale.x * 7.5, 3.5, 42);
      }
    } else {
      const m = this.moonAnims.find((x) => (x.anchor.children[0]?.userData?.sel as SolarSelection | undefined)?.id === sel.id);
      const ma = this.moonAnims.find((x) => {
        const hit = x.anchor.children.find((c) => c.userData.sel);
        return hit && (hit.userData.sel as SolarSelection).id === sel.id;
      });
      const found = m ?? ma;
      if (found) {
        target = found.mesh;
        dist = THREE.MathUtils.clamp(found.mesh.scale.x * 11, 1.2, 9);
      }
    }
    if (!target) return;
    this.cam = { mode: "approach", target, dist };
    target.getWorldPosition(this.lastFollow);
  }

  private clearFocus() {
    this.cam = { mode: "approach", target: null, dist: 120 };
    this.lastFollow.set(0, 0, 0);
  }

  resetCamera() {
    this.clearFocus();
  }

  setPaused(p: boolean) { this.paused = p; }
  setSpeed(m: number) { this.speedMult = THREE.MathUtils.clamp(m, 0.1, 12); }
  setSpin(m: number) { this.spinMult = THREE.MathUtils.clamp(m, 0, 4); }

  /** aproxima (<1) ou afasta (>1) a câmera do alvo atual */
  zoomBy(f: number) {
    const dir = this.camera.position.clone().sub(this.controls.target);
    const len = THREE.MathUtils.clamp(dir.length() * Math.max(f, 0.05), 2.5, 700);
    this.camera.position.copy(this.controls.target).addScaledVector(dir.normalize(), len);
  }

  /* -------------------------------------------------- eventos */

  private onDown = (e: PointerEvent) => { this.downPos = { x: e.clientX, y: e.clientY }; };
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
      this.opts.onSelect(hits[0].object.userData.sel as SolarSelection);
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
    if (!this.paused) this.simDays += dt * BASE_DAYS_PER_SEC * this.speedMult;

    for (const a of this.anims) {
      this.setKepler(a.anchor, a.r, a.ecc, a.varpi, a.phase, a.periodDays, this.simDays);
      const dir = a.retro ? -1 : 1;
      a.mesh.rotation.y = dir * this.simDays * ROT_VISUAL * (Math.PI * 2 / Math.max(Math.abs(a.rotDays), 0.2));
    }
    for (const m of this.moonAnims) {
      const th = m.phase + (this.simDays / Math.max(Math.abs(m.periodDays), 0.2)) * Math.PI * 2 * Math.sign(m.periodDays);
      m.anchor.position.set(Math.cos(th) * m.r, 0, Math.sin(th) * m.r);
      m.mesh.rotation.y = th; /* rotação síncrona */
    }

    /* cinturão: rotação diferencial (3ª lei de Kepler) */
    this.beltInner.rotation.y = -(this.simDays / 1600) * Math.PI * 2;
    this.beltOuter.rotation.y = -(this.simDays / 2600) * Math.PI * 2;

    for (const m of this.starMats) m.uniforms.uTime.value += dt;
    for (const m of this.planetMats) if (m.uniforms.uTime) m.uniforms.uTime.value += dt * 0.35 * (this.paused ? 0 : this.speedMult * 0.4 + 0.6);
    this.ptMat.uniforms.uTime.value += dt;
    this.sunMesh.rotation.y = this.simDays * ROT_VISUAL * (Math.PI * 2 / ROT_DAYS.sun) * 0.4;

    /* câmera */
    this.updateCamera();
    this.controls.update();

    /* rótulos */
    const w = this.mount.clientWidth;
    const h = this.mount.clientHeight;
    for (const l of this.labels) {
      let visible = true;
      if (l.kind === "moon") {
        const isSel = this.sel?.id === l.id || this.sel?.planetId === l.id;
        let near = false;
        if (l.parentAnchor) {
          l.parentAnchor.getWorldPosition(this.V2);
          near = this.camera.position.distanceTo(this.V2) < 22;
        }
        visible = isSel || near || this.hovered === l.id;
      }
      if (!visible) { l.el.classList.add("is-hidden"); continue; }
      l.obj.getWorldPosition(this.V);
      this.V.y += l.kind === "moon" ? 0.7 : 1.9;
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

  private updateCamera() {
    const { mode, target, dist } = this.cam;
    if (mode === "free") return;
    const pos = target ? target.getWorldPosition(this.V) : this.V.set(0, 0, 0);
    if (mode === "approach") {
      this.V2.copy(this.camera.position).sub(pos);
      if (this.V2.lengthSq() < 1e-6) this.V2.set(0.5, 0.45, 1);
      this.V2.normalize();
      const dest = this.V2.multiplyScalar(dist).add(pos);
      this.camera.position.lerp(dest, 0.075);
      this.controls.target.lerp(pos, 0.1);
      if (this.camera.position.distanceTo(dest) < Math.max(0.08, dist * 0.02)) {
        this.cam.mode = target ? "follow" : "free";
        this.lastFollow.copy(pos);
      }
    } else if (mode === "follow" && target) {
      target.getWorldPosition(this.V2);
      const delta = this.V2.clone().sub(this.lastFollow);
      this.camera.position.add(delta);
      this.controls.target.copy(this.V2);
      this.lastFollow.copy(this.V2);
    }
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
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.forEach((l) => l.el.remove());
  }
}
