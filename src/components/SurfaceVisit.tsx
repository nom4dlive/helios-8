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

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line bg-panel/85 px-3 py-1.5 backdrop-blur-sm">
      <div className="font-mono text-[8px] tracking-[0.22em] text-dim">{label}</div>
      <div className="mt-0.5 font-mono text-[11.5px] font-medium text-ink tabular-nums">{value}</div>
    </div>
  );
}

const cardinal = (deg: number) => {
  const dirs = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];
  return dirs[Math.round(deg / 45) % 8];
};

export default function SurfaceVisit({ bodyName, accent, view, onClose }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [tele, setTele] = useState<SurfaceTelemetry>({
    azimuthDeg: 0,
    pitchDeg: 0,
    fov: 70,
    fps: 60,
    posX: 0,
    posZ: 0,
    canWalk: !view.cloudSea,
    moving: false,
    panoActive: false,
  });
  const [dragged, setDragged] = useState(false);

  useEffect(() => {
    if (!mountRef.current) return;
    const scene = new SurfaceScene(mountRef.current, {
      def: view,
      onTelemetry: setTele,
    });
    sfx.visit();
    const markDrag = () => setDragged(true);
    mountRef.current.addEventListener("pointerdown", markDrag);
    return () => {
      mountRef.current?.removeEventListener("pointerdown", markDrag);
      scene.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const sunChip = view.sunVisible
    ? view.realism?.sunDiffuse
      ? "DIFUSO NAS NUVENS"
      : `Ø ${view.sunAngularDeg.toFixed(2)}° · ${(view.sunAngularDeg / 0.53).toFixed(1)}× TERRA`
    : "OCULTO";

  return (
    <div className="absolute inset-0 z-40 overflow-hidden bg-void">
      <div ref={mountRef} className="absolute inset-0" />

      {/* vinheta + grão suave por cima da cena */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.55)_100%)]" />

      {/* cabeçalho */}
      <div className="pointer-events-none absolute left-5 top-5 z-30">
        <div className="flex items-center gap-3">
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: accent, boxShadow: `0 0 12px ${accent}` }}
          />
          <div>
            <div className="font-display text-[22px] font-semibold leading-none text-ink drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
              {bodyName}
            </div>
            <div className="mt-1 font-mono text-[9px] tracking-[0.26em] text-ink/70">
              {view.viewLabel.toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      {/* botão de saída */}
      <div className="absolute right-5 top-5 z-30 flex flex-col items-end gap-2">
        <button
          onClick={onClose}
          className="group flex items-center gap-2.5 border border-solar/60 bg-panel/90 px-4 py-2.5 backdrop-blur-md transition-all hover:border-solar-hot hover:bg-solar/15"
        >
          <svg width="13" height="13" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-solar-hot transition-transform group-hover:-translate-x-0.5">
            <path d="M8 1H2v12h6M5 7h8m0 0L10 4m3 3l-3 3" />
          </svg>
          <span className="font-mono text-[10px] tracking-[0.22em] text-solar-hot">
            VOLTAR AO MAPA · ESC
          </span>
        </button>

        {/* telemetria */}
        <div className="pointer-events-none flex flex-col items-end gap-1 font-mono">
          <div className="flex gap-2">
            <span className="stat"><span>EL</span><strong>{tele.pitchDeg.toFixed(0)}°</strong></span>
            <span className="stat"><span>FOV</span><strong>{tele.fov.toFixed(0)}°</strong></span>
          </div>
          {view.sunVisible && (
            <span className="stat">
              <span>SOL</span>
              <strong className="text-solar-hot">{sunChip}</strong>
            </span>
          )}
          {tele.canWalk && (
            <span className="stat">
              <span>POS</span>
              <strong>{tele.posX.toFixed(0)}, {tele.posZ.toFixed(0)}</strong>
            </span>
          )}
          <span className="stat">
            <span>FPS</span>
            <strong className={tele.fps < 30 ? "text-[#ff9a6a]" : ""}>{tele.fps}</strong>
          </span>
        </div>
      </div>

      {/* bússola */}
      <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 text-center">
        <div className="font-display text-[26px] font-semibold text-ink drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
          {cardinal(tele.azimuthDeg)}
        </div>
        <div className="font-mono text-[10px] tracking-[0.3em] text-ink/60 tabular-nums">
          {tele.azimuthDeg.toFixed(0).padStart(3, "0")}°
        </div>
      </div>

      {/* ficha de dados */}
      <div className="pointer-events-none absolute bottom-5 left-5 z-30 flex max-w-[46%] flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          <Chip label="GRAVIDADE" value={`${view.gravityMs2.toLocaleString("pt-BR")} m/s²`} />
          <Chip label="PRESSÃO" value={view.pressure} />
          <Chip label="TEMPERATURA" value={view.temperature} />
          <Chip label="DURAÇÃO DO DIA" value={view.dayLength} />
        </div>
        {view.notes[0] && (
          <div
            className="max-w-md border-l-2 px-3 py-2"
            style={{ borderColor: accent, background: "rgba(4,6,12,0.68)", backdropFilter: "blur(6px)" }}
          >
            <div className="font-mono text-[8px] tracking-[0.24em]" style={{ color: accent }}>
              DIÁRIO DO VISITANTE
            </div>
            {view.notes.map((n, i) => (
              <p key={i} className="mt-1 font-body text-[12px] leading-snug text-ink/85">
                {n}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* dica inicial */}
      {!dragged && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-10 text-center">
          <div className="animate-pulse font-mono text-[11px] uppercase tracking-[0.24em] text-ink/85 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
            arraste para olhar ao redor
          </div>
          {tele.canWalk && (
            <div className="mt-1.5 font-mono text-[10px] tracking-[0.2em] text-solar-hot drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
              WASD — caminhar · SHIFT — correr
            </div>
          )}
          <div className="mt-1 font-mono text-[9px] tracking-[0.18em] text-dim">
            role para aproximar o horizonte
          </div>
        </div>
      )}
      {dragged && tele.canWalk && (
        <div className="pointer-events-none absolute bottom-[86px] left-1/2 z-20 -translate-x-1/2 font-mono text-[8.5px] tracking-[0.22em] text-dim/85 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
          WASD CAMINHAR · SHIFT CORRER · ARRASTE OLHAR · ESC SAIR
        </div>
      )}
    </div>
  );
}
