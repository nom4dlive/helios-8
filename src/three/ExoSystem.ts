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
import { surfaceUniforms } from "./SolarSystem";
import { SURFACE_VERT, PLANET_FRAG } from "./shaders";
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

/** shader de estrela genérico, tintado pela temperatura espectral */
const STAR_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float mu = clamp(dot(N, V), 0.0, 1.0);
  vec3 col = uColor * (1.15 + 0.5 * mu);
  col *= 0.55 + 0.7 * pow(mu, 0.7);
  gl_FragColor = vec4(col * 1.8, 1.0);
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

  private raf = 0;
  private clock = new THREE.Clock();
  private simDays = 0;
  private ro!: ResizeObserver;
  private disposed = false;

  constructor(mount: HTMLElement, labelLayer: HTMLElement, opts: ExoSystemOptions) {
    this.mount = mount;
    this.labelLayer = labelLayer;
    this.opts = opts;
    this.initGL();
    this.bind();
    this.build(EXO_SYSTEMS[0].id);
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
    this.scene.background = new THREE.Color("#04060c");
    this.camera = new THREE.PerspectiveCamera(48, w / h, 0.1, 4000);
    this.camera.position.set(0, 55, 120);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 420;

    /* fundo simples: pontos de estrelas */
    const N = 900;
    const p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 900 + Math.random() * 300;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      p[i * 3] = r * Math.sin(ph) * Math.cos(th);
      p[i * 3 + 1] = r * Math.cos(ph);
      p[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    const m = new THREE.PointsMaterial({
      color: 0x9fb0cc,
      size: 1.4,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    this.scene.add(new THREE.Points(g, m));
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
      fragmentShader: STAR_FRAG,
      uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 } },
    });
    const mesh = new THREE.Mesh(SPHERE, mat);
    mesh.scale.setScalar(Math.max(0.2, radius));
    parent.add(mesh);

    /* halo aditivo */
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
    return mesh;
  }

  private makePlanetMesh(planet: ExoPlanet, starPos: THREE.Vector3): THREE.Mesh {
    const surface: SurfaceParams =
      planet.radiusEarth > 1.9 ? NEPTUNIAN : planet.fluxEarth != null && planet.fluxEarth < 0.5 ? DRY : ROCKY;
    const u = surfaceUniforms({ surface });
    u.uSunPos.value = starPos;
    const mat = new THREE.ShaderMaterial({
      vertexShader: SURFACE_VERT,
      fragmentShader: PLANET_FRAG,
      uniforms: u,
    });
    const mesh = new THREE.Mesh(planet.radiusEarth > 1.8 ? SPHERE : SPHERE_LO, mat);
    mesh.scale.setScalar(planetR(planet.radiusEarth));
    return mesh;
  }

  build(systemId: string) {
    /* limpa cena anterior */
    const keep = new Set<THREE.Object3D>();
    this.scene.traverse((o) => {
      if ((o as THREE.Points).isPoints) keep.add(o);
    });
    for (const o of [...this.scene.children]) {
      if (!keep.has(o)) {
        o.traverse((c) => {
          const mm = c as THREE.Mesh;
          if (mm.geometry && mm.geometry !== SPHERE && mm.geometry !== SPHERE_LO) mm.geometry.dispose();
          const mat = mm.material as THREE.Material | THREE.Material[] | undefined;
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else if (mat) mat.dispose();
        });
        this.scene.remove(o);
      }
    }
    this.planetAnims = [];
    this.pickables = [];
    this.labels.forEach((l) => l.el.remove());
    this.labels = [];

    const sys = EXO_SYSTEMS.find((s) => s.id === systemId) ?? EXO_SYSTEMS[0];

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
      const mesh = this.makePlanetMesh(planet, starPos);
      mesh.userData.sel = { systemId: sys.id, planetId: planet.id } as ExoSelection;
      anchor.add(mesh);
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
    });
    this.ro.observe(this.mount);
  }

  /* -------------------------------------------------- loop */

  private V = new THREE.Vector3();

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    /* ~365 dias a cada 12 s: anos curtos giram rápido, anos longos perceptíveis */
    this.simDays += dt * (365.25 / 12);

    for (const a of this.planetAnims) {
      const th = a.phase + (this.simDays / Math.max(a.period, 0.05)) * Math.PI * 2;
      a.anchor.position.set(Math.cos(th) * a.r, 0, Math.sin(th) * a.r);
      a.mesh.rotation.y += dt * 0.4;
    }

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

    this.renderer.render(this.scene, this.camera);
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
      if (mm.geometry) mm.geometry.dispose();
      const mat = mm.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.forEach((l) => l.el.remove());
  }
}
