import type { BodyDef, MoonDef } from "../data/bodies";
import { fmtInt, fmtNum } from "../data/bodies";

export interface SelInfo {
  kind: "star" | "planet" | "moon";
  name: string;
  accent: string;
  typeLabel: string;
  diameterKm: number;
  fact: string;
  moon?: MoonDef;
  parent?: BodyDef;
  def?: BodyDef;
}

interface Props {
  info: SelInfo;
  onClose: () => void;
  onSelect: (id: string) => void;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border-b border-line/70 py-2 last:border-b-0">
      <div className="font-mono text-[8.5px] tracking-[0.24em] text-dim">{label}</div>
      <div className="mt-0.5 font-mono text-[13px] font-medium text-ink tabular-nums">{value}</div>
      {sub && <div className="font-mono text-[10px] text-dim tabular-nums">{sub}</div>}
    </div>
  );
}

function fmtPeriod(days: number): { value: string; sub?: string } {
  const abs = Math.abs(days);
  if (abs < 1) return { value: `${fmtNum(abs * 24, 1)} horas` };
  if (abs < 1000) return { value: `${fmtNum(abs, abs < 10 ? 2 : 1)} dias` };
  return { value: `${fmtNum(abs / 365.25, 1)} anos`, sub: `${fmtInt(Math.round(abs))} dias` };
}

