import { useEffect, useRef, useState } from "react";
import { SurfaceScene, type SurfaceTelemetry } from "../three/SurfaceScene";
import type { SurfaceViewDef } from "../data/surfaceViews";
import { sfx } from "../lib/sound";

interface Props {
  bodyId: string;
  bodyName: string;
  accent: string;
  view: SurfaceViewDef;
  onClose: () => void;
}

const CARDINALS = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];
const cardinal = (deg: number) => CARDINALS[Math.round(deg / 45) % 8];

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line bg-void/70 px-3 py-1.5 backdrop-blur-sm">
      <div className="font-mono text-[8px] tracking-[0.22em] text-dim">{label}</div>
      <div className="mt-0.5 font-mono text-[12px] font-medium text-ink tabular-nums">{value}</div>
    </div>
  );
}

export default function SurfaceVisit({ bodyId, bodyName, accent, view, onClose }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [tele, setTele] = useState<SurfaceTelemetry>({ azimuthDeg: 0, pitchDeg: 0, fov: 70 });

  const sunDiffuse = (view.realism?.sunDiffuse ?? 0) >= 0.5;
  const sunEarthRatio = view.sunAngularDeg / 0.533;
  const sunChip = sunDiffuse
    ? "DIFUSO NAS NUVENS"
    : `Ø ${view.sunAngularDeg.toFixed(2).replace(".", ",")}° · ${sunEarthRatio.toFixed(1).replace(".", ",")}× TERRA`;
  const [ready, setReady] = useState(false);
  const [dragged, setDragged] = useState(false);
  const [showNotes, setShowNotes] = useState(true);

  useEffect(() => {
    if (!mountRef.current) return;
    const sc = new SurfaceScene(mountRef.current, {
      def: view,
      onTelemetry: setTele,
    });
    const t = window.setTimeout(() => setReady(true), 60);
    const onFirst = () => setDragged(true);
    const el = mountRef.current;
    el.addEventListener("pointerdown", onFirst);
    sfx.select();
    return () => {
      window.clearTimeout(t);
      el.removeEventListener("pointerdown", onFirst);
      sc.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyId]);

  return (
    <div className="absolute inset-0 z-40 overflow-hidden bg-void">
      {/* cena em primeira pessoa */}
      <div
        ref={mountRef}
        className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
      />

      {/* vinheta */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.5) 100%)",
        }}
      />

      {/* cabeçalho */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
        <div className="flex items-center gap-3 border border-line bg-panel/80 px-4 py-2.5 backdrop-blur-md">
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: accent, boxShadow: `0 0 12px ${accent}` }}
          />
          <div>
            <div className="font-display text-[16px] font-semibold leading-tight text-ink">
              {bodyName}
            </div>
            <div className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-dim">
              {view.viewLabel} · visão de superfície
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="pointer-events-auto group flex items-center gap-2.5 border border-solar/50 bg-solar/10 px-4 py-2.5 transition-all hover:bg-solar/25"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-solar transition-transform group-hover:-translate-x-0.5">
            <path d="M7 1L2 6l5 5M2 6h9" />
          </svg>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-solar-hot">
            Voltar ao mapa · Esc
          </span>
        </button>
      </div>

      {/* bússola central */}
      <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 text-center">
        <div className="font-display text-[26px] font-semibold text-ink drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
          {cardinal(tele.azimuthDeg)}
        </div>
        <div className="font-mono text-[10px] tracking-[0.2em] text-dim tabular-nums">
          {Math.round(tele.azimuthDeg)}° · elev {Math.round(tele.pitchDeg)}° · FOV {Math.round(tele.fov)}°
        </div>
      </div>

      {/* o que você vê no céu */}
      {view.visibleBodies.length > 0 && (
        <div className="absolute left-4 top-20 flex flex-col gap-1.5">
          <div className="font-mono text-[8.5px] tracking-[0.24em] text-dim">NO CÉU</div>
          {view.visibleBodies.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-2 border border-line bg-panel/70 px-2.5 py-1.5 backdrop-blur-sm"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#cfe0ff", boxShadow: "0 0 6px #cfe0ff" }} />
              <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink">{b.label}</span>
              <span className="font-mono text-[9px] text-dim tabular-nums">Ø {b.angularDeg}°</span>
            </div>
          ))}
        </div>
      )}

      {/* notas do visitante */}
      {showNotes && (
        <div className="absolute bottom-24 left-4 max-w-[320px] border border-line bg-panel/80 p-3.5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[8.5px] tracking-[0.24em]" style={{ color: accent }}>
              DIÁRIO DO VISITANTE
            </div>
            <button
              onClick={() => setShowNotes(false)}
              className="font-mono text-[9px] text-dim transition-colors hover:text-ink"
            >
              ocultar
            </button>
          </div>
          <ul className="mt-2 space-y-1.5">
            {view.notes.map((n, i) => (
              <li key={i} className="flex gap-2 font-body text-[12px] leading-snug text-ink/85">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: accent }} />
                {n}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!showNotes && (
        <button
          onClick={() => setShowNotes(true)}
          className="absolute bottom-24 left-4 border border-line bg-panel/80 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.2em] text-dim backdrop-blur-md transition-colors hover:text-ink"
        >
          Diário do visitante
        </button>
      )}

      {/* dica de interação */}
      {!dragged && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-10 text-center">
          <div className="animate-pulse font-mono text-[11px] uppercase tracking-[0.24em] text-ink/80 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
            arraste para olhar ao redor
          </div>
          <div className="mt-1 font-mono text-[9px] tracking-[0.18em] text-dim">
            role para aproximar o horizonte
          </div>
        </div>
      )}

      {/* telemetria inferior */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          {view.sunVisible && (
            <div className="border px-3 py-1.5 backdrop-blur-sm" style={{ borderColor: `${accent}66`, background: "rgba(4,6,12,0.7)" }}>
              <div className="font-mono text-[8px] tracking-[0.22em]" style={{ color: accent }}>
                SOL NO CÉU
              </div>
              <div className="mt-0.5 font-mono text-[12px] font-medium text-ink tabular-nums">{sunChip}</div>
            </div>
          )}
          <Chip label="GRAVIDADE" value={`${view.gravityMs2.toLocaleString("pt-BR")} m/s²`} />
          <Chip label="PRESSÃO" value={view.pressure} />
          <Chip label="TEMPERATURA" value={view.temperature} />
          <Chip label="DURAÇÃO DO DIA" value={view.dayLength} />
        </div>
        <div className="hidden font-mono text-[8.5px] tracking-[0.2em] text-dim/70 md:block">
          SIMULAÇÃO ARTÍSTICA BASEADA EM DADOS NASA/ESA · ESCALAS ANGULARES REAIS
        </div>
      </div>
    </div>
  );
}
