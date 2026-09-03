# ORBE · Atlas de Mundos Exoplanetários

Simulação 3D interativa (React + Three.js + Tailwind v4) com três modos integrados: exploração completa do **Sistema Solar**, catálogo de **exoplanetas reais** (HWC + Open Exoplanet Catalogue) e um **comparador universal** de estrelas, planetas e luas.

## 🧭 Os três modos (teclas `1` `2` `3`)

| Modo | Conteúdo |
|---|---|
| **Sistema Solar** | Sol + 8 planetas + 15 luas em órbitas keplerianas reais (excentricidade, periélio, inclinação axial), anéis de Saturno/Urano, cinturão de asteroides, rótulos flutuantes e foco de câmera em qualquer corpo. |
| **Exoplanetas** | 22 sistemas reais / 60 mundos: TRAPPIST-1, Proxima, TOI-700, Teegarden, Kepler-186/452/22, KELT-9 b, HR 8799, planetas de pulsar… com zona habitável de Kopparapu, ESI, metalicidade e método/ano de descoberta. |
| **Comparar** | **Observatório de Comparação 3D**: até 3 estrelas, planetas ou luas (de qualquer sistema, inclusive o Solar) renderizados **lado a lado em pedestais holográficos giratórios com os mesmos shaders de alto realismo** das cenas principais. Alterne entre *proporção real* e *tamanhos iguais*, use presets rápidos, régua de raio em escala log e um seletor de corpos por categoria. |

## 🕹 Controles

| Ação | Controle |
|---|---|
| Orbitar câmera / zoom | arrastar / rolar (ou botões ⊕ ⊖ do dock) |
| Focar corpo | clique na cena, no trilho lateral ou no painel |
| Pausar / velocidade / rotação | dock inferior (Espaço alterna pausa) |
| Visão geral (reenquadrar) | botão no dock |
| Visitar superfície (1ª pessoa) | botão "Pousar" no painel → WASD caminha, Shift corre, Esc volta |
| Trocar de modo | abas no topo ou teclas 1/2/3 |

## 🪐 Visita em primeira pessoa

Cada um dos 23 corpos do Sistema Solar e todos os exoplanetas têm perfil de visita próprio: céu com o **tamanho angular real** da estrela, terreno procedural com colisão exata, gravidade local (a passada muda na Lua vs. Júpiter), rochas, poeira e o "Diário do Visitante" com fatos científicos.

## ⚖️ Comparador

- **Estrelas**: temperatura, massa, raio, luminosidade, metalicidade, nº de planetas, distância.
- **Planetas**: raio, massa, período, distância à estrela, insolação, temperatura de equilíbrio, ESI, badge de zona habitável.
- **Luas**: raio, distância do planeta, período orbital.
- Presets rápidos ("Terra × TRAPPIST-1e", "Sol × anã vermelha", "Mundos de oceano"…) e busca com filtro.

## 🗂 Arquitetura

```
src/
├── App.tsx                  modos, dock de simulação, navegação segmentada
├── data/
│   ├── catalog.ts           22 sistemas exoplanetários + helpers (Kepler, Kopparapu, ESI)
│   ├── solarSystem.ts       Sol, 8 planetas, 15 luas + perfis de visita
│   ├── compare.ts           listas unificadas do comparador
│   └── bodySpecs.ts         resolve qualquer corpo → spec 3D p/ os shaders realistas
├── three/
│   ├── shaders.ts           biblioteca GLSL (ruído, superfícies, céu, terreno, anéis)
│   ├── SolarScene.ts        cena orbital do Sistema Solar (bloom, kepler, luas)
│   ├── ExoScene.ts          cena de sistemas exoplanetários (12 classes de mundo)
│   ├── CompareScene.ts      palco 3D do comparador (pedestais giratórios)
│   └── SurfaceScene.ts      visita em 1ª pessoa (terreno assado na CPU, colisão)
├── components/
│   ├── ComparePanel.tsx     observatório de comparação (slots, presets, picker)
│   ├── SolarDetailPanel.tsx painel de dados do Sistema Solar
│   ├── SurfaceVisit.tsx     overlay da visita (telemetria, diário)
│   └── AlienTeacher.tsx     Prof. Zyx — curiosidades TDAH-friendly
└── lib/sound.ts             feedback sonoro (WebAudio)
```

## ▶️ Executar

```bash
npm install
npm run dev      # desenvolvimento
npm run build    # produção (dist/)
```

*Fontes: NASA Exoplanet Archive · Open Exoplanet Catalogue (Rein et al.) · Habitable Worlds Catalog (PHL @ UPR Arecibo) · NASA Planetary Fact Sheets. Escalas orbitais visuais usam lei de potência para legibilidade; grandezas angulares e físicas são reais.*
