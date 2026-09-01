import { ALL_BODIES } from "../data/bodies";

interface Props {
  selected: string | null;
  onSelect: (id: string) => void;
}

export default function NavRail({ selected, onSelect }: Props) {
  return (
    <div className="absolute left-4 top-1/2 z-20 -translate-y-1/2">
      <div className="fade-up flex flex-col gap-1.5 border border-line bg-panel/85 p-1.5">
        <div className="px-1 pb-1 pt-0.5 font-mono text-[8px] tracking-[0.28em] text-dim">
          CORPOS
        </div>
        {ALL_BODIES.map((b) => {
          const active = selected === b.id;
          return (
            <button
              key={b.id}
              onClick={() => onSelect(b.id)}
              title={b.name}
              className={`group relative flex h-8 w-8 items-center justify-center border transition-all duration-150 ${
                active
                  ? "border-solar/80 bg-solar/10"
                  : "border-transparent hover:border-line hover:bg-white/[0.04]"
              }`}
            >
              <span
                className="block rounded-full transition-transform duration-150 group-hover:scale-110"
                style={{
                  width: b.id === "sun" ? 16 : Math.max(7, Math.min(14, b.sizeR * 7)),
                  height: b.id === "sun" ? 16 : Math.max(7, Math.min(14, b.sizeR * 7)),
                  background: `radial-gradient(circle at 34% 30%, #ffffffcc 0%, ${b.accent} 42%, #000000b0 100%)`,
                  boxShadow: active ? `0 0 12px ${b.accent}` : `0 0 5px ${b.accent}66`,
                }}
              />
              <span className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.18em] text-ink group-hover:block">
                {b.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
