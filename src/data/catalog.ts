/**
 * ATLAS DE MUNDOS — catálogo consolidado a partir de:
 *  • Habitable Worlds Catalog (PHL @ UPR Arecibo)
 *  • Open Exoplanet Catalogue (XML systems — Hannu Rein et al.)
 *  • NASA Exoplanet Archive
 *
 * Campos OEC preservados: método e ano de descoberta, excentricidade,
 * metalicidade estelar [Fe/H], classe do mundo e notas científicas.
 */

export type WorldClass =
  | "temperate"
  | "desert"
  | "lava"
  | "ocean"
  | "hycean"
  | "super-earth"
  | "mini-neptune"
  | "hot-jupiter"
  | "gas-giant"
  | "imaged-giant"
  | "pulsar-world";

export const CLASS_META: Record<WorldClass, { label: string; color: string }> = {
  temperate: { label: "Temperado", color: "#5fd08a" },
  desert: { label: "Desértico", color: "#d9a05b" },
  lava: { label: "Mundo de lava", color: "#ff6a3d" },
  ocean: { label: "Candidato a oceano", color: "#5bb8ff" },
  hycean: { label: "Hycean", color: "#7fd4d0" },
  "super-earth": { label: "Super-Terra", color: "#b8d08a" },
  "mini-neptune": { label: "Mini-Netuno", color: "#8fb8e8" },
  "hot-jupiter": { label: "Júpiter quente", color: "#ffb04d" },
  "gas-giant": { label: "Gigante gasoso", color: "#e8c890" },
  "imaged-giant": { label: "Gigante imageado", color: "#f0d8a8" },
  "pulsar-world": { label: "Mundo de pulsar", color: "#b09bff" },
};

export type DiscoveryMethod =
  | "Trânsito"
  | "Velocidade radial"
  | "Imageamento direto"
  | "Pulsar timing";

export interface ExoPlanet {
  id: string;
  name: string;
  cls: WorldClass;
  radiusEarth: number;
  massEarth?: number;
  periodDays: number;
  ecc?: number;
  fluxEarth?: number;
  teqK?: number;
  method: DiscoveryMethod;
  year: number;
  note: string;
  habitable?: boolean;
}

export interface StarSpec {
  type: string;
  tempK: number;
  massSun: number;
  radiusSun: number;
  luminositySun: number;
  color: string;
  metallicity?: number;
}

export interface ExoSystem {
  id: string;
  starName: string;
  distLy: number;
  spectral: StarSpec;
  kind?: "pulsar";
  ageGyr?: number;
  highlight: string;
  planets: ExoPlanet[];
}

/* ------------------------------------------------------------ helpers */

export const fmtNum = (v: number, dec = 2) =>
  v.toLocaleString("pt-BR", { maximumFractionDigits: dec, minimumFractionDigits: 0 });
export const fmtInt = (v: number) => Math.round(v).toLocaleString("pt-BR");

/** 3ª lei de Kepler: a³ = P²·M★  (UA, dias, massas solares) */
export const semiMajorAxisAU = (periodDays: number, massSun: number) =>
  Math.cbrt(Math.pow(Math.max(periodDays, 0.01) / 365.25, 2) * Math.max(massSun, 0.01));

/** limites da zona habitável (Kopparapu, fluxo estelar) */
export const hzLimits = (lum: number) => ({
  inner: Math.sqrt(Math.max(lum, 1e-6) / 1.05),
  outer: Math.sqrt(Math.max(lum, 1e-6) / 0.32),
});

export type HzStatus = "conservative" | "optimistic" | "outside";
export const hzStatus = (flux?: number): HzStatus => {
  if (flux == null) return "outside";
  if (flux >= 0.35 && flux <= 1.55) return "conservative";
  if (flux >= 0.22 && flux <= 1.9) return "optimistic";
  return "outside";
};

/** ESI simplificado (Schulze-Makuch): raio × temperatura de equilíbrio */
export function esi(radiusEarth: number, teqK?: number): number | null {
  const r = Math.max(radiusEarth, 0.01);
  const esiR = 1 - Math.abs(r - 1) / (r + 1);
  if (teqK == null) return Math.pow(esiR, 0.5);
  const T = Math.max(teqK, 1);
  const esiT = 1 - Math.abs(T - 288) / (T + 288);
  return Math.pow(Math.max(esiR * esiT, 0), 0.5);
}

