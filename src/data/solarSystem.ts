/**
 * SISTEMA SOLAR — dados reais (NASA Planetary Fact Sheets) + parâmetros de
 * shader autorais e perfis de visita em 1ª pessoa por corpo.
 */
import type { WorldClass } from "./catalog";
import type { VisitProfile } from "../three/SurfaceScene";

export interface SurfaceParams {
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
  clouds?: { tint: string; amp: number };
  ring?: { inner: number; outer: number; tint: string; opacity: number };
  spot?: { latDeg: number; lonDeg: number; size: number; color: string };
}

export interface SolarPlanet {
  id: string;
  name: string;
  cls: WorldClass;
  radiusKm: number;
  massEarth: number;
  auDist: number;
  periodDays: number;
  rotLabel: string;
  tiltDeg: number;
  inclDeg: number;
  ecc: number;
  varpiDeg: number;
  tempLabel: string;
  gravity: number;
  moonsKnown: number;
  accent: string;
  note: string;
  surface: SurfaceParams;
}

export interface SolarMoon {
  id: string;
  planetId: string;
  name: string;
  cls: WorldClass;
  radiusKm: number;
  orbitKm: number;
  periodDays: number;
  accent: string;
  note: string;
  surface: SurfaceParams;
}

/* ------------------------------------------------------------ planetas */

