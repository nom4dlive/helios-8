import { useEffect, useMemo, useRef, useState } from "react";
import { ExoScene, type ExoSelection } from "./three/ExoScene";
import AlienTeacher from "./components/AlienTeacher";
import SurfaceVisit from "./components/SurfaceVisit";
import {
  EXO_SYSTEMS,
  CLASS_META,
  semiMajorAxisAU,
  hzLimits,
  hzStatus,
  esi,
  fmtNum,
  fmtInt,
  type ExoPlanet,
} from "./data/catalog";
import { sfx } from "./lib/sound";

const TOTAL_PLANETS = EXO_SYSTEMS.reduce((n, s) => n + s.planets.length, 0);
const TOTAL_HAB = EXO_SYSTEMS.reduce(
  (n, s) => n + s.planets.filter((p) => p.habitable).length,
  0
);

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ExoScene | null>(null);

  const [systemId, setSystemId] = useState(EXO_SYSTEMS[1].id); /* TRAPPIST-1 */
  const [sel, setSel] = useState<ExoSelection | null>({ systemId: EXO_SYSTEMS[1].id });
  const [compare, setCompare] = useState(true);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [spin, setSpin] = useState(1);
  const [alien, setAlien] = useState(true);
  const [visitPlanet, setVisitPlanet] = useState<ExoPlanet | null>(null);

  const sys = useMemo(() => EXO_SYSTEMS.find((s) => s.id === systemId) ?? EXO_SYSTEMS[1], [systemId]);
  const selPlanet = useMemo(
    () => (sel?.planetId ? sys.planets.find((p) => p.id === sel.planetId) ?? null : null),
    [sel, sys]
  );

  /* ---------------- cena 3D ---------------- */
  useEffect(() => {
    if (!mountRef.current || !labelsRef.current) return;
    const scene = new ExoScene(mountRef.current, labelsRef.current, {
      onSelect: (s) => {
        setSel(s);
        setSystemId(s.systemId);
        sfx.select();
      },
    });
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.build(systemId);
    setSel({ systemId });
  }, [systemId]);

  useEffect(() => {
    sceneRef.current?.setShowCompare(compare);
  }, [compare]);

  /* ---------------- teclado ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (visitPlanet) setVisitPlanet(null);
        else setSel({ systemId });
      }
      if (e.code === "Space" && !visitPlanet) {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitPlanet, systemId, paused]);

  const togglePause = () => {
    setPaused((p) => {
      const next = !p;
      sceneRef.current?.setPaused(next);
      if (next) sfx.pause();
      else sfx.play();
      return next;
    });
  };
  const onSpeed = (v: number) => {
    setSpeed(v);
    sceneRef.current?.setSpeed(v);
  };
  const onSpin = (v: number) => {
    setSpin(v);
    sceneRef.current?.setSpin(v);
  };
  const pickPlanet = (p: ExoPlanet) => {
    setSel({ systemId, planetId: p.id });
    sfx.select();
  };
  const hz = hzLimits(sys.spectral.luminositySun);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-void text-ink">
      {/* ══════════ cabeçalho ══════════ */}
      <header className="flex shrink-0 items-center justify-between border-b border-line bg-panel px-5 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-[22px] font-bold tracking-tight text-ink">
            ORBE<span className="text-solar">·</span>
          </h1>
          <span className="hidden font-mono text-[9px] tracking-[0.3em] text-dim sm:block">
            ATLAS DE MUNDOS EXOPLANETÁRIOS
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[9px] tracking-[0.16em]">
          <span className="border border-line px-2.5 py-1 text-dim">
            <strong className="text-ink">{EXO_SYSTEMS.length}</strong> SISTEMAS
          </span>
          <span className="border border-line px-2.5 py-1 text-dim">
            <strong className="text-ink">{TOTAL_PLANETS}</strong> PLANETAS
          </span>
          <span className="border border-bio/40 px-2.5 py-1 text-bio">
            {TOTAL_HAB} CANDIDATOS HABITÁVEIS
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ══════════ lista de sistemas ══════════ */}
        <aside className="scroll-slim w-[232px] shrink-0 overflow-y-auto border-r border-line bg-panel/90">
          <div className="px-3 pb-1 pt-3 font-mono text-[8.5px] tracking-[0.26em] text-dim">
            SISTEMAS · POR DISTÂNCIA
          </div>
          {[...EXO_SYSTEMS]
            .sort((a, b) => a.distLy - b.distLy)
            .map((s) => {
              const active = s.id === systemId;
              const nHab = s.planets.filter((p) => p.habitable).length;
              return (
                <button
                  key={s.id}
                  onClick={() => setSystemId(s.id)}
                  className={`flex w-full items-center gap-2.5 border-l-2 px-3 py-2.5 text-left transition-colors ${
                    active ? "border-solar bg-solar/[0.07]" : "border-transparent hover:bg-white/[0.03]"
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: s.spectral.color, boxShadow: `0 0 8px ${s.spectral.color}` }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate font-body text-[12.5px] font-medium ${active ? "text-solar-hot" : "text-ink"}`}>
                      {s.starName}
                      {s.kind === "pulsar" && <span className="ml-1.5 text-[9px] text-[#b09bff]">✳</span>}
                    </span>
                    <span className="block font-mono text-[8.5px] tracking-[0.12em] text-dim tabular-nums">
                      {s.spectral.type.split(" ")[0]} · {fmtNum(s.distLy, s.distLy < 20 ? 2 : 0)} AL ·{" "}
                      {s.planets.length} {s.planets.length === 1 ? "mundo" : "mundos"}
                      {nHab > 0 && <span className="text-bio"> · {nHab} ZH</span>}
                    </span>
                  </span>
                </button>
              );
            })}
          <div className="px-3 py-3 font-mono text-[7.5px] leading-relaxed tracking-[0.1em] text-dim/70">
            DADOS: HWC · PHL @ UPR ARECIBO / OPEN EXOPLANET CATALOGUE / NASA EXOPLANET ARCHIVE
          </div>
        </aside>

        {/* ══════════ viewport 3D ══════════ */}
        <main className="relative min-w-0 flex-1">
          <div ref={mountRef} className="absolute inset-0" />
          <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden" />

          <AlienTeacher system={sys} enabled={alien && !visitPlanet} />

          {/* dock de simulação */}
          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 border border-line bg-panel/90 px-4 py-2.5 backdrop-blur-md">
            <button
              onClick={togglePause}
              className="flex h-8 w-8 items-center justify-center border border-line text-ink transition-colors hover:border-solar/60 hover:text-solar-hot"
              title={paused ? "Reproduzir (Espaço)" : "Pausar (Espaço)"}
            >
              {paused ? (
                <svg width="11" height="12" viewBox="0 0 11 12" fill="currentColor"><path d="M0 0l11 6-11 6z" /></svg>
              ) : (
                <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor"><rect width="3.4" height="12" /><rect x="6.6" width="3.4" height="12" /></svg>
              )}
            </button>

            <label className="flex items-center gap-2 font-mono text-[8.5px] tracking-[0.18em] text-dim">
              VELOCIDADE
              <input
                type="range" min={0.25} max={8} step={0.25} value={speed}
                onChange={(e) => onSpeed(parseFloat(e.target.value))}
                className="rng w-[90px]"
              />
              <strong className="w-[38px] text-ink tabular-nums">{fmtNum(speed, 2)}×</strong>
            </label>

            <label className="flex items-center gap-2 font-mono text-[8.5px] tracking-[0.18em] text-dim">
              ROTAÇÃO
              <input
                type="range" min={0} max={3} step={0.25} value={spin}
                onChange={(e) => onSpin(parseFloat(e.target.value))}
                className="rng w-[70px]"
              />
              <strong className="w-[30px] text-ink tabular-nums">{fmtNum(spin, 2)}×</strong>
            </label>

            <span className="h-5 w-px bg-line" />

            <button
              onClick={() => { setCompare((c) => !c); sfx.toggle(); }}
              className={`border px-2.5 py-1.5 font-mono text-[8.5px] tracking-[0.16em] transition-colors ${
                compare ? "border-solar/60 bg-solar/10 text-solar-hot" : "border-line text-dim hover:text-ink"
              }`}
            >
              ⇄ SISTEMA SOLAR
            </button>
            <button
              onClick={() => { setAlien((a) => !a); sfx.toggle(); }}
              className={`flex items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[8.5px] tracking-[0.16em] transition-colors ${
                alien ? "border-[#7fe8de]/60 bg-[#7fe8de]/10 text-[#7fe8de]" : "border-line text-dim hover:text-ink"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${alien ? "pulse-dot bg-[#7fe8de]" : "bg-dim"}`} />
              PROF. ZYX
            </button>
          </div>

          <div className="pointer-events-none absolute bottom-3 right-3 z-10 hidden text-right font-mono text-[8px] tracking-[0.2em] text-dim/80 lg:block">
            ARRASTE — ORBITAR · ROLE — ZOOM · CLIQUE — DADOS
            <br />
            ESPAÇO — PAUSA · ESC — LIMPAR SELEÇÃO
          </div>
        </main>

        {/* ══════════ painel de dados ══════════ */}
        <aside className="scroll-slim w-[304px] shrink-0 overflow-y-auto border-l border-line bg-panel/95 p-4">
          {!selPlanet ? (
            <div key={sys.id} className="rise-in">
              <div className="font-mono text-[8.5px] tracking-[0.26em] text-dim">
                {sys.kind === "pulsar" ? "SISTEMA DE PULSAR" : "SISTEMA ESTELAR"}
              </div>
              <h2 className="mt-1 font-display text-[20px] font-bold leading-tight text-ink">{sys.starName}</h2>
              <div className="mt-1 font-mono text-[10px] tracking-[0.14em]" style={{ color: sys.spectral.color }}>
                {sys.spectral.type} · {fmtInt(sys.spectral.tempK)} K
              </div>

              <div className="mt-3 grid grid-cols-2 gap-1.5">
                <MiniStat label="DISTÂNCIA" value={`${fmtNum(sys.distLy, sys.distLy < 20 ? 2 : 0)} al`} />
                <MiniStat label="MASSA" value={`${fmtNum(sys.spectral.massSun, 2)} M☉`} />
                <MiniStat label="RAIO" value={`${fmtNum(sys.spectral.radiusSun, sys.spectral.radiusSun < 0.01 ? 6 : 2)} R☉`} />
                <MiniStat label="LUMINOSIDADE" value={`${fmtNum(sys.spectral.luminositySun, sys.spectral.luminositySun < 0.01 ? 5 : 2)} L☉`} />
                {sys.spectral.metallicity != null && (
                  <MiniStat label="METALICIDADE" value={`[Fe/H] ${sys.spectral.metallicity > 0 ? "+" : ""}${fmtNum(sys.spectral.metallicity, 2)}`} />
                )}
                {sys.ageGyr != null && <MiniStat label="IDADE" value={`${fmtNum(sys.ageGyr, 1)} bi anos`} />}
                {sys.kind !== "pulsar" && (
                  <MiniStat label="ZH (KOPPARAPU)" value={`${fmtNum(hz.inner, 2)}–${fmtNum(hz.outer, 2)} UA`} />
                )}
                <MiniStat label="MUNDOS" value={`${sys.planets.length}`} />
              </div>

              <p className="mt-3 border-l-2 border-solar/70 bg-solar/[0.05] px-2.5 py-2 font-body text-[12px] leading-relaxed text-ink/90">
                {sys.highlight}
              </p>

              <div className="mt-3 font-mono text-[8.5px] tracking-[0.24em] text-dim">MUNDOS DO SISTEMA</div>
              <div className="mt-1.5 flex flex-col gap-1">
                {sys.planets.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => pickPlanet(p)}
                    className="group flex items-center gap-2 border border-line px-2.5 py-2 text-left transition-all duration-150 hover:translate-x-1 hover:border-solar/50 hover:bg-solar/5"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: CLASS_META[p.cls].color, boxShadow: `0 0 6px ${CLASS_META[p.cls].color}` }}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink group-hover:text-solar-hot">
                        {p.name.split("(")[0].trim()}
                      </span>
                      <span className="block font-mono text-[8px] tracking-[0.08em] text-dim">
                        {CLASS_META[p.cls].label} · {fmtNum(p.periodDays, p.periodDays < 10 ? 2 : 0)} d
                      </span>
                    </span>
                    <span className="ml-auto font-mono text-[9.5px] text-dim tabular-nums">{fmtNum(p.radiusEarth, 2)} R⊕</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div key={selPlanet.id} className="rise-in">
              <div className="font-mono text-[8.5px] tracking-[0.26em] text-dim">MUNDO SELECIONADO</div>
              <h2 className="mt-1 font-display text-[19px] font-bold leading-tight text-ink">{selPlanet.name}</h2>
              <div
                className="mt-1.5 inline-block border px-1.5 py-0.5 font-mono text-[8.5px] tracking-[0.18em]"
                style={{ color: CLASS_META[selPlanet.cls].color, borderColor: `${CLASS_META[selPlanet.cls].color}55` }}
              >
                {CLASS_META[selPlanet.cls].label.toUpperCase()}
              </div>
              {selPlanet.habitable && (
                <span className="ml-1.5 inline-block border border-bio/50 px-1.5 py-0.5 font-mono text-[8.5px] tracking-[0.18em] text-bio">
                  ZONA HABITÁVEL
                </span>
              )}

              <div className="mt-3 flex flex-col">
                <StatRow label="RAIO" value={`${fmtNum(selPlanet.radiusEarth, 2)} R⊕`} sub={`${fmtInt(selPlanet.radiusEarth * 6371)} km`} />
                {selPlanet.massEarth != null && (
                  <StatRow label="MASSA" value={`${fmtNum(selPlanet.massEarth, 2)} M⊕`} sub={`${fmtNum(selPlanet.massEarth / 317.8, 2)} M♃`} />
                )}
                <StatRow label="PERÍODO ORBITAL" value={`${fmtNum(selPlanet.periodDays, selPlanet.periodDays < 10 ? 2 : 1)} dias`} />
                {selPlanet.ecc != null && selPlanet.ecc > 0 && (
                  <StatRow label="EXCENTRICIDADE" value={`${fmtNum(selPlanet.ecc, 3)}`} sub="0 = círculo perfeito" />
                )}
                <StatRow
                  label="DISTÂNCIA À ESTRELA"
                  value={`${fmtNum(semiMajorAxisAU(selPlanet.periodDays, sys.spectral.massSun), 3)} UA`}
                  sub={`${fmtNum(semiMajorAxisAU(selPlanet.periodDays, sys.spectral.massSun) * 149.6, 1)} milhões km · Terra = 1 UA`}
                />
                {selPlanet.fluxEarth != null && (
                  <StatRow label="INSOLAÇÃO" value={`${fmtNum(selPlanet.fluxEarth, 2)} S⊕`} sub={`status ZH: ${hzStatus(selPlanet.fluxEarth) === "conservative" ? "conservadora" : hzStatus(selPlanet.fluxEarth) === "optimistic" ? "otimista" : "fora"}`} />
                )}
                {selPlanet.teqK != null && (
                  <StatRow label="TEMP. EQUILÍBRIO" value={`${fmtInt(selPlanet.teqK)} K`} sub={`${fmtInt(selPlanet.teqK - 273.15)} °C`} />
                )}
                {selPlanet.cls !== "imaged-giant" && selPlanet.cls !== "pulsar-world" ? (
                  <StatRow
                    label="ESI (TERRA = 1,00)"
                    value={esi(selPlanet.radiusEarth, selPlanet.teqK)?.toFixed(2).replace(".", ",") ?? "—"}
                    sub="Índice de Semelhança com a Terra"
                  />
                ) : null}
                <StatRow label="DESCOBERTA" value={`${selPlanet.method} · ${selPlanet.year}`} />
                <StatRow label="DISTÂNCIA DA TERRA" value={`${fmtNum(sys.distLy, sys.distLy < 20 ? 2 : 0)} anos-luz`} />
              </div>

              <p className="mt-3 border-l-2 border-solar/70 bg-solar/[0.05] px-2.5 py-2 font-body text-[12px] leading-relaxed text-ink/90">
                {selPlanet.note}
              </p>

              <button
                onClick={() => { setVisitPlanet(selPlanet); sfx.whoosh(); }}
                className="group mt-3 flex w-full items-center gap-3 border border-solar/60 bg-gradient-to-r from-solar/25 to-solar/5 px-3.5 py-3 text-left transition-all duration-200 hover:border-solar-hot hover:from-solar/40"
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="shrink-0 text-solar-hot transition-transform group-hover:scale-110">
                  <path d="M12 3v12m0 0l-4-4m4 4l4-4" />
                  <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                </svg>
                <span>
                  <span className="block font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-solar-hot">
                    Visitar superfície
                  </span>
                  <span className="block font-mono text-[8.5px] tracking-[0.12em] text-dim">
                    visão em 1ª pessoa · céu com o tamanho real do Sol
                  </span>
                </span>
              </button>

              <button
                onClick={() => setSel({ systemId })}
                className="mt-2 w-full border border-line px-3 py-2 font-mono text-[9px] tracking-[0.2em] text-dim transition-colors hover:border-solar/50 hover:text-ink"
              >
                ← VOLTAR AO SISTEMA
              </button>
            </div>
          )}
        </aside>
      </div>

      {visitPlanet && (
        <SurfaceVisit planet={visitPlanet} system={sys} onClose={() => setVisitPlanet(null)} />
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line bg-white/[0.02] px-2 py-1.5">
      <div className="font-mono text-[7.5px] tracking-[0.2em] text-dim">{label}</div>
      <div className="mt-0.5 font-mono text-[11px] font-medium text-ink tabular-nums">{value}</div>
    </div>
  );
}

function StatRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border-b border-line/60 py-2 last:border-b-0">
      <div className="font-mono text-[8.5px] tracking-[0.22em] text-dim">{label}</div>
      <div className="mt-0.5 font-mono text-[13px] font-medium text-ink tabular-nums">{value}</div>
      {sub && <div className="font-mono text-[9.5px] text-dim tabular-nums">{sub}</div>}
    </div>
  );
}
