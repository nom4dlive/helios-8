/**
 * BODY SPECS — resolve qualquer corpo do comparador (estrela, planeta ou lua,
 * do Sistema Solar ou do catálogo exoplanetário) numa especificação 3D que
 * alimenta os shaders de alto realismo (PLANET_FRAG / EARTH_FRAG / STAR_FRAG).
 *
 * Reutiliza fielmente as superfícies já autoradas:
 *   • planetas/luas solares  → SurfaceParams de solarSystem.ts
 *   • planetas exo           → classSurface() de ExoScene (variação determinística)
 *   • estrelas               → cor/temperatura espectral (shader STAR_FRAG)
 */
import { EXO_SYSTEMS, type ExoPlanet } from "./catalog";
import { SOLAR_PLANETS, SOLAR_MOONS, SOLAR_STAR, SOLAR_SYSTEM_ID } from "./solarSystem";
import { classSurface } from "../three/ExoScene";

/** campos de superfície aceitos pelo surfaceUniforms do comparador */
export interface SurfaceLike {
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
  earthLike?: boolean;
  spot?: { latDeg: number; lonDeg: number; size: number; color: string };
}

export interface BodySpec {
  id: string;
  name: string;
  kind: "star" | "planet" | "moon";
  accent: string;
  radiusKm: number;
  spinHours: number; /* negativo = retrógrado */
  surface?: SurfaceLike;
  star?: { tempK: number; color: string; pulsar: boolean };
  ring?: { inner: number; outer: number; tint: string; opacity: number };
  clouds?: { tint: string; amp: number };
}

/* rotação em horas (negativo = retrógrado) */
const SPIN_HOURS: Record<string, number> = {
  sun: 609.6,
  mercury: 1407.6,
  venus: -5832.5,
  earth: 23.93,
  mars: 24.62,
  jupiter: 9.93,
  saturn: 10.66,
  uranus: -17.24,
  neptune: 16.11,
};

const toSurface = (s: ReturnType<typeof classSurface>): SurfaceLike => ({ ...s });

export function bodySpecFor(id: string): BodySpec | null {
  /* ---------- estrelas ---------- */
  if (id === "star-solar") {
    return {
      id,
      name: SOLAR_STAR.name,
      kind: "star",
      accent: SOLAR_STAR.spectral.color,
      radiusKm: SOLAR_STAR.radiusKm,
      spinHours: SPIN_HOURS.sun,
      star: { tempK: SOLAR_STAR.spectral.tempK, color: SOLAR_STAR.spectral.color, pulsar: false },
    };
  }
  if (id.startsWith("star-")) {
    const sys = EXO_SYSTEMS.find((s) => `star-${s.id}` === id);
    if (sys) {
      return {
        id,
        name: sys.starName,
        kind: "star",
        accent: sys.spectral.color,
        radiusKm: Math.max(sys.spectral.radiusSun, 0.0001) * 696340,
        spinHours: 500,
        star: { tempK: sys.spectral.tempK, color: sys.spectral.color, pulsar: sys.kind === "pulsar" },
      };
    }
    return null;
  }

  /* ---------- planetas solares ---------- */
  const sp = SOLAR_PLANETS.find((p) => p.id === id);
  if (sp) {
    return {
      id,
      name: sp.name,
      kind: "planet",
      accent: sp.accent,
      radiusKm: sp.radiusKm,
      spinHours: SPIN_HOURS[id] ?? 24,
      surface: { ...sp.surface },
      ring: sp.surface.ring,
      clouds: sp.surface.clouds,
    };
  }

  /* ---------- luas solares ---------- */
  const sm = SOLAR_MOONS.find((m) => m.id === id);
  if (sm) {
    return {
      id,
      name: sm.name,
      kind: "moon",
      accent: sm.accent,
      radiusKm: sm.radiusKm,
      spinHours: Math.abs(sm.periodDays) * 24, /* maré travada */
      surface: { ...sm.surface },
    };
  }

  /* ---------- planetas exoplanetários ("<sysId>-<planetId>") ---------- */
  for (const sys of EXO_SYSTEMS) {
    if (sys.id === SOLAR_SYSTEM_ID) continue;
    const pl: ExoPlanet | undefined = sys.planets.find((p) => `${sys.id}-${p.id}` === id);
    if (pl) {
      return {
        id,
        name: pl.name,
        kind: "planet",
        accent: "#e8c890",
        radiusKm: pl.radiusEarth * 6371,
        /* mundos próximos da estrela tendem a maré travada: spin ≈ órbita */
        spinHours: pl.periodDays < 30 ? pl.periodDays * 24 : 20 + (pl.periodDays % 20),
        surface: toSurface(classSurface(pl)),
      };
    }
  }

  return null;
}
