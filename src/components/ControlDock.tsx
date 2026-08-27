import { fmtNum } from "../data/bodies";

export interface Toggles {
  orbits: boolean;
  labels: boolean;
  belt: boolean;
}

interface Props {
  paused: boolean;
  speed: number;
  muted: boolean;
  toggles: Toggles;
  onTogglePause: () => void;
  onSpeed: (mult: number) => void;
  onToggleKey: (k: keyof Toggles) => void;
  onOverview: () => void;
  onToggleMute: () => void;
}

const PlayIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4 2.5v11l9-5.5-9-5.5z" />
  </svg>
);
const PauseIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
    <rect x="3.5" y="2.5" width="3.2" height="11" />
    <rect x="9.3" y="2.5" width="3.2" height="11" />
  </svg>
);
const TargetIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="8" cy="8" r="5.2" />
    <path d="M8 0.8v3M8 12.2v3M0.8 8h3M12.2 8h3" />
    <circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);
const SoundOnIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M2.5 6v4h2.8L9 13V3L5.3 6H2.5z" fill="currentColor" stroke="none" />
    <path d="M11 5.5a3.6 3.6 0 0 1 0 5M12.8 3.6a6.2 6.2 0 0 1 0 8.8" />
  </svg>
);
const SoundOffIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M2.5 6v4h2.8L9 13V3L5.3 6H2.5z" fill="currentColor" stroke="none" />
    <path d="M11 6.2l3.6 3.6M14.6 6.2L11 9.8" />
  </svg>
);

function ToggleBtn({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`border px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.16em] transition-all duration-150 ${
        active
          ? "border-solar/70 bg-solar/10 text-solar-hot"
          : "border-line text-dim hover:border-white/25 hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

export default function ControlDock(p: Props) {
  const sliderVal = Math.log10(p.speed);
  const ritmo =
    p.speed * 8 >= 365
      ? `1 s ≈ ${fmtNum((p.speed * 8) / 365.25, 1)} anos`
      : `1 s ≈ ${fmtNum(p.speed * 8, p.speed * 8 >= 10 ? 0 : 1)} dias`;

  return (
    <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
      <div className="fade-up flex items-center gap-4 border border-line bg-panel/92 px-4 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.55)]">
        {/* reprodução */}
        <button
          onClick={p.onTogglePause}
          title={p.paused ? "Reproduzir (Espaço)" : "Pausar (Espaço)"}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all duration-150 hover:scale-105 ${
            p.paused
              ? "border-solar bg-solar/15 text-solar-hot shadow-[0_0_16px_rgba(245,179,66,0.35)]"
              : "border-solar/60 text-solar hover:bg-solar/10"
          }`}
        >
          {p.paused ? <PlayIcon /> : <PauseIcon />}
        </button>

        {/* velocidade */}
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-6">
            <span className="font-mono text-[8.5px] tracking-[0.26em] text-dim">VELOCIDADE</span>
            <span className="font-mono text-[10.5px] font-semibold text-solar tabular-nums">
              ×{p.speed >= 10 ? fmtNum(p.speed, 0) : fmtNum(p.speed, p.speed >= 1 ? 1 : 2)}
              <span className="ml-2 font-normal text-dim">{ritmo}</span>
            </span>
          </div>
          <input
            type="range"
            className="speed w-52"
            min={-1}
            max={2}
            step={0.01}
            value={sliderVal}
            onChange={(e) => p.onSpeed(Math.pow(10, parseFloat(e.target.value)))}
            aria-label="Velocidade da simulação"
          />
        </div>

        <div className="h-9 w-px bg-line" />

        {/* toggles */}
        <div className="flex items-center gap-1.5">
          <ToggleBtn
            active={p.toggles.orbits}
            label="Órbitas"
            onClick={() => p.onToggleKey("orbits")}
          />
          <ToggleBtn
            active={p.toggles.labels}
            label="Rótulos"
            onClick={() => p.onToggleKey("labels")}
          />
          <ToggleBtn
            active={p.toggles.belt}
            label="Cinturão"
            onClick={() => p.onToggleKey("belt")}
          />
        </div>

        <div className="h-9 w-px bg-line" />

        <button
          onClick={p.onOverview}
          title="Visão geral do sistema"
          className="flex items-center gap-1.5 border border-line px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-dim transition-all duration-150 hover:border-ice/60 hover:text-ice"
        >
          <TargetIcon />
          Visão geral
        </button>

        <button
          onClick={p.onToggleMute}
          title={p.muted ? "Ativar som" : "Silenciar"}
          className={`flex h-7 w-7 items-center justify-center border transition-colors ${
            p.muted
              ? "border-line text-dim hover:text-ink"
              : "border-ice/40 text-ice hover:bg-ice/10"
          }`}
        >
          {p.muted ? <SoundOffIcon /> : <SoundOnIcon />}
        </button>
      </div>
    </div>
  );
}
