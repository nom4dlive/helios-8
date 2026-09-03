/**
 * Sistemas do Habitable Worlds Catalog (PHL @ UPR Arecibo), com dados do
 * NASA Exoplanet Archive. Propriedades estelares aproximadas por tipo
 * espectral quando o catálogo não lista valores individuais.
 */
export type SpectralType = "M" | "K" | "G";

export interface StarProps {
  type: string;
  class: SpectralType;
  massSun: number;
  radiusSun: number;
  tempK: number;
  luminositySun: number;
  color: string;
}

export interface ExoPlanet {
  id: string;
  name: string;
  massEarth: number | null;
  radiusEarth: number;
  periodDays: number;
  fluxEarth: number | null;
  teqK: number | null;
  sample: "conservative" | "optimistic";
  note: string;
}

export interface ExoSystem {
  id: string;
  starName: string;
  spectral: StarProps;
  distLy: number;
  ageGyr: number | null;
  planets: ExoPlanet[];
  highlight: string;
}

/* propriedades típicas por tipo espectral */
const STAR_PRESETS: Record<SpectralType, Omit<StarProps, "type" | "class">> = {
  M: { massSun: 0.3, radiusSun: 0.32, tempK: 3350, luminositySun: 0.013, color: "#ff9a5c" },
  K: { massSun: 0.72, radiusSun: 0.7, tempK: 4600, luminositySun: 0.22, color: "#ffd08a" },
  G: { massSun: 1.0, radiusSun: 1.0, tempK: 5750, luminositySun: 1.0, color: "#fff2cc" },
};

function star(type: string, over?: Partial<Omit<StarProps, "type" | "class">>): StarProps {
  const cls: SpectralType = type.startsWith("G") ? "G" : type.startsWith("K") ? "K" : "M";
  return { type, class: cls, ...STAR_PRESETS[cls], ...over };
}

/** 3ª lei de Kepler: a³ = P²·M★ (P em anos, M em massas solares) → a em UA */
export function semiMajorAxisAU(periodDays: number, starMassSun: number): number {
  const P = Math.max(periodDays, 0.01) / 365.25;
  return Math.cbrt(P * P * Math.max(starMassSun, 0.01));
}

/** limites da zona habitável (Kopparapu simplificado) em UA */
export function hzLimits(luminositySun: number): { inner: number; outer: number } {
  const L = Math.max(luminositySun, 1e-6);
  return {
    inner: Math.sqrt(L / 1.05),
    outer: Math.sqrt(L / 0.35),
  };
}

export function hzStatus(fluxEarth: number | null): "conservative" | "optimistic" | "outside" {
  if (fluxEarth == null) return "optimistic";
  if (fluxEarth >= 0.35 && fluxEarth <= 1.05) return "conservative";
  if (fluxEarth > 0.25 && fluxEarth < 1.5) return "optimistic";
  return "outside";
}