export const SOLAR_PLANETS: SolarPlanet[] = [
  {
    id: "mercury", name: "Mercúrio", cls: "desert",
    radiusKm: 2439.7, massEarth: 0.055, auDist: 0.387, periodDays: 87.97,
    rotLabel: "58,6 dias", tiltDeg: 0.03, inclDeg: 7.0, ecc: 0.2056, varpiDeg: 77,
    tempLabel: "167 °C (média)", gravity: 3.7, moonsKnown: 0, accent: "#b8a894",
    note: "O menor planeta e o mais próximo do Sol. Um ano dura 88 dias, mas um dia solar dura 176 dias terrestres.",
    surface: {
      palette: ["#8a8378", "#6e675c", "#a39a8c", "#544d43", "#d8d2c8", "#000000"],
      bandFreq: 2, bandTurb: 0, bandAmp: 0, noiseScale: 5, noiseAmp: 0.5,
      ridgeScale: 9, ridgeAmp: 0.25, craterScale: 14, craterAmp: 0.55, polarCap: 0,
      atmosColor: "#9a9088", atmosAmp: 0.06, glow: 0, spec: 0,
    },
  },
  {
    id: "venus", name: "Vênus", cls: "lava",
    radiusKm: 6051.8, massEarth: 0.815, auDist: 0.723, periodDays: 224.7,
    rotLabel: "243 dias (retrógrada)", tiltDeg: 177.4, inclDeg: 3.4, ecc: 0.0068, varpiDeg: 131,
    tempLabel: "464 °C", gravity: 8.87, moonsKnown: 0, accent: "#e8c890",
    note: "O planeta mais quente: 92 atmosferas de CO₂ criam um efeito estufa descontrolado. Gira ao contrário do resto do sistema.",
    surface: {
      palette: ["#c9a05e", "#b08948", "#e0bd80", "#8a6838", "#f0d8a8", "#000000"],
      bandFreq: 6, bandTurb: 2.5, bandAmp: 0.25, noiseScale: 3.5, noiseAmp: 0.4,
      ridgeScale: 0, ridgeAmp: 0, craterScale: 0, craterAmp: 0, polarCap: 0,
      atmosColor: "#f0d090", atmosAmp: 0.55, glow: 0, spec: 0,
      clouds: { tint: "#e8c890", amp: 0.9 },
    },
  },
  {
    id: "earth", name: "Terra", cls: "temperate",
    radiusKm: 6371, massEarth: 1, auDist: 1.0, periodDays: 365.26,
    rotLabel: "23,9 horas", tiltDeg: 23.4, inclDeg: 0.0, ecc: 0.0167, varpiDeg: 103,
    tempLabel: "15 °C", gravity: 9.81, moonsKnown: 1, accent: "#5fd08a",
    note: "O único mundo conhecido com vida — e com oceanos líquidos estáveis cobrindo 71% da superfície.",
    surface: {
      palette: ["#0a3f7a", "#1a5fa8", "#2e7a4a", "#8a7a4a", "#f0f4f8", "#c8a05a"],
      bandFreq: 0, bandTurb: 0, bandAmp: 0, noiseScale: 3.2, noiseAmp: 0,
      ridgeScale: 0, ridgeAmp: 0, craterScale: 0, craterAmp: 0, polarCap: 0,
      atmosColor: "#6ab0ff", atmosAmp: 0.5, glow: 0, spec: 0, earthLike: true,
      clouds: { tint: "#ffffff", amp: 0.8 },
    },
  },
  {
    id: "mars", name: "Marte", cls: "desert",
    radiusKm: 3389.5, massEarth: 0.107, auDist: 1.524, periodDays: 686.98,
    rotLabel: "24,6 horas", tiltDeg: 25.2, inclDeg: 1.9, ecc: 0.0934, varpiDeg: 336,
    tempLabel: "−63 °C", gravity: 3.71, moonsKnown: 2, accent: "#d96a4a",
    note: "O mundo mais explorado por robôs. Tem o maior vulcão do sistema solar (Olympus Mons, 22 km) e gelo nos polos.",
    surface: {
      palette: ["#b06a3f", "#8a4f2e", "#c98a5a", "#5e3018", "#e8dcc8", "#7a4020"],
      bandFreq: 3, bandTurb: 0.6, bandAmp: 0.12, noiseScale: 4.5, noiseAmp: 0.5,
      ridgeScale: 7, ridgeAmp: 0.3, craterScale: 10, craterAmp: 0.3, polarCap: 0.86,
      atmosColor: "#e0a070", atmosAmp: 0.28, glow: 0, spec: 0,
    },
  },
  {
    id: "jupiter", name: "Júpiter", cls: "gas-giant",
    radiusKm: 69911, massEarth: 317.8, auDist: 5.203, periodDays: 4332.6,
    rotLabel: "9,9 horas", tiltDeg: 3.1, inclDeg: 1.3, ecc: 0.0489, varpiDeg: 14,
    tempLabel: "−108 °C", gravity: 24.79, moonsKnown: 95, accent: "#e8c890",
    note: "O gigante: 2,5× a massa de todos os outros planetas juntos. A Grande Mancha Vermelha é uma tempestade maior que a Terra.",
    surface: {
      palette: ["#d8b48a", "#a87850", "#f0dcc0", "#8a5a38", "#e8d0b0", "#c89060"],
      bandFreq: 14, bandTurb: 2.2, bandAmp: 0.85, noiseScale: 6, noiseAmp: 0.3,
      ridgeScale: 0, ridgeAmp: 0, craterScale: 0, craterAmp: 0, polarCap: 0,
      atmosColor: "#f0d8b0", atmosAmp: 0.4, glow: 0, spec: 0,
      spot: { latDeg: -22, lonDeg: 40, size: 0.34, color: "#c05030" },
    },
  },
  {
    id: "saturn", name: "Saturno", cls: "gas-giant",
    radiusKm: 58232, massEarth: 95.2, auDist: 9.537, periodDays: 10759,
    rotLabel: "10,7 horas", tiltDeg: 26.7, inclDeg: 2.5, ecc: 0.0565, varpiDeg: 93,
    tempLabel: "−139 °C", gravity: 10.44, moonsKnown: 146, accent: "#e8d0a0",
    note: "Famoso pelos anéis de gelo com 280 mil km de largura e apenas ~10 m de espessura em alguns trechos.",
    surface: {
      palette: ["#d8c498", "#b8a070", "#f0e0b8", "#9a8050", "#e8d8b0", "#c8b080"],
      bandFreq: 11, bandTurb: 1.4, bandAmp: 0.6, noiseScale: 5, noiseAmp: 0.25,
      ridgeScale: 0, ridgeAmp: 0, craterScale: 0, craterAmp: 0, polarCap: 0,
      atmosColor: "#f0e0b8", atmosAmp: 0.35, glow: 0, spec: 0,
      ring: { inner: 1.25, outer: 2.35, tint: "#d8c8a8", opacity: 0.92 },
    },
  },
  {
    id: "uranus", name: "Urano", cls: "mini-neptune",
    radiusKm: 25362, massEarth: 14.5, auDist: 19.19, periodDays: 30688,
    rotLabel: "17,2 h (retrógrada)", tiltDeg: 97.8, inclDeg: 0.8, ecc: 0.0457, varpiDeg: 173,
    tempLabel: "−197 °C", gravity: 8.87, moonsKnown: 28, accent: "#9fd8d8",
    note: "O planeta 'deitado': o eixo inclina 98°, então cada polo tem 42 anos de dia seguidos. O metano dá a cor azul-esverdeada.",
    surface: {
      palette: ["#9fd0d4", "#7fb8c0", "#b8e0e4", "#6aa0a8", "#d0ecef", "#8fc8cc"],
      bandFreq: 5, bandTurb: 0.8, bandAmp: 0.18, noiseScale: 3, noiseAmp: 0.15,
      ridgeScale: 0, ridgeAmp: 0, craterScale: 0, craterAmp: 0, polarCap: 0,
      atmosColor: "#a8e0e8", atmosAmp: 0.5, glow: 0, spec: 0,
      ring: { inner: 1.6, outer: 1.95, tint: "#8aa8b0", opacity: 0.3 },
    },
  },
  {
    id: "neptune", name: "Netuno", cls: "mini-neptune",
    radiusKm: 24622, massEarth: 17.1, auDist: 30.07, periodDays: 60182,
    rotLabel: "16,1 horas", tiltDeg: 28.3, inclDeg: 1.8, ecc: 0.0113, varpiDeg: 48,
    tempLabel: "−201 °C", gravity: 11.15, moonsKnown: 16, accent: "#5b8be8",
    note: "Os ventos mais rápidos do sistema solar: 2.100 km/h. Foi descoberto pela matemática, antes do telescópio.",
    surface: {
      palette: ["#3a5fc0", "#2a48a0", "#5a80d8", "#1e3580", "#7aa0e8", "#4a6cc8"],
      bandFreq: 7, bandTurb: 1.6, bandAmp: 0.35, noiseScale: 4, noiseAmp: 0.25,
      ridgeScale: 0, ridgeAmp: 0, craterScale: 0, craterAmp: 0, polarCap: 0,
      atmosColor: "#6a90e8", atmosAmp: 0.5, glow: 0, spec: 0,
      spot: { latDeg: -28, lonDeg: 100, size: 0.26, color: "#1a2a60" },
    },
  },
];

