import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { CMP_STARS, CMP_PLANETS, CMP_MOONS, type CmpStar, type CmpPlanet, type CmpMoon } from "../data/compare";
import { fmtNum } from "../data/catalog";
import { sfx } from "../lib/sound";

type Tab = "stars" | "planets" | "moons";
type ScaleMode = "linear" | "sqrt" | "log";

const SLOT_COLORS = ["#f5b342", "#5fd08a", "#7fb8ff"];
const MAX_SLOTS = 3;

interface Metric<T> {
  label: string;
  note?: string;
  get: (t: T) => number | null;
  scale: ScaleMode;
  fmt: (v: number) => string;
  noBar?: boolean;
  zeroLabel?: string;
}

const scaleVal = (v: number, mode: ScaleMode) =>
  mode === "log" ? Math.log10(Math.max(v, 1e-6)) : mode === "sqrt" ? Math.sqrt(Math.max(v, 0)) : v;

function delta(v: number, base: number): string {
  if (base <= 0 || v <= 0) return "—";
  const r = v / base;
  if (r >= 10) return `${fmtNum(r, r >= 100 ? 0 : 1)}×`;
  if (r >= 1) return `+${fmtNum((r - 1) * 100, 0)}%`;
  return `−${fmtNum((1 - r) * 100, 0)}%`;
}

/* ------------------------------------------------------------ métricas */

const STAR_METRICS: Metric<CmpStar>[] = [
  { label: "Temperatura", note: "define a cor da estrela", get: (s) => s.tempK, scale: "linear", fmt: (v) => `${fmtNum(v, 0)} K` },
  { label: "Massa", get: (s) => s.massSun, scale: "log", fmt: (v) => `${fmtNum(v, 2)} M☉` },
  { label: "Raio", get: (s) => s.radiusSun, scale: "log", fmt: (v) => `${fmtNum(v, 2)} R☉` },
  { label: "Luminosidade", get: (s) => s.lumSun, scale: "log", fmt: (v) => `${fmtNum(v, v < 0.01 ? 4 : 2)} L☉` },
  { label: "Metalicidade", note: "[Fe/H] — berços de planetas rochosos", get: (s) => s.metallicity ?? null, scale: "linear", fmt: (v) => `${v > 0 ? "+" : ""}${fmtNum(v, 2)}`, noBar: true },
  { label: "Planetas conhecidos", get: (s) => s.planetCount, scale: "linear", fmt: (v) => `${fmtNum(v, 0)}` },
  { label: "Distância da Terra", get: (s) => s.distLy, scale: "log", fmt: (v) => `${fmtNum(v, v < 20 ? 2 : 0)} al`, zeroLabel: "você está aqui" },
];

const PLANET_METRICS: Metric<CmpPlanet>[] = [
  { label: "Raio", get: (p) => p.radiusEarth, scale: "sqrt", fmt: (v) => `${fmtNum(v, 2)} R⊕` },
  { label: "Massa", get: (p) => p.massEarth ?? null, scale: "log", fmt: (v) => `${fmtNum(v, 2)} M⊕` },
  { label: "Período orbital", note: "duração do ano local", get: (p) => p.periodDays, scale: "log", fmt: (v) => `${fmtNum(v, v < 10 ? 2 : 0)} dias` },
  { label: "Distância à estrela", get: (p) => p.distAU, scale: "log", fmt: (v) => `${fmtNum(v, 3)} UA` },
  { label: "Insolação", note: "Terra = 1,00 S⊕", get: (p) => p.flux ?? null, scale: "log", fmt: (v) => `${fmtNum(v, 2)} S⊕` },
  { label: "Temp. de equilíbrio", get: (p) => p.teqK ?? null, scale: "linear", fmt: (v) => `${fmtNum(v, 0)} K · ${fmtNum(v - 273.15, 0)} °C` },
  { label: "ESI", note: "Índice de Semelhança com a Terra (Terra = 1,00)", get: (p) => p.esiVal ?? null, scale: "linear", fmt: (v) => fmtNum(v, 2) },
];

const MOON_METRICS: Metric<CmpMoon>[] = [
  { label: "Raio", get: (m) => m.radiusKm, scale: "sqrt", fmt: (v) => `${fmtNum(v, 0)} km` },
  { label: "Distância do planeta", get: (m) => m.orbitKm, scale: "log", fmt: (v) => `${fmtNum(v, 0)} km` },
  { label: "Período orbital", get: (m) => m.periodDays, scale: "log", fmt: (v) => `${fmtNum(v, v < 10 ? 2 : 1)} dias` },
];

/* ------------------------------------------------------------ presets */

