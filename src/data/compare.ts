/**
 * COMPARADOR UNIVERSAL — unifica o Sistema Solar e o catálogo de exoplanetas
 * em listas comparáveis de estrelas, planetas e luas.
 */
import {
  EXO_SYSTEMS,
  semiMajorAxisAU,
  esi,
  hzStatus,
  type ExoSystem,
} from "./catalog";
import {
  SOLAR_PLANETS,
  SOLAR_MOONS,
  SOLAR_STAR,
  SOLAR_SYSTEM_ID,
} from "./solarSystem";

/* ------------------------------------------------------------ estrelas */

export interface CmpStar {
  id: string;
  name: string;
  systemId: string;
  type: string;
  color: string;
  tempK: number;
  massSun: number;
  radiusSun: number;
  lumSun: number;
  metallicity?: number;
  planetCount: number;
  distLy: number;
}

const starFrom = (s: ExoSystem): CmpStar => ({
  id: `star-${s.id}`,
  name: s.starName,
  systemId: s.id,
  type: s.spectral.type,
  color: s.spectral.color,
  tempK: s.spectral.tempK,
  massSun: s.spectral.massSun,
  radiusSun: s.spectral.radiusSun,
  lumSun: s.spectral.luminositySun,
  metallicity: s.spectral.metallicity,
  planetCount: s.planets.length,
  distLy: s.distLy,
});

export const CMP_STARS: CmpStar[] = [
  {
    id: "star-solar",
    name: "Sol",
    systemId: SOLAR_SYSTEM_ID,
    type: SOLAR_STAR.spectral.type,
    color: SOLAR_STAR.spectral.color,
    tempK: SOLAR_STAR.spectral.tempK,
    massSun: 1,
    radiusSun: 1,
    lumSun: 1,
    metallicity: 0,
    planetCount: SOLAR_PLANETS.length,
    distLy: 0,
  },
  ...EXO_SYSTEMS.map(starFrom),
];

/* ------------------------------------------------------------ planetas */

export interface CmpPlanet {
  id: string;
  name: string;
  systemName: string;
  systemId: string;
  color: string;
  radiusEarth: number;
  massEarth?: number;
  periodDays: number;
  distAU: number;
  flux?: number;
  teqK?: number;
  esiVal?: number;
  habitable?: boolean;
  isSolar?: boolean;
}

const solarPlanets: CmpPlanet[] = SOLAR_PLANETS.map((p) => {
  const rE = p.radiusKm / 6371;
  const flux = 1 / (p.auDist * p.auDist);
  const teqK = 278.6 / Math.sqrt(p.auDist);
  return {
    id: p.id,
    name: p.name,
    systemName: "Sistema Solar",
    systemId: SOLAR_SYSTEM_ID,
    color: p.accent,
    radiusEarth: rE,
    massEarth: p.massEarth,
    periodDays: p.periodDays,
    distAU: p.auDist,
    flux,
    teqK,
    esiVal: esi(rE, teqK) ?? undefined,
    habitable: hzStatus(flux) !== "outside",
    isSolar: true,
  };
});

const exoPlanets: CmpPlanet[] = EXO_SYSTEMS.flatMap((s) =>
  s.planets.map((p) => {
    const distAU = semiMajorAxisAU(p.periodDays, s.spectral.massSun);
    return {
      id: `${s.id}-${p.id}`,
      name: p.name,
      systemName: s.starName,
      systemId: s.id,
      color: "#e8c890",
      radiusEarth: p.radiusEarth,
      massEarth: p.massEarth,
      periodDays: p.periodDays,
      distAU,
      flux: p.fluxEarth,
      teqK: p.teqK,
      esiVal: esi(p.radiusEarth, p.teqK) ?? undefined,
      habitable: p.habitable,
    };
  })
);

export const CMP_PLANETS: CmpPlanet[] = [...solarPlanets, ...exoPlanets];

/* ------------------------------------------------------------ luas */

export interface CmpMoon {
  id: string;
  name: string;
  planetName: string;
  color: string;
  radiusKm: number;
  orbitKm: number;
  periodDays: number;
}

export const CMP_MOONS: CmpMoon[] = SOLAR_MOONS.map((m) => ({
  id: m.id,
  name: m.name,
  planetName: SOLAR_PLANETS.find((p) => p.id === m.planetId)?.name ?? "—",
  color: m.accent,
  radiusKm: m.radiusKm,
  orbitKm: m.orbitKm,
  periodDays: Math.abs(m.periodDays),
}));
