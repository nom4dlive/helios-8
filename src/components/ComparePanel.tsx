/**
 * OBSERVATÓRIO DE COMPARAÇÃO — painel 100% visual e interativo.
 * Renderiza os corpos lado a lado em pedestais 3D holográficos (mesmos shaders
 * de alto realismo) e oferece slots comparativos com réguas de escala,
 * presets rápidos e um seletor de estrelas/planetas/luas.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { CompareScene } from "../three/CompareScene";
import { bodySpecFor } from "../data/bodySpecs";
import { CMP_STARS, CMP_PLANETS, CMP_MOONS } from "../data/compare";
import { fmtNum, fmtInt } from "../data/catalog";
import { sfx } from "../lib/sound";

type Tab = "stars" | "planets" | "moons";

interface PickerItem {
  id: string;
  name: string;
  sub: string;
  color: string;
}

const SLOT_COLORS = ["#f5b342", "#7fd4ff", "#5fd08a"];

const PRESETS: { label: string; ids: (string | null)[] }[] = [
  { label: "TERRA × MARTE", ids: ["earth", "mars", null] },
  { label: "TERRA × TRAPPIST-1E", ids: ["earth", "trappist-trappist-e", null] },
  { label: "SOL × ANÃ VERMELHA", ids: ["star-solar", "star-trappist", null] },
  { label: "GIGANTES", ids: ["jupiter", "saturn", "neptune"] },
  { label: "LUAS DE OCEANO", ids: ["europa", "enceladus", "titan"] },
];

function radiusKmOf(id: string | null): number | null {
  if (!id) return null;
  return bodySpecFor(id)?.radiusKm ?? null;
}

function statsOf(id: string | null): { label: string; value: string }[] {
  if (!id) return [];
  const spec = bodySpecFor(id);
  if (!spec) return [];
  if (spec.kind === "star") {
    const s = CMP_STARS.find((x) => x.id === id);
    return [
      { label: "TIPO", value: s?.type ?? "—" },
      { label: "TEMPERATURA", value: `${fmtInt(s?.tempK ?? spec.star?.tempK ?? 0)} K` },
      { label: "MASSA", value: `${fmtNum(s?.massSun ?? 0, 2)} M☉` },
      { label: "LUMINOSIDADE", value: `${fmtNum(s?.lumSun ?? 0, s?.lumSun != null && s.lumSun < 0.01 ? 4 : 2)} L☉` },
    ];
  }
  if (spec.kind === "moon") {
    const m = CMP_MOONS.find((x) => x.id === id);
    return [
      { label: "PLANETA", value: m?.planetName ?? "—" },
      { label: "RAIO", value: `${fmtInt(spec.radiusKm)} km` },
      { label: "ÓRBITA", value: `${fmtInt((m?.orbitKm ?? 0) / 1000)} mil km` },
      { label: "PERÍODO", value: `${fmtNum(m?.periodDays ?? 0, 2)} d` },
    ];
  }
  const p = CMP_PLANETS.find((x) => x.id === id);
  return [
    { label: "RAIO", value: `${fmtNum(spec.radiusKm / 6371, 2)} R⊕` },
    { label: "MASSA", value: p?.massEarth != null ? `${fmtNum(p.massEarth, 2)} M⊕` : "—" },
    { label: "PERÍODO", value: `${fmtNum(p?.periodDays ?? 0, p?.periodDays != null && p.periodDays < 10 ? 2 : 0)} d` },
    { label: "DISTÂNCIA", value: `${fmtNum(p?.distAU ?? 0, 2)} UA` },
  ];
}

function kindLabel(id: string | null): string {
  if (!id) return "";
  const s = bodySpecFor(id);
  if (!s) return "";
  return s.kind === "star" ? "ESTRELA" : s.kind === "moon" ? "LUA" : "PLANETA";
}

export default function ComparePanel({ onClose }: { onClose: () => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CompareScene | null>(null);

  const [slots, setSlots] = useState<(string | null)[]>(["earth", "trappist-trappist-e", null]);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("planets");
  const [query, setQuery] = useState("");
  const [relative, setRelative] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);

  /* cena 3D */
  useEffect(() => {
    if (!mountRef.current || !labelsRef.current) return;
    const scene = new CompareScene(mountRef.current, labelsRef.current, {
      onHover: setHovered,
      onSelect: (id) => {
        /* clicar num corpo abre o picker no slot correspondente */
        const idx = slots.indexOf(id);
        setPickerSlot(idx >= 0 ? idx : 0);
        sfx.select();
      },
    });
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    sceneRef.current?.setBodies(slots);
  }, [slots]);

  useEffect(() => {
    sceneRef.current?.setRelativeScale(relative);
  }, [relative]);

  /* picker */
  const items: PickerItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (n: string) => n.toLowerCase().includes(q);
    if (tab === "stars")
      return CMP_STARS.filter((s) => match(s.name)).map((s) => ({
        id: s.id, name: s.name, sub: `${s.type} · ${fmtNum(s.distLy, 1)} al`, color: s.color,
      }));
    if (tab === "moons")
      return CMP_MOONS.filter((m) => match(m.name)).map((m) => ({
        id: m.id, name: m.name, sub: `lua de ${m.planetName}`, color: m.color,
      }));
    return CMP_PLANETS.filter((p) => match(p.name)).map((p) => ({
      id: p.id, name: p.name, sub: p.systemName, color: p.color,
    }));
  }, [tab, query]);

  const choose = (id: string) => {
    if (pickerSlot == null) return;
    setSlots((s) => s.map((v, i) => (i === pickerSlot ? id : v)));
    setPickerSlot(null);
    setQuery("");
    sfx.select();
  };

  const clear = (i: number) => {
    setSlots((s) => s.map((v, idx) => (idx === i ? null : v)));
    sfx.toggle();
  };

  /* régua de raios (log) entre os corpos presentes */
  const radii = slots.map(radiusKmOf);
  const presentRadii = radii.filter((r): r is number => r != null);
  const maxLog = presentRadii.length ? Math.log10(Math.max(...presentRadii)) : 1;
  const minLog = presentRadii.length ? Math.log10(Math.min(...presentRadii)) : 0;
  const span = Math.max(maxLog - minLog, 0.0001);

  const activeSlots = slots.filter(Boolean).length;

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-void/95">
      {/* ── cabeçalho ── */}
      <header className="flex shrink-0 items-center justify-between border-b border-line bg-panel/90 px-5 py-3">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-[19px] font-bold text-ink">Observatório de Comparação</h2>
          <span className="hidden font-mono text-[8.5px] tracking-[0.24em] text-dim md:block">
            {activeSlots} {activeSlots === 1 ? "CORPO" : "CORPOS"} EM ESCALA {relative ? "REAL" : "IGUAL"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* toggle de escala */}
          <div className="segmented">
            <button className={relative ? "active" : ""} onClick={() => { setRelative(true); sfx.toggle(); }}>
              Proporção real
            </button>
            <button className={!relative ? "active" : ""} onClick={() => { setRelative(false); sfx.toggle(); }}>
              Tamanhos iguais
            </button>
            <span className="seg-ind" style={{ transform: relative ? "translateX(0)" : "translateX(100%)" }} />
          </div>
          <button onClick={onClose} className="btn-icon" title="Voltar (Esc)">
            <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6" fill="none">
              <path d="M1 1l10 10M11 1L1 11" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── presets ── */}
      <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-line bg-panel/60 px-5 py-2">
        <span className="font-mono text-[8px] tracking-[0.24em] text-dim">PRESETS</span>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => { setSlots([...p.ids]); sfx.select(); }}
            className="chip"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── palco 3D ── */}
      <div className="relative min-h-0 flex-1">
        <div ref={mountRef} className="absolute inset-0" />
        <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden" />

        {/* régua de raios sobreposta */}
        {activeSlots > 0 && (
          <div className="pointer-events-none absolute left-1/2 top-4 z-10 w-[min(560px,80%)] -translate-x-1/2">
            <div className="mb-1 text-center font-mono text-[8px] tracking-[0.24em] text-dim">
              RAIO RELATIVO · ESCALA LOG
            </div>
            <div className="flex items-center gap-2">
              {slots.map((id, i) => {
                const r = radii[i];
                if (!id || r == null) return null;
                const w =
                  presentRadii.length === 1
                    ? 100
                    : 8 + 92 * ((Math.log10(r) - minLog) / span);
                return (
                  <div key={id} className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="h-[7px] overflow-hidden rounded-full bg-white/[0.05]">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${w}%`, background: SLOT_COLORS[i], boxShadow: `0 0 10px ${SLOT_COLORS[i]}` }}
                      />
                    </div>
                    <div className="truncate text-center font-mono text-[8.5px] tabular-nums" style={{ color: SLOT_COLORS[i] }}>
                      {fmtInt(r)} km
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeSlots === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="font-mono text-[11px] tracking-[0.2em] text-dim">
              ADICIONE CORPOS NOS SLOTS ABAIXO PARA COMPARAR
            </p>
          </div>
        )}
      </div>

      {/* ── slots comparativos ── */}
      <div className="grid shrink-0 grid-cols-3 gap-2.5 border-t border-line bg-panel/90 p-3.5">
        {slots.map((id, i) => {
          const spec = id ? bodySpecFor(id) : null;
          const isHovered = hovered === id;
          return (
            <div
              key={i}
              className={`rise-in relative flex flex-col overflow-hidden border transition-all duration-200 ${
                id ? "bg-white/[0.025]" : "border-dashed border-line bg-transparent"
              }`}
              style={{
                borderColor: isHovered ? SLOT_COLORS[i] : id ? `${SLOT_COLORS[i]}44` : undefined,
                boxShadow: isHovered ? `0 0 24px ${SLOT_COLORS[i]}33, inset 0 0 30px ${SLOT_COLORS[i]}0d` : undefined,
              }}
            >
              <span className="absolute left-0 top-0 h-full w-[3px]" style={{ background: id ? SLOT_COLORS[i] : "transparent" }} />
              {id && spec ? (
                <>
                  <div className="flex items-start gap-2.5 px-3 pt-2.5">
                    <span
                      className="mt-0.5 block h-3.5 w-3.5 shrink-0 rounded-full"
                      style={{ background: `radial-gradient(circle at 34% 30%, #ffffffcc, ${spec.accent} 45%, #000a)`, boxShadow: `0 0 12px ${spec.accent}` }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-body text-[14px] font-semibold text-ink">{spec.name}</div>
                      <div className="font-mono text-[8px] tracking-[0.2em]" style={{ color: SLOT_COLORS[i] }}>
                        {kindLabel(id)} · SLOT {i + 1}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button className="btn-icon !h-6 !w-6" title="Trocar corpo" onClick={() => { setPickerSlot(i); sfx.toggle(); }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
                        </svg>
                      </button>
                      <button className="btn-icon !h-6 !w-6" title="Remover" onClick={() => clear(i)}>
                        <svg width="10" height="10" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6">
                          <path d="M1 1l10 10M11 1L1 11" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 px-3 pb-2.5 pt-2">
                    {statsOf(id).map((s) => (
                      <div key={s.label}>
                        <div className="font-mono text-[7px] tracking-[0.18em] text-dim">{s.label}</div>
                        <div className="font-mono text-[11px] font-medium text-ink tabular-nums">{s.value}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <button
                  onClick={() => { setPickerSlot(i); sfx.toggle(); }}
                  className="group flex flex-1 flex-col items-center justify-center gap-1.5 py-5 text-dim transition-colors hover:text-solar-hot"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-line text-xl transition-transform group-hover:scale-110 group-hover:border-solar/60">
                    +
                  </span>
                  <span className="font-mono text-[8.5px] tracking-[0.22em]">ADICIONAR CORPO</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ── picker ── */}
      {pickerSlot != null && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setPickerSlot(null)}>
          <div
            className="rise-in flex h-[min(520px,80vh)] w-[min(680px,92vw)] flex-col border border-line bg-panel shadow-[0_30px_90px_rgba(0,0,0,0.7)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="font-mono text-[10px] tracking-[0.24em] text-dim">
                SELECIONAR PARA O <span style={{ color: SLOT_COLORS[pickerSlot] }}>SLOT {pickerSlot + 1}</span>
              </div>
              <button className="btn-icon" onClick={() => setPickerSlot(null)}>
                <svg width="11" height="11" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6">
                  <path d="M1 1l10 10M11 1L1 11" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
              <div className="segmented">
                {(["stars", "planets", "moons"] as Tab[]).map((t) => (
                  <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
                    {t === "stars" ? "Estrelas" : t === "planets" ? "Planetas" : "Luas"}
                  </button>
                ))}
              </div>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar…"
                className="ml-auto w-44 border border-line bg-white/[0.03] px-2.5 py-1.5 font-mono text-[11px] text-ink outline-none placeholder:text-dim focus:border-solar/60"
              />
            </div>

            <div className="scroll-slim grid flex-1 grid-cols-2 gap-1.5 overflow-y-auto p-3 sm:grid-cols-3">
              {items.map((it) => (
                <button
                  key={it.id}
                  onClick={() => choose(it.id)}
                  className="group flex items-center gap-2.5 border border-transparent px-2.5 py-2 text-left transition-all duration-150 hover:translate-x-0.5 hover:border-line hover:bg-white/[0.04]"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full transition-transform group-hover:scale-125"
                    style={{ background: `radial-gradient(circle at 34% 30%, #ffffffbb, ${it.color} 45%, #0009)`, boxShadow: `0 0 8px ${it.color}88` }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-body text-[12.5px] font-medium text-ink group-hover:text-solar-hot">{it.name}</span>
                    <span className="block truncate font-mono text-[8.5px] text-dim">{it.sub}</span>
                  </span>
                </button>
              ))}
              {items.length === 0 && (
                <p className="col-span-full py-8 text-center font-mono text-[10px] tracking-[0.2em] text-dim">NADA ENCONTRADO</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
