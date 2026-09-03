/**
 * COMPARE SCENE — Observatório de Comparação 3D.
 * Renderiza até 3 corpos (estrelas/planetas/luas) lado a lado em pedestais
 * holográficos giratórios, usando exatamente os mesmos shaders de alto
 * realismo das cenas principais (PLANET_FRAG / EARTH_FRAG / STAR_FRAG /
 * CLOUD_SHELL / anéis). Cada corpo gira na sua velocidade relativa real.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { bodySpecFor, type BodySpec, type SurfaceLike } from "../data/bodySpecs";
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

export interface CompareSceneOptions {
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

interface Pedestal {
  id: string;
  group: THREE.Group; /* grupo posicionado no slot */
  body: THREE.Object3D; /* o corpo que gira */
  visR: number;
  spin: number;
  mats: THREE.ShaderMaterial[];
  ringMats: THREE.ShaderMaterial[];
  gyro: THREE.Group;
  label: HTMLDivElement;
}

const SPHERE = new THREE.SphereGeometry(1, 56, 40);
const SPHERE_LO = new THREE.SphereGeometry(1, 32, 24);

function surfaceUniforms(s: SurfaceLike, sunPos: THREE.Vector3) {
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

export class CompareScene {
  private mount: HTMLElement;
  private labelLayer: HTMLElement;
  private opts: CompareSceneOptions;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private composer!: EffectComposer;
  private root = new THREE.Group();

  private pedestals: Pedestal[] = [];
  private pickables: THREE.Object3D[] = [];
  private ptMat!: THREE.ShaderMaterial;
  private elapsed = 0;

  private relativeScale = true;
  private hoveredId: string | null = null;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2(-10, -10);
  private downPos = { x: 0, y: 0 };
  private mouseMoved = false;
  private V = new THREE.Vector3();

  private sunDir = new THREE.Vector3(1, 0.55, 0.8).normalize();

  private raf = 0;
  private clock = new THREE.Clock();
  private ro!: ResizeObserver;
  private disposed = false;

  constructor(mount: HTMLElement, labelLayer: HTMLElement, opts: CompareSceneOptions) {
    this.mount = mount;
    this.labelLayer = labelLayer;
    this.opts = opts;
    this.initGL();
    this.bind();
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
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.domElement.style.cursor = "grab";
    this.mount.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(46, w / h, 0.1, 6000);
    this.camera.position.set(0, 5, 21);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = false;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 90;
    this.controls.target.set(0, 0, 0);

    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(
      new UnrealBloomPass(new THREE.Vector2(Math.ceil(w / 2), Math.ceil(h / 2)), 0.75, 0.5, 0.9)
    );
    this.composer.addPass(new OutputPass());

    /* luz que esculpe os planetas/luas (estrelas são emissivas) */
    const key = new THREE.DirectionalLight(0xfff2dd, 2.4);
    key.position.copy(this.sunDir).multiplyScalar(50);
    this.scene.add(key);
    const fill = new THREE.AmbientLight(0x2a3a5a, 0.5);
    this.scene.add(fill);

    /* fundo */
    const nebula = new THREE.Mesh(
      new THREE.SphereGeometry(2600, 32, 24),
      new THREE.ShaderMaterial({ vertexShader: SURFACE_VERT, fragmentShader: NEBULA_FRAG, side: THREE.BackSide, depthWrite: false })
    );
    nebula.renderOrder = -10;
    nebula.userData.keep = true;
    this.scene.add(nebula);

    const N = 1400;
    const pos = new Float32Array(N * 3);
    const size = new Float32Array(N);
    const phase = new Float32Array(N);
    const col = new Float32Array(N * 3);
    const pal = ["#ffffff", "#cfe0ff", "#ffe9c4", "#bcd2ff"].map((c) => new THREE.Color(c));
    for (let i = 0; i < N; i++) {
      const r = 1600 + Math.random() * 700;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph);
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      size[i] = 0.7 + Math.random() * 1.8;
      phase[i] = Math.random();
      const c = pal[Math.floor(Math.random() * pal.length)];
      const b = 0.5 + Math.random() * 0.5;
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
    stars.userData.keep = true;
    this.scene.add(stars);

    this.scene.add(this.root);
  }

  /* -------------------------------------------------- construção dos pedestais */

  private makeLabel(text: string, accent: string): HTMLDivElement {
    const el = document.createElement("div");
    el.className = "orbit-label cmp-label";
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

  /** raio visual de um corpo, dado o modo de escala */
  private visRadius(spec: BodySpec, maxRadiusKm: number): number {
    if (!this.relativeScale) return spec.kind === "star" ? 2.6 : 2.2;
    const norm = Math.max(spec.radiusKm, 1) / Math.max(maxRadiusKm, 1);
    /* compressão p/ manter luas visíveis ao lado de estrelas/gigantes */
    const base = Math.pow(Math.max(norm, 0.0001), spec.kind === "star" ? 0.38 : 0.5);
    return THREE.MathUtils.clamp(base * 3.1, spec.kind === "star" ? 1.5 : 0.34, 3.4);
  }

  setBodies(ids: (string | null)[]) {
    /* limpa pedestais antigos */
    for (const p of this.pedestals) {
      p.label.remove();
      p.group.traverse((c) => {
        const mm = c as THREE.Mesh;
        if (mm.geometry && mm.geometry !== SPHERE && mm.geometry !== SPHERE_LO) mm.geometry.dispose();
        const mat = mm.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) mat.dispose();
      });
      this.root.remove(p.group);
    }
    this.pedestals = [];
    this.pickables = [];

    const specs = ids
      .map((id) => (id ? bodySpecFor(id) : null))
      .filter((s): s is BodySpec => s !== null);
    if (specs.length === 0) return;

    const maxRadiusKm = Math.max(...specs.map((s) => s.radiusKm));
    const n = specs.length;
    const spacing = n === 1 ? 0 : n === 2 ? 8.5 : 7.6;

    specs.forEach((spec, i) => {
      const x = (i - (n - 1) / 2) * spacing;
      const visR = this.visRadius(spec, maxRadiusKm);
      const group = new THREE.Group();
      group.position.set(x, 0, 0);
      this.root.add(group);

      const body = new THREE.Group();
      group.add(body);

      const mats: THREE.ShaderMaterial[] = [];
      const ringMats: THREE.ShaderMaterial[] = [];

      if (spec.kind === "star" && spec.star) {
        const mat = new THREE.ShaderMaterial({
          vertexShader: SURFACE_VERT,
          fragmentShader: STAR_FRAG,
          uniforms: {
            uColor: { value: new THREE.Color(spec.star.color) },
            uTime: { value: 0 },
            uPulse: { value: spec.star.pulsar ? 1 : 0 },
          },
        });
        const mesh = new THREE.Mesh(SPHERE, mat);
        mesh.scale.setScalar(visR);
        mesh.userData.id = spec.id;
        body.add(mesh);
        this.pickables.push(mesh);
        mats.push(mat);

        const haloMat = new THREE.ShaderMaterial({
          vertexShader: SURFACE_VERT,
          fragmentShader: HALO_FRAG,
          uniforms: {
            uColor: { value: new THREE.Color(spec.star.color) },
            uIntensity: { value: spec.star.pulsar ? 2.4 : 1.3 },
          },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const halo = new THREE.Mesh(SPHERE, haloMat);
        halo.scale.setScalar(visR * (spec.star.pulsar ? 2.6 : 1.5));
        body.add(halo);
        mats.push(haloMat);
      } else if (spec.surface) {
        const uniforms = surfaceUniforms(spec.surface, new THREE.Vector3().copy(this.sunDir).multiplyScalar(100));
        const mat = new THREE.ShaderMaterial({
          vertexShader: SURFACE_VERT,
          fragmentShader: spec.surface.earthLike ? EARTH_FRAG : PLANET_FRAG,
          uniforms,
        });
        const mesh = new THREE.Mesh(SPHERE, mat);
        mesh.scale.setScalar(visR);
        mesh.userData.id = spec.id;
        body.add(mesh);
        this.pickables.push(mesh);
        mats.push(mat);

        /* casca de nuvens */
        if (spec.clouds) {
          const cMat = new THREE.ShaderMaterial({
            vertexShader: SURFACE_VERT,
            fragmentShader: CLOUD_SHELL_FRAG,
            uniforms: {
              uTime: uniforms.uTime,
              uAmp: { value: THREE.MathUtils.clamp(spec.clouds.amp, 0, 1) },
              uSpeed: { value: 1 },
              uTint: { value: new THREE.Color(spec.clouds.tint) },
              uSunPos: uniforms.uSunPos,
            },
            transparent: true,
            depthWrite: false,
          });
          const clouds = new THREE.Mesh(SPHERE, cMat);
          clouds.scale.setScalar(visR * 1.02);
          clouds.renderOrder = 2;
          body.add(clouds);
          mats.push(cMat);
        }

        /* halo atmosférico */
        if (spec.surface.atmosAmp > 0.15) {
          const hMat = new THREE.ShaderMaterial({
            vertexShader: SURFACE_VERT,
            fragmentShader: HALO_FRAG,
            uniforms: {
              uColor: { value: new THREE.Color(spec.surface.atmosColor) },
              uIntensity: { value: THREE.MathUtils.clamp(spec.surface.atmosAmp, 0, 1.6) * 0.8 },
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
          });
          const halo = new THREE.Mesh(SPHERE_LO, hMat);
          halo.scale.setScalar(visR * 1.12);
          halo.renderOrder = 3;
          body.add(halo);
          mats.push(hMat);
        }

        /* anéis */
        if (spec.ring) {
          const inner = Math.max(spec.ring.inner, visR * 1.2);
          const outer = Math.max(spec.ring.outer, inner + 0.1);
          const geo = new THREE.RingGeometry(inner, outer, 180, 1);
          geo.rotateX(-Math.PI / 2);
          const rMat = new THREE.ShaderMaterial({
            vertexShader: RING_VERT,
            fragmentShader: RING_FRAG,
            uniforms: {
              uInner: { value: inner },
              uOuter: { value: outer },
              uTint: { value: new THREE.Color(spec.ring.tint) },
              uOpacity: { value: THREE.MathUtils.clamp(spec.ring.opacity, 0, 1) },
              uSunPos: uniforms.uSunPos,
            },
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
          const ring = new THREE.Mesh(geo, rMat);
          ring.rotation.x = THREE.MathUtils.degToRad(spec.id === "uranus" ? 8 : 0);
          ring.renderOrder = 4;
          body.add(ring);
          ringMats.push(rMat);
        }
      }

      /* giroscópio decorativo (anéis holográficos) */
      const gyro = new THREE.Group();
      const accent = new THREE.Color(spec.accent);
      const mkRing = (r: number, tilt: number, op: number) => {
        const t = new THREE.Mesh(
          new THREE.TorusGeometry(r, 0.014, 8, 110),
          new THREE.MeshBasicMaterial({
            color: accent,
            transparent: true,
            opacity: op,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        t.rotation.x = tilt;
        gyro.add(t);
      };
      mkRing(visR * 1.75, Math.PI / 2.15, 0.22);
      mkRing(visR * 2.05, Math.PI / 1.8, 0.13);
      group.add(gyro);

      /* disco-base holográfico */
      const base = new THREE.Mesh(
        new THREE.RingGeometry(visR * 1.25, visR * 1.32, 72),
        new THREE.MeshBasicMaterial({
          color: accent,
          transparent: true,
          opacity: 0.16,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      base.rotation.x = -Math.PI / 2;
      base.position.y = -visR * 1.35;
      group.add(base);

      /* velocidade de rotação relativa (rad/s visual) */
      const spin = (24 / Math.max(Math.abs(spec.spinHours), 4)) * 0.35 * Math.sign(spec.spinHours || 1);

      const label = this.makeLabel(spec.name, spec.accent);

      this.pedestals.push({
        id: spec.id,
        group,
        body,
        visR,
        spin,
        mats,
        ringMats,
        gyro,
        label,
      });
    });

    /* enquadra a câmera na seleção */
    const totalW = (specs.length - 1) * spacing + 8;
    const dist = THREE.MathUtils.clamp(totalW * 1.15, 14, 46);
    this.camera.position.set(0, dist * 0.28, dist);
    this.controls.target.set(0, 0, 0);
  }

  setRelativeScale(v: boolean) {
    if (v === this.relativeScale) return;
    this.relativeScale = v;
    /* reconstrói com os mesmos corpos */
    this.setBodies(this.pedestals.map((p) => p.id));
  }

  /* -------------------------------------------------- eventos */

  private onMove = (e: PointerEvent) => {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.mouseMoved = true;
  };
  private onDown = (e: PointerEvent) => {
    this.downPos = { x: e.clientX, y: e.clientY };
  };
  private onUp = (e: PointerEvent) => {
    const dx = e.clientX - this.downPos.x;
    const dy = e.clientY - this.downPos.y;
    if (dx * dx + dy * dy > 30) return;
    const r = this.renderer.domElement.getBoundingClientRect();
    this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const hit = this.raycast();
    if (hit) this.opts.onSelect(hit);
  };

  private bind() {
    const el = this.renderer.domElement;
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointerup", this.onUp);
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

  private raycast(): string | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    for (const h of hits) {
      if (h.object.userData.id) return h.object.userData.id as string;
    }
    return null;
  }

  /* -------------------------------------------------- loop */

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.elapsed += dt;

    for (const p of this.pedestals) {
      p.body.rotation.y += p.spin * dt;
      p.gyro.rotation.y -= dt * 0.35;
      p.gyro.rotation.z += dt * 0.12;
      for (const m of p.mats) if (m.uniforms.uTime) m.uniforms.uTime.value = this.elapsed;
    }
    this.ptMat.uniforms.uTime.value = this.elapsed;

    if (this.mouseMoved) {
      this.mouseMoved = false;
      const id = this.raycast();
      if (id !== this.hoveredId) {
        this.hoveredId = id;
        this.opts.onHover(id);
      }
      this.renderer.domElement.style.cursor = id ? "pointer" : "grab";
    }

    /* labels */
    const w = this.mount.clientWidth;
    const h = this.mount.clientHeight;
    for (const p of this.pedestals) {
      p.body.getWorldPosition(this.V);
      this.V.y -= p.visR * 1.5;
      this.V.project(this.camera);
      if (this.V.z > 1) {
        p.label.classList.add("is-hidden");
        continue;
      }
      p.label.classList.remove("is-hidden");
      p.label.classList.toggle("is-hovered", p.id === this.hoveredId);
      const x = (this.V.x * 0.5 + 0.5) * w;
      const y = (-this.V.y * 0.5 + 0.5) * h;
      p.label.style.transform = `translate(-50%, 20%) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }

    this.controls.update();
    this.composer.render();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    const el = this.renderer.domElement;
    el.removeEventListener("pointermove", this.onMove);
    el.removeEventListener("pointerdown", this.onDown);
    el.removeEventListener("pointerup", this.onUp);
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
    el.remove();
    this.pedestals.forEach((p) => p.label.remove());
  }
}
