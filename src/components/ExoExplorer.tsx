import { useEffect, useRef, useState } from "react";
import { ExoSystemScene, type ExoSelection } from "../three/ExoSystem";
import {
  EXO_SYSTEMS,
  semiMajorAxisAU,
  hzStatus,
  type ExoSystem,
  type ExoPlanet,
} from "../data/exoplanets";
import { fmtNum } from "../data/bodies";
import { sfx } from "../lib/sound";

interface Props {
  onClose: () => void;
}

const hzBadge = (p: ExoPlanet) => {
  const s = hzStatus(p.fluxEarth);
  if (s === "conservative") return { txt: "ZH CONSERVADORA", cls: "border-[#3fae6a]/60 text-[#5fd08a]" };
  if (s === "optimistic") return { txt: "ZH OTIMISTA", cls: "border-[#8fae5a]/60 text-[#a8c86a]" };
  return { txt: "FORA DA ZH", cls: "border-line text-dim" };
};

export default function ExoExplorer({ onClose }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ExoSystemScene | null>(null);

  const [systemId, setSystemId] = useState(EXO_SYSTEMS[1].id); /* TRAPPIST-1 */
  const [sel, setSel] = useState<ExoSelection | null>({ systemId: EXO_SYSTEMS[1].id });
  const [compare, setCompare] = useState(true);

  const sys: ExoSystem = EXO_SYSTEMS.find((s) => s.id === systemId) ?? EXO_SYSTEMS[0];
  const selPlanet = sel?.planetId ? sys.planets.find((p) => p.id === sel.planetId) ?? null : null;

  useEffect(() => {
    if (!mountRef.current || !labelsRef.current) return;
    const scene = new ExoSystemScene(mountRef.current, labelsRef.current, {
      onSelect: (s) => {
        setSel(s);
        if (s?.systemId) setSystemId(s.systemId);
        if (s) sfx.select();
      },
    });
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setShowCompare(compare);
  }, [compare]);

  useEffect(() => {
    sceneRef.current?.build(systemId);
    setSel({ systemId });
    sfx.toggle();
  }, [systemId]);

  const pickPlanet = (p: ExoPlanet) => {
    setSel({ systemId, planetId: p.id });
    sfx.select();
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-void">
      {/* topo */}
      <div className="flex items-center justify-between border-b border-line bg-panel/95 px-5 py-3">
        <div>
          <div className="font-display text-[18px] font-semibold text-ink">
            MUNDOS HABITÁVEIS<span className="text-solar">·HWC</span>
          </div>
          <div className="font-mono text-[8.5px] tracking-[0.28em] text-dim">
            HABITABLE WORLDS CATALOG · PHL @ UPR ARECIBO / NASA EXOPLANET ARCHIVE
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCompare((c) => !c)}
            className={`border px-3 py-1.5 font-mono text-[9px] tracking-[0.2em] transition-colors ${
              compare
                ? "border-solar/60 bg-solar/10 text-solar-hot"
                : "border-line text-dim hover:text-ink"
            }`}
          >
            ⇄ COMPARAR COM SISTEMA SOLAR
          </button>
          <button
            onClick={onClose}
            className="border border-line px-3 py-1.5 font-mono text-[9px] tracking-[0.2em] text-dim transition-colors hover:border-solar/60 hover:text-solar-hot"
          >
            ✕ VOLTAR AO MAPA · ESC
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* lista de sistemas */}
        <div className="scroll-slim w-[228px] shrink-0 overflow-y-auto border-r border-line bg-panel/90">
          <div className="px-3 pb-1 pt-3 font-mono text-[8.5px] tracking-[0.26em] text-dim">
            SISTEMAS · POR DISTÂNCIA
          </div>
          {EXO_SYSTEMS.map((s) => {
            const active = s.id === systemId;
            return (
              <button
                key={s.id}
                onClick={() => setSystemId(s.id)}
                className={`flex w-full items-center gap-2.5 border-l-2 px-3 py-2.5 text-left transition-colors ${
                  active
                    ? "border-solar bg-solar/[0.07]"
                    : "border-transparent hover:bg-white/[0.03]"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: s.spectral.color, boxShadow: `0 0 8px ${s.spectral.color}` }}
                />
                <span className="min-w-0">
                  <span className={`block truncate font-body text-[12.5px] font-medium ${active ? "text-solar-hot" : "text-ink"}`}>
                    {s.starName}
                  </span>
                  <span className="block font-mono text-[8.5px] tracking-[0.14em] text-dim tabular-nums">
                    {s.spectral.type} · {fmtNum(s.distLy, s.distLy < 20 ? 2 : 0)} AL · {s.planets.length}{" "}
                    {s.planets.length === 1 ? "PLANETA" : "PLANETAS"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* viewport 3D */}
        <div className="relative min-w-0 flex-1">
          <div ref={mountRef} className="absolute inset-0" />
          <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 font-mono text-[8.5px] tracking-[0.22em] text-dim/80">
            ARRASTE — ORBITAR · ROLE — ZOOM · CLIQUE NUM PLANETA — DADOS
            {compare && " · SOL À DIREITA NA MESMA ESCALA"}
          </div>
        </div>

        {/* painel de dados */}
        <div className="scroll-slim w-[300px] shrink-0 overflow-y-auto border-l border-line bg-panel/95 p-4">
          <div className="font-mono text-[8.5px] tracking-[0.26em] text-dim">
            {selPlanet ? "PLANETA SELECIONADO" : "SISTEMA"}
          </div>

          {!selPlanet ? (
            <>
              <h2 className="mt-1 font-display text-[20px] font-semibold text-ink">{sys.starName}</h2>
              <div className="mt-1 font-mono text-[10px] tracking-[0.16em]" style={{ color: sys.spectral.color }}>
                {sys.spectral.type} · {fmtNum(sys.spectral.tempK, 0)} K
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                <MiniStat label="DISTÂNCIA" value={`${fmtNum(sys.distLy, sys.distLy < 20 ? 2 : 0)} al`} />
                <MiniStat label="MASSA" value={`${fmtNum(sys.spectral.massSun, 2)} M☉`} />
                <MiniStat label="RAIO" value={`${fmtNum(sys.spectral.radiusSun, 2)} R☉`} />
                <MiniStat label="LUMINOSIDADE" value={`${fmtNum(sys.spectral.luminositySun, 4)} L☉`} />
                {sys.ageGyr != null && <MiniStat label="IDADE" value={`${fmtNum(sys.ageGyr, 1)} bi anos`} />}
                <MiniStat label="PLANETAS" value={`${sys.planets.length}`} />
              </div>
              <p className="mt-3 border-l-2 border-solar/70 bg-solar/[0.05] px-2.5 py-2 font-body text-[12px] leading-relaxed text-ink/90">
                {sys.highlight}
              </p>
              <div className="mt-3 font-mono text-[8.5px] tracking-[0.24em] text-dim">PLANETAS</div>
              <div className="mt-1.5 flex flex-col gap-1">
                {sys.planets.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => pickPlanet(p)}
                    className="flex items-center gap-2 border border-line px-2.5 py-1.5 text-left transition-all hover:translate-x-1 hover:border-solar/50"
                  >
                    <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink">
                      {p.name.replace(sys.starName, "").trim()}
                    </span>
                    <span className="ml-auto font-mono text-[9.5px] text-dim tabular-nums">
                      {fmtNum(p.radiusEarth, 2)} R⊕
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2 className="mt-1 font-display text-[20px] font-semibold leading-tight text-ink">
                {selPlanet.name}
              </h2>
              <div className={`mt-1.5 inline-block border px-1.5 py-0.5 font-mono text-[8.5px] tracking-[0.18em] ${hzBadge(selPlanet).cls}`}>
                {hzBadge(selPlanet).txt}
              </div>
              <div className="mt-3 flex flex-col">
                <StatRow label="RAIO" value={`${fmtNum(selPlanet.radiusEarth, 2)} R⊕`} sub={`${fmtNum(selPlanet.radiusEarth * 6371, 0)} km`} />
                <StatRow
                  label="MASSA"
                  value={selPlanet.massEarth != null ? `${fmtNum(selPlanet.massEarth, 2)} M⊕` : "—"}
                />
                <StatRow label="PERÍODO ORBITAL" value={`${fmtNum(selPlanet.periodDays, selPlanet.periodDays < 10 ? 2 : 1)} dias`} />
                <StatRow
                  label="DISTÂNCIA À ESTRELA"
                  value={`${fmtNum(semiMajorAxisAU(selPlanet.periodDays, sys.spectral.massSun), 3)} UA`}
                  sub={`${fmtNum(semiMajorAxisAU(selPlanet.periodDays, sys.spectral.massSun) * 149.6, 1)} milhões km · Terra = 1 UA`}
                />
                {selPlanet.fluxEarth != null && (
                  <StatRow label="INSOLAÇÃO" value={`${fmtNum(selPlanet.fluxEarth, 2)} S⊕`} sub="Terra = 1,00" />
                )}
                {selPlanet.teqK != null && (
                  <StatRow label="TEMP. DE EQUILÍBRIO" value={`${fmtNum(selPlanet.teqK, 0)} K`} sub={`${fmtNum(selPlanet.teqK - 273.15, 0)} °C`} />
                )}
                <StatRow label="DISTÂNCIA DA TERRA" value={`${fmtNum(sys.distLy, sys.distLy < 20 ? 2 : 0)} anos-luz`} />
              </div>
              <p className="mt-3 border-l-2 border-solar/70 bg-solar/[0.05] px-2.5 py-2 font-body text-[12px] leading-relaxed text-ink/90">
                {selPlanet.note}
              </p>
              <button
                onClick={() => setSel({ systemId })}
                className="mt-3 w-full border border-line px-3 py-2 font-mono text-[9px] tracking-[0.2em] text-dim transition-colors hover:border-solar/50 hover:text-ink"
              >
                ← VOLTAR AO SISTEMA
              </button>
            </>
          )}

          <div className="mt-4 border-t border-line pt-3 font-mono text-[8px] leading-relaxed tracking-[0.1em] text-dim/80">
            ÓRBITAS E ZONA HABITÁVEL CALCULADAS PELA 3ª LEI DE KEPLER E LIMITES DE KOPPARAPU.
            ESCALA VISUAL IDÊNTICA ENTRE OS SISTEMAS PARA COMPARAÇÃO JUSTA.
          </div>
        </div>
      </div>
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
