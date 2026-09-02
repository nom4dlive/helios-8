# ORBE — Atlas de Mundos Exoplanetários

Simulação 3D interativa (React + Three.js + Tailwind v4) de **22 sistemas exoplanetários reais** com 60 mundos, visita em primeira pessoa às superfícies e um professor alienígena que ensina ciência em linguagem acessível.

## 🔭 Fontes dos dados

| Fonte | O que foi usado |
|---|---|
| **Habitable Worlds Catalog** (PHL @ UPR Arecibo) | 12 sistemas focados em habitabilidade (Proxima b, TRAPPIST-1, Teegarden, Kepler-62/186/452…) |
| **Open Exoplanet Catalogue** (systems.xml, Rein et al.) | Esquema de metadados — método e ano de descoberta, excentricidade, metalicidade [Fe/H] — e 10 mundos extremos (51 Peg b, KELT-9 b, HR 8799, pulsar PSR B1257+12…) |
| **NASA Exoplanet Archive** | Raios, massas, períodos, temperaturas de equilíbrio, tipos espectrais |

## ✨ Recursos

### Explorador de sistemas
- **Órbitas elípticas reais** — excentricidade do catálogo resolvida pela equação de Kepler (Newton, 6 iterações); semieixo maior derivado pela **3ª lei de Kepler** (`a³ = P²·M★`).
- **Zona habitável de Kopparapu** desenhada em verde; planetas candidatos destacados.
- **12 classes de mundo** com superfícies procedurais próprias (GLSL): temperado, desértico, **lava com veios emissivos em bloom**, oceânico (especular), hycean, super-Terra, mini-Netuno, Júpiter quente, gigante gasoso, **gigante imageado** (jovem e incandescente) e **mundo de pulsar** (estrela-farol piscante).
- Estrelas com granulação animada, coroa e **modo pulsar**; fundo com nebulosa e 1.600 estrelas cintilantes; bloom em meia resolução.
- **Comparação lado a lado** com o Sol + planetas rochosos, na mesma escala visual.
- Controles de **pausa / velocidade (0,25–8×) / rotação (0–3×)**; raycast para selecionar corpos.

### Painel de dados (riqueza OEC)
- Estrela: tipo espectral, temperatura, massa, raio, luminosidade, **metalicidade [Fe/H]**, idade, limites da ZH.
- Planeta: raio, massa, período, **excentricidade**, distância (UA e milhões de km), insolação, temperatura de equilíbrio, **ESI** (Índice de Semelhança com a Terra), **método e ano de descoberta**, classe e nota científica.

### Visita à superfície (1ª pessoa)
- Céu com o **tamanho angular real da estrela** (KELT-9 b: Sol de 36°; Proxima b: 1,7°), estrelas, faixas de nuvens e pulso de pulsar.
- Terreno procedural assado na CPU com **colisão exata**; caminhada **WASD + Shift** com passada que varia com a gravidade local (`g = GM/R²`).
- Mundos gasosos/hycean viram **mares de nuvens** flutuantes; mundos de lava brilham nas fraturas.
- "Diário do Visitante" com o que você veria; telemetria (FPS, rumo, posição, FOV, gravidade, Ø do Sol).

### Prof. Zyx 👽
Personagem em canvas (flutuação, piscadas, aceno, jetpack) que narra curiosidades **TDAH-friendly** — frases curtas, uma ideia por balão, palavras-chave em negrito, efeito máquina de escrever. Alterna fatos gerais e **fatos dinâmicos gerados sobre o sistema em exibição**.

## 🎮 Controles

| Ação | Entrada |
|---|---|
| Orbitar câmera / zoom | arrastar / rolar |
| Selecionar corpo | clique |
| Pausar simulação | `Espaço` |
| Limpar seleção / sair da visita | `Esc` |
| Caminhar / correr na superfície | `WASD` / `Shift` |
| Olhar ao redor na superfície | arrastar |

## 🛠 Arquitetura

```
src/
├── data/catalog.ts        # 22 sistemas, 60 planetas, helpers (Kepler, HZ, ESI), fatos
├── three/shaders.ts       # GLSL unificado (planetas, estrelas, céu, terreno, rochas, fundo)
├── three/ExoScene.ts      # explorador orbital (bloom, seleção, comparação, controles)
├── three/SurfaceScene.ts  # visita 1ª pessoa (terreno assado, perfis por classe)
├── components/            # AlienTeacher, SurfaceVisit
├── lib/sound.ts           # micro-feedback WebAudio
└── App.tsx                # layout: lista · viewport · painel de dados
```

Rodar: `npm install` → `npm run dev` · Build: `npm run build`.

*Escalas orbitais e de raio usam leis de potência idênticas em todos os sistemas (comparação justa, não escala real). Grandezas angulares e físicas da visita usam valores reais.*
