import type { HudData } from "../three/SolarSystem";
import { fmtInt, fmtNum } from "../data/bodies";

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

        <div className="mt-4 space-y-1.5 border-l-2 border-solar/50 bg-panel/80 px-3 py-2.5 backdrop-blur-[2px]">
          <Row label="MISSÃO T+" value={`Dia ${fmtInt(Math.floor(hud.simDays))}`} />
          <Row label="ELAPSE" value={`${fmtNum(years, 2)} anos`} />
          <Row label="RITMO" value={ritmo} />
          <Row label="FPS" value={`${hud.fps}`} />
          <div className="flex items-center justify-between gap-6 pt-0.5">
            <span className="font-mono text-[9px] tracking-[0.22em] text-dim">ESTADO</span>
            <span className="flex items-center gap-1.5 font-mono text-[11px] font-medium">
              <span
                className={
                  hud.paused
                    ? "inline-block h-[7px] w-[7px] rounded-full bg-solar shadow-[0_0_8px_rgba(245,179,66,0.9)]"
                    : "pulse-dot inline-block h-[7px] w-[7px] rounded-full bg-ice"
                }
              />
              <span className={hud.paused ? "text-solar" : "text-ice"}>
                {hud.paused ? "PAUSADO" : "EM ÓRBITA"}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
