export interface SurfaceParams {
  /** 6 cores (hex) usadas pelo shader procedural do corpo */
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
  /** 0 = desligado; >0 = latitude (0..1) onde calotas começam */
  polarCap: number;
  spot?: { latDeg: number; lonDeg: number; size: number; color: string };
  atmosColor: string;
  atmosAmp: number;
  earthLike?: boolean;
  clouds?: boolean;
}

export interface MoonDef {
  id: string;
  name: string;
  diameterKm: number;
  distFromPlanetKm: number;
  periodDays: number;
  fact: string;
  accent: string;
  sizeR: number;
  orbitR: number;
  surface: SurfaceParams;
}

export interface BodyDef {
  id: string;
  name: string;
  kind: "star" | "planet";
  typeLabel: string;
  diameterKm: number;
  distSunMkm: number;
  distSunAU: number;
  periodDays: number;
  rotationLabel: string;
  moonsKnown: number;
  orbitSpeedKms?: number;
  tempLabel: string;
  fact: string;
  accent: string;
  sizeR: number;
  orbitR: number;
  orbitInclDeg: number;
  tiltDeg: number;
  ring?: { inner: number; outer: number; opacity: number; tint: string };
  surface: SurfaceParams;
  moons: MoonDef[];
}

export const fmtInt = (n: number) => Math.round(n).toLocaleString("pt-BR");
export const fmtNum = (n: number, d = 1) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

export const SUN: BodyDef = {
  id: "sun",
  name: "Sol",
  kind: "star",
  typeLabel: "Estrela · anã amarela G2V",
  diameterKm: 1392700,
  distSunMkm: 0,
  distSunAU: 0,
  periodDays: 0,
  rotationLabel: "25–35 dias (diferencial)",
  moonsKnown: 0,
  tempLabel: "5.505 °C (superfície)",
  fact: "Concentra 99,86% de toda a massa do sistema solar; o núcleo atinge 15 milhões de °C.",
  accent: "#f5b342",
  sizeR: 5,
  orbitR: 0,
  orbitInclDeg: 0,
  tiltDeg: 7.25,
  surface: {
    palette: ["#ff8c1a", "#ffb347", "#ffd98c", "#fff3c4", "#ffffff", "#fff8e0"],
    bandFreq: 0, bandTurb: 0, bandAmp: 0,
    noiseScale: 4, noiseAmp: 0, ridgeScale: 0, ridgeAmp: 0, craterScale: 0, craterAmp: 0,
    polarCap: 0, atmosColor: "#ffb347", atmosAmp: 1,
  },
  moons: [],
};

const grayCratered: SurfaceParams = {
  palette: ["#8a8680", "#a8a29a", "#6e6a64", "#54514c", "#c9c4bc", "#7d7871"],
  bandFreq: 0, bandTurb: 0, bandAmp: 0,
  noiseScale: 6, noiseAmp: 0.5, ridgeScale: 8, ridgeAmp: 0.35,
  craterScale: 14, craterAmp: 0.55, polarCap: 0,
  atmosColor: "#8a8680", atmosAmp: 0,
};

