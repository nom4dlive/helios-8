import type { HudData } from "../three/SolarSystem";
import { fmtNum } from "../data/bodies";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <span className="font-mono text-[9px] tracking-[0.22em] text-dim">{label}</span>
      <span className="font-mono text-[12px] font-medium text-ink tabular-nums">{value}</span>
    </div>
  );
}

export default function Hud({ hud }: { hud: HudData }) {
  const years = hud.simDays / 365.25;
  const ritmo =
    hud.daysPerSec >= 365
      ? `1 s ≈ ${fmtNum(hud.daysPerSec / 365.25, 1)} anos`
      : hud.daysPerSec >= 1
        ? `1 s ≈ ${fmtNum(hud.daysPerSec, 0)} dias`
        : `1 s ≈ ${fmtNum(hud.daysPerSec, 1)} dia`;

  return (
    <div className="pointer-events-none absolute left-4 top-4 z-20 w-[228px] select-none">
      <div className="fade-up">
        <div className="flex items-center gap-2.5">
          <svg width="30" height="30" viewBox="0 0 30 30" className="spin-slow shrink-0">
            <circle cx="15" cy="15" r="4.2" fill="#f5b342" />
            <circle cx="15" cy="15" r="9" fill="none" stroke="rgba(245,179,66,0.4)" strokeWidth="1" />
            <circle cx="24" cy="15" r="1.6" fill="#8fd3ff" />
            <circle cx="15" cy="15" r="13.4" fill="none" stroke="rgba(143,211,255,0.25)" strokeWidth="1" />
            <circle cx="5.2" cy="8.6" r="1.1" fill="#e8794f" />
          </svg>
          <div>
            <div className="font-display text-[17px] font-bold leading-none tracking-tight text-ink">
              HELIOS<span className="text-solar">·8</span>
            </div>
            <div className="mt-1 font-mono text-[8.5px] tracking-[0.3em] text-dim">
              OBSERVATÓRIO ORBITAL
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-1.5 border border-line bg-panel/80 px-3.5 py-3 backdrop-blur-md">
          <Row
            label="TEMPO DE MISSÃO"
            value={years >= 1 ? `${fmtNum(years, 2)} anos` : `${fmtNum(hud.simDays, 0)} dias`}
          />
          <Row label="RITMO" value={hud.paused ? "PAUSADO" : ritmo} />
          <Row label="FPS" value={`${hud.fps}`} />
          <Row label="STATUS" value={hud.paused ? "CONGELADO" : "EM ÓRBITA"} />
          <div className="mt-1 h-[3px] w-full overflow-hidden bg-white/5">
            <div
              className="h-full bg-gradient-to-r from-solar/80 to-solar-hot transition-[width] duration-300"
              style={{ width: `${Math.min(100, (hud.daysPerSec / (8 * 100)) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
