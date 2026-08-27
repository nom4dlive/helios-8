/**
 * Configurações de visão de superfície — perspectiva em primeira pessoa
 * de um visitante em cada planeta e lua.
 *
 * Valores físicos (tamanho angular do Sol e dos corpos no céu, gravidade,
 * pressão, temperatura) derivados de dados públicos da NASA / ESA e de
 * efemérides (SkyMap). As cores de céu e terreno emulam fotografias reais:
 * Venera (Vênus), Voyager 2 (gigantes e luas geladas), Cassini (Titã/Saturno),
 * Curiosity/Perseverance (Marte) e Apollo (Lua).
 */

export type SkyBodyType = "earth" | "mars" | "jupiter" | "saturn" | "uranus" | "neptune";

export interface SkyBodyDef {
  id: string;
  label: string;
  type: SkyBodyType;
  /** diâmetro angular aparente em graus, visto da superfície */
  angularDeg: number;
  azimuthDeg: number;
  elevationDeg: number;
}

export interface SurfaceViewDef {
  bodyId: string;
  viewLabel: string;
  /**
   * Panorama equiretangular 360° opcional (estilo Blockade Labs Skybox AI).
   * urls são tentadas em ordem — a primeira que carregar vira a cúpula do céu.
   * O motor detecta o Sol na imagem e alinha iluminação/névoa em runtime.
   */
  panorama?: { urls: string[] };
  /** gradiente do céu */
  skyTop: string;
  skyHorizon: string;
  /** Sol */
  sunAngularDeg: number;
  sunElevationDeg: number;
  sunAzimuthDeg: number;
  sunVisible: boolean;
  sunColor: string;
  /** estrelas */
  starsVisible: boolean;
  starDensity: number;
  /** terreno */
  terrainBase: string;
  terrainMid: string;
  terrainDark: string;
  terrainScale: number;
  terrainAmp: number;
  cloudSea: boolean;
  /** atmosfera / névoa */
  fogColor: string;
  fogDensity: number;
  effects: "none" | "dust" | "haze" | "clouds";
  /** refinamentos de realismo — série Ron Miller + fotografias de sondas */
  realism?: {
    /** 0 = disco solar nítido · 1 = brilho difuso filtrado por nuvens (Vênus/Titã) */
    sunDiffuse?: number;
    /** intensidade do halo/glare ao redor do Sol */
    glareBoost?: number;
    /** faixas de nuvens no céu (gigantes gasosos, Terra, smog de Titã) */
    skyBands?: { amp: number; scale: number; drift: number; colorA: string; colorB: string };
    /** luz ambiente do terreno — baixo = sombras duras (vácuo), alto = luz difusa (Vênus) */
    ambient?: number;
    sunStrength?: number;
    sunTint?: string;
    /** cintilação de regolito (grãos vítreos sob o Sol) */
    sparkle?: number;
    /** visibilidade da faixa da Via Láctea em céus sem atmosfera */
    milkyWay?: number;
    /** amplitude do campo de dunas (0 = desligado) */
    dunes?: number;
    /** campo de rochas 3D espalhadas pelo terreno */
    rockField?: { count: number; maxScale: number; colorA: string; colorB: string };
  };
  /** telemetria de superfície */
  gravityMs2: number;
  dayLength: string;
  pressure: string;
  temperature: string;
  /** corpos visíveis no céu */
  visibleBodies: SkyBodyDef[];
  /** notas do que um visitante veria */
  notes: string[];
}

const E = (id: string, label: string, type: SkyBodyType, angularDeg: number, azimuthDeg: number, elevationDeg: number): SkyBodyDef =>
  ({ id, label, type, angularDeg, azimuthDeg, elevationDeg });