/* ------------------------------------------------------------ luas */

const M = (
  id: string, planetId: string, name: string, radiusKm: number, orbitKm: number,
  periodDays: number, accent: string, note: string, surface: SurfaceParams,
  cls: WorldClass = "desert"
): SolarMoon => ({ id, planetId, name, cls, radiusKm, orbitKm, periodDays, accent, note, surface });

const CRATERS = (base: string, mid: string, dark: string, craterAmp: number): SurfaceParams => ({
  palette: [base, mid, dark, dark, "#e8e4dc", "#000000"],
  bandFreq: 0, bandTurb: 0, bandAmp: 0, noiseScale: 5, noiseAmp: 0.4,
  ridgeScale: 8, ridgeAmp: 0.15, craterScale: 16, craterAmp, polarCap: 0,
  atmosColor: "#888888", atmosAmp: 0, glow: 0, spec: 0,
});

export const SOLAR_MOONS: SolarMoon[] = [
  M("moon", "earth", "Lua", 1737.4, 384400, 27.32, "#c8c4bc",
    "Única lua da Terra. Suas marés estabilizam o eixo do planeta — sem ela, o clima seria caótico.",
    { ...CRATERS("#9a968e", "#b8b4ac", "#6a665e", 0.6), spec: 0 }),
  M("phobos", "mars", "Fobos", 11.3, 9376, 0.319, "#8a7a6a",
    "Tão perto de Marte que nasce duas vezes por dia no céu marciano. Está se aproximando e deve se desintegrar em ~50 milhões de anos.",
    CRATERS("#6e6254", "#8a7e6e", "#4a4238", 0.7)),
  M("deimos", "mars", "Deimos", 6.2, 23463, 1.263, "#96887a",
    "A menor lua de Marte: 6 km de raio. Do céu marciano parece uma estrela brilhante, não um disco.",
    CRATERS("#7e7264", "#968a7c", "#564e42", 0.6)),
  M("io", "jupiter", "Io", 1821.6, 421700, 1.769, "#e8d05a",
    "O corpo mais vulcanicamente ativo do sistema solar: 400 vulcões ativos, alimentados pelas marés de Júpiter.",
    { palette: ["#d8c050", "#b89830", "#f0e070", "#8a6a20", "#f8f0a0", "#c85a20"],
      bandFreq: 0, bandTurb: 0, bandAmp: 0, noiseScale: 6, noiseAmp: 0.55,
      ridgeScale: 10, ridgeAmp: 0.3, craterScale: 12, craterAmp: 0.25, polarCap: 0,
      atmosColor: "#e8d870", atmosAmp: 0.1, glow: 0.45, spec: 0 }, "lava"),
  M("europa", "jupiter", "Europa", 1560.8, 671034, 3.551, "#d8d4c8",
    "Sob a crosta de gelo há um oceano global com o dobro da água da Terra — o principal alvo na busca por vida.",
    { palette: ["#c8c0b0", "#a89880", "#e8e0d0", "#8a6850", "#f4f0e8", "#a05838"],
      bandFreq: 0, bandTurb: 0, bandAmp: 0, noiseScale: 4, noiseAmp: 0.2,
      ridgeScale: 12, ridgeAmp: 0.45, craterScale: 8, craterAmp: 0.1, polarCap: 0,
      atmosColor: "#e8e0d8", atmosAmp: 0.08, glow: 0, spec: 0.35 }, "ocean"),
  M("ganymede", "jupiter", "Ganimedes", 2634.1, 1070400, 7.155, "#a89a88",
    "A maior lua do sistema solar — maior que o planeta Mercúrio. É a única lua com campo magnético próprio.",
    CRATERS("#8a8070", "#a89a88", "#5e564a", 0.45)),
  M("callisto", "jupiter", "Calisto", 2410.3, 1882700, 16.69, "#7a7062",
    "A superfície mais craterada do sistema solar: cada centímetro conta 4 bilhões de anos de impactos.",
    CRATERS("#665e50", "#7a7062", "#453e34", 0.75)),
  M("enceladus", "saturn", "Encélado", 252.1, 237948, 1.37, "#e8f0f4",
    "Gêiseres de água salgada jorram do polo sul através de fraturas chamadas 'listras de tigre'.",
    { ...CRATERS("#d8e4ec", "#f0f6fa", "#a8bcc8", 0.3), spec: 0.5 }, "ocean"),
  M("rhea", "saturn", "Reia", 763.8, 527108, 4.518, "#c8c8c4",
    "A segunda maior lua de Saturno, feita de 75% de gelo. Pode ter um tênue anel próprio.",
    CRATERS("#b0b0ac", "#c8c8c4", "#84847e", 0.5)),
  M("titan", "saturn", "Titã", 2574.7, 1221870, 15.95, "#e8a558",
    "A única lua com atmosfera densa (1,5× a da Terra) e líquidos na superfície — rios e lagos de metano.",
    { palette: ["#c08840", "#a06e2c", "#e0a858", "#7a5218", "#f0c878", "#8a5c20"],
      bandFreq: 4, bandTurb: 1.5, bandAmp: 0.2, noiseScale: 4, noiseAmp: 0.35,
      ridgeScale: 6, ridgeAmp: 0.15, craterScale: 0, craterAmp: 0, polarCap: 0,
      atmosColor: "#e8a858", atmosAmp: 0.6, glow: 0, spec: 0.2,
      clouds: { tint: "#e0a050", amp: 0.55 } }, "hycean"),
  M("miranda", "uranus", "Miranda", 235.8, 129390, 1.413, "#b8b4b0",
    "O terreno mais estranho do sistema solar: penhascos de 20 km e um 'V' gigante chamado Verona Rupes.",
    CRATERS("#a09c98", "#b8b4b0", "#706c68", 0.5)),
  M("titania", "uranus", "Titânia", 788.4, 435910, 8.706, "#a8a0a0",
    "A maior lua de Urano, com cânions e escarpas que indicam que o interior já expandiu.",
    CRATERS("#8e8686", "#a8a0a0", "#5e5858", 0.45)),
  M("oberon", "uranus", "Oberon", 761.4, 583520, 13.46, "#9a9494",
    "A mais externa das grandes luas de Urano; suas crateras têm fundos escuros misteriosos.",
    CRATERS("#847e7e", "#9a9494", "#565252", 0.5)),
  M("triton", "neptune", "Tritão", 1353.4, 354759, -5.877, "#d8c8c0",
    "Órbita retrógrada — um objeto capturado do cinturão de Kuiper. Tem gêiseres de nitrogênio ativos.",
    { palette: ["#d8c8c0", "#b8a8a0", "#f0e8e0", "#8a7870", "#f8f4f0", "#c09888"],
      bandFreq: 0, bandTurb: 0, bandAmp: 0, noiseScale: 5, noiseAmp: 0.35,
      ridgeScale: 9, ridgeAmp: 0.2, craterScale: 11, craterAmp: 0.3, polarCap: 0.78,
      atmosColor: "#e8d8d0", atmosAmp: 0.1, glow: 0, spec: 0.25 }, "ocean"),
  M("nereid", "neptune", "Nereida", 170, 5513400, 360.13, "#8a847c",
    "A órbita mais excêntrica entre as luas: vai de 1,4 a 9,7 milhões de km de Netuno.",
    CRATERS("#76706a", "#8a847c", "#4e4a44", 0.55)),
];

