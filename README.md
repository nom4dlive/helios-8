# HELIOS·8 — Observatório Interativo do Sistema Solar

Simulação 3D interativa (React + Three.js + Tailwind v4) do Sistema Solar com visita em primeira pessoa às superfícies e um catálogo de mundos habitáveis (HWC/PHL @ UPR Arecibo).

## ✦ Recursos

### Modo Mapa Orbital
- Sol com fotosfera animada em HDR, coroa com flicker, glow e bloom ACES.
- **Órbitas keplerianas de verdade** — elipses com excentricidade real e o Sol no foco (`M = E − e·sin E`, Newton com excentricidade clampada); os planetas aceleram no periélio.
- Os 8 planetas + **15 luas nomeadas** (Lua, Fobos, Deimos, Io, Europa, Ganimedes, Calisto, Encélado, Reia, Titã, Miranda, Titânia, Oberon, Tritão retrógrado, Nereida), cada uma com órbita, shader procedural e rótulo próprios.
- Cinturão de asteroides com **rotação diferencial** (interior mais rápido, ω ∝ r^(−3/2)) e **vento solar** animado 100% na GPU.
- Clique em qualquer corpo → painel com nome, diâmetro, distância do Sol, período orbital, rotação, velocidade, temperatura, curiosidade e luas clicáveis. Câmera persegue o corpo enquanto ele orbita.
- Controles: play/pause (`Espaço`), velocidade logarítmica ×0,1–×100, toggles de órbitas/rótulos/cinturão, visão geral, mute.

### Modo Visita à Superfície (1ª pessoa) — `V` ou botão no painel
Pouse em **23 corpos** com céu, terreno e iluminação fisicamente motivados (cores de céu da NASA/Venera/Voyager; série Ron Miller como referência de realismo):
- Sol com **diâmetro angular real** (2,8× maior em Mercúrio, ponto ofuscante em Netuno) + astros no céu com escala angular verdadeira — Júpiter a 19° visto de Io, Marte a 40° visto de Fobos, Terra a 1,9° vista da Lua, Saturno a 30° visto de Encélado.
- **Caminhe com `WASD`** (+ `Shift` para correr) com colisão exata no relevo; a passada escala com a gravidade local; passos sonoros. Nos gigantes gasosos você flutua sobre o mar de nuvens.
- Efeitos por mundo: poeira marciana, **gêiseres balísticos** (nitrogênio em Tritão, SO₂ em Io), cintilação de regolito, Via Láctea nos céus sem atmosfera, faixas de nuvens em deriva, Sol difuso em Vênus e Titã.
- HUD: bússola, gravidade, pressão, temperatura, duração do dia, FPS, coordenadas e "Diário do Visitante".

### Mundos Habitáveis (HWC) — `X` ou botão no dock
- 12 sistemas reais do **Habitable Worlds Catalog** (TRAPPIST-1, Proxima b, TOI-700 d/e, Teegarden b/c, Kepler-62 e/f, Kepler-452 b…) com dados do NASA Exoplanet Archive.
- Órbitas pela **3ª lei de Kepler**, zona habitável calculada (Kopparapu) desenhada em verde, estrelas com temperatura/cor/raio reais por tipo espectral.
- **Comparação lado a lado** com o Sol + planetas rochosos do Sistema Solar, na mesma escala visual.

## 🛠 Auditoria de renderização e desempenho

Correções e otimizações aplicadas à arquitetura:

| Área | Problema típico | Solução implementada |
|---|---|---|
| Resolução | DPR alto (4K/Retina) derruba o FPS com bloom+MSAA | **Pixel ratio adaptativo**: monitora FPS, reduz em degraus de 0,25 abaixo de 42 FPS e recupera com folga acima de 57 |
| Geometria | Uma esfera por corpo = dezenas de buffers grandes | **Esferas unitárias compartilhadas** em 3 tiers de LOD (64/44/26 segmentos); cada malha usa `scale` |
| Terreno 1ª pessoa | Ruído duplicado GPU/JS diverge (precisão de `sin`) → colisão flutuante | **Terreno assado na CPU** (altura + normais no buffer); o shader só lê — colisão pixel-perfect, zero divergência |
| Shaders | Uniforms sem clamp geram NaN/arte fatos | **Todos os parâmetros clampados** no CPU antes de virar uniform; divisor do Kepler protegido (`max(…, 0.1)`), excentricidade ≤ 0,9 |
| Partículas | Atualização CPU por frame | Vento solar e gêiseres resolvidos **100% no vertex shader** (zero escrita em buffer) |
| Render order | Artefatos de transparência | Disciplina explícita: nebulosa −10 → estrelas −5 → superfícies 0 → nuvens 1 → atmosfera 2 → coroa 3 → anéis 4 → vento 5; `depthWrite=false` em tudo que é aditivo |
| Raycast | Teste por frame | Só quando o ponteiro **move**, com early-out |
| DOM | Rótulos causando layout thrash | `translate3d` + `will-change`, visibilidade por classe (sem reflow) |
| Memória | Vazamento em re-mounts (React StrictMode) | `dispose()` completo: geometrias, materiais, composer, controles, observers e canvas removidos |
| Console | Uniforms declarados e não fornecidos (warnings) | Removidos (ex.: `uSunDirFlag`); samplers sempre inicializados |

## ▶ Como executar

```bash
npm install
npm run dev      # desenvolvimento
npm run build    # produção (vite build)
npm run typecheck
```

## 🗂 Estrutura

```
src/
  data/bodies.ts          Sol + 8 planetas + 15 luas (dados reais + presets procedurais)
  data/surfaceViews.ts    23 superfícies visitáveis (céu, terreno, física, notas)
  data/exoplanets.ts      12 sistemas HWC + Kepler/Kopparapu
  three/shaders.ts        GLSL: ruído, planetas, Terra, nuvens, Sol, anéis, estrelas, céu/terreno/rochas/plumas
  three/SolarSystem.ts    engine do mapa (Kepler, LOD, resolução adaptativa, pós-produção)
  three/SurfaceScene.ts   engine de superfície (colisão assada, caminhada, gêiseres)
  three/ExoSystem.ts      engine dos sistemas exoplanetários
  components/             Hud, NavRail, ControlDock, InfoPanel, SurfaceVisit, ExoExplorer
  lib/sound.ts            feedback sonoro WebAudio
```

## Atalhos

| Tecla | Ação |
|---|---|
| `Espaço` | play/pause da simulação |
| `V` | visitar superfície do corpo selecionado |
| `X` | abrir Mundos Habitáveis (HWC) |
| `Esc` | desfocar seleção / sair da visita / fechar HWC |
| `WASD` + `Shift` | caminhar / correr na superfície |

*Fontes: NASA, ESA, PHL @ UPR Arecibo (HWC), NASA Exoplanet Archive, Venera 13/14, Voyager 2, Cassini-Huygens, Curiosity, Apollo. Tamanhos e distâncias do mapa usam escala visual (não real) para legibilidade; a visita em 1ª pessoa usa grandezas angulares reais.*