export const PLANETS: BodyDef[] = [
  {
    id: "mercury",
    name: "Mercúrio",
    kind: "planet",
    typeLabel: "Planeta rochoso",
    diameterKm: 4879,
    distSunMkm: 57.9,
    distSunAU: 0.39,
    periodDays: 87.97,
    rotationLabel: "58,6 dias",
    moonsKnown: 0,
    orbitSpeedKms: 47.4,
    tempLabel: "-173 a 427 °C",
    fact: "Um dia solar em Mercúrio (176 dias terrestres) dura mais que o dobro do seu ano.",
    accent: "#a89a8a",
    sizeR: 0.82,
    orbitR: 10.5,
    orbitInclDeg: 7.0,
    tiltDeg: 0.03,
    surface: { ...grayCratered, palette: ["#7a7268", "#968b7d", "#5c554c", "#453f38", "#b0a798", "#6e675e"] },
    moons: [],
  },
  {
    id: "venus",
    name: "Vênus",
    kind: "planet",
    typeLabel: "Planeta rochoso",
    diameterKm: 12104,
    distSunMkm: 108.2,
    distSunAU: 0.72,
    periodDays: 224.7,
    rotationLabel: "243 dias (retrógrada)",
    moonsKnown: 0,
    orbitSpeedKms: 35.0,
    tempLabel: "464 °C (média)",
    fact: "Gira ao contrário e tão devagar que seu dia é mais longo que seu ano.",
    accent: "#e8c890",
    sizeR: 1.35,
    orbitR: 15,
    orbitInclDeg: 3.39,
    tiltDeg: 177.4,
    surface: {
      palette: ["#d9b183", "#e8cfa0", "#c49a67", "#b08a58", "#f0e0bc", "#cfa878"],
      bandFreq: 7, bandTurb: 3.2, bandAmp: 0.55,
      noiseScale: 4, noiseAmp: 0.4, ridgeScale: 0, ridgeAmp: 0, craterScale: 0, craterAmp: 0,
      polarCap: 0, atmosColor: "#f0d8a8", atmosAmp: 1.1,
    },
    moons: [],
  },
  {
    id: "earth",
    name: "Terra",
    kind: "planet",
    typeLabel: "Planeta rochoso · nosso lar",
    diameterKm: 12742,
    distSunMkm: 149.6,
    distSunAU: 1.0,
    periodDays: 365.26,
    rotationLabel: "23,9 horas",
    moonsKnown: 1,
    orbitSpeedKms: 29.8,
    tempLabel: "15 °C (média)",
    fact: "Único lugar do universo com vida confirmada; 71% da superfície é oceano.",
    accent: "#5b9bd5",
    sizeR: 1.4,
    orbitR: 20.5,
    orbitInclDeg: 0.0,
    tiltDeg: 23.4,
    surface: {
      palette: ["#0b3a6e", "#114f8f", "#2e6b34", "#5a8a4a", "#e8f0f4", "#c2a36b"],
      bandFreq: 0, bandTurb: 0, bandAmp: 0,
      noiseScale: 3.2, noiseAmp: 0, ridgeScale: 0, ridgeAmp: 0, craterScale: 0, craterAmp: 0,
      polarCap: 0.74, atmosColor: "#7db4ff", atmosAmp: 1.35, earthLike: true, clouds: true,
    },
    moons: [
      {
        id: "luna",
        name: "Lua",
        diameterKm: 3475,
        distFromPlanetKm: 384400,
        periodDays: 27.32,
        fact: "Afasta-se da Terra 3,8 cm por ano; sua gravidade gera as marés.",
        accent: "#c8c4bc",
        sizeR: 0.38,
        orbitR: 2.9,
        surface: { ...grayCratered, palette: ["#9a958c", "#b5b0a6", "#7c776e", "#615d55", "#d4d0c8", "#8a857c"] },
      },
    ],
  },
  {
    id: "mars",
    name: "Marte",
    kind: "planet",
    typeLabel: "Planeta rochoso",
    diameterKm: 6779,
    distSunMkm: 227.9,
    distSunAU: 1.52,
    periodDays: 686.98,
    rotationLabel: "24,6 horas",
    moonsKnown: 2,
    orbitSpeedKms: 24.1,
    tempLabel: "-63 °C (média)",
    fact: "Abriga o Olympus Mons, vulcão com 21,9 km de altura — quase 3× o Everest.",
    accent: "#d97757",
    sizeR: 1.05,
    orbitR: 26,
    orbitInclDeg: 1.85,
    tiltDeg: 25.2,
    surface: {
      palette: ["#b5643c", "#c97e52", "#8f4a2c", "#703a22", "#e8d8cc", "#9c5a38"],
      bandFreq: 0, bandTurb: 0, bandAmp: 0,
      noiseScale: 5, noiseAmp: 0.6, ridgeScale: 9, ridgeAmp: 0.4, craterScale: 12, craterAmp: 0.3,
      polarCap: 0.86, atmosColor: "#e0a888", atmosAmp: 0.45,
    },
    moons: [
      {
        id: "phobos",
        name: "Fobos",
        diameterKm: 22,
        distFromPlanetKm: 9376,
        periodDays: 0.319,
        fact: "Orbita tão perto que nasce no oeste e se põe no leste, duas vezes por dia marciano.",
        accent: "#8a7a6a",
        sizeR: 0.13,
        orbitR: 1.9,
        surface: { ...grayCratered, palette: ["#6e6256", "#857968", "#57504a", "#423d38", "#9c9182", "#665e54"] },
      },
      {
        id: "deimos",
        name: "Deimos",
        diameterKm: 12,
        distFromPlanetKm: 23463,
        periodDays: 1.263,
        fact: "Tão pequeno que, de sua superfície, Marte ocuparia 40° do céu.",
        accent: "#9a8a7a",
        sizeR: 0.1,
        orbitR: 2.7,
        surface: { ...grayCratered, palette: ["#7c7060", "#94887a", "#635a4e", "#4d463e", "#aca090", "#736a5e"] },
      },
    ],
  },
  {
    id: "jupiter",
    name: "Júpiter",
    kind: "planet",
    typeLabel: "Gigante gasoso",
    diameterKm: 139820,
    distSunMkm: 778.5,
    distSunAU: 5.2,
    periodDays: 4332.6,
    rotationLabel: "9,9 horas (o mais rápido)",
    moonsKnown: 95,
    orbitSpeedKms: 13.1,
    tempLabel: "-108 °C (topo das nuvens)",
    fact: "A Grande Mancha Vermelha é uma tempestade maior que a Terra, ativa há séculos.",
    accent: "#d8b48a",
    sizeR: 3.2,
    orbitR: 35,
    orbitInclDeg: 1.3,
    tiltDeg: 3.1,
    surface: {
      palette: ["#c8a878", "#e8d0a8", "#a87c50", "#8f6844", "#f0e2c8", "#b89068"],
      bandFreq: 14, bandTurb: 2.6, bandAmp: 0.95,
      noiseScale: 5, noiseAmp: 0.25, ridgeScale: 0, ridgeAmp: 0, craterScale: 0, craterAmp: 0,
      polarCap: 0,
      spot: { latDeg: -22, lonDeg: 35, size: 0.34, color: "#c85a3c" },
      atmosColor: "#e8c8a0", atmosAmp: 0.8,
    },
    moons: [
      {
        id: "io",
        name: "Io",
        diameterKm: 3643,
        distFromPlanetKm: 421700,
        periodDays: 1.769,
        fact: "O corpo mais vulcânico do sistema solar, aquecido pela maré gravitacional de Júpiter.",
        accent: "#e8c85a",
        sizeR: 0.3,
        orbitR: 4.6,
        surface: {
          palette: ["#d8b84c", "#e8d078", "#a8883c", "#8f7030", "#f0e0a0", "#c05a2c"],
          bandFreq: 0, bandTurb: 0, bandAmp: 0,
          noiseScale: 7, noiseAmp: 0.7, ridgeScale: 0, ridgeAmp: 0,
          craterScale: 10, craterAmp: 0.25, polarCap: 0,
          spot: { latDeg: 30, lonDeg: -60, size: 0.22, color: "#b8401c" },
          atmosColor: "#e8c85a", atmosAmp: 0,
        },
      },
      {
        id: "europa",
        name: "Europa",
        diameterKm: 3122,
        distFromPlanetKm: 671034,
        periodDays: 3.551,
        fact: "Sob a crosta de gelo há um oceano global com mais água que todos os oceanos da Terra.",
        accent: "#c8b8a0",
        sizeR: 0.27,
        orbitR: 5.7,
        surface: {
          palette: ["#c9bfae", "#e0d8c8", "#a89880", "#8a7a64", "#f0ead8", "#a86040"],
          bandFreq: 0, bandTurb: 0, bandAmp: 0,
          noiseScale: 4, noiseAmp: 0.3, ridgeScale: 14, ridgeAmp: 0.5, craterScale: 0, craterAmp: 0,
          polarCap: 0, atmosColor: "#c8b8a0", atmosAmp: 0,
        },
      },
      {
        id: "ganymede",
        name: "Ganimedes",
        diameterKm: 5268,
        distFromPlanetKm: 1070412,
        periodDays: 7.155,
        fact: "A maior lua do sistema solar — maior que o planeta Mercúrio.",
        accent: "#a0968a",
        sizeR: 0.36,
        orbitR: 7.0,
        surface: { ...grayCratered, palette: ["#8f8578", "#aca295", "#706860", "#58524a", "#c4bab0", "#7d746a"] },
      },
      {
        id: "callisto",
        name: "Calisto",
        diameterKm: 4821,
        distFromPlanetKm: 1882709,
        periodDays: 16.689,
        fact: "A superfície mais craterada do sistema solar, praticamente intocada há 4 bilhões de anos.",
        accent: "#7d7468",
        sizeR: 0.34,
        orbitR: 8.4,
        surface: { ...grayCratered, palette: ["#6e655a", "#8a8072", "#57504a", "#423e38", "#a09688", "#615a50"] },
      },
    ],
  },
  {
    id: "saturn",
    name: "Saturno",
    kind: "planet",
    typeLabel: "Gigante gasoso",
    diameterKm: 116460,
    distSunMkm: 1433.5,
    distSunAU: 9.58,
    periodDays: 10759,
    rotationLabel: "10,7 horas",
    moonsKnown: 274,
    orbitSpeedKms: 9.7,
    tempLabel: "-139 °C (topo das nuvens)",
    fact: "Tão pouco denso (0,69 g/cm³) que flutuaria numa banheira de água suficientemente grande.",
    accent: "#e8d4a8",
    sizeR: 2.8,
    orbitR: 46,
    orbitInclDeg: 2.49,
    tiltDeg: 26.7,
    ring: { inner: 3.6, outer: 6.4, opacity: 0.96, tint: "#d8c8a8" },
    surface: {
      palette: ["#d8c498", "#f0e2c0", "#c0a878", "#a89060", "#f8f0dc", "#cbb890"],
      bandFreq: 11, bandTurb: 1.6, bandAmp: 0.7,
      noiseScale: 4, noiseAmp: 0.18, ridgeScale: 0, ridgeAmp: 0, craterScale: 0, craterAmp: 0,
      polarCap: 0, atmosColor: "#e8d8b8", atmosAmp: 0.7,
    },
    moons: [
      {
        id: "enceladus",
        name: "Encélado",
        diameterKm: 504,
        distFromPlanetKm: 237948,
        periodDays: 1.37,
        fact: "Lança gêiseres de água salgada pelo polo sul; reflete quase 100% da luz solar.",
        accent: "#e8f0f4",
        sizeR: 0.16,
        orbitR: 4.9,
        surface: {
          palette: ["#dce8ec", "#f0f6f8", "#b8c8d0", "#98aab4", "#ffffff", "#c8d8e0"],
          bandFreq: 0, bandTurb: 0, bandAmp: 0,
          noiseScale: 6, noiseAmp: 0.25, ridgeScale: 10, ridgeAmp: 0.3, craterScale: 8, craterAmp: 0.15,
          polarCap: 0, atmosColor: "#e8f0f4", atmosAmp: 0,
        },
      },
      {
        id: "rhea",
        name: "Reia",
        diameterKm: 1527,
        distFromPlanetKm: 527108,
        periodDays: 4.518,
        fact: "A segunda maior lua de Saturno, feita quase inteiramente de gelo.",
        accent: "#c8c4bc",
        sizeR: 0.2,
        orbitR: 6.1,
        surface: { ...grayCratered, palette: ["#b0aca4", "#c8c4bc", "#8f8b84", "#74706a", "#dcd8d0", "#a09c94"] },
      },
      {
        id: "titan",
        name: "Titã",
        diameterKm: 5150,
        distFromPlanetKm: 1221870,
        periodDays: 15.945,
        fact: "Única lua com atmosfera densa e lagos estáveis de metano líquido na superfície.",
        accent: "#d8a050",
        sizeR: 0.35,
        orbitR: 8.2,
        surface: {
          palette: ["#c89048", "#e0ac60", "#a87838", "#8f6430", "#f0c888", "#b8843c"],
          bandFreq: 3, bandTurb: 1.2, bandAmp: 0.3,
          noiseScale: 5, noiseAmp: 0.4, ridgeScale: 0, ridgeAmp: 0, craterScale: 0, craterAmp: 0,
          polarCap: 0, atmosColor: "#e0ac60", atmosAmp: 1.5,
        },
      },
    ],
  },
  {
    id: "uranus",
    name: "Urano",
    kind: "planet",
    typeLabel: "Gigante de gelo",
    diameterKm: 50724,
    distSunMkm: 2872.5,
    distSunAU: 19.2,
    periodDays: 30687,
    rotationLabel: "17,2 horas (retrógrada)",
    moonsKnown: 28,
    orbitSpeedKms: 6.8,
    tempLabel: "-197 °C",
    fact: "Gira 'deitado': seu eixo é inclinado 98°, provavelmente por uma colisão antiga.",
    accent: "#9fd4d8",
    sizeR: 2.0,
    orbitR: 57,
    orbitInclDeg: 0.77,
    tiltDeg: 97.8,
    ring: { inner: 2.5, outer: 3.1, opacity: 0.3, tint: "#9fb8c0" },
    surface: {
      palette: ["#9fd4d8", "#bce4e6", "#84bcc2", "#6ea8b0", "#d8f0f0", "#8fc8cc"],
      bandFreq: 5, bandTurb: 0.9, bandAmp: 0.35,
      noiseScale: 3, noiseAmp: 0.12, ridgeScale: 0, ridgeAmp: 0, craterScale: 0, craterAmp: 0,
      polarCap: 0, atmosColor: "#bce4e6", atmosAmp: 0.9,
    },
    moons: [
      {
        id: "miranda",
        name: "Miranda",
        diameterKm: 471,
        distFromPlanetKm: 129390,
        periodDays: 1.413,
        fact: "Tem os penhascos mais altos do sistema solar: Verona Rupes, com ~20 km.",
        accent: "#b0aca4",
        sizeR: 0.14,
        orbitR: 3.2,
        surface: { ...grayCratered, ridgeAmp: 0.6 },
      },
      {
        id: "titania",
        name: "Titânia",
        diameterKm: 1578,
        distFromPlanetKm: 435910,
        periodDays: 8.706,
        fact: "Maior lua de Urano, com cânions e falhas que cortam sua crosta gelada.",
        accent: "#a8a29a",
        sizeR: 0.2,
        orbitR: 4.4,
        surface: { ...grayCratered },
      },
      {
        id: "oberon",
        name: "Oberon",
        diameterKm: 1523,
        distFromPlanetKm: 583520,
        periodDays: 13.463,
        fact: "A mais externa das grandes luas de Urano, coberta de crateras com material escuro.",
        accent: "#968f86",
        sizeR: 0.19,
        orbitR: 5.5,
        surface: { ...grayCratered },
      },
    ],
  },
  {
    id: "neptune",
    name: "Netuno",
    kind: "planet",
    typeLabel: "Gigante de gelo",
    diameterKm: 49244,
    distSunMkm: 4495.1,
    distSunAU: 30.05,
    periodDays: 60190,
    rotationLabel: "16,1 horas",
    moonsKnown: 16,
    orbitSpeedKms: 5.4,
    tempLabel: "-201 °C",
    fact: "Ventos supersônicos de até 2.100 km/h — os mais rápidos do sistema solar.",
    accent: "#5b7fd4",
    sizeR: 1.95,
    orbitR: 66,
    orbitInclDeg: 1.77,
    tiltDeg: 28.3,
    surface: {
      palette: ["#3c5cb8", "#5478d0", "#2e4a9c", "#263e88", "#7c9ce0", "#4468c4"],
      bandFreq: 8, bandTurb: 2.2, bandAmp: 0.6,
      noiseScale: 4, noiseAmp: 0.2, ridgeScale: 0, ridgeAmp: 0, craterScale: 0, craterAmp: 0,
      polarCap: 0,
      spot: { latDeg: -28, lonDeg: 60, size: 0.26, color: "#1e3278" },
      atmosColor: "#7c9ce0", atmosAmp: 1.0,
    },
    moons: [
      {
        id: "triton",
        name: "Tritão",
        diameterKm: 2707,
        distFromPlanetKm: 354759,
        periodDays: -5.877,
        fact: "Orbita ao contrário (retrógrado) — provavelmente um objeto capturado do cinturão de Kuiper.",
        accent: "#c8d8e0",
        sizeR: 0.24,
        orbitR: 3.6,
        surface: {
          palette: ["#c8d4dc", "#e4ecf0", "#a8b8c4", "#8fa4b2", "#f4f8fa", "#d8c0b0"],
          bandFreq: 0, bandTurb: 0, bandAmp: 0,
          noiseScale: 6, noiseAmp: 0.35, ridgeScale: 12, ridgeAmp: 0.25, craterScale: 0, craterAmp: 0,
          polarCap: 0.7, atmosColor: "#c8d8e0", atmosAmp: 0.2,
        },
      },
      {
        id: "nereid",
        name: "Nereida",
        diameterKm: 340,
        distFromPlanetKm: 5513400,
        periodDays: 360.14,
        fact: "Uma das órbitas mais excêntricas conhecidas entre luas: de 1,4 a 9,7 milhões de km.",
        accent: "#a8a29a",
        sizeR: 0.13,
        orbitR: 5.4,
        surface: { ...grayCratered },
      },
    ],
  },
];

export const ALL_BODIES: BodyDef[] = [SUN, ...PLANETS];

export function findMoon(id: string): { moon: MoonDef; parent: BodyDef } | null {
  for (const p of PLANETS) {
    for (const m of p.moons) if (m.id === id) return { moon: m, parent: p };
  }
  return null;
}