/** tamanho angular real do Sol do sistema visto do planeta (°) */
export function sunAngularDeg(sys: ExoSystem, planet: ExoPlanet): number {
  const a = semiMajorAxisAU(planet.periodDays, sys.spectral.massSun);
  const rAU = sys.spectral.radiusSun * 0.00465;
  const ang = 2 * Math.atan2(rAU, Math.max(a, rAU * 1.2)) * (180 / Math.PI);
  return Math.min(Math.max(ang, 0.05), 120);
}

/** gravidade superficial estimada (m/s²) */
export function surfaceGravity(p: ExoPlanet): number {
  const m = p.massEarth ?? Math.pow(p.radiusEarth, 2.06);
  return Math.min(Math.max((9.81 * m) / (p.radiusEarth * p.radiusEarth), 0.3), 40);
}

/** resolve M = E − e·sinE (Newton, 6 iterações) */
export function solveKepler(M: number, e: number): number {
  const ec = Math.min(Math.max(e, 0), 0.9);
  let E = ec < 0.8 ? M : Math.PI;
  for (let i = 0; i < 6; i++) {
    const f = E - ec * Math.sin(E) - M;
    E -= f / (1 - ec * Math.cos(E));
  }
  return E;
}

/* ------------------------------------------------------------ catálogo */

const P = (
  id: string,
  name: string,
  cls: WorldClass,
  radiusEarth: number,
  periodDays: number,
  method: DiscoveryMethod,
  year: number,
  note: string,
  extra: Partial<ExoPlanet> = {}
): ExoPlanet => ({ id, name, cls, radiusEarth, periodDays, method, year, note, ...extra });

