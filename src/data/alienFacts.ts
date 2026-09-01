import type { ExoSystem } from "./exoplanets";
import { fmtNum } from "./bodies";

/**
 * Curiosidades do Prof. Zyx — linguagem TDAH-friendly:
 * frases curtas, UMA ideia por balão, comparações concretas e palavras-chave em **negrito**.
 */
export interface AlienFact {
  id: string;
  text: string;
}

export const ALIEN_FACTS: AlienFact[] = [
  { id: "f1", text: "Já achamos mais de **5.000 exoplanetas**! E isso é só o começo da conta." },
  { id: "f2", text: "Um **ano** em TRAPPIST-1e dura só **6 dias**. Sua semana inteira cabe num ano de lá!" },
  { id: "f3", text: "A **zona habitável** é a distância certa da estrela: nem quente demais, nem frio demais. Como cachinhos dourados." },
  { id: "f4", text: "**Proxima b** é o exoplaneta mais perto da Terra: 4,2 anos-luz. Uma nave atual levaria **70 mil anos** até lá." },
  { id: "f5", text: "Anãs vermelhas são pequenas e **vivem trilhões de anos**. Os planetas delas têm muito tempo pra vida aparecer." },
  { id: "f6", text: "Tem planeta com **chuva de vidro** e outro com **ferro derretido**. Sorte a nossa ter água!" },
  { id: "f7", text: "O método do **trânsito** flagra planetas passando na frente da estrela — tipo um mosquito cruzando um farol." },
  { id: "f8", text: "**Kepler-452b** tem um ano de 385 dias, quase igual ao nosso. Por isso chamam de 'primo da Terra'." },
  { id: "f9", text: "A luz de algumas estrelas que você vê **viajou 600 anos** até chegar aqui. Você está vendo o passado!" },
  { id: "f10", text: "Planetas travados na estrela têm um lado **sempre dia** e outro **sempre noite**. O crepúsculo mora na borda." },
  { id: "f11", text: "**Kepler-22b** pode ser um mundo-oceano: água por todos os lados, sem continente nenhum." },
  { id: "f12", text: "O telescópio **James Webb** cheira o ar de exoplanetas! Ele procura vapor d'água e CO₂ lá longe." },
  { id: "f13", text: "Existem planetas **maiores que Júpiter** que dão a volta na estrela em menos de 4 dias. Velocidade pura!" },
  { id: "f14", text: "Se você pesa 30 kg na Terra, num planeta com o dobro da gravidade pesaria **60 kg**. Academia grátis!" },
  { id: "f15", text: "Quase toda estrela que você vê no céu tem **pelo menos um planeta**. O universo é lotado de mundos!" },
  { id: "f16", text: "O **ESI** mede o quanto um planeta parece com a Terra: 0 = nada, 1 = gêmeo. A Terra é o gabarito." },
];

/** gera curiosidades dinâmicas sobre o sistema que está na tela */
export function systemFacts(sys: ExoSystem): AlienFact[] {
  const shortest = [...sys.planets].sort((a, b) => a.periodDays - b.periodDays)[0];
  const biggest = [...sys.planets].sort((a, b) => b.radiusEarth - a.radiusEarth)[0];
  const habitable = sys.planets.filter((p) => p.fluxEarth != null && p.fluxEarth >= 0.35 && p.fluxEarth <= 1.5);
  const facts: AlienFact[] = [
    {
      id: `${sys.id}-ano`,
      text: `Aqui em **${sys.starName}**, o ano mais curto dura **${fmtNum(shortest.periodDays, shortest.periodDays < 10 ? 1 : 0)} dias**. Pisque e já é ano novo!`,
    },
    {
      id: `${sys.id}-luz`,
      text: `A luz de **${sys.starName}** leva **${fmtNum(sys.distLy, sys.distLy < 20 ? 1 : 0)} anos** pra chegar na Terra. Um 'oi' demoraria o dobro pra voltar!`,
    },
    {
      id: `${sys.id}-tipo`,
      text: `**${sys.starName}** é uma estrela **${sys.spectral.type}** a ${fmtNum(sys.spectral.tempK, 0)} K. A cor dela pinta o céu de todos os planetas!`,
    },
  ];
  if (biggest.radiusEarth > 1.6) {
    facts.push({
      id: `${sys.id}-gigante`,
      text: `**${biggest.name.replace(sys.starName, "").trim()}** tem ${fmtNum(biggest.radiusEarth, 2)}× o raio da Terra. Pode ser um mundo de água... ou de gás!`,
    });
  }
  if (habitable.length > 0) {
    facts.push({
      id: `${sys.id}-zh`,
      text: `Este sistema tem **${habitable.length} ${habitable.length === 1 ? "candidato" : "candidatos"}** a mundo habitável na zona certa. Água líquida? Talvez!`,
    });
  }
  return facts;
}