export const SURFACE_VIEWS: Record<string, SurfaceViewDef> = {
  mercury: {
    bodyId: "mercury",
    viewLabel: "Superfície craterada",
    skyTop: "#020208",
    skyHorizon: "#241f18",
    sunAngularDeg: 1.4,
    sunElevationDeg: 38,
    sunAzimuthDeg: 40,
    sunVisible: true,
    sunColor: "#fff4d0",
    starsVisible: true,
    starDensity: 1,
    terrainBase: "#7a736a",
    terrainMid: "#948c80",
    terrainDark: "#443e36",
    terrainScale: 3.2,
    terrainAmp: 2.6,
    cloudSea: false,
    fogColor: "#100d0a",
    fogDensity: 0.0009,
    effects: "none",
    gravityMs2: 3.7,
    dayLength: "176 dias terrestres (dia solar)",
    pressure: "Vácuo (10⁻¹⁵ bar)",
    temperature: "-173 °C a 427 °C",
    visibleBodies: [],
    notes: [
      "O Sol aparece ~2,8× maior do que da Terra — um disco ofuscante coroado por halo.",
      "Sem atmosfera: céu negro absoluto ao meio-dia, estrelas e Via Láctea visíveis.",
      "Contraste brutal: luz solar direta contra sombras de borda nítida, sem penumbra.",
    ],
  },

  venus: {
    bodyId: "venus",
    viewLabel: "Superfície vulcânica sob nuvens",
    skyTop: "#8a5a20",
    skyHorizon: "#e0a850",
    sunAngularDeg: 0.73,
    sunElevationDeg: 30,
    sunAzimuthDeg: 55,
    sunVisible: false,
    sunColor: "#ffd9a0",
    starsVisible: false,
    starDensity: 0,
    terrainBase: "#4a3e2e",
    terrainMid: "#63533c",
    terrainDark: "#2c2418",
    terrainScale: 2.6,
    terrainAmp: 3.2,
    cloudSea: false,
    fogColor: "#c99a4a",
    fogDensity: 0.0042,
    effects: "haze",
    gravityMs2: 8.87,
    dayLength: "117 dias terrestres (retrógrado)",
    pressure: "92 bar (92× a da Terra)",
    temperature: "465 °C",
    visibleBodies: [],
    notes: [
      "O Sol desaparece: resta apenas um clarear difuso âmbar no teto de nuvens de H₂SO₄.",
      "Fotos das Venera 13/14: céu butterscotch em todas as direções, sem horizonte nítido.",
      "Luz totalmente difusa — as rochas basálticas quase não projetam sombra.",
    ],
  },

  earth: {
    bodyId: "earth",
    viewLabel: "Planície com atmosfera",
    skyTop: "#2a6fe0",
    skyHorizon: "#b8dcf0",
    sunAngularDeg: 0.53,
    sunElevationDeg: 42,
    sunAzimuthDeg: 45,
    sunVisible: true,
    sunColor: "#fffbe8",
    starsVisible: false,
    starDensity: 0,
    terrainBase: "#4a7a3d",
    terrainMid: "#8a7a4f",
    terrainDark: "#2d4a28",
    terrainScale: 2.2,
    terrainAmp: 2.2,
    cloudSea: false,
    fogColor: "#a8c8e0",
    fogDensity: 0.0014,
    effects: "clouds",
    gravityMs2: 9.81,
    dayLength: "23 h 56 min",
    pressure: "1,013 bar",
    temperature: "Média 15 °C",
    visibleBodies: [],
    notes: [
      "O azul do céu vem do espalhamento de Rayleigh na atmosfera de N₂/O₂.",
      "A Lua aparece a 0,5° — o mesmo diâmetro aparente do Sol (por isso eclipses totais).",
    ],
  },

  mars: {
    bodyId: "mars",
    viewLabel: "Panorama 360° fotorreal + terreno procedural",
    panorama: {
      urls: [
        "panos/mars.jpg",
        "https://image.qwenlm.ai/generated-images/d91318a7-f59b-4879-8108-2652cee59b5d/_result.png",
      ],
    },
    skyTop: "#4c3322",
    skyHorizon: "#cf9a66",
    sunAngularDeg: 0.35,
    sunElevationDeg: 35,
    sunAzimuthDeg: 50,
    sunVisible: true,
    sunColor: "#f5e8d0",
    starsVisible: false,
    starDensity: 0.12,
    terrainBase: "#c1512a",
    terrainMid: "#8a4a26",
    terrainDark: "#5e3018",
    terrainScale: 2.8,
    terrainAmp: 2.8,
    cloudSea: false,
    fogColor: "#b8885a",
    fogDensity: 0.0022,
    effects: "dust",
    gravityMs2: 3.71,
    dayLength: "24 h 37 min",
    pressure: "0,006 bar",
    temperature: "Média -63 °C",
    visibleBodies: [],
    notes: [
      "Céu 360° fotorreal (estilo skybox) fundido ao terreno 3D: o Sol da imagem é detectado e alinhado à iluminação em tempo real.",
      "O céu é caramelo/salmão pela poeira de óxido de ferro; ao entardecer, azul perto do Sol.",
      "Colinas, mesas e crateras distantes do panorama continuam o terreno procedural no horizonte.",
    ],
  },

  jupiter: {
    bodyId: "jupiter",
    viewLabel: "Topo das nuvens de amônia",
    skyTop: "#1a2038",
    skyHorizon: "#c9b896",
    sunAngularDeg: 0.1,
    sunElevationDeg: 28,
    sunAzimuthDeg: 60,
    sunVisible: true,
    sunColor: "#e8e0c8",
    starsVisible: true,
    starDensity: 0.15,
    terrainBase: "#d8c8a8",
    terrainMid: "#b8a488",
    terrainDark: "#96805e",
    terrainScale: 1.1,
    terrainAmp: 1.2,
    cloudSea: true,
    fogColor: "#b8a888",
    fogDensity: 0.0028,
    effects: "haze",
    gravityMs2: 24.79,
    dayLength: "9 h 56 min",
    pressure: "~1 bar (nível de referência)",
    temperature: "-108 °C",
    visibleBodies: [],
    notes: [
      "O Sol é um ponto minúsculo (0,1°), porém ~27× mais brilhante que a Lua cheia.",
      "Você flutua sobre um oceano de nuvens de amônia em faixas creme, ferrugem e marrom.",
      "As faixas derivam em velocidades diferentes — turbulência visível ao longo de horas.",
    ],
  },

  saturn: {
    bodyId: "saturn",
    viewLabel: "Topo das nuvens douradas",
    skyTop: "#2a2f45",
    skyHorizon: "#e0d0a8",
    sunAngularDeg: 0.053,
    sunElevationDeg: 26,
    sunAzimuthDeg: 62,
    sunVisible: true,
    sunColor: "#e0d8c0",
    starsVisible: true,
    starDensity: 0.15,
    terrainBase: "#e8d8b0",
    terrainMid: "#c9b890",
    terrainDark: "#a08860",
    terrainScale: 1.0,
    terrainAmp: 1.0,
    cloudSea: true,
    fogColor: "#cfc098",
    fogDensity: 0.0028,
    effects: "haze",
    gravityMs2: 10.44,
    dayLength: "10 h 42 min",
    pressure: "~1 bar (nível de referência)",
    temperature: "-139 °C",
    visibleBodies: [],
    notes: [
      "O Sol é um disco 10× menor que o visto da Terra, mas ainda ofuscante.",
      "As nuvens de amônia formam um mar dourado-pálido, com faixas mais suaves que as de Júpiter.",
    ],
  },

  uranus: {
    bodyId: "uranus",
    viewLabel: "Topo das nuvens de metano",
    skyTop: "#2a4a5a",
    skyHorizon: "#a8d8dc",
    sunAngularDeg: 0.018,
    sunElevationDeg: 24,
    sunAzimuthDeg: 65,
    sunVisible: true,
    sunColor: "#d0dce0",
    starsVisible: true,
    starDensity: 0.2,
    terrainBase: "#b8e0e0",
    terrainMid: "#a0d0d4",
    terrainDark: "#88bcc4",
    terrainScale: 0.9,
    terrainAmp: 0.7,
    cloudSea: true,
    fogColor: "#9fd0d4",
    fogDensity: 0.003,
    effects: "haze",
    gravityMs2: 8.69,
    dayLength: "17 h 14 min (retrógrado)",
    pressure: "~1 bar (nível de referência)",
    temperature: "-197 °C",
    visibleBodies: [],
    notes: [
      "O metano absorve a luz vermelha, tingindo tudo de ciano uniforme.",
      "É o planeta mais liso do sistema solar: quase nenhuma nuvem visível.",
    ],
  },

  neptune: {
    bodyId: "neptune",
    viewLabel: "Topo das nuvens de metano",
    skyTop: "#1a2a6a",
    skyHorizon: "#5a88d8",
    sunAngularDeg: 0.009,
    sunElevationDeg: 22,
    sunAzimuthDeg: 68,
    sunVisible: true,
    sunColor: "#c8d4e8",
    starsVisible: true,
    starDensity: 0.25,
    terrainBase: "#3a5ab8",
    terrainMid: "#2e4aa0",
    terrainDark: "#22397e",
    terrainScale: 1.2,
    terrainAmp: 1.0,
    cloudSea: true,
    fogColor: "#4a6ab0",
    fogDensity: 0.003,
    effects: "haze",
    gravityMs2: 11.15,
    dayLength: "16 h 06 min",
    pressure: "~1 bar (nível de referência)",
    temperature: "-201 °C",
    visibleBodies: [],
    notes: [
      "Vento supersônico de 2.100 km/h varre cirrus brancos sobre o azul profundo.",
      "O Sol é uma estrela brilhante, mas 900× menos intensa que na Terra.",
    ],
  },

  moon: {
    bodyId: "moon",
    viewLabel: "Regolito cinzento",
    skyTop: "#010106",
    skyHorizon: "#1c1c1c",
    sunAngularDeg: 0.53,
    sunElevationDeg: 36,
    sunAzimuthDeg: 42,
    sunVisible: true,
    sunColor: "#ffffff",
    starsVisible: true,
    starDensity: 1,
    terrainBase: "#7a7670",
    terrainMid: "#92908a",
    terrainDark: "#4a4844",
    terrainScale: 3.0,
    terrainAmp: 2.0,
    cloudSea: false,
    fogColor: "#0a0a0a",
    fogDensity: 0.0007,
    effects: "none",
    gravityMs2: 1.62,
    dayLength: "29,5 dias terrestres",
    pressure: "Vácuo (10⁻¹² bar)",
    temperature: "-173 °C a 127 °C",
    visibleBodies: [E("earth", "Terra", "earth", 1.9, 120, 40)],
    notes: [
      "A Terra paira fixa no céu, ~3,7× maior que a Lua cheia vista da Terra.",
      "Sem atmosfera, a sombra é absolutamente negra e o silêncio é total.",
    ],
  },

  phobos: {
    bodyId: "phobos",
    viewLabel: "Rochedo próximo a Marte",
    skyTop: "#010106",
    skyHorizon: "#161008",
    sunAngularDeg: 0.35,
    sunElevationDeg: 34,
    sunAzimuthDeg: 48,
    sunVisible: true,
    sunColor: "#fff2d8",
    starsVisible: true,
    starDensity: 1,
    terrainBase: "#5c554c",
    terrainMid: "#716a5e",
    terrainDark: "#38332b",
    terrainScale: 3.6,
    terrainAmp: 1.6,
    cloudSea: false,
    fogColor: "#0a0806",
    fogDensity: 0.0006,
    effects: "none",
    gravityMs2: 0.0057,
    dayLength: "7 h 39 min",
    pressure: "Vácuo",
    temperature: "~ -40 °C",
    visibleBodies: [E("mars", "Marte", "mars", 39.7, 150, 45)],
    notes: [
      "Marte ocupa quase 40° do céu — ~80× a área da Lua cheia.",
      "A gravidade é tão fraca que um salto forte poderia escapar do corpo.",
    ],
  },

  deimos: {
    bodyId: "deimos",
    viewLabel: "Rochedo distante de Marte",
    skyTop: "#010106",
    skyHorizon: "#140e08",
    sunAngularDeg: 0.35,
    sunElevationDeg: 34,
    sunAzimuthDeg: 48,
    sunVisible: true,
    sunColor: "#fff2d8",
    starsVisible: true,
    starDensity: 1,
    terrainBase: "#635c52",
    terrainMid: "#7a7266",
    terrainDark: "#3d3830",
    terrainScale: 3.4,
    terrainAmp: 1.4,
    cloudSea: false,
    fogColor: "#0a0806",
    fogDensity: 0.0006,
    effects: "none",
    gravityMs2: 0.003,
    dayLength: "30 h 18 min",
    pressure: "Vácuo",
    temperature: "~ -40 °C",
    visibleBodies: [E("mars", "Marte", "mars", 16.4, 150, 45)],
    notes: [
      "Marte aparece 32× maior que a Lua cheia, mostrando calota polar e bacias escuras.",
    ],
  },

  io: {
    bodyId: "io",
    viewLabel: "Planície de enxofre",
    skyTop: "#050510",
    skyHorizon: "#3a3a52",
    sunAngularDeg: 0.1,
    sunElevationDeg: 30,
    sunAzimuthDeg: 58,
    sunVisible: true,
    sunColor: "#f0ecd8",
    starsVisible: true,
    starDensity: 0.85,
    terrainBase: "#d8b83a",
    terrainMid: "#c08828",
    terrainDark: "#8a5f1e",
    terrainScale: 2.6,
    terrainAmp: 2.4,
    cloudSea: false,
    fogColor: "#24243c",
    fogDensity: 0.001,
    effects: "none",
    gravityMs2: 1.796,
    dayLength: "42 h 27 min",
    pressure: "~10⁻¹¹ bar (SO₂)",
    temperature: "-143 °C",
    visibleBodies: [E("jupiter", "Júpiter", "jupiter", 19, 140, 38)],
    notes: [
      "O corpo mais vulcânico do sistema solar: gêiseres de enxofre tingem o chão de amarelo.",
      "Júpiter domina o céu com 19° — 36× a área da Lua cheia.",
    ],
  },

  europa: {
    bodyId: "europa",
    viewLabel: "Crosta de gelo rachado",
    skyTop: "#020208",
    skyHorizon: "#20202a",
    sunAngularDeg: 0.1,
    sunElevationDeg: 28,
    sunAzimuthDeg: 60,
    sunVisible: true,
    sunColor: "#f0ecd8",
    starsVisible: true,
    starDensity: 0.9,
    terrainBase: "#d8d0c0",
    terrainMid: "#c0b8a8",
    terrainDark: "#a08060",
    terrainScale: 4.2,
    terrainAmp: 0.8,
    cloudSea: false,
    fogColor: "#101018",
    fogDensity: 0.0008,
    effects: "none",
    gravityMs2: 1.315,
    dayLength: "3,55 dias terrestres",
    pressure: "~10⁻¹¹ bar (O₂)",
    temperature: "-160 °C",
    visibleBodies: [E("jupiter", "Júpiter", "jupiter", 11.9, 145, 42)],
    notes: [
      "Linhas vermelhas (lineae) cruzam o gelo — fraturas de um oceano subsuperficial.",
      "Júpiter cresce e encolhe no céu conforme Europa gira em rotação travada.",
    ],
  },

  ganymede: {
    bodyId: "ganymede",
    viewLabel: "Gelo antigo craterado",
    skyTop: "#020208",
    skyHorizon: "#1e1e26",
    sunAngularDeg: 0.1,
    sunElevationDeg: 28,
    sunAzimuthDeg: 60,
    sunVisible: true,
    sunColor: "#f0ecd8",
    starsVisible: true,
    starDensity: 0.9,
    terrainBase: "#8a8278",
    terrainMid: "#a39c90",
    terrainDark: "#5c564c",
    terrainScale: 3.2,
    terrainAmp: 1.8,
    cloudSea: false,
    fogColor: "#101016",
    fogDensity: 0.0008,
    effects: "none",
    gravityMs2: 1.428,
    dayLength: "7,15 dias terrestres",
    pressure: "Vácuo (traços de O₂)",
    temperature: "-163 °C",
    visibleBodies: [E("jupiter", "Júpiter", "jupiter", 7.5, 148, 40)],
    notes: [
      "A maior lua do sistema solar tem campo magnético próprio e auroras fracas.",
    ],
  },

  callisto: {
    bodyId: "callisto",
    viewLabel: "Superfície mais craterada",
    skyTop: "#020208",
    skyHorizon: "#1a1a22",
    sunAngularDeg: 0.1,
    sunElevationDeg: 28,
    sunAzimuthDeg: 60,
    sunVisible: true,
    sunColor: "#f0ecd8",
    starsVisible: true,
    starDensity: 0.9,
    terrainBase: "#5c544a",
    terrainMid: "#746c60",
    terrainDark: "#3a342c",
    terrainScale: 3.8,
    terrainAmp: 2.0,
    cloudSea: false,
    fogColor: "#0e0e14",
    fogDensity: 0.0008,
    effects: "none",
    gravityMs2: 1.235,
    dayLength: "16,7 dias terrestres",
    pressure: "Vácuo (traços de CO₂)",
    temperature: "-139 °C",
    visibleBodies: [E("jupiter", "Júpiter", "jupiter", 4.3, 150, 38)],
    notes: [
      "A superfície mais antiga e craterada conhecida — um registro de 4 bilhões de anos.",
    ],
  },

  enceladus: {
    bodyId: "enceladus",
    viewLabel: "Gelo fresco e brilhante",
    skyTop: "#020208",
    skyHorizon: "#24242c",
    sunAngularDeg: 0.053,
    sunElevationDeg: 26,
    sunAzimuthDeg: 62,
    sunVisible: true,
    sunColor: "#eae6d2",
    starsVisible: true,
    starDensity: 0.95,
    terrainBase: "#e8e8e4",
    terrainMid: "#d4d4ce",
    terrainDark: "#a8a8a0",
    terrainScale: 3.0,
    terrainAmp: 0.9,
    cloudSea: false,
    fogColor: "#14141a",
    fogDensity: 0.0008,
    effects: "none",
    gravityMs2: 0.113,
    dayLength: "1,37 dias terrestres",
    pressure: "Vácuo (gêiseres de H₂O)",
    temperature: "-201 °C",
    visibleBodies: [E("saturn", "Saturno", "saturn", 27.5, 140, 35)],
    notes: [
      "Gêiseres no polo sul lançam gelo ao espaço — a superfície é a mais refletiva do sistema.",
      "Saturno preenche 27° do céu, com os anéis quase de perfil.",
    ],
  },

  rhea: {
    bodyId: "rhea",
    viewLabel: "Gelo acinzentado",
    skyTop: "#020208",
    skyHorizon: "#202028",
    sunAngularDeg: 0.053,
    sunElevationDeg: 26,
    sunAzimuthDeg: 62,
    sunVisible: true,
    sunColor: "#eae6d2",
    starsVisible: true,
    starDensity: 0.95,
    terrainBase: "#a8a4a0",
    terrainMid: "#bdbab4",
    terrainDark: "#7c7872",
    terrainScale: 3.2,
    terrainAmp: 1.2,
    cloudSea: false,
    fogColor: "#121218",
    fogDensity: 0.0008,
    effects: "none",
    gravityMs2: 0.264,
    dayLength: "4,52 dias terrestres",
    pressure: "Vácuo (traços de O₂/CO₂)",
    temperature: "-173 °C",
    visibleBodies: [E("saturn", "Saturno", "saturn", 12.6, 145, 38)],
    notes: ["Segunda maior lua de Saturno, coberta de gelo de água craterado."],
  },

  titan: {
    bodyId: "titan",
    viewLabel: "Dunas de hidrocarbonetos",
    skyTop: "#a06828",
    skyHorizon: "#d89a4a",
    sunAngularDeg: 0.053,
    sunElevationDeg: 25,
    sunAzimuthDeg: 60,
    sunVisible: false,
    sunColor: "#e8c080",
    starsVisible: false,
    starDensity: 0,
    terrainBase: "#4a3f30",
    terrainMid: "#5f5240",
    terrainDark: "#332b20",
    terrainScale: 2.0,
    terrainAmp: 1.6,
    cloudSea: false,
    fogColor: "#b8843e",
    fogDensity: 0.0048,
    effects: "haze",
    gravityMs2: 1.352,
    dayLength: "15,9 dias terrestres",
    pressure: "1,45 bar",
    temperature: "-179 °C",
    visibleBodies: [E("saturn", "Saturno", "saturn", 5.5, 150, 30)],
    notes: [
      "Névoa laranja de metano esconde o Sol; chove metano líquido que forma rios e lagos.",
      "Saturno aparece como um disco difuso através da névoa (foto da Huygens, 2005).",
    ],
  },

  miranda: {
    bodyId: "miranda",
    viewLabel: "Penhascos de gelo",
    skyTop: "#020208",
    skyHorizon: "#1e1e28",
    sunAngularDeg: 0.018,
    sunElevationDeg: 24,
    sunAzimuthDeg: 64,
    sunVisible: true,
    sunColor: "#dcdce0",
    starsVisible: true,
    starDensity: 0.95,
    terrainBase: "#9a9aa2",
    terrainMid: "#b4b4bc",
    terrainDark: "#6c6c76",
    terrainScale: 3.4,
    terrainAmp: 2.6,
    cloudSea: false,
    fogColor: "#12121a",
    fogDensity: 0.0008,
    effects: "none",
    gravityMs2: 0.079,
    dayLength: "1,41 dias terrestres",
    pressure: "Vácuo",
    temperature: "-187 °C",
    visibleBodies: [E("uranus", "Urano", "uranus", 22.2, 145, 40)],
    notes: [
      "Verona Rupes, o penhasco mais alto do sistema solar (~20 km), corta o terreno.",
      "Urano aparece enorme, com seus finos anéis quase na vertical.",
    ],
  },

  titania: {
    bodyId: "titania",
    viewLabel: "Gelo e cânions",
    skyTop: "#020208",
    skyHorizon: "#1c1c26",
    sunAngularDeg: 0.018,
    sunElevationDeg: 24,
    sunAzimuthDeg: 64,
    sunVisible: true,
    sunColor: "#dcdce0",
    starsVisible: true,
    starDensity: 0.95,
    terrainBase: "#8a8a92",
    terrainMid: "#a4a4ac",
    terrainDark: "#5e5e68",
    terrainScale: 3.2,
    terrainAmp: 2.0,
    cloudSea: false,
    fogColor: "#101018",
    fogDensity: 0.0008,
    effects: "none",
    gravityMs2: 0.379,
    dayLength: "8,7 dias terrestres",
    pressure: "Vácuo",
    temperature: "-203 °C",
    visibleBodies: [E("uranus", "Urano", "uranus", 6.6, 148, 38)],
    notes: ["Maior lua de Urano, com cânions gigantes que cruzam o gelo acinzentado."],
  },

  oberon: {
    bodyId: "oberon",
    viewLabel: "Gelo craterado escuro",
    skyTop: "#020208",
    skyHorizon: "#1a1a24",
    sunAngularDeg: 0.018,
    sunElevationDeg: 24,
    sunAzimuthDeg: 64,
    sunVisible: true,
    sunColor: "#dcdce0",
    starsVisible: true,
    starDensity: 0.95,
    terrainBase: "#7c7468",
    terrainMid: "#948c80",
    terrainDark: "#524c42",
    terrainScale: 3.4,
    terrainAmp: 1.8,
    cloudSea: false,
    fogColor: "#100f16",
    fogDensity: 0.0008,
    effects: "none",
    gravityMs2: 0.346,
    dayLength: "13,5 dias terrestres",
    pressure: "Vácuo",
    temperature: "-198 °C",
    visibleBodies: [E("uranus", "Urano", "uranus", 5.0, 150, 36)],
    notes: ["A mais externa das grandes luas de Urano, coberta de crateras com pisos escuros."],
  },

  triton: {
    bodyId: "triton",
    viewLabel: "Gelo de nitrogênio rosa",
    skyTop: "#2a2438",
    skyHorizon: "#c9a8a8",
    sunAngularDeg: 0.01,
    sunElevationDeg: 22,
    sunAzimuthDeg: 66,
    sunVisible: true,
    sunColor: "#e8dcd0",
    starsVisible: true,
    starDensity: 0.5,
    terrainBase: "#d8b8b0",
    terrainMid: "#c9a8a0",
    terrainDark: "#b09088",
    terrainScale: 2.4,
    terrainAmp: 1.0,
    cloudSea: false,
    fogColor: "#b09a98",
    fogDensity: 0.0012,
    effects: "haze",
    gravityMs2: 0.779,
    dayLength: "5,9 dias terrestres (retrógrado)",
    pressure: "~10⁻⁵ bar (N₂)",
    temperature: "-235 °C",
    visibleBodies: [E("neptune", "Netuno", "neptune", 7.9, 148, 42)],
    notes: [
      "Gêiseres de nitrogênio lançam poeira escura sobre o gelo cor-de-rosa 'cantaloupe'.",
      "Órbita retrógrada: Tritão é um objeto do cinturão de Kuiper capturado.",
    ],
  },

  nereid: {
    bodyId: "nereid",
    viewLabel: "Gelo distante e excêntrico",
    skyTop: "#020208",
    skyHorizon: "#18181f",
    sunAngularDeg: 0.009,
    sunElevationDeg: 22,
    sunAzimuthDeg: 66,
    sunVisible: true,
    sunColor: "#d8d0c0",
    starsVisible: true,
    starDensity: 0.9,
    terrainBase: "#8a8478",
    terrainMid: "#a09a8c",
    terrainDark: "#5c584e",
    terrainScale: 3.0,
    terrainAmp: 1.4,
    cloudSea: false,
    fogColor: "#0e0e14",
    fogDensity: 0.0007,
    effects: "none",
    gravityMs2: 0.07,
    dayLength: "~11,5 h (estimado)",
    pressure: "Vácuo",
    temperature: "-223 °C",
    visibleBodies: [E("neptune", "Netuno", "neptune", 0.5, 150, 40)],
    notes: [
      "A órbita mais excêntrica de qualquer lua: Netuno varia de enorme a um ponto.",
      "Vista da Voyager 2 em 1989 a 4,7 milhões de km — nunca visitada de perto.",
    ],
  },
};