export const EXO_SYSTEMS: ExoSystem[] = [
  /* ═══════════ 12 SISTEMAS DO HABITABLE WORLDS CATALOG ═══════════ */
  {
    id: "proxima",
    starName: "Proxima Centauri",
    distLy: 4.25,
    spectral: { type: "M5.5V", tempK: 3042, massSun: 0.122, radiusSun: 0.154, luminositySun: 0.0017, color: "#ff9d6b", metallicity: 0.21 },
    ageGyr: 4.85,
    highlight: "A estrela mais próxima do Sol abriga o exoplaneta confirmado mais perto da Terra — uma super-Terra dentro da zona habitável.",
    planets: [
      P("proxima-b", "Proxima b", "temperate", 1.07, 11.19, "Velocidade radial", 2016,
        "Recebe 75% da luz que a Terra recebe. Pode ter água líquida — e está a uma 'curta' viagem de 70 mil anos.",
        { massEarth: 1.07, ecc: 0.11, fluxEarth: 0.75, teqK: 234, habitable: true }),
      P("proxima-d", "Proxima d", "desert", 0.81, 5.12, "Velocidade radial", 2022,
        "Um dos planetas mais leves já detectados: só 26% da massa da Terra, colado à estrela.",
        { massEarth: 0.26, fluxEarth: 4.2, teqK: 340 }),
    ],
  },
  {
    id: "trappist",
    starName: "TRAPPIST-1",
    distLy: 40.7,
    spectral: { type: "M8V", tempK: 2566, massSun: 0.089, radiusSun: 0.119, luminositySun: 0.000553, color: "#ff7a4d" },
    ageGyr: 7.6,
    highlight: "Sete planetas do tamanho da Terra em órbitas mais apertadas que as luas de Júpiter — três deles na zona habitável.",
    planets: [
      P("trappist-b", "TRAPPIST-1b", "desert", 1.12, 1.51, "Trânsito", 2016, "Quente demais: 550 K de temperatura.", { massEarth: 1.37, fluxEarth: 4.7, teqK: 400 }),
      P("trappist-c", "TRAPPIST-1c", "desert", 1.1, 2.42, "Trânsito", 2016, "Vênus-like: efeito estufa provável.", { massEarth: 1.31, fluxEarth: 2.27, teqK: 342 }),
      P("trappist-d", "TRAPPIST-1d", "ocean", 0.79, 4.05, "Trânsito", 2016, "Pode ser um mundo-oceano raso.", { massEarth: 0.39, fluxEarth: 1.14, teqK: 288 }),
      P("trappist-e", "TRAPPIST-1e", "temperate", 0.92, 6.1, "Trânsito", 2017, "O mais parecido com a Terra do sistema: rochoso, denso e na ZH.", { massEarth: 0.69, fluxEarth: 0.65, teqK: 251, habitable: true }),
      P("trappist-f", "TRAPPIST-1f", "ocean", 1.05, 9.21, "Trânsito", 2016, "Candidato a oceano global sob gelo fino.", { massEarth: 1.04, fluxEarth: 0.38, teqK: 219, habitable: true }),
      P("trappist-g", "TRAPPIST-1g", "temperate", 1.13, 12.35, "Trânsito", 2016, "No limite externo da ZH.", { massEarth: 1.32, fluxEarth: 0.26, teqK: 199, habitable: true }),
      P("trappist-h", "TRAPPIST-1h", "desert", 0.76, 18.77, "Trânsito", 2017, "Gelado e distante da pequena estrela.", { massEarth: 0.33, fluxEarth: 0.13, teqK: 173 }),
    ],
  },
  {
    id: "teegarden",
    starName: "Teegarden",
    distLy: 12.5,
    spectral: { type: "M7V", tempK: 2904, massSun: 0.089, radiusSun: 0.116, luminositySun: 0.00073, color: "#ff8a5e" },
    highlight: "Uma anã vermelha calma com dois planetas temperados — Teegarden b tem um dos maiores ESI conhecidos.",
    planets: [
      P("teegarden-b", "Teegarden b", "temperate", 1.05, 4.91, "Velocidade radial", 2019,
        "ESI ~0,93: um dos mundos mais 'parecidos com a Terra' já medidos.",
        { massEarth: 1.05, fluxEarth: 1.15, teqK: 282, habitable: true }),
      P("teegarden-c", "Teegarden c", "temperate", 1.11, 11.4, "Velocidade radial", 2019,
        "Na borda fria da zona habitável.",
        { massEarth: 1.11, fluxEarth: 0.37, teqK: 199, habitable: true }),
    ],
  },
  {
    id: "luyten",
    starName: "Luyten (GJ 273)",
    distLy: 12.2,
    spectral: { type: "M3.5V", tempK: 3382, massSun: 0.29, radiusSun: 0.29, luminositySun: 0.0086, color: "#ffa070" },
    highlight: "Luyten b foi o primeiro planeta de zona habitável achado por velocidade radial em uma anã vermelha próxima.",
    planets: [
      P("luyten-b", "Luyten b", "temperate", 1.4, 18.65, "Velocidade radial", 2017,
        "Super-Terra temperada a 12 anos-luz; primeira mensagem interestelar de 'bem-vindos' foi apontada para ela.",
        { massEarth: 2.89, fluxEarth: 1.06, teqK: 259, habitable: true }),
      P("luyten-c", "Luyten c", "desert", 1.1, 3.55, "Velocidade radial", 2017,
        "Mundo quente e apertado contra a estrela.",
        { massEarth: 1.18, fluxEarth: 5.1, teqK: 380 }),
    ],
  },
  {
    id: "gj1002",
    starName: "GJ 1002",
    distLy: 15.8,
    spectral: { type: "M5.5V", tempK: 3024, massSun: 0.12, radiusSun: 0.14, luminositySun: 0.00084, color: "#ff9468" },
    highlight: "Sistema vizinho com duas Terras em zona habitável, anunciado em 2022 pelo espectrógrafo ESPRESSO.",
    planets: [
      P("gj1002-b", "GJ 1002 b", "temperate", 1.03, 10.35, "Velocidade radial", 2022,
        "Massa quase idêntica à da Terra, órbita na ZH interna.",
        { massEarth: 1.08, fluxEarth: 0.72, teqK: 230, habitable: true }),
      P("gj1002-c", "GJ 1002 c", "temperate", 1.1, 21.2, "Velocidade radial", 2022,
        "A companheira mais fria, na ZH externa.",
        { massEarth: 1.36, fluxEarth: 0.34, teqK: 211, habitable: true }),
    ],
  },
  {
    id: "ross128",
    starName: "Ross 128",
    distLy: 11.0,
    spectral: { type: "M4V", tempK: 3192, massSun: 0.168, radiusSun: 0.197, luminositySun: 0.0036, color: "#ff9c70" },
    highlight: "Uma das anãs vermelhas mais tranquilas do céu — sem os flares violentos que esterilizam planetas vizinhos.",
    planets: [
      P("ross128-b", "Ross 128 b", "temperate", 1.1, 9.87, "Velocidade radial", 2017,
        "Super-Terra temperada a 11 anos-luz, com insolação 38% maior que a da Terra.",
        { massEarth: 1.4, fluxEarth: 1.38, teqK: 294, habitable: true }),
    ],
  },
  {
    id: "tauceti",
    starName: "Tau Ceti",
    distLy: 11.9,
    spectral: { type: "G8.5V", tempK: 5344, massSun: 0.783, radiusSun: 0.793, luminositySun: 0.52, color: "#ffe9b0", metallicity: -0.55 },
    highlight: "Estrela parecida com o Sol, visível a olho nu, com um disco de detritos massivo e candidatos planetários.",
    planets: [
      P("tauceti-e", "Tau Ceti e", "lava", 1.7, 162.9, "Velocidade radial", 2012,
        "Provável mundo de lava com 4× a massa da Terra.",
        { massEarth: 3.93, fluxEarth: 1.71, teqK: 310 }),
      P("tauceti-f", "Tau Ceti f", "temperate", 1.8, 642, "Velocidade radial", 2012,
        "Candidato a super-Terra gelada na borda da ZH — alvo clássico de projetos SETI.",
        { massEarth: 3.93, fluxEarth: 0.29, teqK: 195, habitable: true }),
    ],
  },
  {
    id: "toi700",
    starName: "TOI-700",
    distLy: 101.4,
    spectral: { type: "M2V", tempK: 3480, massSun: 0.42, radiusSun: 0.42, luminositySun: 0.023, color: "#ffa878" },
    highlight: "O TESS encontrou aqui dois mundos de tamanho terrestre na zona habitável: d (2020) e e (2023).",
    planets: [
      P("toi700-d", "TOI-700 d", "temperate", 1.14, 37.4, "Trânsito", 2020,
        "Primeiro mundo de tamanho terrestre do TESS na ZH.",
        { massEarth: 1.72, fluxEarth: 0.94, teqK: 269, habitable: true }),
      P("toi700-e", "TOI-700 e", "temperate", 0.95, 27.8, "Trânsito", 2023,
        "Descoberto depois de d, na ZH otimista — 10% menor que a Terra.",
        { fluxEarth: 1.4, teqK: 292, habitable: true }),
    ],
  },
  {
    id: "kepler62",
    starName: "Kepler-62",
    distLy: 865,
    spectral: { type: "K2V", tempK: 4925, massSun: 0.69, radiusSun: 0.64, luminositySun: 0.21, color: "#ffd98c" },
    highlight: "Cinco planetas, dois deles na zona habitável — e, por modelos, provavelmente cobertos de oceano.",
    planets: [
      P("kepler62-e", "Kepler-62 e", "hycean", 1.61, 122.4, "Trânsito", 2013,
        "Super-Terra hycean: um oceano quente e profundo de ponta a ponta.",
        { massEarth: 4.5, fluxEarth: 1.04, teqK: 270, habitable: true }),
      P("kepler62-f", "Kepler-62 f", "super-earth", 1.41, 267.3, "Trânsito", 2013,
        "No frio da ZH externa — talvez um oceano sob gelo, como uma Europa gigante.",
        { massEarth: 3.2, fluxEarth: 0.41, teqK: 208, habitable: true }),
    ],
  },
  {
    id: "kepler1649",
    starName: "Kepler-1649",
    distLy: 301,
    spectral: { type: "M5V", tempK: 3240, massSun: 0.23, radiusSun: 0.25, luminositySun: 0.0047, color: "#ff9d6b" },
    highlight: "Kepler-1649 c quase escapou: foi achado em dados antigos por um algoritmo revisado por humanos.",
    planets: [
      P("kepler1649-c", "Kepler-1649 c", "temperate", 1.06, 19.53, "Trânsito", 2020,
        "1,06× o raio da Terra e 75% da insolação — entre os gêmeos terrestres mais próximos em tamanho e luz.",
        { fluxEarth: 0.75, teqK: 234, habitable: true }),
      P("kepler1649-b", "Kepler-1649 b", "desert", 1.02, 8.46, "Trânsito", 2017,
        "O irmão interno, quente demais para oceanos.",
        { fluxEarth: 3.9, teqK: 330 }),
    ],
  },
  {
    id: "kepler452",
    starName: "Kepler-452",
    distLy: 1810,
    spectral: { type: "G2V", tempK: 5757, massSun: 1.04, radiusSun: 1.11, luminositySun: 1.2, color: "#fff2cc" },
    ageGyr: 6.0,
    highlight: "Uma estrela quase gêmea do Sol (6 bilhões de anos) com um planeta de 385 dias — o 'primo da Terra'.",
    planets: [
      P("kepler452-b", "Kepler-452 b", "super-earth", 1.63, 384.8, "Trânsito", 2015,
        "Ano de 385 dias em torno de uma estrela como o Sol. Se for rochoso, pode ter vulcanismo intenso.",
        { fluxEarth: 1.11, teqK: 265, habitable: true }),
    ],
  },
  {
    id: "kepler22",
    starName: "Kepler-22",
    distLy: 635,
    spectral: { type: "G5V", tempK: 5518, massSun: 0.97, radiusSun: 0.98, luminositySun: 0.79, color: "#ffeec0" },
    highlight: "Primeiro planeta confirmado na zona habitável de uma estrela parecida com o Sol (2011).",
    planets: [
      P("kepler22-b", "Kepler-22 b", "ocean", 2.38, 289.9, "Trânsito", 2011,
        "2,4× o raio da Terra com ano de 290 dias — forte candidato a mundo-oceano morno.",
        { fluxEarth: 1.11, teqK: 262, habitable: true }),
    ],
  },

  /* ═══════════ 10 MUNDOS EXTREMOS DO OPEN EXOPLANET CATALOGUE ═══════════ */
  {
    id: "51peg",
    starName: "51 Pegasi",
    distLy: 50.45,
    spectral: { type: "G2IV", tempK: 5768, massSun: 1.11, radiusSun: 1.24, luminositySun: 1.36, color: "#fff2cc", metallicity: 0.2 },
    highlight: "1995: Dimidium foi o PRIMEIRO exoplaneta achado em torno de uma estrela como o Sol — Prêmio Nobel de 2019.",
    planets: [
      P("51peg-b", "Dimidium (51 Peg b)", "hot-jupiter", 12.5, 4.23, "Velocidade radial", 1995,
        "Meio Júpiter colado à estrela: ano de 4 dias. Sua descoberta reescreveu os livros de astronomia.",
        { massEarth: 146, ecc: 0.01, teqK: 1260 }),
    ],
  },
  {
    id: "hd209458",
    starName: "HD 209458",
    distLy: 159,
    spectral: { type: "G0V", tempK: 6065, massSun: 1.13, radiusSun: 1.16, luminositySun: 1.61, color: "#fff4d0" },
    highlight: "'Osíris' foi o primeiro planeta a transitar (1999) e o primeiro a ter atmosfera detectada — sódio e vapor escapando.",
    planets: [
      P("hd209458-b", "Osíris (HD 209458 b)", "hot-jupiter", 15.3, 3.525, "Trânsito", 1999,
        "Inflado pelo calor e evaporando: perde ~10 mil toneladas de gás por segundo.",
        { massEarth: 219, teqK: 1449 }),
    ],
  },
  {
    id: "kepler186",
    starName: "Kepler-186",
    distLy: 582,
    spectral: { type: "M1V", tempK: 3755, massSun: 0.54, radiusSun: 0.47, luminositySun: 0.054, color: "#ffb080" },
    highlight: "Kepler-186f (2014) foi o PRIMEIRO planeta de tamanho terrestre encontrado na zona habitável.",
    planets: [
      P("kepler186-b", "Kepler-186 b", "desert", 1.07, 3.89, "Trânsito", 2014, "Interior rochoso escaldante.", { teqK: 635 }),
      P("kepler186-c", "Kepler-186 c", "desert", 1.25, 7.27, "Trânsito", 2014, "Segundo do quinteto interior.", { teqK: 516 }),
      P("kepler186-d", "Kepler-186 d", "desert", 1.4, 13.34, "Trânsito", 2014, "Limite provável entre rocha e gás.", { teqK: 433 }),
      P("kepler186-e", "Kepler-186 e", "super-earth", 1.27, 22.41, "Trânsito", 2014, "Mundo quente na borda interna.", { teqK: 375 }),
      P("kepler186-f", "Kepler-186 f", "temperate", 1.17, 129.9, "Trânsito", 2014,
        "O marco histórico: primeira Terra-size na ZH. Meio-dia eterno? Não — mas o Sol lá é vermelho.",
        { fluxEarth: 0.32, teqK: 188, habitable: true }),
    ],
  },
  {
    id: "k2-18",
    starName: "K2-18",
    distLy: 124,
    spectral: { type: "M2.5V", tempK: 3457, massSun: 0.44, radiusSun: 0.44, luminositySun: 0.023, color: "#ffa878" },
    highlight: "O James Webb achou vapor d'água, CO₂ e metano em K2-18b — e um possível sinal de dimetilsulfeto, gás ligado à vida na Terra.",
    planets: [
      P("k2-18-b", "K2-18 b", "hycean", 2.61, 32.94, "Trânsito", 2015,
        "Arquétipo dos mundos hycean: oceano global sob atmosfera de hidrogênio.",
        { massEarth: 8.63, fluxEarth: 1.38, teqK: 265, habitable: true }),
      P("k2-18-c", "K2-18 c", "mini-neptune", 2.28, 8.96, "Velocidade radial", 2019,
        "Não transita — detectado só pelo balanço gravitacional na estrela.",
        { massEarth: 7.4, teqK: 405 }),
    ],
  },
  {
    id: "gj1214",
    starName: "GJ 1214",
    distLy: 48,
    spectral: { type: "M4.5V", tempK: 3026, massSun: 0.18, radiusSun: 0.21, luminositySun: 0.0045, color: "#ff9060" },
    highlight: "GJ 1214 b é o mini-Netuno mais estudado do céu — provavelmente um mundo de vapor supercrítico.",
    planets: [
      P("gj1214-b", "GJ 1214 b", "mini-neptune", 2.74, 1.58, "Trânsito", 2009,
        "Céu de vapor, mar supercrítico: ano de 38 horas e temperatura de 600 K.",
        { massEarth: 8.17, teqK: 596 }),
    ],
  },
  {
    id: "55cnc",
    starName: "55 Cancri",
    distLy: 41,
    spectral: { type: "G8V", tempK: 5196, massSun: 0.91, radiusSun: 0.94, luminositySun: 0.58, color: "#ffe4a8", metallicity: 0.29 },
    highlight: "Cinco planetas, e o interno — Janssen — é um mundo de lava com ano de 17,7 horas, mapeado em infravermelho.",
    planets: [
      P("55cnc-e", "Janssen (55 Cnc e)", "lava", 1.88, 0.7365, "Trânsito", 2011,
        "Lava derretida no lado diurno (2.000 K); pode chover rocha vaporizada no terminador.",
        { massEarth: 7.99, teqK: 1958 }),
      P("55cnc-b", "Galileo (55 Cnc b)", "gas-giant", 13.2, 14.65, "Velocidade radial", 1996,
        "Netuno quente de 0,84 massa de Júpiter.",
        { massEarth: 267, ecc: 0.01, teqK: 670 }),
      P("55cnc-d", "Lipperhey (55 Cnc d)", "gas-giant", 13.8, 4825, "Velocidade radial", 2002,
        "Gigante de longa órbita, 3,9 massas de Júpiter.",
        { massEarth: 1234, ecc: 0.03, teqK: 130 }),
    ],
  },
  {
    id: "kelt9",
    starName: "KELT-9",
    distLy: 670,
    spectral: { type: "A0V", tempK: 10170, massSun: 2.52, radiusSun: 2.36, luminositySun: 55, color: "#dfeaff" },
    highlight: "O planeta mais quente conhecido: KELT-9b chega a 4.050 K — mais quente que muitas estrelas. Ferro vira vapor na atmosfera.",
    planets: [
      P("kelt9-b", "KELT-9 b", "lava", 21.3, 1.481, "Trânsito", 2017,
        "Chove ferro? No lado noturno, talvez sim: vapor metálico condensa ao atravessar o terminador.",
        { massEarth: 910, teqK: 4050 }),
    ],
  },
  {
    id: "gj436",
    starName: "GJ 436",
    distLy: 31.9,
    spectral: { type: "M2.5V", tempK: 3479, massSun: 0.45, radiusSun: 0.44, luminositySun: 0.016, color: "#ffa878" },
    highlight: "GJ 436 b arrasta uma cauda de hélio de 14 milhões de km — um cometa planetário evaporando.",
    planets: [
      P("gj436-b", "GJ 436 b", "mini-neptune", 4.17, 2.644, "Velocidade radial", 2004,
        "Netuno morno perdendo a atmosfera; a cauda foi vista pelo Hubble.",
        { massEarth: 22.2, ecc: 0.15, teqK: 686 }),
    ],
  },
  {
    id: "hr8799",
    starName: "HR 8799",
    distLy: 133,
    spectral: { type: "A5V", tempK: 7430, massSun: 1.47, radiusSun: 1.34, luminositySun: 6.8, color: "#eaf2ff" },
    ageGyr: 0.042,
    highlight: "Primeiro sistema multiplanetário FOTOGRAFADO diretamente (2008): quatro gigantes jovens e incandescentes.",
    planets: [
      P("hr8799-e", "HR 8799 e", "imaged-giant", 12.6, 16630, "Imageamento direto", 2010, "O interno, a 14,5 UA — jovem e quente (~1.000 K).", { massEarth: 2900 }),
      P("hr8799-d", "HR 8799 d", "imaged-giant", 12.6, 35400, "Imageamento direto", 2008, "24 UA da estrela.", { massEarth: 2500 }),
      P("hr8799-c", "HR 8799 c", "imaged-giant", 12.2, 70500, "Imageamento direto", 2008, "38 UA; spectra mostram monóxido de carbono.", { massEarth: 2300 }),
      P("hr8799-b", "HR 8799 b", "imaged-giant", 13.4, 180300, "Imageamento direto", 2008, "O gigante externo, a 71 UA.", { massEarth: 1900 }),
    ],
  },
  {
    id: "psr1257",
    starName: "PSR B1257+12",
    distLy: 2300,
    spectral: { type: "Pulsar (nêutron)", tempK: 28856, massSun: 1.4, radiusSun: 0.000014, luminositySun: 0.0008, color: "#bcd0ff" },
    kind: "pulsar",
    highlight: "Os PRIMEIROS exoplanetas da história (1992) orbitam um cadáver estelar que gira 161 vezes por segundo.",
    planets: [
      P("psr-draugr", "Draugr", "pulsar-world", 0.35, 25.26, "Pulsar timing", 1994,
        "O menor exoplaneta conhecido: metade da massa da Lua, banhado por radiação.",
        { massEarth: 0.02 }),
      P("psr-poltergeist", "Poltergeist", "pulsar-world", 1.5, 66.54, "Pulsar timing", 1992,
        "Super-Terra sob rajadas de raios-X de um pulsar de milissegundo.",
        { massEarth: 4.3 }),
      P("psr-phobetor", "Phobetor", "pulsar-world", 1.45, 98.21, "Pulsar timing", 1992,
        "Companheiro de Poltergeist — descobertos juntos, antes de 51 Peg.",
        { massEarth: 3.9 }),
    ],
  },
];

