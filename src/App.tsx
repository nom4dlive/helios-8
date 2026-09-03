import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ExoScene, type ExoSelection } from "./three/ExoScene";
import { SolarScene, type SolarSelection } from "./three/SolarScene";
import AlienTeacher from "./components/AlienTeacher";
import SurfaceVisit from "./components/SurfaceVisit";
import SolarDetailPanel from "./components/SolarDetailPanel";
import ComparePanel from "./components/ComparePanel";
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
import {
  SOLAR_PLANETS,
  SOLAR_MOONS,
  solarVisitFor,
} from "./data/solarSystem";
import { sfx } from "./lib/sound";

type Mode = "solar" | "exo" | "compare";

const TOTAL_EXO = EXO_SYSTEMS.reduce((n, s) => n + s.planets.length, 0);

const MODES: { id: Mode; label: string; sub: string; key: string }[] = [
  { id: "solar", label: "Sistema Solar", sub: "exploração orbital", key: "1" },
  { id: "exo", label: "Exoplanetas", sub: "catálogo HWC · OEC", key: "2" },
  { id: "compare", label: "Comparar", sub: "estrelas · planetas · luas", key: "3" },
];

/* ═══════════════════════ dock de simulação ═══════════════════════ */

interface DockProps {
  paused: boolean;
  speed: number;
  spin: number;
  onTogglePause: () => void;
  onSpeed: (v: number) => void;
  onSpin: (v: number) => void;
  onReset: () => void;
  onZoom: (dir: 1 | -1) => void;
  children?: ReactNode;
}

function SimDock({ paused, speed, spin, onTogglePause, onSpeed, onSpin, onReset, onZoom, children }: DockProps) {
  return (
    <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2.5 border border-line bg-panel/90 px-3.5 py-2 backdrop-blur-md">
      <button onClick={onTogglePause} className="btn btn-icon" title={paused ? "Reproduzir (Espaço)" : "Pausar (Espaço)"}>
        {paused ? (
          <svg width="11" height="12" viewBox="0 0 11 12" fill="currentColor"><path d="M0 0l11 6-11 6z" /></svg>
        ) : (
          <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor"><rect width="3.4" height="12" /><rect x="6.6" width="3.4" height="12" /></svg>
        )}
      </button>

      <label className="flex items-center gap-2 font-mono text-[8.5px] tracking-[0.18em] text-dim">
        VELOCIDADE
        <input type="range" min={0.25} max={8} step={0.25} value={speed}
          onChange={(e) => onSpeed(parseFloat(e.target.value))} className="rng w-[84px]" />
        <strong className="w-[38px] text-ink tabular-nums">{fmtNum(speed, 2)}×</strong>
      </label>

      <label className="flex items-center gap-2 font-mono text-[8.5px] tracking-[0.18em] text-dim">
        ROTAÇÃO
        <input type="range" min={0} max={3} step={0.25} value={spin}
          onChange={(e) => onSpin(parseFloat(e.target.value))} className="rng w-[64px]" />
        <strong className="w-[30px] text-ink tabular-nums">{fmtNum(spin, 2)}×</strong>
      </label>

      <span className="h-5 w-px bg-line" />

      <button onClick={() => onZoom(-1)} className="btn btn-icon" title="Aproximar">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="5" cy="5" r="3.6" /><path d="M8 8l3 3M3.6 5h2.8M5 3.6v2.8" /></svg>
      </button>
      <button onClick={() => onZoom(1)} className="btn btn-icon" title="Afastar">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="5" cy="5" r="3.6" /><path d="M8 8l3 3M3.6 5h2.8" /></svg>
      </button>
      <button onClick={onReset} className="btn" title="Reenquadrar o sistema">
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1 4V1h3M8 1h3v3M11 8v3H8M4 11H1V8" /><circle cx="6" cy="6" r="1.4" /></svg>
        VISÃO GERAL
      </button>

      {children}
    </div>
  );
}

