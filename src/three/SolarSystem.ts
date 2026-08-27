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
  tiltRad: number;
}

const V0 = new THREE.Vector3();
const V1 = new THREE.Vector3();
const V2 = new THREE.Vector3();

function surfaceUniforms(src: { surface: BodyDef["surface"] }) {
  const s = src.surface;
  const palette = s.palette.map((c) => new THREE.Color(c));
  while (palette.length < 6) palette.push(new THREE.Color("#000000"));
  const u: Record<string, THREE.IUniform> = {
    uPalette: { value: palette },
    uTime: { value: 0 },
    uBandFreq: { value: s.bandFreq },
    uBandTurb: { value: s.bandTurb },
    uBandAmp: { value: s.bandAmp },
    uNoiseScale: { value: s.noiseScale },
    uNoiseAmp: { value: s.noiseAmp },
    uRidgeScale: { value: s.ridgeScale },
    uRidgeAmp: { value: s.ridgeAmp },
    uCraterScale: { value: s.craterScale },
    uCraterAmp: { value: s.craterAmp },
    uPolarCap: { value: s.polarCap },
    uSpotPos: { value: new THREE.Vector3(0, 1, 0) },
    uSpotSize: { value: s.spot ? s.spot.size : 0.4 },
    uSpotOn: { value: s.spot ? 1 : 0 },
    uSpotColor: { value: new THREE.Color(s.spot ? s.spot.color : "#000000") },
    uAtmosColor: { value: new THREE.Color(s.atmosColor) },
    uAtmosAmp: { value: s.atmosAmp },
    uSunPos: { value: new THREE.Vector3(0, 0, 0) },
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
  private belt!: THREE.Points;

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
  private selectedId: string | null = null;

  private cam = { mode: "free" as "free" | "approach" | "follow", id: null as string | null, dist: 95 };
  private lastFollow = new THREE.Vector3();

  private raf = 0;
  private clock = new THREE.Clock();
  private wallTime = 0;
  private hudTimer = 0;
  private frames = 0;
  private fps = 60;
  private ro!: ResizeObserver;
  private disposed = false;

  constructor(container: HTMLElement, labelLayer: HTMLElement, opts: SolarSystemOptions) {
    this.container = container;
    this.labelLayer = labelLayer;
    this.opts = opts;
    this.initGL();
    this.buildScene();
    this.bindEvents();
    this.clock.start();
    this.loop();
  }

  /* ---------------------------------------------------------- setup */

  private initGL() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.72, 0.55, 1.0);
    this.composer.addPass(this.bloom);
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
    const pts: THREE.Vector3[] = [];
    const N = 180;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    return new THREE.LineLoop(geo, mat);
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

    const STAR_COUNT = 2400;
    const pos = new Float32Array(STAR_COUNT * 3);
    const size = new Float32Array(STAR_COUNT);
    const phase = new Float32Array(STAR_COUNT);
    const col = new Float32Array(STAR_COUNT * 3);
    const starPalette = [
      new THREE.Color("#ffffff"),
      new THREE.Color("#ffffff"),
      new THREE.Color("#cfe0ff"),
      new THREE.Color("#ffe9c4"),
      new THREE.Color("#ffc9a0"),
      new THREE.Color("#bcd2ff"),
    ];
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
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const stars = new THREE.Points(starGeo, this.starMat);
    stars.renderOrder = -5;
    this.scene.add(stars);

    /* -------- Sol -------- */
    const sunUni = {
      uTime: { value: 0 },
    };
    const sunMat = new THREE.ShaderMaterial({
      vertexShader: SURFACE_VERT,
      fragmentShader: SUN_FRAG,
      uniforms: { ...sunUni },
    });
    const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(SUN.sizeR, 72, 48), sunMat);
    this.scene.add(sunMesh);
    this.sunMats.push(sunMat);
    this.pickables.push(sunMesh);

    const coronaMat = new THREE.ShaderMaterial({
      vertexShader: SURFACE_VERT,
      fragmentShader: CORONA_FRAG,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const corona = new THREE.Mesh(new THREE.SphereGeometry(SUN.sizeR * 1.32, 64, 40), coronaMat);
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
      tiltRad: 0,
    });

    /* -------- planetas -------- */
    PLANETS.forEach((def, idx) => this.buildPlanet(def, idx));

    /* -------- cinturão de asteroides -------- */
    const BELT_N = 1700;
    const bpos = new Float32Array(BELT_N * 3);
    for (let i = 0; i < BELT_N; i++) {
      const r = 27.4 + Math.random() * 3.4 + (Math.random() - 0.5) * 0.8;
      const a = Math.random() * Math.PI * 2;
      bpos[i * 3] = Math.cos(a) * r;
      bpos[i * 3 + 1] = (Math.random() - 0.5) * 1.1;
      bpos[i * 3 + 2] = Math.sin(a) * r;
    }
    const beltGeo = new THREE.BufferGeometry();
    beltGeo.setAttribute("position", new THREE.BufferAttribute(bpos, 3));
    this.belt = new THREE.Points(
      beltGeo,
      new THREE.PointsMaterial({
        color: 0x8a7f70,
        size: 0.085,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      })
    );
    this.scene.add(this.belt);
  }

  private buildPlanet(def: BodyDef, idx: number) {
    const orbitPlane = new THREE.Group();
    orbitPlane.rotation.x = THREE.MathUtils.degToRad(def.orbitInclDeg);
    this.scene.add(orbitPlane);

    const line = this.orbitLine(def.orbitR, def.accent, 0.2);
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
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(def.sizeR, 56, 40), mat);
    tiltGroup.add(mesh);
    this.pickables.push(mesh);

    /* nuvens (Terra) */
    if (def.surface.clouds) {
      const cloudMat = new THREE.ShaderMaterial({
        vertexShader: SURFACE_VERT,
        fragmentShader: CLOUD_FRAG,
        uniforms: {
          uTime: uniforms.uTime,
          uCloudAmp: { value: 0.85 },
          uSunPos: uniforms.uSunPos,
        },
        transparent: true,
        depthWrite: false,
      });
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(def.sizeR * 1.018, 56, 40),
        cloudMat
      );
      clouds.renderOrder = 1;
      tiltGroup.add(clouds);
      this.surfaceMats.push(cloudMat);
    }

    /* halo atmosférico aditivo */
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
      const atmo = new THREE.Mesh(new THREE.SphereGeometry(def.sizeR * 1.13, 48, 32), atmoMat);
      atmo.renderOrder = 2;
      anchor.add(atmo);
    }

    /* anéis */
    if (def.ring) {
      const ringGeo = new THREE.RingGeometry(def.ring.inner, def.ring.outer, 220, 1);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.ShaderMaterial({
        vertexShader: RING_VERT,
        fragmentShader: RING_FRAG,
        uniforms: {
          uInner: { value: def.ring.inner },
          uOuter: { value: def.ring.outer },
          uTint: { value: new THREE.Color(def.ring.tint) },
          uOpacity: { value: def.ring.opacity },
          uSunPos: uniforms.uSunPos,
        },
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.renderOrder = 4;
      tiltGroup.add(ring);
    }

    const theta0 = idx * 0.83 + 0.4;
    anchor.position.set(
      Math.cos(theta0) * def.orbitR,
      0,
      Math.sin(theta0) * def.orbitR
    );

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
      tiltRad: THREE.MathUtils.degToRad(def.tiltDeg),
    };
    this.bodies.set(def.id, rt);

    /* -------- luas -------- */
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
      const mMesh = new THREE.Mesh(new THREE.SphereGeometry(m.sizeR, 32, 24), mMat);
      mAnchor.add(mMesh);
      this.pickables.push(mMesh);

      /* área de clique ampliada para luas pequenas */
      const hitR = Math.max(0.26, m.sizeR * 2.6);
      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(hitR, 12, 10),
        new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true })
      );
      hit.userData.id = m.id;
      mAnchor.add(hit);
      this.pickables.push(hit);

      const mTheta0 = mi * 2.17 + idx * 0.7;
      mAnchor.position.set(
        Math.cos(mTheta0) * m.orbitR,
        0,
        Math.sin(mTheta0) * m.orbitR
      );

      const mDef: BodyDef = {
        ...m,
        kind: "planet",
        typeLabel: "Satélite natural",
        distSunMkm: def.distSunMkm,
        distSunAU: def.distSunAU,
        rotationLabel: "—",
        moonsKnown: 0,
        tempLabel: "—",
        orbitR: m.orbitR,
        orbitInclDeg: 0,
        tiltDeg: 0,
        sizeR: m.sizeR,
        moons: [],
        orbitSpeedKms: undefined,
      };

      this.bodies.set(m.id, {
        id: m.id,
        def: mDef,
        isMoon: true,
        parentId: def.id,
        anchor: mAnchor,
        mesh: mMesh,
        labelEl: this.makeLabel(m, true),
        theta0: mTheta0,
        orbitR: m.orbitR,
        periodDays: m.periodDays,
        spin: 0.02,
        tiltRad: 0,
      });
    });
  }

  /* ---------------------------------------------------------- eventos */

  private onPointerMove = (e: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
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
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
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
    this.starMat.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
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
    this.belt.visible = v;
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

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.wallTime += dt;

    if (!this.paused) {
      this.simDays += dt * BASE_DAYS_PER_SEC * this.speedMult;
    }

    /* corpos */
    for (const b of this.bodies.values()) {
      if (b.periodDays !== 0 && !b.isMoon) {
        const th = b.theta0 + (this.simDays / b.periodDays) * Math.PI * 2;
        b.anchor.position.set(Math.cos(th) * b.orbitR, 0, Math.sin(th) * b.orbitR);
      }
      if (b.isMoon && b.parentId) {
        const th = b.theta0 + (this.simDays / b.periodDays) * Math.PI * 2;
        b.anchor.position.set(Math.cos(th) * b.orbitR, 0, Math.sin(th) * b.orbitR);
      }
      b.mesh.rotation.y = this.simDays * b.spin * Math.PI * 2;
    }

    /* uniforms de tempo */
    for (const m of this.surfaceMats) {
      if (m.uniforms.uTime) m.uniforms.uTime.value = this.simDays * 0.4;
    }
    for (const m of this.sunMats) m.uniforms.uTime.value = this.wallTime;
    this.starMat.uniforms.uTime.value = this.wallTime;
    this.belt.rotation.y = (this.simDays / 1680) * Math.PI * 2;

    /* câmera */
    this.updateCamera();
    this.controls.update();

    /* hover */
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

    /* HUD ~4 Hz */
    this.frames++;
    this.hudTimer += dt;
    if (this.hudTimer >= 0.25) {
      this.fps = Math.round(this.frames / this.hudTimer);
      this.frames = 0;
      this.hudTimer = 0;
      this.opts.onHud(this.hudSnapshot());
    }

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
          b.parentId === this.selectedId || b.parentId === this.hoveredId;
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
      el.style.transform = `translate(-50%, -140%) translate3d(${x.toFixed(1)}px, ${y.toFixed(
        1
      )}px, 0)`;
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
      const m = (any as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
      else if (m) m.dispose();
    });
    this.composer.dispose();
    this.renderer.dispose();
    el.remove();
    this.labelLayer.innerHTML = "";
  }
}