/* ------------------------------------------------------------ fatos TDAH-friendly */

export interface AlienFact {
  id: string;
  text: string;
}

export const ALIEN_FACTS: AlienFact[] = [
  { id: "f1", text: "Já achamos mais de **5.500 exoplanetas**! E olha que vasculhamos só um cantinho do céu." },
  { id: "f2", text: "Um **ano** em TRAPPIST-1e dura **6 dias**. Sua semana inteira cabe num ano de lá!" },
  { id: "f3", text: "A **zona habitável** é o ponto certo da estrela: nem quente nem frio demais. Cachinhos Dourados aprovaria." },
  { id: "f4", text: "**Proxima b** está a 4,2 anos-luz. Uma nave de hoje levaria **70 mil anos** — melhor inventar outra coisa!" },
  { id: "f5", text: "O primeiro exoplaneta de verdade, em 1992, orbita um **pulsar**: uma estrela morta que gira 161× por segundo." },
  { id: "f6", text: "Em **KELT-9b** faz 4.000 °C. Lá, **ferro derrete e vira vapor** — e talvez chova metal no lado frio!" },
  { id: "f7", text: "O método do **trânsito** vê planetas passando na frente da estrela — como um mosquito cruzando um farol." },
  { id: "f8", text: "**GJ 436 b** tem uma cauda de gás de 14 milhões de km. Um cometa do tamanho de Netuno!" },
  { id: "f9", text: "O James Webb 'cheira' atmosferas a anos-luz: já achou **vapor d'água e CO₂** em K2-18b." },
  { id: "f10", text: "Planetas travados têm um lado **sempre dia** e outro **sempre noite**. O crepúsculo mora na borda." },
  { id: "f11", text: "**Kepler-186f** foi a primeira 'Terra' na zona habitável. O pôr do sol lá é **vermelho**." },
  { id: "f12", text: "Mundos **hycean** podem ter oceano global + céu de hidrogênio. K2-18b é o famoso da turma." },
  { id: "f13", text: "**Janssen** dá uma volta em 17 HORAS. De um lado é lava; do outro, talvez chova pedra." },
  { id: "f14", text: "Se você pesa 30 kg aqui, numa super-Terra com 2g pesaria **60 kg**. Academia grátis e eterna!" },
  { id: "f15", text: "O **ESI** mede semelhança com a Terra: 0 = nada, 1 = gêmea. Teegarden b marca **0,93**!" },
  { id: "f16", text: "HR 8799 tem 4 gigantes **fotografados de verdade** — pontinhos de luz ao lado da estrela." },
];