export default function InfoPanel({ info, onClose, onSelect }: Props) {
  const d = info.def;
  const m = info.moon;
  const period = m
    ? fmtPeriod(m.periodDays)
    : d && d.periodDays > 0
      ? fmtPeriod(d.periodDays)
      : null;

  return (
    <div
      key={info.name}
      className="panel-in absolute bottom-24 right-4 top-4 z-20 flex w-[304px] flex-col border border-line bg-panel/95 shadow-[0_18px_60px_rgba(0,0,0,0.6)]"
    >
      {/* cabeçalho */}
      <div className="relative border-b border-line px-5 pb-4 pt-4">
        <button
          onClick={onClose}
          title="Fechar (Esc)"
          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center border border-line text-dim transition-colors hover:border-solar/60 hover:text-solar"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.4">
            <path d="M1 1l8 8M9 1l-8 8" />
          </svg>
        </button>
        <div className="flex items-center gap-3">
          <span
            className="block h-4 w-4 shrink-0 rounded-full"
            style={{
              background: `radial-gradient(circle at 34% 30%, #ffffffcc, ${info.accent} 45%, #000000aa)`,
              boxShadow: `0 0 14px ${info.accent}88`,
            }}
          />
          <div>
            <h2 className="font-display text-[21px] font-semibold leading-tight text-ink">
              {info.name}
            </h2>
            <div
              className="mt-1 inline-block border px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.2em]"
              style={{ color: info.accent, borderColor: `${info.accent}55` }}
            >
              {info.typeLabel}
            </div>
          </div>
        </div>
      </div>

      {/* dados */}
      <div className="scroll-slim flex-1 overflow-y-auto px-5 py-2">
        <Stat label="DIÂMETRO" value={`${fmtInt(info.diameterKm)} km`} />

        {info.kind === "moon" && info.parent && (
          <>
            <Stat
              label={`DISTÂNCIA DE ${info.parent.name.toUpperCase()}`}
              value={`${fmtInt(m!.distFromPlanetKm)} km`}
            />
            {period && <Stat label="PERÍODO ORBITAL" value={period.value} sub={period.sub} />}
            <div className="py-2">
              <div className="font-mono text-[8.5px] tracking-[0.24em] text-dim">PLANETA-HOSPEDEIRO</div>
              <button
                onClick={() => onSelect(info.parent!.id)}
                className="mt-1.5 flex w-full items-center gap-2 border border-line px-2.5 py-1.5 text-left transition-colors hover:border-solar/60 hover:bg-solar/5"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: info.parent.accent, boxShadow: `0 0 8px ${info.parent.accent}` }}
                />
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink">
                  {info.parent.name}
                </span>
                <span className="ml-auto font-mono text-[10px] text-dim">
                  {fmtNum(info.parent.distSunAU, 2)} UA
                </span>
              </button>
            </div>
          </>
        )}

        {info.kind !== "moon" && d && (
          <>
            {info.kind === "planet" && (
              <Stat
                label="DISTÂNCIA DO SOL"
                value={`${fmtNum(d.distSunMkm, d.distSunMkm >= 1000 ? 0 : 1)} milhões km`}
                sub={`${fmtNum(d.distSunAU, 2)} unidades astronômicas`}
              />
            )}
            {period && <Stat label="PERÍODO ORBITAL" value={period.value} sub={period.sub} />}
            <Stat label="ROTAÇÃO" value={d.rotationLabel} />
            {d.orbitSpeedKms !== undefined && (
              <Stat label="VELOCIDADE ORBITAL" value={`${fmtNum(d.orbitSpeedKms, 1)} km/s`} />
            )}
            <Stat label="TEMPERATURA" value={d.tempLabel} />
            {info.kind === "planet" && (
              <Stat label="LUAS CONHECIDAS" value={`${d.moonsKnown}`} />
            )}
          </>
        )}

        {/* curiosidade */}
        <div className="my-3 border-l-2 border-solar/70 bg-solar/[0.05] px-3 py-2.5">
          <div className="font-mono text-[8.5px] tracking-[0.24em] text-solar">CURIOSIDADE</div>
          <p className="mt-1 font-body text-[12.5px] leading-relaxed text-ink/90">{info.fact}</p>
        </div>

        {/* luas principais */}
        {info.kind === "planet" && d && d.moons.length > 0 && (
          <div className="pb-4">
            <div className="font-mono text-[8.5px] tracking-[0.24em] text-dim">
              LUAS PRINCIPAIS · CLIQUE PARA VISITAR
            </div>
            <div className="mt-2 flex flex-col gap-1">
              {d.moons.map((moon) => (
                <button
                  key={moon.id}
                  onClick={() => onSelect(moon.id)}
                  className="group flex items-center gap-2.5 border border-line px-2.5 py-1.5 text-left transition-all duration-150 hover:translate-x-1 hover:border-solar/50 hover:bg-solar/5"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: moon.accent, boxShadow: `0 0 6px ${moon.accent}` }}
                  />
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink group-hover:text-solar-hot">
                    {moon.name}
                  </span>
                  <span className="ml-auto font-mono text-[9.5px] text-dim tabular-nums">
                    Ø {fmtInt(moon.diameterKm)} km
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {info.kind === "moon" && info.parent && (
          <div className="pb-4">
            <div className="font-mono text-[8.5px] tracking-[0.24em] text-dim">
              OUTRAS LUAS DE {info.parent.name.toUpperCase()}
            </div>
            <div className="mt-2 flex flex-col gap-1">
              {info.parent.moons
                .filter((x) => x.id !== m!.id)
                .map((moon) => (
                  <button
                    key={moon.id}
                    onClick={() => onSelect(moon.id)}
                    className="group flex items-center gap-2.5 border border-line px-2.5 py-1.5 text-left transition-all duration-150 hover:translate-x-1 hover:border-solar/50 hover:bg-solar/5"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: moon.accent, boxShadow: `0 0 6px ${moon.accent}` }}
                    />
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink group-hover:text-solar-hot">
                      {moon.name}
                    </span>
                    <span className="ml-auto font-mono text-[9.5px] text-dim tabular-nums">
                      Ø {fmtInt(moon.diameterKm)} km
                    </span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-line px-5 py-2 font-mono text-[8.5px] tracking-[0.2em] text-dim">
        ESC PARA DESFOCAR · ESPAÇO PARA PAUSAR
      </div>
    </div>
  );
}
