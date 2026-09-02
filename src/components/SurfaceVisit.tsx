import { useEffect, useRef, useState } from "react";
import { SurfaceScene, visitProfile, type SurfaceTelemetry } from "../three/SurfaceScene";
import { CLASS_META, fmtNum, type ExoPlanet, type ExoSystem } from "../data/catalog";
import { sfx } from "../lib/sound";

interface Props {
  planet: ExoPlanet;
  system: ExoSystem;
  onClose: () => void;
}

export default function SurfaceVisit({ planet, system, onClose }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [tele, setTele] = useState<SurfaceTelemetry>({
    fps: 60, posX: 0, posZ: 0, headingDeg: 0, pitchDeg: 0, fov: 70, moving: false,
  });
  const [dragged, setDragged] = useState(false);
  const prof = visitProfile(planet, system);

  useEffect(() => {
    if (!mountRef.current) return;
    const scene = new SurfaceScene(mountRef.current, {
      planet,
      system,
      onTelemetry: setTele,
    });
    sfx.whoosh();
    const onDown = () => setDragged(true);
    mountRef.current.addEventListener("pointerdown", onDown);
    return () => {
      mountRef.current?.removeEventListener("pointerdown", onDown);
      scene.dispose();
    };
  }, [planet.id, system.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const compass = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"][Math.round(tele.headingDeg / 45) % 8];

  return (
    <div className="absolute inset-0 z-40 bg-black">
      <div ref={mountRef} className="absolute inset-0" />

      {/* topo */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-start justify-between p-4">
        <div className="rise-in border border-line bg-panel/90 px-4 py-2.5 backdrop-blur-md">
          <div className="font-display text-[16px] font-bold text-ink">{planet.name}</div>
          <div className="mt-0.5 font-mono text-[8.5px] tracking-[0.24em] text-dim">
            <span style={{ color: CLASS_META[planet.cls].color }}>{CLASS_META[planet.cls].label.toUpperCase()}</span>
            {" · "}SISTEMA {system.starName.toUpperCase()}
          </div>
        </div>
        <button
          onClick={onClose}
          className="pointer-events-auto border border-line bg-panel/90 px-4 py-2.5 font-mono text-[9.5px] tracking-[0.2em] text-dim backdrop-blur-md transition-colors hover:border-solar/60 hover:text-solar-hot"
        >
          ✕ VOLTAR À ÓRBITA · ESC
        </button>
      </div>

      {/* telemetria */}
      <div className="pointer-events-none absolute right-4 top-[76px] z-10 flex flex-col items-end gap-1">
        <span className="stat"><span>FPS</span><strong className={tele.fps < 30 ? "text-solar-hot" : ""}>{tele.fps}</strong></span>
        <span className="stat"><span>RUMO</span><strong>{compass} {tele.headingDeg.toFixed(0)}°</strong></span>
        <span className="stat"><span>FOV</span><strong>{tele.fov.toFixed(0)}°</strong></span>
        <span className="stat"><span>POS</span><strong>{tele.posX.toFixed(0)}, {tele.posZ.toFixed(0)}</strong></span>
        <span className="stat"><span>GRAVIDADE</span><strong>{fmtNum(prof.gravity, 1)} m/s²</strong></span>
        <span className="stat"><span>SOL NO CÉU</span><strong className="text-solar-hot">Ø {fmtNum(prof.sunAngularDeg, prof.sunAngularDeg < 1 ? 2 : 1)}°</strong></span>
        {tele.moving && (
          <span className="stat" style={{ borderColor: "rgba(95,208,138,0.5)" }}>
            <span>STATUS</span><strong className="text-bio">EXPLORANDO</strong>
          </span>
        )}
      </div>

      {/* notas da superfície */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-10 max-w-[330px] border border-line bg-panel/90 p-3.5 backdrop-blur-md">
        <div className="font-mono text-[8px] tracking-[0.26em] text-solar">DIÁRIO DO VISITANTE</div>
        {prof.notes.map((n, i) => (
          <p key={i} className="mt-1.5 font-body text-[12px] leading-relaxed text-ink/90">
            {n}
          </p>
        ))}
      </div>

      {/* dica */}
      {!dragged && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 translate-y-12 text-center">
          <div className="animate-pulse font-mono text-[11px] uppercase tracking-[0.24em] text-ink/85 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
            arraste para olhar ao redor
          </div>
          {!prof.cloudSea && (
            <div className="mt-1.5 font-mono text-[10px] tracking-[0.2em] text-solar-hot drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
              WASD — caminhar · SHIFT — correr
            </div>
          )}
        </div>
      )}
    </div>
  );
}