/* matching tolerante: ignora espaços e hífens ("TRAPPIST-1 e" ≡ "TRAPPIST-1e") */
const norm = (s: string) => s.toLowerCase().replace(/[\s-]/g, "");
const byStar = (n: string) => CMP_STARS.find((s) => norm(s.name).includes(norm(n)))?.id;
const byPlanet = (n: string) => CMP_PLANETS.find((p) => norm(p.name).includes(norm(n)))?.id;
const byMoon = (n: string) => CMP_MOONS.find((m) => norm(m.name).includes(norm(n)))?.id;

const PRESETS: Record<Tab, { label: string; ids: (string | undefined)[] }[]> = {
  stars: [
    { label: "Sol × anã vermelha", ids: [byStar("Sol"), byStar("TRAPPIST")] },
    { label: "Sol × gêmea solar", ids: [byStar("Sol"), byStar("Kepler-452")] },
    { label: "Vizinhas da Terra", ids: [byStar("Proxima"), byStar("TRAPPIST"), byStar("Teegarden")] },
  ],
  planets: [
    { label: "Terra × TRAPPIST-1e", ids: [byPlanet("Terra"), byPlanet("TRAPPIST-1 e")] },
    { label: "Primos da Terra", ids: [byPlanet("Terra"), byPlanet("Kepler-452 b"), byPlanet("Kepler-186 f")] },
    { label: "Gigantes extremos", ids: [byPlanet("Júpiter"), byPlanet("KELT-9 b"), byPlanet("51 Pegasi b")] },
  ],
  moons: [
    { label: "Lua × Titã", ids: [byMoon("Lua"), byMoon("Titã")] },
    { label: "Mundos de oceano", ids: [byMoon("Europa"), byMoon("Encélado"), byMoon("Tritão")] },
  ],
};

/* ------------------------------------------------------------ linha de métrica */

