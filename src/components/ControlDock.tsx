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
  onSpeed: (v: number) => void;
  onToggleKey: (k: keyof Toggles) => void;
  onOverview: () => void;
  onToggleMute: () => void;
  onOpenExo: () => void;
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 border px-2 py-1 font-mono text-[8.5px] tracking-[0.18em] transition-colors ${
        on
          ? "border-solar/60 text-solar-hot"
          : "border-line text-dim hover:border-solar/40 hover:text-ink"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full transition-colors ${on ? "bg-solar shadow-[0_0_6px_#f5b342]" : "bg-dim/50"}`}
      />
      {label}
    </button>
  );
}

export default function ControlDock({
  paused,
  speed,
  muted,
  toggles,
  onTogglePause,
  onSpeed,
  onToggleKey,
  onOverview,
  onToggleMute,
  onOpenExo,
}: Props) {
  const sliderVal = Math.round(Math.log10(speed / 0.1) * 33.33);
  const fromSlider = (v: number) => Math.round(0.1 * Math.pow(10, v / 33.33) * 10) / 10;

  return (
    <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
      <div className="fade-up flex items-center gap-3 border border-line bg-panel/90 px-4 py-2.5 shadow-[0_14px_50px_rgba(0,0,0,0.55)] backdrop-blur-md">
        <button
          onClick={onTogglePause}
          title={paused ? "Reproduzir (Espaço)" : "Pausar (Espaço)"}
          className="flex h-9 w-9 items-center justify-center border border-solar/60 bg-solar/10 text-solar-hot transition-all hover:bg-solar/25 hover:shadow-[0_0_18px_rgba(245,179,66,0.35)]"
        >
          {paused ? (
            <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor">
              <path d="M3 1.5l9.5 5.5L3 12.5z" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <rect x="1.5" y="1" width="3.4" height="10" />
              <rect x="7.1" y="1" width="3.4" height="10" />
            </svg>
          )}
        </button>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between font-mono text-[8px] tracking-[0.2em] text-dim">
            <span>VELOCIDADE</span>
            <span className="text-solar-hot tabular-nums">×{speed < 1 ? speed.toFixed(1) : Math.round(speed)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={sliderVal}
            onChange={(e) => onSpeed(fromSlider(Number(e.target.value)))}
            className="slider-solar w-36"
          />
        </div>

        <div className="h-8 w-px bg-line" />

        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1.5">
            <Toggle label="ÓRBITAS" on={toggles.orbits} onClick={() => onToggleKey("orbits")} />
            <Toggle label="RÓTULOS" on={toggles.labels} onClick={() => onToggleKey("labels")} />
            <Toggle label="CINTURÃO" on={toggles.belt} onClick={() => onToggleKey("belt")} />
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={onOverview}
              className="border border-line px-2 py-1 font-mono text-[8.5px] tracking-[0.18em] text-dim transition-colors hover:border-solar/40 hover:text-ink"
            >
              VISÃO GERAL
            </button>
            <button
              onClick={onToggleMute}
              title={muted ? "Ativar som" : "Silenciar"}
              className={`border px-2 py-1 font-mono text-[8.5px] tracking-[0.18em] transition-colors ${
                muted ? "border-line text-dim/60" : "border-line text-dim hover:text-ink"
              }`}
            >
              {muted ? "MUDO" : "SOM"}
            </button>
            <button
              onClick={onOpenExo}
              className="border border-solar/50 bg-solar/10 px-2 py-1 font-mono text-[8.5px] tracking-[0.18em] text-solar-hot transition-all hover:bg-solar/25"
              title="Catálogo de Mundos Habitáveis (X)"
            >
              ✦ MUNDOS HWC
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