/**
 * Refinamentos de realismo mapeados da série de Ron Miller
 * ("O Sol visto de cada planeta", ex-diretor de arte da NASA) e cruzados
 * com fotografias reais: Venera 13/14, Mariner 10/MESSENGER, Apollo,
 * Pathfinder/Curiosity/Perseverance, Voyager 1/2, Galileo, Cassini-Huygens.
 */
const AIRLESS = {
  glareBoost: 2.4,
  ambient: 0.07,
  sunStrength: 1.5,
  sparkle: 0.6,
  milkyWay: 0.35,
} as const;

export const REALISM_PATCHES: Record<string, NonNullable<SurfaceViewDef["realism"]>> = {
  /* Sol 2,8× maior: disco ofuscante coroado por halo, sombras de navalha */
  mercury: {
    ...AIRLESS,
    glareBoost: 3.4,
    sunStrength: 1.75,
    sunTint: "#fff2d8",
    sparkle: 0.45,
    rockField: { count: 100, maxScale: 4.5, colorA: "#5c574e", colorB: "#8d8578" },
  },

  /* Miller: o Sol some — apenas um clarear difuso âmbar no teto de nuvens de H₂SO₄ */
  venus: {
    sunDiffuse: 1,
    glareBoost: 0.35,
    ambient: 0.82,
    sunStrength: 0.28,
    sunTint: "#ffd9a0",
    skyBands: { amp: 0.38, scale: 2.3, drift: 0.018, colorA: "#eec27f", colorB: "#a97a3c" },
    /* basaltos arredondados pela erosão química — fotos Venera 13/14 */
    rockField: { count: 120, maxScale: 4, colorA: "#6e5a3e", colorB: "#a3855c" },
  },

  earth: {
    glareBoost: 1.35,
    ambient: 0.32,
    sunStrength: 1.12,
    sunTint: "#fff3de",
    skyBands: { amp: 0.2, scale: 3.6, drift: 0.028, colorA: "#ffffff", colorB: "#d9e8f6" },
  },

  /* Apollo: regolito cinza com "brilho de vidro" e céu negro absoluto */
  moon: {
    ...AIRLESS,
    glareBoost: 2.6,
    sparkle: 0.85,
    milkyWay: 0.42,
    rockField: { count: 130, maxScale: 5, colorA: "#4e4c48", colorB: "#83807a" },
  },

  /* Pathfinder/Curiosity: ferrugem viva, dunas, rochas basálticas espalhadas */
  mars: {
    glareBoost: 1.15,
    ambient: 0.26,
    sunStrength: 1.0,
    sunTint: "#ffe6cc",
    skyBands: { amp: 0.08, scale: 5.0, drift: 0.05, colorA: "#f0cdb0", colorB: "#c99873" },
    dunes: 1.15,
    rockField: { count: 190, maxScale: 7.5, colorA: "#6e3a20", colorB: "#a45c34" },
  },

  phobos: {
    ...AIRLESS,
    glareBoost: 2.0,
    sparkle: 0.4,
    sunStrength: 1.3,
    ambient: 0.09,
    rockField: { count: 60, maxScale: 3.5, colorA: "#4a4238", colorB: "#776b5c" },
  },
  deimos: {
    ...AIRLESS,
    glareBoost: 1.9,
    sparkle: 0.4,
    sunStrength: 1.25,
    ambient: 0.09,
    rockField: { count: 45, maxScale: 2.5, colorA: "#52483c", colorB: "#7d7264" },
  },

  /* Galileo: planícies de enxofre sob céu negro; Júpiter domina o horizonte */
  io: {
    ...AIRLESS,
    glareBoost: 2.7,
    sunStrength: 1.35,
    sparkle: 0.3,
    rockField: { count: 70, maxScale: 3.5, colorA: "#8a7a2e", colorB: "#c4a94e" },
  },

  europa: { ...AIRLESS, glareBoost: 2.5, sparkle: 0.9, sunTint: "#f4f0ff" },
  ganymede: {
    ...AIRLESS,
    glareBoost: 2.4,
    sparkle: 0.55,
    rockField: { count: 90, maxScale: 5, colorA: "#57504a", colorB: "#847c70" },
  },
  callisto: {
    ...AIRLESS,
    glareBoost: 2.3,
    sparkle: 0.5,
    ambient: 0.08,
    rockField: { count: 110, maxScale: 5, colorA: "#46423a", colorB: "#726b5e" },
  },

  /* Cassini: mar de metano espelhado, smog laranja, Sol difuso e baço */
  titan: {
    sunDiffuse: 0.92,
    glareBoost: 0.55,
    ambient: 0.68,
    sunStrength: 0.32,
    sunTint: "#ffd9a8",
    skyBands: { amp: 0.32, scale: 2.7, drift: 0.014, colorA: "#eda452", colorB: "#9c6420" },
    /* dunas equatoriais de hidrocarbonetos (areia orgânica escura) */
    dunes: 0.7,
  },
  enceladus: { ...AIRLESS, glareBoost: 2.6, sparkle: 1.0, sunTint: "#f2f6ff" },
  rhea: { ...AIRLESS, glareBoost: 2.4, sparkle: 0.8, sunTint: "#f2f6ff" },

  miranda: { ...AIRLESS, glareBoost: 2.2, sparkle: 0.7, sunTint: "#eef4ff" },
  titania: { ...AIRLESS, glareBoost: 2.2, sparkle: 0.6, sunTint: "#eef4ff" },
  oberon: { ...AIRLESS, glareBoost: 2.2, sparkle: 0.55, sunTint: "#eef4ff" },

  triton: {
    ...AIRLESS,
    glareBoost: 2.5,
    sparkle: 0.85,
    sunTint: "#f0f6ff",
    ambient: 0.1,
    rockField: { count: 55, maxScale: 3, colorA: "#9aa4ac", colorB: "#d4dce2" },
  },
  nereid: { ...AIRLESS, glareBoost: 2.0, sparkle: 0.5, sunStrength: 1.2 },

  /* Miller: o Sol vira um ponto minúsculo porém ~27× mais brilhante que a Lua cheia */
  jupiter: {
    sunDiffuse: 0.1,
    glareBoost: 4.6,
    ambient: 0.5,
    sunStrength: 0.9,
    sunTint: "#fff8ea",
    skyBands: { amp: 0.52, scale: 5.6, drift: 0.05, colorA: "#e9d6b2", colorB: "#a3794f" },
  },

  /* Cassini: deck dourado-pálido; faixas mais suaves que as de Júpiter */
  saturn: {
    glareBoost: 3.6,
    ambient: 0.55,
    sunStrength: 0.85,
    sunTint: "#fff6dd",
    skyBands: { amp: 0.34, scale: 4.4, drift: 0.034, colorA: "#eedcb0", colorB: "#c3a26b" },
  },

  /* Voyager 2: céu aqua quase sem feições, Sol como estrela ofuscante */
  uranus: {
    glareBoost: 3.2,
    ambient: 0.6,
    sunStrength: 0.75,
    sunTint: "#f4ffff",
    skyBands: { amp: 0.1, scale: 3.0, drift: 0.02, colorA: "#c2f0f2", colorB: "#8fd6da" },
  },

  /* Voyager 2: azul profundo, tênues faixas e cirros; Sol é farol puntual */
  neptune: {
    glareBoost: 3.8,
    ambient: 0.5,
    sunStrength: 0.8,
    sunTint: "#f2f6ff",
    skyBands: { amp: 0.22, scale: 4.2, drift: 0.03, colorA: "#82b2ff", colorB: "#3a66d8" },
  },
};

/** aplica o patch de realismo sobre a definição base (não-mutável) */
export function getViewRealism(id: string): SurfaceViewDef | null {
  const base = SURFACE_VIEWS[id];
  if (!base) return null;
  return { ...base, realism: REALISM_PATCHES[id] ?? {} };
}

export const getSurfaceView = (id: string): SurfaceViewDef | null => getViewRealism(id);