export const EXO_SYSTEMS: ExoSystem[] = [
  {
    id: "proxima",
    starName: "Proxima Centauri",
    spectral: star("M5.5V", { massSun: 0.12, radiusSun: 0.154, tempK: 3042, luminositySun: 0.0017 }),
    distLy: 4.25,
    ageGyr: 4.85,
    highlight: "O exoplaneta mais próximo da Terra orbita a estrela mais próxima do Sol.",
    planets: [
      {
        id: "proxima-b",
        name: "Proxima b",
        massEarth: 1.07,
        radiusEarth: 1.03,
        periodDays: 11.19,
        fluxEarth: 0.72,
        teqK: 234,
        sample: "conservative",
        note: "Na zona habitável da estrela mais próxima; provavelmente com rotação travada em maré.",
      },
    ],
  },
  {
    id: "trappist1",
    starName: "TRAPPIST-1",
    spectral: star("M8V", { massSun: 0.089, radiusSun: 0.119, tempK: 2566, luminositySun: 0.00055 }),
    distLy: 40.7,
    ageGyr: 7.6,
    highlight: "Sete planetas do tamanho da Terra; três a quatro dentro da zona habitável — o sistema mais promissor conhecido.",
    planets: [
      { id: "t1-b", name: "TRAPPIST-1 b", massEarth: 1.37, radiusEarth: 1.12, periodDays: 1.51, fluxEarth: 4.15, teqK: 400, sample: "optimistic", note: "Quente demais: recebe 4× a insolação da Terra." },
      { id: "t1-c", name: "TRAPPIST-1 c", massEarth: 1.31, radiusEarth: 1.1, periodDays: 2.42, fluxEarth: 2.23, teqK: 342, sample: "optimistic", note: "Provável efeito estufa descontrolado, como Vênus." },
      { id: "t1-d", name: "TRAPPIST-1 d", massEarth: 0.39, radiusEarth: 0.79, periodDays: 4.05, fluxEarth: 1.12, teqK: 288, sample: "optimistic", note: "Borda interna da ZH; pode ser um mundo-oceano." },
      { id: "t1-e", name: "TRAPPIST-1 e", massEarth: 0.69, radiusEarth: 0.92, periodDays: 6.1, fluxEarth: 0.65, teqK: 251, sample: "conservative", note: "O mais parecido com a Terra do sistema (ESI 0,85)." },
      { id: "t1-f", name: "TRAPPIST-1 f", massEarth: 1.04, radiusEarth: 1.05, periodDays: 9.21, fluxEarth: 0.37, teqK: 219, sample: "conservative", note: "Candidato a mundo-oceano com crosta de gelo." },
      { id: "t1-g", name: "TRAPPIST-1 g", massEarth: 1.32, radiusEarth: 1.13, periodDays: 12.35, fluxEarth: 0.26, teqK: 199, sample: "conservative", note: "Zona habitável otimista; densidade indica muita água." },
      { id: "t1-h", name: "TRAPPIST-1 h", massEarth: 0.33, radiusEarth: 0.77, periodDays: 18.77, fluxEarth: 0.14, teqK: 169, sample: "optimistic", note: "Frio e externo — um mundo congelado na borda do sistema." },
    ],
  },
  {
    id: "gj1002",
    starName: "GJ 1002",
    spectral: star("M5.5V", { massSun: 0.13, radiusSun: 0.15, tempK: 2980, luminositySun: 0.0016 }),
    distLy: 15.8,
    ageGyr: null,
    highlight: "Dois planetas de baixa massa na zona habitável de uma anã vermelha muito calma.",
    planets: [
      { id: "gj1002-b", name: "GJ 1002 b", massEarth: 1.08, radiusEarth: 1.03, periodDays: 10.35, fluxEarth: 0.67, teqK: 231, sample: "conservative", note: "Borda interna da zona habitável." },
      { id: "gj1002-c", name: "GJ 1002 c", massEarth: 1.36, radiusEarth: 1.1, periodDays: 21.2, fluxEarth: 0.26, teqK: 182, sample: "conservative", note: "Borda externa; o sistema inteiro cabe dentro da órbita de Mercúrio." },
    ],
  },
  {
    id: "teegarden",
    starName: "Estrela de Teegarden",
    spectral: star("M7V", { massSun: 0.089, radiusSun: 0.116, tempK: 2904, luminositySun: 0.00073 }),
    distLy: 12.5,
    ageGyr: 8,
    highlight: "Dois planetas com ESI entre os mais altos conhecidos, ao redor de uma estrela antiga e tranquila.",
    planets: [
      { id: "teeg-b", name: "Teegarden b", massEarth: 1.05, radiusEarth: 1.02, periodDays: 4.91, fluxEarth: 1.15, teqK: 282, sample: "conservative", note: "ESI 0,95 — um dos mundos mais semelhantes à Terra já medidos." },
      { id: "teeg-c", name: "Teegarden c", massEarth: 1.11, radiusEarth: 1.04, periodDays: 11.41, fluxEarth: 0.37, teqK: 200, sample: "conservative", note: "Zona habitável conservadora; ano de apenas 11 dias." },
    ],
  },
  {
    id: "luyten",
    starName: "Estrela de Luyten",
    spectral: star("M3.5V", { massSun: 0.29, radiusSun: 0.31, tempK: 3380, luminositySun: 0.012 }),
    distLy: 12.2,
    ageGyr: null,
    highlight: "Um planeta temperado detectado por velocidade radial numa vizinha próxima do Sol.",
    planets: [
      { id: "luyten-b", name: "Luyten b (GJ 273 b)", massEarth: 2.89, radiusEarth: 1.51, periodDays: 18.65, fluxEarth: 1.23, teqK: 259, sample: "conservative", note: "Super-Terra na borda interna da zona habitável." },
    ],
  },
  {
    id: "ross128",
    starName: "Ross 128",
    spectral: star("M4V", { massSun: 0.17, radiusSun: 0.21, tempK: 3192, luminositySun: 0.0036 }),
    distLy: 11,
    ageGyr: 9.4,
    highlight: "Planeta temperado ao redor de uma das anãs vermelhas menos ativas conhecidas.",
    planets: [
      { id: "ross128-b", name: "Ross 128 b", massEarth: 1.4, radiusEarth: 1.1, periodDays: 9.87, fluxEarth: 1.38, teqK: 269, sample: "conservative", note: "Recebe 38% mais luz que a Terra; a estrela calma favorece a retenção de atmosfera." },
    ],
  },
  {
    id: "tauceti",
    starName: "Tau Ceti",
    spectral: star("G8.5V", { massSun: 0.78, radiusSun: 0.79, tempK: 5344, luminositySun: 0.52 }),
    distLy: 11.9,
    ageGyr: 5.8,
    highlight: "Uma estrela parecida com o Sol, visível a olho nu, com um candidato na zona habitável.",
    planets: [
      { id: "tauceti-f", name: "Tau Ceti f", massEarth: 3.93, radiusEarth: 1.64, periodDays: 636.1, fluxEarth: 0.29, teqK: 195, sample: "conservative", note: "Super-Terra fria na zona habitável otimista de um sol gêmeo." },
    ],
  },
  {
    id: "kepler1649",
    starName: "Kepler-1649",
    spectral: star("M5V", { massSun: 0.2, radiusSun: 0.23, tempK: 3240, luminositySun: 0.0042 }),
    distLy: 301,
    ageGyr: null,
    highlight: "Recuperado de dados antigos do Kepler: quase um gêmeo da Terra em tamanho e insolação.",
    planets: [
      { id: "k1649-c", name: "Kepler-1649 c", massEarth: 1.2, radiusEarth: 1.06, periodDays: 19.54, fluxEarth: 0.75, teqK: 234, sample: "conservative", note: "1,06 R⊕ e 75% da insolação terrestre — um dos análogos mais fiéis à Terra." },
    ],
  },
  {
    id: "toi700",
    starName: "TOI-700",
    spectral: star("M2V", { massSun: 0.42, radiusSun: 0.42, tempK: 3480, luminositySun: 0.023 }),
    distLy: 101.4,
    ageGyr: 1.1,
    highlight: "O primeiro sistema do TESS com planeta do tamanho da Terra na zona habitável.",
    planets: [
      { id: "toi700-d", name: "TOI-700 d", massEarth: 1.72, radiusEarth: 1.14, periodDays: 37.42, fluxEarth: 0.87, teqK: 268, sample: "conservative", note: "Descoberta inaugural do TESS na zona habitável (2020)." },
      { id: "toi700-e", name: "TOI-700 e", massEarth: 0.82, radiusEarth: 0.95, periodDays: 27.81, fluxEarth: 1.34, teqK: 279, sample: "optimistic", note: "95% do raio da Terra, confirmado em 2023 — possivelmente rochoso." },
    ],
  },
  {
    id: "kepler62",
    starName: "Kepler-62",
    spectral: star("K2V", { massSun: 0.69, radiusSun: 0.64, tempK: 4925, luminositySun: 0.21 }),
    distLy: 981,
    ageGyr: 7,
    highlight: "Dois mundos que podem ser oceanos globais na zona habitável de uma estrela K.",
    planets: [
      { id: "k62-e", name: "Kepler-62 e", massEarth: 4.5, radiusEarth: 1.61, periodDays: 122.39, fluxEarth: 1.15, teqK: 270, sample: "optimistic", note: "Provável mundo-oceano quente; 61% maior que a Terra." },
      { id: "k62-f", name: "Kepler-62 f", massEarth: 3.1, radiusEarth: 1.41, periodDays: 267.29, fluxEarth: 0.41, teqK: 208, sample: "conservative", note: "Candidato clássico a oceano com calotas de gelo (ESI 0,67)." },
    ],
  },
  {
    id: "kepler452",
    starName: "Kepler-452",
    spectral: star("G2V", { massSun: 1.04, radiusSun: 1.11, tempK: 5757, luminositySun: 1.2 }),
    distLy: 1799,
    ageGyr: 6,
    highlight: "'Primo mais velho da Terra': ano de 385 dias ao redor de um sol gêmeo mais evoluído.",
    planets: [
      { id: "k452-b", name: "Kepler-452 b", massEarth: 5.3, radiusEarth: 1.63, periodDays: 384.84, fluxEarth: 1.1, teqK: 265, sample: "optimistic", note: "Órbita de 385 dias a 1,05 UA de uma estrela quase idêntica ao Sol." },
    ],
  },
  {
    id: "kepler22",
    starName: "Kepler-22",
    spectral: star("G5V", { massSun: 0.97, radiusSun: 0.98, tempK: 5518, luminositySun: 0.79 }),
    distLy: 635,
    ageGyr: null,
    highlight: "Primeira confirmação do Kepler de um planeta na zona habitável de uma estrela tipo Sol.",
    planets: [
      { id: "k22-b", name: "Kepler-22 b", massEarth: 9.1, radiusEarth: 2.38, periodDays: 289.86, fluxEarth: 1.1, teqK: 262, sample: "optimistic", note: "Provável mini-Netuno ou mundo-oceano; 2,4× o raio da Terra." },
    ],
  },
];
