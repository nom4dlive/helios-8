# HELIOS·8 — Observatório Interativo do Sistema Solar

Uma demonstração interativa de aprendizado do sistema solar construída com **React + TypeScript + Three.js (WebGL2)**. Ela combina um **mapa orbital 3D** navegável com um **modo de visita em primeira pessoa** à superfície de cada planeta e lua, renderizando céu, chão, horizonte e fenômenos particulares de cada mundo com shaders GLSL procedurais calibrados por dados reais.

> **Todas as cores, escalas angulares e grandezas físicas são derivadas de dados públicos da NASA/ESA e de efemérides (SkyMap).** A fidelidade é artística nos detalhes, mas fisicamente correta nos ângulos, gravidade, pressão, temperatura e no tamanho aparente dos corpos no céu.

---

## ✦ Recursos

### Modo Mapa Orbital
- Sol com granulação animada, coroa e bloom; os 8 planetas em órbitas com períodos, inclinações e eixos reais (incluindo rotação retrógrada de Vênus e Urano).
- **15 luas nomeadas** (Lua, Fobos, Deimos, Io, Europa, Ganimedes, Calisto, Encélado, Reia, Titã, Miranda, Titânia, Oberon, Tritão e Nereida), cada uma com órbita própria.
- Cinturão de asteroides, campo de 2.400 estrelas cintilantes e nebulosa de fundo.
- Clique em qualquer corpo → painel com **nome, diâmetro, distância do Sol, período orbital, rotação, velocidade, temperatura** e curiosidade.
- Câmera que persegue o corpo selecionado enquanto ele orbita.

### Modo Visita à Superfície (1ª pessoa)
Pouse em **23 corpos** e veja o mundo como um visitante:
- Céu com a cor real de cada atmosfera (céu negro na Lua, caramelo em Marte, laranja em Vênus e Titã, azul na Terra).
- **Tamanho angular real** do Sol e dos planetas/lua no céu — Júpiter ocupa 19° visto de Io; Marte cobre 40° visto de Fobos; a Terra tem 1,9° vista da Lua.
- Terreno procedural fiel: enxofre amarelo em Io, gelo rachado em Europa, dunas de hidrocarboneto em Titã, mar de nuvens nos gigantes gasosos.
- Telemetria de superfície: gravidade, pressão, temperatura, duração do dia e bússola.
- "Diário do visitante" com o que você realmente veria (fontes: Venera, Voyager 2, Cassini/Huygens, Curiosity, Apollo).

---

## 🚀 Como executar

```bash
# instalar dependências
npm install

# ambiente de desenvolvimento (http://localhost:5173)
npm run dev

# verificação de tipos
npm run typecheck

# build de produção (gera dist/)
npm run build
```

---

## 🎮 Como usar

### Mapa Orbital
| Ação | Controle |
|---|---|
| Orbitar a câmera | Arrastar |
| Zoom | Rolar o mouse |
| Selecionar um corpo | Clique no corpo ou no rótulo |
| Pausar / retomar o tempo | `Espaço` ou botão ⏯ |
| Velocidade do tempo | Arrastar o controle (0,1×–100×) |
| Visão geral | Botão "Visão geral" |
| Alternar órbitas / rótulos / cinturão | Botões no painel inferior |

### Modo Visita (1ª pessoa)
| Ação | Controle |
|---|---|
| **Entrar** na superfície | Selecionar um corpo → botão **"Visitar superfície"**, ou teclar `V` |
| Olhar ao redor | Arrastar |
| Aproximar o horizonte (FOV) | Rolar o mouse |
| **Sair** e voltar ao mapa | `Esc` ou botão "Voltar ao mapa" |

---

## 🪐 Corpos visitáveis

| Grupo | Corpos |
|---|---|
| Planetas rochosos | Mercúrio, Vênus, Terra, Marte |
| Gigantes (topo das nuvens) | Júpiter, Saturno, Urano, Netuno |
| Lua da Terra | Lua |
| Luas de Marte | Fobos, Deimos |
| Luas de Júpiter | Io, Europa, Ganimedes, Calisto |
| Luas de Saturno | Encélado, Reia, Titã |
| Luas de Urano | Miranda, Titânia, Oberon |
| Luas de Netuno | Tritão, Nereida |

O Sol **não** é visitável (é uma esfera de plasma a 5.505 °C) — o painel informa isso.

---

## 🏗 Arquitetura técnica

```
src/
├── App.tsx                     # composição, estados, atalhos de teclado
├── data/
│   ├── bodies.ts               # Sol, 8 planetas e 15 luas (dados reais)
│   └── surfaceViews.ts         # configs de céu/terreno por corpo (modo visita)
├── three/
│   ├── shaders.ts              # biblioteca GLSL (noise, fBm) + shaders do mapa
│   ├── SolarSystem.ts          # cena orbital, raycasting, câmera de perseguição
│   └── SurfaceScene.ts         # renderizador 1ª pessoa (céu, terreno, corpos)
├── components/
│   ├── Hud.tsx  NavRail.tsx  ControlDock.tsx
│   ├── InfoPanel.tsx           # dados do corpo + botão de visita
│   └── SurfaceVisit.tsx        # HUD do modo visita (bússola, telemetria)
└── lib/sound.ts                # feedback sonoro (WebAudio)
```

- **Shaders procedurais:** value-noise + fBm + ridged noise geram as texturas de todos os corpos em tempo real (sem imagens externas), garantindo carregamento instantâneo e resolução infinita.
- **Pós-processamento:** `UnrealBloomPass` + `OutputPass` com tone mapping ACES no mapa orbital; renderização direta com ACES no modo visita.
- **Escalas:** distâncias e raios usam escalas comprimidas (não lineares) para caber na cena — indicado na interface. Já as **escalas angulares do modo visita são reais** (calculadas por trigonometria a partir de raios e distâncias verdadeiros).

---

## 📚 Fontes dos dados

- **NASA / JPL** — raios, distâncias médias, períodos orbitais e de rotação, gravidade, pressão e temperatura ([nasa.gov/planets](https://science.nasa.gov/solar-system/)).
- **ESA** — resultados das missões Venera (Vênus), Cassini/Huygens (Titã) e Rosetta.
- **Voyager 2 (NASA)** — luas de Urano e Netuno (Miranda, Titânia, Oberon, Tritão, Nereida).
- **SkyMap / efemérides** — verificação dos diâmetros angulares aparentes.
- Cores de céu e superfície emulam fotografias reais: Apollo (Lua), Curiosity/Perseverance (Marte), Galileo (luas de Júpiter), Cassini (Saturno e luas).

> Por serem shaders procedurais inspirados nessas referências — e não texturas fotográficas — a experiência carrega instantaneamente e permanece nítida em qualquer zoom, mantendo fidelidade nas cores e proporções angulares.