/* ------------------------------------------------------------ meta */

export const SOLAR_STAR = {
  name: "Sol",
  spectral: { type: "G2V", tempK: 5772, massSun: 1, radiusSun: 1, luminositySun: 1, color: "#ffcc66", metallicity: 0 },
  distLy: 0,
  ageGyr: 4.6,
  highlight:
    "Nossa estrela contém 99,86% de toda a massa do sistema. A luz que chega à Terra tem 8 minutos; a de Netuno, 4 horas.",
  note: "Anã amarela G2V na sequência principal. Queima 600 milhões de toneladas de hidrogênio por segundo.",
  radiusKm: 696340,
};

export const SOLAR_SYSTEM_ID = "solar";

export const SOLAR_SYSTEM_META = {
  id: SOLAR_SYSTEM_ID,
  starName: "Sistema Solar",
  distLy: 0,
  spectral: SOLAR_STAR.spectral,
  ageGyr: 4.6,
  highlight: SOLAR_STAR.highlight,
  planets: SOLAR_PLANETS.length,
  habitable: 1,
};

/* ------------------------------------------------------------ perfis de visita */

type VisitPartial = Partial<VisitProfile>;

const baseVisit = (over: VisitPartial): VisitPartial => ({
  skyTop: "#05060c",
  skyHorizon: "#14161e",
  sunColor: "#fff6e0",
  starDensity: 0.85,
  cloudSea: false,
  seaColorA: "#123048",
  seaColorB: "#1e4a68",
  terrainBase: "#8a8378",
  terrainMid: "#a39a8c",
  terrainDark: "#544d43",
  rockA: "#5e564a",
  rockB: "#8a8378",
  fogColor: "#0a0c12",
  fogDensity: 0,
  terrainAmp: 3.2,
  glowVeins: 0,
  sparkle: 0.15,
  rocks: 120,
  gravity: 9.81,
  sunAngularDeg: 0.53,
  notes: [],
  ...over,
});