/* ═══════════════════════ modo Sistema Solar ═══════════════════════ */

function SolarMode({ paused, speed, spin, setPaused, setSpeed, setSpin }: {
  paused: boolean; speed: number; spin: number;
  setPaused: (v: boolean) => void; setSpeed: (v: number) => void; setSpin: (v: number) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SolarScene | null>(null);
  const [sel, setSel] = useState<SolarSelection | null>(null);
  const [visitId, setVisitId] = useState<string | null>(null);

  useEffect(() => {
    if (!mountRef.current || !labelsRef.current) return;
    const scene = new SolarScene(mountRef.current, labelsRef.current, {
      onSelect: (s) => {
        setSel(s);
        sfx.select();
      },
    });
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => { sceneRef.current?.setPaused(paused); }, [paused]);
  useEffect(() => { sceneRef.current?.setSpeed(speed); }, [speed]);
  useEffect(() => { sceneRef.current?.setSpin(spin); }, [spin]);

  /* sincroniza cliques do painel com a cena (foco de câmera) */
  const select = (s: SolarSelection | null) => {
    setSel(s);
    sceneRef.current?.select(s);
    sfx.select();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !visitId) select(null);
      if (e.code === "Space" && !visitId) {
        e.preventDefault();
        setPaused(!paused);
        if (!paused) sfx.pause(); else sfx.play();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId, paused]);

  const visitBody = visitId
    ? SOLAR_PLANETS.find((p) => p.id === visitId) ?? SOLAR_MOONS.find((m) => m.id === visitId) ?? null
    : null;
  const visitHost = visitBody && "planetId" in visitBody
    ? SOLAR_PLANETS.find((p) => p.id === (visitBody as { planetId: string }).planetId)
    : null;

  return (
    <div className="relative flex min-h-0 flex-1">
      {/* trilho de corpos */}
      <aside className="scroll-slim w-[212px] shrink-0 overflow-y-auto border-r border-line bg-panel/90">
        <div className="px-3 pb-1 pt-3 font-mono text-[8.5px] tracking-[0.26em] text-dim">CORPOS · CLIQUE PARA FOCAR</div>
        <button
          onClick={() => select({ kind: "star", id: "sun" })}
          className={`flex w-full items-center gap-2.5 border-l-2 px-3 py-2.5 text-left transition-colors ${
            sel?.kind === "star" ? "border-solar bg-solar/[0.07]" : "border-transparent hover:bg-white/[0.03]"
          }`}
        >
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: "#ffcc66", boxShadow: "0 0 10px #ffcc66" }} />
          <span className="font-body text-[12.5px] font-medium text-ink">Sol</span>
          <span className="ml-auto font-mono text-[8px] text-dim">G2V</span>
        </button>

        <div className="px-3 pb-1 pt-2 font-mono text-[8.5px] tracking-[0.26em] text-dim">PLANETAS</div>
        {SOLAR_PLANETS.map((p) => (
          <button
            key={p.id}
            onClick={() => select({ kind: "planet", id: p.id })}
            className={`flex w-full items-center gap-2.5 border-l-2 px-3 py-2 text-left transition-colors ${
              sel?.kind === "planet" && sel.id === p.id ? "border-solar bg-solar/[0.07]" : "border-transparent hover:bg-white/[0.03]"
            }`}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.accent, boxShadow: `0 0 7px ${p.accent}` }} />
            <span className="min-w-0 flex-1">
              <span className="block font-body text-[12px] font-medium text-ink">{p.name}</span>
              <span className="block font-mono text-[7.5px] tracking-[0.1em] text-dim tabular-nums">
                {fmtNum(p.auDist, 2)} UA · {p.moonsKnown} {p.moonsKnown === 1 ? "lua" : "luas"}
              </span>
            </span>
          </button>
        ))}

        <div className="px-3 pb-1 pt-2 font-mono text-[8.5px] tracking-[0.26em] text-dim">LUAS PRINCIPAIS</div>
        {SOLAR_MOONS.map((m) => {
          const host = SOLAR_PLANETS.find((p) => p.id === m.planetId);
          return (
            <button
              key={m.id}
              onClick={() => select({ kind: "moon", id: m.id, planetId: m.planetId })}
              className={`flex w-full items-center gap-2.5 border-l-2 px-3 py-1.5 text-left transition-colors ${
                sel?.kind === "moon" && sel.id === m.id ? "border-solar bg-solar/[0.07]" : "border-transparent hover:bg-white/[0.03]"
              }`}
            >
              <span className="ml-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: m.accent, boxShadow: `0 0 5px ${m.accent}` }} />
              <span className="block font-body text-[11px] text-ink/90">{m.name}</span>
              <span className="ml-auto font-mono text-[7.5px] text-dim">{host?.name}</span>
            </button>
          );
        })}
      </aside>

      {/* viewport */}
      <main className="relative min-w-0 flex-1">
        <div ref={mountRef} className="absolute inset-0" />
        <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden" />

        <SimDock
          paused={paused} speed={speed} spin={spin}
          onTogglePause={() => { setPaused(!paused); if (!paused) sfx.pause(); else sfx.play(); }}
          onSpeed={setSpeed} onSpin={setSpin}
          onReset={() => sceneRef.current?.resetCamera()}
          onZoom={(d) => sceneRef.current?.zoomBy(d === -1 ? 0.78 : 1.28)}
        />

        <div className="pointer-events-none absolute bottom-3 right-3 z-10 hidden text-right font-mono text-[8px] tracking-[0.2em] text-dim/80 lg:block">
          ARRASTE — ORBITAR · ROLE — ZOOM · CLIQUE — DADOS
          <br />ESPAÇO — PAUSA · ESC — LIMPAR
        </div>
      </main>

      {/* painel de dados */}
      <aside className="scroll-slim w-[300px] shrink-0 overflow-y-auto border-l border-line bg-panel/95 p-4">
        <SolarDetailPanel sel={sel} onSelect={select} onVisit={(id) => { setVisitId(id); sfx.whoosh(); }} />
      </aside>

      {visitBody && visitId && solarVisitFor(visitId) && (
        <SurfaceVisit
          profile={solarVisitFor(visitId)!}
          name={visitBody.name}
          subtitle={
            visitHost
              ? `LUA DE ${visitHost.name.toUpperCase()} · SISTEMA SOLAR`
              : `${CLASS_META[visitBody.cls].label.toUpperCase()} · SISTEMA SOLAR`
          }
          onClose={() => setVisitId(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════ modo Exoplanetas ═══════════════════════ */

function ExoMode({ paused, speed, spin, setPaused, setSpeed, setSpin }: {
  paused: boolean; speed: number; spin: number;
  setPaused: (v: boolean) => void; setSpeed: (v: number) => void; setSpin: (v: number) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ExoScene | null>(null);

  const [systemId, setSystemId] = useState(EXO_SYSTEMS[1].id);
  const [sel, setSel] = useState<ExoSelection | null>({ systemId: EXO_SYSTEMS[1].id });
  const [alien, setAlien] = useState(true);
  const [visitPlanet, setVisitPlanet] = useState<ExoPlanet | null>(null);

  const sys = useMemo(() => EXO_SYSTEMS.find((s) => s.id === systemId) ?? EXO_SYSTEMS[1], [systemId]);
  const selPlanet = useMemo(
    () => (sel?.planetId ? sys.planets.find((p) => p.id === sel.planetId) ?? null : null),
    [sel, sys]
  );

  useEffect(() => {
    if (!mountRef.current || !labelsRef.current) return;
    const scene = new ExoScene(mountRef.current, labelsRef.current, {
      onSelect: (s) => {
        setSel(s);
        setSystemId(s.systemId);
        sfx.select();
      },
    });
    scene.setShowCompare(false);
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => { sceneRef.current?.build(systemId); setSel({ systemId }); }, [systemId]);
  useEffect(() => { sceneRef.current?.setPaused(paused); }, [paused]);
  useEffect(() => { sceneRef.current?.setSpeed(speed); }, [speed]);
  useEffect(() => { sceneRef.current?.setSpin(spin); }, [spin]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !visitPlanet) setSel({ systemId });
      if (e.code === "Space" && !visitPlanet) {
        e.preventDefault();
        setPaused(!paused);
        if (!paused) sfx.pause(); else sfx.play();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitPlanet, systemId, paused]);

  const pickPlanet = (p: ExoPlanet) => {
    setSel({ systemId, planetId: p.id });
    sfx.select();
  };
  const hz = hzLimits(sys.spectral.luminositySun);

  return (
    <div className="relative flex min-h-0 flex-1">
      {/* lista de sistemas */}
      <aside className="scroll-slim w-[232px] shrink-0 overflow-y-auto border-r border-line bg-panel/90">
        <div className="px-3 pb-1 pt-3 font-mono text-[8.5px] tracking-[0.26em] text-dim">SISTEMAS · POR DISTÂNCIA</div>
        {[...EXO_SYSTEMS].sort((a, b) => a.distLy - b.distLy).map((s) => {
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
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.spectral.color, boxShadow: `0 0 8px ${s.spectral.color}` }} />
              <span className="min-w-0 flex-1">
                <span className={`block truncate font-body text-[12.5px] font-medium ${active ? "text-solar-hot" : "text-ink"}`}>
                  {s.starName}
                  {s.kind === "pulsar" && <span className="ml-1.5 text-[9px] text-[#b09bff]">✳</span>}
                </span>
                <span className="block font-mono text-[8.5px] tracking-[0.12em] text-dim tabular-nums">
                  {s.spectral.type.split(" ")[0]} · {fmtNum(s.distLy, s.distLy < 20 ? 2 : 0)} AL · {s.planets.length}{" "}
                  {s.planets.length === 1 ? "mundo" : "mundos"}
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

      {/* viewport */}
      <main className="relative min-w-0 flex-1">
        <div ref={mountRef} className="absolute inset-0" />
        <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden" />

        <AlienTeacher system={sys} enabled={alien && !visitPlanet} />

        <SimDock
          paused={paused} speed={speed} spin={spin}
          onTogglePause={() => { setPaused(!paused); if (!paused) sfx.pause(); else sfx.play(); }}
          onSpeed={setSpeed} onSpin={setSpin}
          onReset={() => sceneRef.current?.resetCamera()}
          onZoom={(d) => sceneRef.current?.zoomBy(d === -1 ? 0.78 : 1.28)}
        >
          <span className="h-5 w-px bg-line" />
          <button
            onClick={() => { setAlien((a) => !a); sfx.toggle(); }}
            className={`btn ${alien ? "!border-[#7fe8de]/60 !text-[#7fe8de]" : ""}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${alien ? "pulse-dot bg-[#7fe8de]" : "bg-dim"}`} />
            PROF. ZYX
          </button>
        </SimDock>

        <div className="pointer-events-none absolute bottom-3 right-3 z-10 hidden text-right font-mono text-[8px] tracking-[0.2em] text-dim/80 lg:block">
          ARRASTE — ORBITAR · ROLE — ZOOM · CLIQUE — DADOS
        </div>
      </main>

      {/* painel de dados */}
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
              {sys.kind !== "pulsar" && <MiniStat label="ZH (KOPPARAPU)" value={`${fmtNum(hz.inner, 2)}–${fmtNum(hz.outer, 2)} UA`} />}
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
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CLASS_META[p.cls].color, boxShadow: `0 0 6px ${CLASS_META[p.cls].color}` }} />
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
                <StatRow
                  label="INSOLAÇÃO"
                  value={`${fmtNum(selPlanet.fluxEarth, 2)} S⊕`}
                  sub={`ZH: ${hzStatus(selPlanet.fluxEarth) === "conservative" ? "conservadora" : hzStatus(selPlanet.fluxEarth) === "optimistic" ? "otimista" : "fora"}`}
                />
              )}
              {selPlanet.teqK != null && (
                <StatRow label="TEMP. EQUILÍBRIO" value={`${fmtInt(selPlanet.teqK)} K`} sub={`${fmtInt(selPlanet.teqK - 273.15)} °C`} />
              )}
              {selPlanet.cls !== "imaged-giant" && selPlanet.cls !== "pulsar-world" && (
                <StatRow
                  label="ESI (TERRA = 1,00)"
                  value={esi(selPlanet.radiusEarth, selPlanet.teqK)?.toFixed(2).replace(".", ",") ?? "—"}
                  sub="Índice de Semelhança com a Terra"
                />
              )}
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
                <span className="block font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-solar-hot">Visitar superfície</span>
                <span className="block font-mono text-[8.5px] tracking-[0.12em] text-dim">visão em 1ª pessoa · céu com o tamanho real do Sol</span>
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

      {visitPlanet && <SurfaceVisit planet={visitPlanet} system={sys} onClose={() => setVisitPlanet(null)} />}
    </div>
  );
}

/* ═══════════════════════ App ═══════════════════════ */

export default function App() {
  const [mode, setMode] = useState<Mode>("solar");
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [spin, setSpin] = useState(1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "1") setMode("solar");
      if (e.key === "2") setMode("exo");
      if (e.key === "3") setMode("compare");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const modeIdx = MODES.findIndex((m) => m.id === mode);
  const sim = { paused, speed, spin, setPaused, setSpeed, setSpin };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-void text-ink">
      <header className="flex shrink-0 items-center gap-5 border-b border-line bg-panel px-5 py-2.5">
        <div className="flex items-baseline gap-2.5">
          <h1 className="font-display text-[21px] font-bold tracking-tight">
            ORBE<span className="text-solar">·</span>
          </h1>
          <span className="hidden font-mono text-[8.5px] tracking-[0.3em] text-dim md:block">ATLAS DE MUNDOS</span>
        </div>

        {/* navegação por modos */}
        <nav className="seg relative grid grid-cols-3 border border-line bg-white/[0.02]" aria-label="Modos">
          <span className="seg-ind" style={{ transform: `translateX(${modeIdx * 100}%)` }} />
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => { setMode(m.id); sfx.toggle(); }}
              className={`relative z-10 flex items-center gap-2.5 px-4 py-2 transition-colors duration-200 ${
                mode === m.id ? "text-solar-hot" : "text-dim hover:text-ink"
              }`}
            >
              <kbd className={`border px-1 font-mono text-[8px] ${mode === m.id ? "border-solar/50" : "border-line"}`}>{m.key}</kbd>
              <span className="text-left">
                <span className="block font-display text-[12px] font-bold leading-tight">{m.label}</span>
                <span className="hidden font-mono text-[7px] tracking-[0.14em] opacity-70 lg:block">{m.sub.toUpperCase()}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 font-mono text-[8.5px] tracking-[0.14em]">
          <span className="hidden border border-line px-2.5 py-1 text-dim xl:block">
            <strong className="text-ink">8</strong> PLANETAS · <strong className="text-ink">15</strong> LUAS
          </span>
          <span className="hidden border border-line px-2.5 py-1 text-dim xl:block">
            <strong className="text-ink">{EXO_SYSTEMS.length}</strong> SISTEMAS · <strong className="text-ink">{TOTAL_EXO}</strong> EXOPLANETAS
          </span>
          <span className="border border-bio/40 px-2.5 py-1 text-bio">HWC · OEC · NASA</span>
        </div>
      </header>

      {mode === "solar" && <SolarMode {...sim} />}
      {mode === "exo" && <ExoMode {...sim} />}
      {mode === "compare" && <ComparePanel onClose={() => setMode("solar")} />}
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