export function systemFacts(sys: ExoSystem): AlienFact[] {
  const shortest = [...sys.planets].sort((a, b) => a.periodDays - b.periodDays)[0];
  const habitable = sys.planets.filter((p) => hzStatus(p.fluxEarth) !== "outside");
  const facts: AlienFact[] = [
    {
      id: `${sys.id}-ano`,
      text: `Aqui em **${sys.starName}**, o ano mais curto dura **${fmtNum(shortest.periodDays, shortest.periodDays < 10 ? 1 : 0)} dias**. Pisque e já é ano novo!`,
    },
    {
      id: `${sys.id}-luz`,
      text: `A luz de **${sys.starName}** leva **${fmtNum(sys.distLy, sys.distLy < 20 ? 1 : 0)} anos** até a Terra. Um 'oi' demoraria o dobro pra voltar!`,
    },
    {
      id: `${sys.id}-tipo`,
      text: `**${sys.starName}** é do tipo **${sys.spectral.type}** (${fmtInt(sys.spectral.tempK)} K). A cor dela pinta o céu de todos os planetas!`,
    },
  ];
  if (habitable.length > 0) {
    facts.push({
      id: `${sys.id}-zh`,
      text: `Este sistema tem **${habitable.length} ${habitable.length === 1 ? "candidato" : "candidatos"}** na zona habitável. Água líquida? Talvez!`,
    });
  }
  if (sys.kind === "pulsar") {
    facts.push({
      id: `${sys.id}-pulsar`,
      text: `Isto é um **pulsar**: o núcleo esmagado de uma estrela que explodiu. E mesmo assim tem planetas!`,
    });
  }
  return facts;
}