function MetricRow<T>({ m, items, names }: { m: Metric<T>; items: T[]; names: string[] }) {
  const vals = items.map(m.get);
  const numeric = vals.filter((v): v is number => v != null && v > 0);
  const maxF = numeric.length ? Math.max(...numeric.map((v) => scaleVal(v, m.scale))) : 1;

  return (
    <div className="border-b border-line/60 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[9px] tracking-[0.24em] text-dim">{m.label.toUpperCase()}</span>
        {m.note && <span className="hidden font-mono text-[8px] tracking-[0.08em] text-dim/60 sm:block">{m.note}</span>}
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        {items.map((_, i) => {
          const v = vals[i];
          const w = v == null || v <= 0 ? 0 : Math.min(100, Math.max(1.5, (scaleVal(v, m.scale) / maxF) * 100));
          const base = vals[0] ?? 0;
          return (
            <div key={i} className="flex items-center gap-2.5">
              <span className="w-[86px] shrink-0 truncate font-body text-[11.5px] font-medium" style={{ color: SLOT_COLORS[i] }}>
                {names[i]}
              </span>
              <div className="relative h-[17px] flex-1 overflow-hidden bg-white/[0.03]">
                {!m.noBar && (
                  <div
                    className="h-full transition-[width] duration-700 ease-out"
                    style={{
                      width: `${w}%`,
                      background: `linear-gradient(90deg, ${SLOT_COLORS[i]}44, ${SLOT_COLORS[i]})`,
                      boxShadow: `0 0 10px ${SLOT_COLORS[i]}33`,
                    }}
                  />
                )}
              </div>
              <span className="w-[118px] shrink-0 text-right font-mono text-[10.5px] text-ink tabular-nums">
                {v == null ? "—" : v <= 0 && m.zeroLabel ? m.zeroLabel : m.fmt(v)}
              </span>
              <span className="w-[64px] shrink-0 text-right font-mono text-[9px] tabular-nums" style={{ color: i === 0 ? "transparent" : SLOT_COLORS[i] }}>
                {i === 0 ? "·" : v == null || base == null ? "—" : delta(v, base)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ painel */

export default function ComparePanel() {
  const [tab, setTab] = useState<Tab>("planets");
  const [starSel, setStarSel] = useState<string[]>(() => [byStar("Sol"), byStar("TRAPPIST")].filter(Boolean) as string[]);
  const [planetSel, setPlanetSel] = useState<string[]>(() => [byPlanet("Terra"), byPlanet("TRAPPIST-1 e")].filter(Boolean) as string[]);
  const [moonSel, setMoonSel] = useState<string[]>(() => [byMoon("Lua"), byMoon("Titã")].filter(Boolean) as string[]);
  const [query, setQuery] = useState("");

  const toggle = (setter: Dispatch<SetStateAction<string[]>>, id: string) => {
    sfx.select();
    setter((prev) => {
      if (prev.includes(id)) return prev.length > 1 ? prev.filter((x) => x !== id) : prev;
      const next = [...prev, id];
      return next.length > MAX_SLOTS ? [...next.slice(next.length - MAX_SLOTS)] : next;
    });
  };

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (tab === "stars")
      return CMP_STARS.map((s) => ({ id: s.id, title: s.name, sub: `${s.type} · ${s.distLy === 0 ? "aqui" : fmtNum(s.distLy, 0) + " al"}`, color: s.color })).filter(
        (x) => !q || x.title.toLowerCase().includes(q) || x.sub.toLowerCase().includes(q)
      );
    if (tab === "planets")
      return CMP_PLANETS.map((p) => ({ id: p.id, title: p.name, sub: `${p.systemName} · ${fmtNum(p.radiusEarth, 2)} R⊕${p.habitable ? " · ZH" : ""}`, color: p.color })).filter(
        (x) => !q || x.title.toLowerCase().includes(q) || x.sub.toLowerCase().includes(q)
      );
    return CMP_MOONS.map((m) => ({ id: m.id, title: m.name, sub: `lua de ${m.planetName} · ${fmtNum(m.radiusKm, 0)} km`, color: m.color })).filter(
      (x) => !q || x.title.toLowerCase().includes(q) || x.sub.toLowerCase().includes(q)
    );
  }, [tab, query]);

  const sel = tab === "stars" ? starSel : tab === "planets" ? planetSel : moonSel;
  const setter = tab === "stars" ? setStarSel : tab === "planets" ? setPlanetSel : setMoonSel;

  const slots = useMemo(() => {
    if (tab === "stars") {
      const items = starSel.map((id) => CMP_STARS.find((s) => s.id === id)!).filter(Boolean);
      return { items, names: items.map((s) => s.name), metrics: STAR_METRICS as Metric<unknown>[], heads: items.map((s) => ({ title: s.name, sub: `${s.type} · ${s.planetCount} planetas`, color: s.color })) };
    }
    if (tab === "planets") {
      const items = planetSel.map((id) => CMP_PLANETS.find((p) => p.id === id)!).filter(Boolean);
      return {
        items,
        names: items.map((p) => p.name),
        metrics: PLANET_METRICS as Metric<unknown>[],
        heads: items.map((p) => ({
          title: p.name,
          sub: `${p.systemName} · ${p.isSolar ? "Sistema Solar" : "exoplaneta"}${p.habitable ? " · ZONA HABITÁVEL" : ""}`,
          color: p.color,
        })),
      };
    }
    const items = moonSel.map((id) => CMP_MOONS.find((m) => m.id === id)!).filter(Boolean);
    return { items, names: items.map((m) => m.name), metrics: MOON_METRICS as Metric<unknown>[], heads: items.map((m) => ({ title: m.name, sub: `lua de ${m.planetName}`, color: m.color })) };
  }, [tab, starSel, planetSel, moonSel]);

  const TABS: { id: Tab; label: string; count: number; icon: ReactNode }[] = [
    {
      id: "stars", label: "Estrelas", count: CMP_STARS.length,
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" /></svg>,
    },
    {
      id: "planets", label: "Planetas", count: CMP_PLANETS.length,
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="6" /><ellipse cx="12" cy="12" rx="10.5" ry="3.4" transform="rotate(-16 12 12)" /></svg>,
    },
    {
      id: "moons", label: "Luas", count: CMP_MOONS.length,
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="14" cy="12" r="7" /><path d="M9.5 6.5a7 7 0 0 0 0 11" /><circle cx="4" cy="12" r="1.6" /></svg>,
    },
  ];

  return (
    <div className="flex min-h-0 flex-1">
      {/* ══════════ seletor ══════════ */}
      <aside className="flex w-[300px] shrink-0 flex-col border-r border-line bg-panel/90">
        <div className="grid grid-cols-3 border-b border-line">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setQuery(""); sfx.toggle(); }}
              className={`flex flex-col items-center gap-1 py-3 transition-colors ${tab === t.id ? "bg-solar/10 text-solar-hot" : "text-dim hover:text-ink"}`}
            >
              {t.icon}
              <span className="font-mono text-[8.5px] tracking-[0.18em]">{t.label.toUpperCase()}</span>
              <span className="font-mono text-[8px] text-dim/70 tabular-nums">{t.count}</span>
            </button>
          ))}
        </div>

        {/* presets */}
        <div className="border-b border-line px-3 py-2.5">
          <div className="font-mono text-[7.5px] tracking-[0.24em] text-dim">COMPARAÇÕES RÁPIDAS</div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {PRESETS[tab].map((p) => (
              <button
                key={p.label}
                onClick={() => {
                  const ids = p.ids.filter(Boolean) as string[];
                  if (ids.length) { setter(ids); sfx.select(); }
                }}
                className="border border-line px-2 py-1 font-mono text-[8px] tracking-[0.06em] text-dim transition-colors hover:border-solar/50 hover:text-solar-hot"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-3 py-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar ${TABS.find((t) => t.id === tab)?.label.toLowerCase()}…`}
            className="w-full border border-line bg-white/[0.03] px-2.5 py-1.5 font-body text-[12px] text-ink outline-none placeholder:text-dim/50 focus:border-solar/60"
          />
        </div>

        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {list.map((x) => {
            const active = sel.includes(x.id);
            const slotIdx = sel.indexOf(x.id);
            return (
              <button
                key={x.id}
                onClick={() => toggle(setter, x.id)}
                className={`flex w-full items-center gap-2.5 border px-2.5 py-2 text-left transition-all duration-150 ${
                  active ? "border-solar/40 bg-solar/[0.07]" : "border-transparent hover:bg-white/[0.03]"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    background: active ? SLOT_COLORS[slotIdx] : x.color,
                    boxShadow: `0 0 7px ${active ? SLOT_COLORS[slotIdx] : x.color}`,
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate font-body text-[12px] font-medium ${active ? "text-ink" : "text-ink/85"}`}>{x.title}</span>
                  <span className="block truncate font-mono text-[8px] tracking-[0.08em] text-dim">{x.sub}</span>
                </span>
                {active && (
                  <span className="shrink-0 font-mono text-[8.5px] font-semibold" style={{ color: SLOT_COLORS[slotIdx] }}>
                    {slotIdx + 1}º
                  </span>
                )}
              </button>
            );
          })}
          {list.length === 0 && (
            <div className="px-3 py-6 text-center font-mono text-[9px] tracking-[0.16em] text-dim">NADA ENCONTRADO</div>
          )}
        </div>
        <div className="border-t border-line px-3 py-2 font-mono text-[7.5px] leading-relaxed tracking-[0.1em] text-dim/70">
          SELECIONE ATÉ {MAX_SLOTS} CORPOS · ESCALA LOG NAS FAIXAS EXTREMAS
        </div>
      </aside>

      {/* ══════════ resultado ══════════ */}
      <main className="scroll-slim min-h-0 flex-1 overflow-y-auto bg-void/60 px-6 py-5">
        <div className="rise-in mx-auto max-w-[880px]">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[20px] font-bold text-ink">
              Comparação de {TABS.find((t) => t.id === tab)?.label.toLowerCase()}
            </h2>
            <span className="font-mono text-[8.5px] tracking-[0.22em] text-dim">
              {sel.length} {sel.length === 1 ? "CORPO" : "CORPOS"} · BASE = 1º SELECIONADO
            </span>
          </div>

          {/* cabeçalhos dos slots */}
          <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(slots.heads.length, 1)}, 1fr)` }}>
            {slots.heads.map((h, i) => (
              <div
                key={i}
                className="rise-in border bg-panel/80 px-3.5 py-3"
                style={{ borderColor: `${SLOT_COLORS[i]}44`, animationDelay: `${i * 70}ms` }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] font-semibold" style={{ color: SLOT_COLORS[i] }}>{i + 1}º</span>
                  <span className="truncate font-display text-[14px] font-bold text-ink">{h.title}</span>
                </div>
                <div className="mt-1 truncate font-mono text-[8px] tracking-[0.12em] text-dim">{h.sub.toUpperCase()}</div>
                <div className="mt-2 h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${SLOT_COLORS[i]}, transparent)` }} />
              </div>
            ))}
          </div>

          {/* métricas */}
          <div className="mt-2 border border-line bg-panel/60 px-4 py-1">
            {slots.metrics.map((m, i) => (
              <MetricRow key={i} m={m as Metric<never>} items={slots.items as never[]} names={slots.names} />
            ))}
          </div>

          <p className="mt-3 font-mono text-[8px] leading-relaxed tracking-[0.1em] text-dim/70">
            BARRAS NORMALIZADAS PELO MAIOR VALOR DE CADA LINHA · MASSAS, LUMINOSIDADE, PERÍODOS E DISTÂNCIAS USAM
            ESCALA LOGARÍTMICA PARA MANTER PROPORÇÕES LEGÍVEIS · DADOS: NASA EXOPLANET ARCHIVE · OPEN EXOPLANET CATALOGUE · HWC/PHL
          </p>
        </div>
      </main>
    </div>
  );
}
