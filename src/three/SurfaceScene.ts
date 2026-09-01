import * as THREE from "three";
import type { SurfaceViewDef } from "../data/surfaceViews";
import {
  NOISE_GLSL,
  SKY_VERT,
  SKY_FRAG,
  TERRAIN_VERT,
  TERRAIN_FRAG,
  ROCK_VERT,
  ROCK_FRAG,
  PLUME_VERT,
  PLUME_FRAG,
} from "./shaders";
import { sfx } from "../lib/sound";

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

export interface SurfaceSceneOptions {
  def: SurfaceViewDef;
  onTelemetry: (t: SurfaceTelemetry) => void;
}

/* ---------- ruído em JS (apenas CPU — o terreno é assado, não há duplicação GPU) ---------- */
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

const rad = THREE.MathUtils.degToRad;

function makeGlowTexture(color: string, inner = 0.5): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, color);
  grad.addColorStop(inner, color + "55");
  grad.addColorStop(1, color + "00");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** astro no céu: disco colorido + nome desenhado no próprio sprite */
function makeBodySprite(color: string, name: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(256, 200, 0, 256, 200, 190);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.25, color);
  grad.addColorStop(0.55, color + "cc");
  grad.addColorStop(0.72, color + "22");
  grad.addColorStop(1, color + "00");
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  g.font = "600 34px 'IBM Plex Mono', monospace";
  g.textAlign = "center";
  g.fillStyle = "rgba(232,236,244,0.85)";
  g.shadowColor = "rgba(0,0,0,0.9)";
  g.shadowBlur = 8;
  g.fillText(name.toUpperCase(), 256, 470);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class SurfaceScene {
  private mount: HTMLElement;
  private opts: SurfaceSceneOptions;
  private def: SurfaceViewDef;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;

  private skyUniforms!: Record<string, THREE.IUniform>;
  private timeUniforms: THREE.IUniform[] = [];

  private yaw = 0;
  private pitch = -0.04;
  private fov = 70;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  private keys = new Set<string>();
  private walkX = 0;
  private walkZ = 0;
  private camY = 2;
  private eyeHeight = 2.2;
  private canWalk = true;
  private moving = false;
  private stepTimer = 0;

  private heightAt: (x: number, z: number) => number = () => 0;
  private dustRef: THREE.Points | null = null;
  private lookTmp = new THREE.Vector3();
  private fwdTmp = new THREE.Vector3();
  private rightTmp = new THREE.Vector3();

  /* panorama 360° */
  private panoActive = false;
  private panoMat: THREE.MeshBasicMaterial | null = null;
  private sunSprites: THREE.Sprite[] = [];
  private fogUniform: THREE.IUniform | null = null;
  private sunDirRef: THREE.Vector3 = new THREE.Vector3(0, 1, 0);

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
    this.def = opts.def;
    this.canWalk = !this.def.cloudSea;
    this.initGL();
    this.build();
    this.bind();
    /* começa olhando para o astro principal do céu */
    const main = this.def.skyBodies.reduce<SurfaceViewDef["skyBodies"][number] | null>(
      (acc, b) => (!acc || b.glow > acc.glow ? b : acc),
      null
    );
    if (main) {
      this.yaw = rad(180 - main.azimuthDeg);
      this.pitch = rad(THREE.MathUtils.clamp(main.elevationDeg * 0.5, -20, 40));
    } else {
      this.yaw = rad(180 - this.def.sunAzimuthDeg);
      this.pitch = rad(THREE.MathUtils.clamp(this.def.sunElevationDeg * 0.4, -20, 35));
    }
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
    this.camera = new THREE.PerspectiveCamera(this.fov, w / h, 0.1, 4200);
  }

  /* -------------------------------------------------- construção */

  private build() {
    const d = this.def;
    const r = d.realism ?? {};
    const sunDir = new THREE.Vector3(
      Math.cos(rad(d.sunElevationDeg)) * Math.sin(rad(d.sunAzimuthDeg)),
      Math.sin(rad(d.sunElevationDeg)),
      Math.cos(rad(d.sunElevationDeg)) * Math.cos(rad(d.sunAzimuthDeg))
    ).normalize();
    this.sunDirRef.copy(sunDir);

    /* ---------- céu ---------- */
    const bands = r.skyBands;
    this.skyUniforms = {
      uSkyTop: { value: new THREE.Color(d.skyTop) },
      uSkyHorizon: { value: new THREE.Color(d.skyHorizon) },
      uSunDir: { value: sunDir },
      uStarDensity: { value: THREE.MathUtils.clamp(d.starDensity, 0, 2) },
      uTime: { value: 0 },
      uSunDiffuse: { value: THREE.MathUtils.clamp(r.sunDiffuse ?? 0, 0, 1) },
      uSunStrength: { value: THREE.MathUtils.clamp(r.sunStrength ?? 1, 0, 2.5) },
      uSunTint: { value: new THREE.Color(r.sunTint ?? "#ffffff") },
      uBandAmp: { value: bands ? THREE.MathUtils.clamp(bands.amp, 0, 1) : 0 },
      uBandScale: { value: bands ? THREE.MathUtils.clamp(bands.scale, 0.5, 20) : 3 },
      uBandDrift: { value: bands ? THREE.MathUtils.clamp(bands.drift, 0, 0.5) : 0.02 },
      uBandColorA: { value: new THREE.Color(bands?.colorA ?? "#ffffff") },
      uBandColorB: { value: new THREE.Color(bands?.colorB ?? "#cccccc") },
      uMilkyWay: { value: THREE.MathUtils.clamp(r.milkyWay ?? 0, 0, 1) },
    };
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(2100, 48, 32),
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
    this.timeUniforms.push(this.skyUniforms.uTime);

    /* ---------- Sol: núcleo nítido + halo de glare ---------- */
    const sunTex = makeGlowTexture(d.sunColor, 0.32);
    const sunPos = sunDir.clone().multiplyScalar(1600);
    const sunDiffuse = THREE.MathUtils.clamp(r.sunDiffuse ?? 0, 0, 1);
    const glareBoost = d.sunAngularDeg >= 1 ? 3.2 : d.starsVisible ? 2.3 : 1.2;

    const coreScale = THREE.MathUtils.clamp(
      1600 * Math.tan(rad(d.sunAngularDeg / 2)) * 2.4 * (1 - sunDiffuse),
      0,
      240
    );
    if (coreScale > 0.4 && d.sunVisible) {
      const core = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: sunTex,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      core.scale.set(coreScale, coreScale, 1);
      core.position.copy(sunPos);
      core.renderOrder = 4;
      this.scene.add(core);
      this.sunSprites.push(core);
    }
    const glareScale = THREE.MathUtils.clamp(
      Math.max(30, 1600 * Math.tan(rad(d.sunAngularDeg / 2)) * 10) *
        (0.5 + 0.4 * glareBoost) *
        (1 - sunDiffuse * 0.75),
      0,
      700
    );
    if (glareScale > 1 && d.sunVisible) {
      const glare = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: sunTex,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          opacity: THREE.MathUtils.clamp(0.4 * glareBoost, 0, 1),
        })
      );
      glare.scale.set(glareScale, glareScale, 1);
      glare.position.copy(sunPos);
      glare.renderOrder = 3;
      this.scene.add(glare);
      this.sunSprites.push(glare);
    }

    /* ---------- astros no céu ---------- */
    for (const b of d.skyBodies) {
      const ang = THREE.MathUtils.clamp(b.angularDeg, 0.05, 60);
      const el = rad(THREE.MathUtils.clamp(b.elevationDeg, -80, 85));
      const az = rad(b.azimuthDeg);
      const dir = new THREE.Vector3(
        Math.cos(el) * Math.sin(az),
        Math.sin(el),
        Math.cos(el) * Math.cos(az)
      );
      const scale = THREE.MathUtils.clamp(2 * 1600 * Math.tan(rad(ang / 2)), 8, 1400);
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: makeBodySprite(b.color, b.name),
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          opacity: 0.96,
        })
      );
      sprite.scale.set(scale, scale, 1);
      sprite.position.copy(dir.multiplyScalar(1600));
      sprite.renderOrder = 2;
      this.scene.add(sprite);
    }

    /* ---------- terreno (assado na CPU → colisão exata) ---------- */
    const duneAmp = THREE.MathUtils.clamp(r.dunes ?? 0, 0, 3);
    const amp = Math.max(d.terrainAmp, 0.2);
    const scale = Math.max(d.terrainScale, 0.2);

    const heightFn = (x: number, z: number): number => {
      const s = scale;
      const base = fbm2(x * s * 0.004 + 1.7, z * s * 0.004 + 9.2) - 0.5;
      const mid = fbm2(x * s * 0.0016 + 5.5, z * s * 0.0016 + 3.3) - 0.5;
      const rough = fbm2(x * s * 0.02 + 9.9, z * s * 0.02 + 7.1) - 0.5;
      let h = base * amp + mid * amp * 2.4 + rough * amp * 0.35;
      if (duneAmp > 0) {
        h +=
          Math.sin(x * 0.045 + fbm2(x * 0.006, z * 0.006) * 3) *
          Math.cos(z * 0.038 + 1.7) *
          duneAmp;
      }
      const rockN = fbm2(x * s * 0.0009 + 14.4, z * s * 0.0009 + 2.2);
      h += Math.max(0, (rockN - 0.62) / 0.23) ** 1.4 * amp * 1.6;
      return h;
    };

    const SIZE = 2000;
    const SEGS = 172;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS);
    geo.rotateX(-Math.PI / 2);
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const nrmAttr = geo.attributes.normal as THREE.BufferAttribute;

    if (this.canWalk) {
      this.heightAt = heightFn;
      const H = new Float32Array(posAttr.count);
      for (let i = 0; i < posAttr.count; i++) {
        H[i] = heightFn(posAttr.getX(i), posAttr.getZ(i));
      }
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
      this.camY = heightFn(0, 0) + this.eyeHeight;
    } else {
      /* mar de nuvens: superfície plana, ondulação animada no shader */
      this.heightAt = () => 0;
    }

    const terrainMat = new THREE.ShaderMaterial({
      vertexShader: TERRAIN_VERT,
      fragmentShader: TERRAIN_FRAG,
      uniforms: {
        uScale: { value: scale },
        uAmp: { value: amp },
        uDuneAmp: { value: duneAmp },
        uCloudSea: { value: d.cloudSea ? 1 : 0 },
        uTime: { value: 0 },
        uBaked: { value: this.canWalk ? 1 : 0 },
        uBase: { value: new THREE.Color(d.terrainBase) },
        uMid: { value: new THREE.Color(d.terrainMid) },
        uDark: { value: new THREE.Color(d.terrainDark) },
        uFogColor: { value: new THREE.Color(d.fogColor) },
        uFogDensity: { value: THREE.MathUtils.clamp(d.fogDensity, 0.0001, 0.05) },
        uSunDir: { value: sunDir },
        uAmbient: { value: THREE.MathUtils.clamp(r.ambient ?? 0.35, 0.02, 1) },
        uSunStrength: { value: THREE.MathUtils.clamp(r.sunStrength ?? 1, 0, 2.5) },
        uSunTint: { value: new THREE.Color(r.sunTint ?? "#ffffff") },
        uSparkle: { value: THREE.MathUtils.clamp(r.sparkle ?? 0, 0, 1.5) },
      },
    });
    const terrain = new THREE.Mesh(geo, terrainMat);
    this.scene.add(terrain);
    this.timeUniforms.push(terrainMat.uniforms.uTime);
    this.fogUniform = terrainMat.uniforms.uFogColor;

    /* ---------- campo de rochas (InstancedMesh) ---------- */
    if (this.canWalk && r.rockField) {
      const rf = r.rockField;
      const count = Math.max(1, rf.count);
      const rockGeo = new THREE.DodecahedronGeometry(1, 0);
      const rockMat = new THREE.ShaderMaterial({
        vertexShader: ROCK_VERT,
        fragmentShader: ROCK_FRAG,
        uniforms: {
          uColorA: { value: new THREE.Color(rf.colorA) },
          uColorB: { value: new THREE.Color(rf.colorB) },
          uSunDir: { value: sunDir },
          uAmbient: terrainMat.uniforms.uAmbient,
          uSunStrength: terrainMat.uniforms.uSunStrength,
          uFogColor: terrainMat.uniforms.uFogColor,
          uFogDensity: terrainMat.uniforms.uFogDensity,
        },
      });
      const inst = new THREE.InstancedMesh(rockGeo, rockMat, count);
      const M = new THREE.Matrix4();
      const Q = new THREE.Quaternion();
      const S = new THREE.Vector3();
      const P = new THREE.Vector3();
      const E = new THREE.Euler();
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 6 + Math.pow(Math.random(), 1.6) * 340;
        const x = Math.cos(ang) * dist;
        const z = Math.sin(ang) * dist;
        const s = 0.25 + Math.pow(Math.random(), 2.4) * Math.max(0.2, rf.maxScale);
        P.set(x, this.heightAt(x, z) + s * 0.32, z);
        E.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        Q.setFromEuler(E);
        S.set(s * (0.7 + Math.random() * 0.6), s * (0.5 + Math.random() * 0.5), s * (0.7 + Math.random() * 0.6));
        M.compose(P, Q, S);
        inst.setMatrixAt(i, M);
      }
      inst.instanceMatrix.needsUpdate = true;
      this.scene.add(inst);
    }

    /* ---------- gêiser / pluma ---------- */
    if (this.canWalk && r.plume) {
      const pl = r.plume;
      const n = Math.max(16, pl.count);
      const seeds = new Float32Array(n);
      const ppos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        seeds[i] = Math.random();
        ppos[i * 3] = pl.x;
        ppos[i * 3 + 1] = this.heightAt(pl.x, pl.z);
        ppos[i * 3 + 2] = pl.z;
      }
      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute("position", new THREE.BufferAttribute(ppos, 3));
      pGeo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
      const pMat = new THREE.ShaderMaterial({
        vertexShader: PLUME_VERT,
        fragmentShader: PLUME_FRAG,
        uniforms: {
          uTime: { value: 0 },
          uSpeed: { value: Math.max(1, pl.speed) },
          uGravity: { value: Math.max(0.05, pl.gravity) },
          uSpread: { value: THREE.MathUtils.clamp(pl.spread, 0.05, 2) },
          uWind: { value: pl.wind },
          uOrigin: { value: new THREE.Vector3(pl.x, this.heightAt(pl.x, pl.z), pl.z) },
          uColorA: { value: new THREE.Color(pl.colorA) },
          uColorB: { value: new THREE.Color(pl.colorB) },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
      });
      const plume = new THREE.Points(pGeo, pMat);
      plume.renderOrder = 6;
      this.scene.add(plume);
      this.timeUniforms.push(pMat.uniforms.uTime);
    }

    /* ---------- poeira em suspensão (Marte) ---------- */
    if (d.effects === "dust") {
      const n = 420;
      const dp = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 8 + Math.random() * 95;
        dp[i * 3] = Math.cos(ang) * dist;
        dp[i * 3 + 1] = Math.random() * 14 - 2;
        dp[i * 3 + 2] = Math.sin(ang) * dist;
      }
      const dGeo = new THREE.BufferGeometry();
      dGeo.setAttribute("position", new THREE.BufferAttribute(dp, 3));
      const dMat = new THREE.PointsMaterial({
        color: new THREE.Color(d.fogColor).lerp(new THREE.Color("#d8a878"), 0.5),
        size: 0.5,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
      });
      const dust = new THREE.Points(dGeo, dMat);
      this.dustRef = dust;
      this.scene.add(dust);
    }

    /* ---------- panorama 360° (cúpula equiretangular calibrada) ---------- */
    if (d.panorama && d.panorama.urls.length > 0) {
      void this.loadPanorama(d.panorama.urls);
    }
  }

  /**
   * Cúpula equiretangular com calibração em runtime:
   * 1. detecta o Sol gravado na foto (centróide dos pixels mais brilhantes);
   * 2. gira a cúpula (quatérnio) para alinhá-lo à iluminação do terreno;
   * 3. amostra a cor do horizonte e a usa como névoa → emenda sem costura.
   */
  private async loadPanorama(urls: string[]) {
    let img: HTMLImageElement | null = null;
    for (const url of urls) {
      try {
        img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.crossOrigin = "anonymous";
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error(url));
          el.src = url;
        });
        break;
      } catch {
        img = null;
      }
    }
    if (!img || this.disposed) return;

    const tex = new THREE.Texture(img);
    tex.needsUpdate = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;

    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.BackSide,
      depthWrite: false,
      transparent: true,
      opacity: 0,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1980, 64, 40), mat);
    dome.renderOrder = -9;
    this.scene.add(dome);
    this.panoMat = mat;

    /* calibração por análise de pixels (só se o CORS permitir leitura) */
    try {
      const W = 160;
      const H = 80;
      const cv = document.createElement("canvas");
      cv.width = W;
      cv.height = H;
      const g = cv.getContext("2d", { willReadFrequently: true });
      if (!g) return;
      g.drawImage(img, 0, 0, W, H);
      const px = g.getImageData(0, 0, W, H).data;

      /* Sol: centróide ponderado pelo cubo da luminância (região superior) */
      let sumW = 0;
      let cx = 0;
      let cy = 0;
      let peak = 0;
      for (let y = 0; y < H * 0.62; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
          if (lum > peak) peak = lum;
          const w = Math.pow(lum / 255, 6);
          sumW += w;
          cx += x * w;
          cy += y * w;
        }
      }
      if (peak > 235 && sumW > 1e-4) {
        const u = cx / sumW / W;
        const v = cy / sumW / H;
        /* UV da esfera three: az = u·2π − π/2, el = (0,5 − v)·π */
        const az = u * Math.PI * 2 - Math.PI / 2;
        const el = (0.5 - v) * Math.PI;
        const dirImg = new THREE.Vector3(
          Math.cos(el) * Math.sin(az),
          Math.sin(el),
          Math.cos(el) * Math.cos(az)
        ).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(dirImg, this.sunDirRef.clone().normalize());
        dome.quaternion.copy(q);
      }

      /* névoa adaptativa: cor média da faixa do horizonte */
      let rr = 0;
      let gg = 0;
      let bb = 0;
      let n = 0;
      for (let y = Math.floor(H * 0.46); y < Math.floor(H * 0.56); y++) {
        for (let x = 0; x < W; x += 2) {
          const i = (y * W + x) * 4;
          rr += px[i];
          gg += px[i + 1];
          bb += px[i + 2];
          n++;
        }
      }
      if (n > 0 && this.fogUniform) {
        /* mistura 70% foto / 30% névoa original p/ manter o contraste do terreno */
        const fc = this.fogUniform.value as THREE.Color;
        const photo = new THREE.Color(rr / n / 255, gg / n / 255, bb / n / 255);
        fc.copy(fc.lerp(photo, 0.7));
      }

      /* o Sol da foto assume: esconde o Sol/glare procedurais */
      for (const s of this.sunSprites) s.visible = false;
    } catch {
      /* CORS bloqueado → cúpula sem calibração (ainda assim melhor que nada) */
    }

    this.panoActive = true;
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
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.yaw -= dx * 0.0034;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.003, -1.45, 1.45);
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
  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.key.toLowerCase());
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };

  private bind() {
    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    el.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.mount);
  }

  private resize() {
    if (this.disposed) return;
    const w = Math.max(1, this.mount.clientWidth);
    const h = Math.max(1, this.mount.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  /* -------------------------------------------------- loop */

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.wallTime += dt;

    for (const u of this.timeUniforms) u.value = this.wallTime;

    /* caminhada (vetores reutilizados — zero alocação por frame) */
    this.moving = false;
    if (this.canWalk) {
      const g = Math.max(0.5, this.def.gravityMs2);
      const baseSpeed = 5.5 * THREE.MathUtils.clamp(Math.sqrt(9.81 / g), 0.45, 3.2);
      const speed = (this.keys.has("shift") ? baseSpeed * 2.3 : baseSpeed) * dt;
      const fwd = this.fwdTmp.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const right = this.rightTmp.set(fwd.z, 0, -fwd.x);
      let dx = 0;
      let dz = 0;
      if (this.keys.has("w") || this.keys.has("arrowup")) { dx += fwd.x * speed; dz += fwd.z * speed; }
      if (this.keys.has("s") || this.keys.has("arrowdown")) { dx -= fwd.x * speed; dz -= fwd.z * speed; }
      if (this.keys.has("a") || this.keys.has("arrowleft")) { dx -= right.x * speed; dz -= right.z * speed; }
      if (this.keys.has("d") || this.keys.has("arrowright")) { dx += right.x * speed; dz += right.z * speed; }
      if (dx !== 0 || dz !== 0) {
        this.moving = true;
        this.walkX = THREE.MathUtils.clamp(this.walkX + dx, -920, 920);
        this.walkZ = THREE.MathUtils.clamp(this.walkZ + dz, -920, 920);
        this.stepTimer -= dt;
        if (this.stepTimer <= 0) {
          this.stepTimer = THREE.MathUtils.clamp(0.5 * Math.sqrt(9.81 / g), 0.26, 1.1);
          sfx.step(0.8 + 0.4 * Math.random());
        }
      }
      const targetY = this.heightAt(this.walkX, this.walkZ) + this.eyeHeight;
      this.camY += (targetY - this.camY) * Math.min(1, dt * 9);
    } else {
      /* flutuação suave no mar de nuvens */
      this.camY = 3.2 + Math.sin(this.wallTime * 0.4) * 0.5;
    }

    this.camera.position.set(this.walkX, this.camY, this.walkZ);
    this.lookTmp.set(
      this.walkX - Math.sin(this.yaw) * Math.cos(this.pitch),
      this.camY + Math.sin(this.pitch),
      this.walkZ - Math.cos(this.yaw) * Math.cos(this.pitch)
    );
    this.camera.lookAt(this.lookTmp);

    /* poeira em deriva lenta */
    if (this.dustRef) {
      this.dustRef.rotation.y += dt * 0.045;
      this.dustRef.position.y = Math.sin(this.wallTime * 0.3) * 0.4;
    }

    /* fade-in do panorama 360° */
    if (this.panoMat && this.panoMat.opacity < 1) {
      this.panoMat.opacity = Math.min(1, this.panoMat.opacity + dt * 0.7);
    }

    /* FPS */
    this.frames++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 1) {
      this.fps = Math.round(this.frames / Math.max(this.fpsTimer, 0.001));
      this.frames = 0;
      this.fpsTimer = 0;
    }

    /* telemetria 10 Hz */
    this.teleTimer += dt;
    if (this.teleTimer >= 0.1) {
      this.teleTimer = 0;
      this.opts.onTelemetry({
        azimuthDeg: ((THREE.MathUtils.radToDeg(this.yaw) % 360) + 360) % 360,
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
      const kill = (mm: THREE.Material) => {
        /* texturas de sprite/mapa não são liberadas pelo material.dispose() */
        const withMap = mm as THREE.Material & { map?: THREE.Texture | null };
        if (withMap.map) withMap.map.dispose();
        mm.dispose();
      };
      if (Array.isArray(m)) m.forEach(kill);
      else if (m) kill(m);
    });
    this.renderer.dispose();
    el.remove();
  }
}