export const SOLAR_VISITS: Record<string, VisitProfile> = {
  mercury: baseVisit({
    skyTop: "#000002", skyHorizon: "#05050a", sunColor: "#fff4d8", starDensity: 1,
    terrainBase: "#8a8378", terrainMid: "#a39a8c", terrainDark: "#4a443c",
    rockA: "#5e564a", rockB: "#8a8378", fogDensity: 0, terrainAmp: 2.6, sparkle: 0.4,
    rocks: 160, gravity: 3.7, sunAngularDeg: 1.4,
    notes: [
      "Céu negro absoluto mesmo ao meio-dia — não há atmosfera para espalhar luz.",
      "O Sol tem quase 3× o diâmetro visto da Terra e castiga o solo a 427 °C.",
      "Sombras de borda cortante; sem ar, cada rocha parece recortada a laser.",
    ],
  }) as VisitProfile,
  venus: baseVisit({
    skyTop: "#b8945a", skyHorizon: "#e0b878", sunColor: "#ffdca0", starDensity: 0,
    terrainBase: "#3e362e", terrainMid: "#55493c", terrainDark: "#241f19",
    rockA: "#2e2820", rockB: "#4a4038", fogColor: "#c8a060", fogDensity: 0.022,
    terrainAmp: 2.2, sparkle: 0, rocks: 140, gravity: 8.87, sunAngularDeg: 0.02,
    notes: [
      "O Sol é invisível: só um clarear âmbar difuso nas nuvens de ácido sulfúrico.",
      "Fotos da Venera 13 mostram rochas basálticas sob um céu butterscotch.",
      "92 atm de pressão — como estar a 900 m de profundidade no oceano.",
    ],
  }) as VisitProfile,
  earth: baseVisit({
    skyTop: "#2a5fc4", skyHorizon: "#b8d8f0", sunColor: "#fffdf4", starDensity: 0,
    terrainBase: "#3a6a30", terrainMid: "#7a9a4a", terrainDark: "#24401c",
    rockA: "#4e4a42", rockB: "#7a7268", fogColor: "#c8d8e8", fogDensity: 0.0025,
    terrainAmp: 4.5, sparkle: 0, rocks: 90, gravity: 9.81, sunAngularDeg: 0.53,
    notes: [
      "O céu azul é espalhamento de Rayleigh — a luz azul se espalha mais no ar.",
      "Único lugar conhecido do universo onde alguém já pisou.",
    ],
  }) as VisitProfile,
  mars: baseVisit({
    skyTop: "#4c3322", skyHorizon: "#cf9a66", sunColor: "#f5e8d0", starDensity: 0.12,
    terrainBase: "#c1512a", terrainMid: "#8a4a26", terrainDark: "#5e3018",
    rockA: "#6e3a20", rockB: "#a45c34", fogColor: "#c08a58", fogDensity: 0.0038,
    terrainAmp: 2.8, sparkle: 0.05, rocks: 190, gravity: 3.71, sunAngularDeg: 0.35,
    notes: [
      "Céu caramelo pela poeira de óxido de ferro suspensa; pôr do sol azulado.",
      "Olympus Mons tem 22 km — quase 3× o Everest.",
    ],
  }) as VisitProfile,
  jupiter: baseVisit({
    cloudSea: true, seaColorA: "#c89868", seaColorB: "#e8c898",
    skyTop: "#3a2a1a", skyHorizon: "#c8a878", sunColor: "#fff8e8", starDensity: 0,
    fogColor: "#c8a878", fogDensity: 0, terrainAmp: 5, gravity: 24.79, sunAngularDeg: 0.1,
    bands: { amp: 0.5, scale: 5.5, colorA: "#e8d0a8", colorB: "#a87848" },
    notes: [
      "O Sol é um ponto 5× menor que na Terra, porém 27× mais brilhante que a Lua cheia.",
      "Você flutua sobre um oceano de nuvens de amônia em faixas que derivam.",
    ],
  }) as VisitProfile,
  saturn: baseVisit({
    cloudSea: true, seaColorA: "#d0b488", seaColorB: "#f0dcb0",
    skyTop: "#4a3a22", skyHorizon: "#e0c898", sunColor: "#fff6dd", starDensity: 0,
    fogColor: "#e0c898", fogDensity: 0, terrainAmp: 4.5, gravity: 10.44, sunAngularDeg: 0.056,
    bands: { amp: 0.34, scale: 4.4, colorA: "#eedcb0", colorB: "#c3a26b" },
    notes: [
      "O Sol é um disco 10× menor que o visto da Terra, ainda ofuscante.",
      "Daqui os anéis aparecem como um arco dourado cruzando o céu.",
    ],
  }) as VisitProfile,
  uranus: baseVisit({
    cloudSea: true, seaColorA: "#8ac8cc", seaColorB: "#b8e4e8",
    skyTop: "#1a4a52", skyHorizon: "#9fd8dc", sunColor: "#f4ffff", starDensity: 0,
    fogColor: "#9fd8dc", fogDensity: 0, terrainAmp: 4, gravity: 8.87, sunAngularDeg: 0.028,
    bands: { amp: 0.1, scale: 3, colorA: "#c2f0f2", colorB: "#8fd6da" },
    notes: ["Céu aqua quase sem feições; o Sol é uma estrela ofuscante, 20× menor.", "Cada polo tem 42 anos de luz contínua."],
  }) as VisitProfile,
  neptune: baseVisit({
    cloudSea: true, seaColorA: "#3a5fc0", seaColorB: "#6a90e8",
    skyTop: "#0c1a4a", skyHorizon: "#4a70d0", sunColor: "#f2f6ff", starDensity: 0,
    fogColor: "#4a70d0", fogDensity: 0, terrainAmp: 4, gravity: 11.15, sunAngularDeg: 0.018,
    bands: { amp: 0.22, scale: 4.2, colorA: "#82b2ff", colorB: "#3a66d8" },
    notes: ["Azul profundo com tênues cirros; ventos de 2.100 km/h varrem as nuvens.", "O Sol é um farol puntual 30× mais fraco."],
  }) as VisitProfile,

  moon: baseVisit({
    skyTop: "#000002", skyHorizon: "#05050a", starDensity: 1, sparkle: 0.9,
    terrainBase: "#9a968e", terrainMid: "#b8b4ac", terrainDark: "#5e5a52",
    rockA: "#56524a", rockB: "#8a867e", fogDensity: 0, terrainAmp: 2.4, rocks: 150,
    gravity: 1.62, sunAngularDeg: 0.53,
    notes: [
      "Regolito cinza que cintila como vidro moído sob o Sol (fotos Apollo).",
      "A Terra nasce 4× maior que a Lua cheia — e nunca muda de lugar no céu.",
    ],
  }) as VisitProfile,
  io: baseVisit({
    skyTop: "#000003", skyHorizon: "#0a0a10", starDensity: 0.9,
    terrainBase: "#d8c050", terrainMid: "#f0e070", terrainDark: "#8a6a20",
    rockA: "#a06020", rockB: "#e0c050", fogDensity: 0, terrainAmp: 3.6, glowVeins: 0.5,
    rocks: 110, gravity: 1.8, sunAngularDeg: 0.1,
    notes: [
      "Planícies de enxofre amarelo, vermelho e branco — o mundo mais vulcânico conhecido.",
      "Júpiter domina o horizonte, 20× maior que a Lua cheia, sempre no mesmo ponto.",
    ],
  }) as VisitProfile,
  europa: baseVisit({
    skyTop: "#000003", skyHorizon: "#08080e", starDensity: 0.95, sparkle: 0.8,
    terrainBase: "#c8c0b0", terrainMid: "#e8e0d0", terrainDark: "#8a7a68",
    rockA: "#8a6850", rockB: "#d8cfc0", fogDensity: 0, terrainAmp: 1.8, rocks: 40,
    gravity: 1.31, sunAngularDeg: 0.09,
    notes: [
      "Gelo rachado por 'linhas' avermelhadas — fracturas do oceano global abaixo.",
      "Júpiter paira gigante no céu; sob o gelo, o oceano tem 2× a água da Terra.",
    ],
  }) as VisitProfile,
  ganymede: baseVisit({
    skyTop: "#000003", skyHorizon: "#08080e", starDensity: 0.9,
    terrainBase: "#8a8070", terrainMid: "#a89a88", terrainDark: "#5e564a",
    rockA: "#4e4840", rockB: "#8a8070", fogDensity: 0, terrainAmp: 2.6, rocks: 130,
    gravity: 1.43, sunAngularDeg: 0.09,
    notes: ["Terreno claro jovem e escuro antigo — a maior lua do sistema solar.", "Única lua com campo magnético: auroras tênues possíveis."],
  }) as VisitProfile,
  callisto: baseVisit({
    skyTop: "#000003", skyHorizon: "#08080e", starDensity: 0.9,
    terrainBase: "#665e50", terrainMid: "#7a7062", terrainDark: "#453e34",
    rockA: "#3a342c", rockB: "#665e50", fogDensity: 0, terrainAmp: 2.4, rocks: 170,
    gravity: 1.24, sunAngularDeg: 0.085,
    notes: ["A superfície mais craterada do sistema solar — um registro de 4 bilhões de anos.", "Crateras de impacto em todos os tamanhos, sem geologia para apagá-las."],
  }) as VisitProfile,
  enceladus: baseVisit({
    skyTop: "#000004", skyHorizon: "#0a0a12", starDensity: 1, sparkle: 1,
    terrainBase: "#d8e4ec", terrainMid: "#f0f6fa", terrainDark: "#a8bcc8",
    rockA: "#a0b4c0", rockB: "#e8f0f4", fogDensity: 0, terrainAmp: 1.6, rocks: 60,
    gravity: 0.113, sunAngularDeg: 0.035,
    notes: [
      "O solo mais reflexivo do sistema solar: quase 100% da luz é devolvida.",
      "Gêiseres de água salgada jorram no polo sul — visíveis contra o céu negro.",
    ],
  }) as VisitProfile,
  rhea: baseVisit({
    skyTop: "#000004", skyHorizon: "#0a0a12", starDensity: 1, sparkle: 0.7,
    terrainBase: "#b0b0ac", terrainMid: "#c8c8c4", terrainDark: "#84847e",
    rockA: "#787872", rockB: "#b0b0ac", fogDensity: 0, terrainAmp: 2.2, rocks: 120,
    gravity: 0.264, sunAngularDeg: 0.053,
    notes: ["Gelo antigo e craterado; Saturno aparece gigante no céu.", "Pode haver um tênue anel de poeira ao redor da própria lua."],
  }) as VisitProfile,
  titan: baseVisit({
    skyTop: "#a06a24", skyHorizon: "#e0a050", sunColor: "#ffd9a0", starDensity: 0,
    terrainBase: "#4a3620", terrainMid: "#5e4830", terrainDark: "#30220f",
    rockA: "#3a2c18", rockB: "#5e4830", fogColor: "#c88c40", fogDensity: 0.014,
    terrainAmp: 1.8, sparkle: 0, rocks: 80, gravity: 1.35, sunAngularDeg: 0.056,
    bands: { amp: 0.3, scale: 2.7, colorA: "#eda452", colorB: "#9c6420" },
    notes: [
      "Smog laranja espesso — o Sol é um disco difuso e baço (foto da Huygens).",
      "Rios e lagos de metano líquido; 'neve' orgânica cai devagar na gravidade baixa.",
    ],
  }) as VisitProfile,
  miranda: baseVisit({
    skyTop: "#000004", skyHorizon: "#0a0a12", starDensity: 1,
    terrainBase: "#a09c98", terrainMid: "#b8b4b0", terrainDark: "#706c68",
    rockA: "#66625e", rockB: "#a09c98", fogDensity: 0, terrainAmp: 4.2, rocks: 100,
    gravity: 0.079, sunAngularDeg: 0.026,
    notes: ["Penhascos de até 20 km — Verona Rupes, o despenhadeiro mais alto conhecido.", "Terreno em 'colcha de retalhos': parece ter se despedaçado e se remontado."],
  }) as VisitProfile,
  titania: baseVisit({
    skyTop: "#000004", skyHorizon: "#0a0a12", starDensity: 1,
    terrainBase: "#8e8686", terrainMid: "#a8a0a0", terrainDark: "#5e5858",
    rockA: "#544e4e", rockB: "#8e8686", fogDensity: 0, terrainAmp: 3, rocks: 110,
    gravity: 0.37, sunAngularDeg: 0.026,
    notes: ["Cânions e escarpas que cruzam a lua inteira.", "Urano aparece azul-esverdeado, com os anéis na vertical."],
  }) as VisitProfile,
  oberon: baseVisit({
    skyTop: "#000004", skyHorizon: "#0a0a12", starDensity: 1,
    terrainBase: "#847e7e", terrainMid: "#9a9494", terrainDark: "#565252",
    rockA: "#4c4848", rockB: "#847e7e", fogDensity: 0, terrainAmp: 3, rocks: 130,
    gravity: 0.35, sunAngularDeg: 0.026,
    notes: ["Crateras com fundos escuros — talvez material expelido do interior.", "A mais fria e distante das grandes luas de Urano."],
  }) as VisitProfile,
  triton: baseVisit({
    skyTop: "#05040a", skyHorizon: "#1c1418", starDensity: 1, sparkle: 0.8,
    terrainBase: "#d8c8c0", terrainMid: "#f0e8e0", terrainDark: "#a89888",
    rockA: "#9a8880", rockB: "#d8c8c0", fogDensity: 0, terrainAmp: 1.4, rocks: 50,
    gravity: 0.78, sunAngularDeg: 0.018,
    notes: [
      "Gelo de nitrogênio rosado; o Sol é um ponto minúsculo, 900× mais fraco que na Terra.",
      "Gêiseres escuros sobem 8 km e o vento os inclina em penachos visíveis.",
    ],
  }) as VisitProfile,
  nereid: baseVisit({
    skyTop: "#000004", skyHorizon: "#0a0a12", starDensity: 1,
    terrainBase: "#76706a", terrainMid: "#8a847c", terrainDark: "#4e4a44",
    rockA: "#44403a", rockB: "#76706a", fogDensity: 0, terrainAmp: 2.8, rocks: 90,
    gravity: 0.071, sunAngularDeg: 0.017,
    notes: ["Órbita tão excêntrica que Netuno muda 7× de tamanho no céu ao longo do ano.", "Provavelmente um objeto capturado do cinturão de Kuiper."],
  }) as VisitProfile,
  phobos: baseVisit({
    skyTop: "#000003", skyHorizon: "#08080e", starDensity: 0.9,
    terrainBase: "#6e6254", terrainMid: "#8a7e6e", terrainDark: "#4a4238",
    rockA: "#3e382e", rockB: "#6e6254", fogDensity: 0, terrainAmp: 3.4, rocks: 160,
    gravity: 0.0057, sunAngularDeg: 0.35,
    notes: [
      "Marte preenche um quarto do céu — nasce duas vezes por dia, em 4h15 de órbita.",
      "Gravidade ínfima: um salto daqui escaparia da lua.",
    ],
  }) as VisitProfile,
  deimos: baseVisit({
    skyTop: "#000003", skyHorizon: "#08080e", starDensity: 0.9,
    terrainBase: "#7e7264", terrainMid: "#968a7c", terrainDark: "#564e42",
    rockA: "#4a4438", rockB: "#7e7264", fogDensity: 0, terrainAmp: 2.6, rocks: 120,
    gravity: 0.003, sunAngularDeg: 0.35,
    notes: ["Marte aparece 20× menor que Fobos, mas ainda 100× maior que a Lua cheia.", "Solo de regolito fofo com crateras rasas e suaves."],
  }) as VisitProfile,
};

export const solarVisitFor = (id: string): VisitProfile | null => SOLAR_VISITS[id] ?? null;

export const moonPlanet = (moonId: string) => {
  const m = SOLAR_MOONS.find((x) => x.id === moonId);
  return m ? SOLAR_PLANETS.find((p) => p.id === m.planetId) ?? null : null;
};
