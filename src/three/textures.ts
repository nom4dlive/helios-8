import * as THREE from "three";

/**
 * Fila de texturas fotográficas (Solar System Scope, CC BY 4.0).
 * — tenta 8K, cai para 2K em qualquer falha;
 * — reamostra para ≤ 4096px antes do upload (uma 8K crua ≈ 256 MB/planeta);
 * — 3 downloads simultâneos, com progresso reportado ao HUD.
 */
export type TexKind = "map" | "sun" | "clouds" | "atmo" | "ring" | "stars";

export interface TexJob {
  key: TexKind;
  hi: string;
  lo: string;
  srgb?: boolean;
}

const CDN = "https://www.solarsystemscope.com/textures/download/";
const t = (f: string) => CDN + f;

export const BODY_TEXTURES: Record<string, TexJob[]> = {
  sun: [{ key: "sun", hi: t("8k_sun.jpg"), lo: t("2k_sun.jpg") }],
  mercury: [{ key: "map", hi: t("8k_mercury.jpg"), lo: t("2k_mercury.jpg") }],
  venus: [
    { key: "map", hi: t("8k_venus_surface.jpg"), lo: t("2k_venus_surface.jpg") },
    { key: "atmo", hi: t("8k_venus_atmosphere.jpg"), lo: t("2k_venus_atmosphere.jpg") },
  ],
  earth: [
    { key: "map", hi: t("8k_earth_daymap.jpg"), lo: t("2k_earth_daymap.jpg") },
    { key: "clouds", hi: t("8k_earth_clouds.jpg"), lo: t("2k_earth_clouds.jpg") },
  ],
  moon: [{ key: "map", hi: t("8k_moon.jpg"), lo: t("2k_moon.jpg") }],
  mars: [{ key: "map", hi: t("8k_mars.jpg"), lo: t("2k_mars.jpg") }],
  jupiter: [{ key: "map", hi: t("8k_jupiter.jpg"), lo: t("2k_jupiter.jpg") }],
  saturn: [
    { key: "map", hi: t("8k_saturn.jpg"), lo: t("2k_saturn.jpg") },
    {
      key: "ring",
      hi: t("2k_saturn_ring_alpha.png"),
      lo: t("2k_saturn_ring_alpha.png"),
      srgb: true,
    },
  ],
  uranus: [{ key: "map", hi: t("8k_uranus.jpg"), lo: t("2k_uranus.jpg") }],
  neptune: [{ key: "map", hi: t("8k_neptune.jpg"), lo: t("2k_neptune.jpg") }],
  _stars: [{ key: "stars", hi: t("8k_stars_milky_way.jpg"), lo: t("2k_stars_milky_way.jpg") }],
};

export interface TexResult {
  bodyId: string;
  key: TexKind;
  tex: THREE.Texture | null;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("falha: " + url));
    img.src = url;
  });
}

function toTexture(img: HTMLImageElement, srgb: boolean, aniso: number): THREE.Texture {
  const MAX = 4096;
  const w0 = Math.max(2, img.naturalWidth || 2);
  const h0 = Math.max(2, img.naturalHeight || 2);
  let source: CanvasImageSource = img;
  if (Math.max(w0, h0) > MAX) {
    const k = MAX / Math.max(w0, h0);
    const c = document.createElement("canvas");
    c.width = Math.max(2, Math.round(w0 * k));
    c.height = Math.max(2, Math.round(h0 * k));
    const g = c.getContext("2d");
    if (g) {
      g.drawImage(img, 0, 0, c.width, c.height);
      source = c;
    }
  }
  const tex = new THREE.Texture(source);
  tex.needsUpdate = true;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.max(1, aniso);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function loadTextureQueue(
  jobs: { bodyId: string; job: TexJob }[],
  aniso: number,
  onProgress?: (done: number, total: number) => void
): Promise<TexResult[]> {
  const results: TexResult[] = [];
  const total = Math.max(jobs.length, 1);
  let done = 0;
  let idx = 0;

  const worker = async () => {
    for (;;) {
      const cur = jobs[idx++];
      if (!cur) return;
      let tex: THREE.Texture | null = null;
      try {
        const img = await loadImage(cur.job.hi).catch(() => loadImage(cur.job.lo));
        tex = toTexture(img, cur.job.srgb ?? true, aniso);
      } catch {
        tex = null;
      }
      results.push({ bodyId: cur.bodyId, key: cur.job.key, tex });
      done++;
      onProgress?.(done, total);
    }
  };

  const n = THREE.MathUtils.clamp(jobs.length, 1, 3);
  const workers: Promise<void>[] = [];
  for (let i = 0; i < n; i++) workers.push(worker());
  return Promise.all(workers).then(() => results);
}
