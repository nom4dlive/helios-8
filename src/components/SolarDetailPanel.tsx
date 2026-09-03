import type { SolarSelection } from "../three/SolarScene";
import {
  SOLAR_PLANETS,
  SOLAR_MOONS,
  SOLAR_STAR,
  solarVisitFor,
} from "../data/solarSystem";
import { CLASS_META, fmtNum, fmtInt } from "../data/catalog";

interface Props {
  sel: SolarSelection | null;
  onSelect: (sel: SolarSelection) => void;
  onVisit: (id: string) => void;
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

export default function SolarDetailPanel({ sel, onSelect, onVisit }: Props) {
  const planet = sel?.kind === "planet" ? SOLAR_PLANETS.find((p) => p.id === sel.id) ?? null : null;
  const moon = sel?.kind === "moon" ? SOLAR_MOONS.find((m) => m.id === sel.id) ?? null : null;
  const host = moon ? SOLAR_PLANETS.find((p) => p.id === moon.planetId) ?? null : null;
  const moonsOfPlanet = planet ? SOLAR_MOONS.filter((m) => m.planetId === planet.id) : [];

  /* ---------------------------- Sol ---------------------------- */
  if (!sel || sel.kind === "star") {
    return (
      <div key="star" className="rise-in">
        <div className="font-mono text-[8.5px] tracking-[0.26em] text-dim">ESTRELA-MÃE</div>
        <h2 className="mt-1 font-display text-[20px] font-bold text-ink">{SOLAR_STAR.name}</h2>
        <div className="mt-1 font-mono text-[10px] tracking-[0.14em]" style={{ color: SOLAR_STAR.spectral.color }}>
          {SOLAR_STAR.spectral.type} · {fmtInt(SOLAR_STAR.spectral.tempK)} K
        </div>
        <div className="mt-3 flex flex-col">
          <StatRow label="RAIO" value={`${fmtInt(SOLAR_STAR.radiusKm)} km`} sub="109× o raio da Terra" />
          <StatRow label="MASSA" value="1,989 × 10³⁰ kg" sub="99,86% da massa do sistema" />
          <StatRow label="LUMINOSIDADE" value="3,828 × 10²⁶ W" sub="referência: 1 L☉" />
          <StatRow label="IDADE" value={`${fmtNum(SOLAR_STAR.ageGyr, 1)} bilhões de anos`} sub="metade da vida de uma estrela G" />
          <StatRow label="FUSÃO NUCLEAR" value="600 mi t/s de H → He" sub="no núcleo a 15 milhões K" />
          <StatRow label="PLANETAS" value={`${SOLAR_PLANETS.length}`} sub={`${SOLAR_MOONS.length} luas principais mapeadas`} />
        </div>
        <p className="mt-3 border-l-2 border-solar/70 bg-solar/[0.05] px-2.5 py-2 font-body text-[12px] leading-relaxed text-ink/90">
          {SOLAR_STAR.highlight}
        </p>
        <p className="mt-2 font-mono text-[8px] tracking-[0.16em] text-dim/70">CLIQUE NUM PLANETA OU LUA NA CENA PARA EXPLORAR</p>
      </div>
    );
  }

  /* ---------------------------- planeta ---------------------------- */
  if (planet) {
    return (
      <div key={planet.id} className="rise-in">
        <div className="font-mono text-[8.5px] tracking-[0.26em] text-dim">PLANETA</div>
        <h2 className="mt-1 font-display text-[20px] font-bold leading-tight text-ink">{planet.name}</h2>
        <div
          className="mt-1.5 inline-block border px-1.5 py-0.5 font-mono text-[8.5px] tracking-[0.18em]"
          style={{ color: CLASS_META[planet.cls].color, borderColor: `${CLASS_META[planet.cls].color}55` }}
        >
          {CLASS_META[planet.cls].label.toUpperCase()}
        </div>
        <div className="mt-3 flex flex-col">
          <StatRow label="RAIO" value={`${fmtNum(planet.radiusKm, 0)} km`} sub={`${fmtNum(planet.radiusKm / 6371, 2)}× o da Terra`} />
          <StatRow label="MASSA" value={`${fmtNum(planet.massEarth, planet.massEarth < 1 ? 3 : 2)} M⊕`} />
          <StatRow label="DISTÂNCIA DO SOL" value={`${fmtNum(planet.auDist, 3)} UA`} sub={`${fmtNum(planet.auDist * 149.6, 1)} milhões km`} />
          <StatRow label="PERÍODO ORBITAL" value={`${fmtNum(planet.periodDays, planet.periodDays < 1000 ? 1 : 0)} dias`} sub={planet.periodDays > 1000 ? `${fmtNum(planet.periodDays / 365.25, 1)} anos` : undefined} />
          <StatRow label="ROTAÇÃO" value={planet.rotLabel} sub={`inclinação axial ${fmtNum(planet.tiltDeg, 1)}°`} />
          <StatRow label="TEMPERATURA" value={planet.tempLabel} />
          <StatRow label="GRAVIDADE" value={`${fmtNum(planet.gravity, 2)} m/s²`} sub={`${fmtNum(planet.gravity / 9.81, 2)}× a da Terra`} />
          <StatRow label="EXCENTRICIDADE" value={`${fmtNum(planet.ecc, 4)}`} sub="0 = órbita circular" />
          <StatRow label="LUAS CONHECIDAS" value={`${planet.moonsKnown}`} sub={moonsOfPlanet.length ? `${moonsOfPlanet.length} em destaque aqui` : undefined} />
        </div>
        <p className="mt-3 border-l-2 border-solar/70 bg-solar/[0.05] px-2.5 py-2 font-body text-[12px] leading-relaxed text-ink/90">
          {planet.note}
        </p>

        {moonsOfPlanet.length > 0 && (
          <div className="mt-3">
            <div className="font-mono text-[8.5px] tracking-[0.24em] text-dim">LUAS PRINCIPAIS · CLIQUE PARA VISITAR</div>
            <div className="mt-1.5 flex flex-col gap-1">
              {moonsOfPlanet.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onSelect({ kind: "moon", id: m.id, planetId: m.planetId })}
                  className="group flex items-center gap-2.5 border border-line px-2.5 py-1.5 text-left transition-all duration-150 hover:translate-x-1 hover:border-solar/50 hover:bg-solar/5"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: m.accent, boxShadow: `0 0 6px ${m.accent}` }} />
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink group-hover:text-solar-hot">{m.name}</span>
                  <span className="ml-auto font-mono text-[9.5px] text-dim tabular-nums">Ø {fmtInt(m.radiusKm * 2)} km</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <VisitButtonWrapper onVisit={onVisit} id={planet.id} label={`Pousar em ${planet.name}`} />
      </div>
    );
  }

  /* ---------------------------- lua ---------------------------- */
  if (moon && host) {
    return (
      <div key={moon.id} className="rise-in">
        <div className="font-mono text-[8.5px] tracking-[0.26em] text-dim">SATÉLITE NATURAL</div>
        <h2 className="mt-1 font-display text-[20px] font-bold leading-tight text-ink">{moon.name}</h2>
        <div
          className="mt-1.5 inline-block border px-1.5 py-0.5 font-mono text-[8.5px] tracking-[0.18em]"
          style={{ color: CLASS_META[moon.cls].color, borderColor: `${CLASS_META[moon.cls].color}55` }}
        >
          {CLASS_META[moon.cls].label.toUpperCase()}
        </div>
        <div className="mt-3 flex flex-col">
          <StatRow label="RAIO" value={`${fmtNum(moon.radiusKm, 0)} km`} sub={`Ø ${fmtInt(moon.radiusKm * 2)} km`} />
          <StatRow label={`DISTÂNCIA DE ${host.name.toUpperCase()}`} value={`${fmtInt(moon.orbitKm)} km`} sub={`${fmtNum(moon.orbitKm / 384400, 2)}× a distância Terra–Lua`} />
          <StatRow label="PERÍODO ORBITAL" value={`${fmtNum(Math.abs(moon.periodDays), 2)} dias`} sub={moon.periodDays < 0 ? "órbita retrógrada" : undefined} />
        </div>

        <button
          onClick={() => onSelect({ kind: "planet", id: host.id })}
          className="mt-3 flex w-full items-center gap-2 border border-line px-2.5 py-1.5 text-left transition-colors hover:border-solar/60 hover:bg-solar/5"
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: host.accent, boxShadow: `0 0 8px ${host.accent}` }} />
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink">Planeta-hospedeiro: {host.name}</span>
        </button>

        <p className="mt-3 border-l-2 border-solar/70 bg-solar/[0.05] px-2.5 py-2 font-body text-[12px] leading-relaxed text-ink/90">
          {moon.note}
        </p>

        <VisitButtonWrapper onVisit={onVisit} id={moon.id} label={`Pousar em ${moon.name}`} />
      </div>
    );
  }

  return null;
}

/** botão de visita (wrapper p/ injetar o handler do App) */
function VisitButtonWrapper({ onVisit, id, label }: { onVisit: (id: string) => void; id: string; label: string }) {
  if (!solarVisitFor(id)) return null;
  return (
    <button
      onClick={() => onVisit(id)}
      className="group mt-3 flex w-full items-center gap-3 border border-solar/60 bg-gradient-to-r from-solar/25 to-solar/5 px-3.5 py-3 text-left transition-all duration-200 hover:border-solar-hot hover:from-solar/40"
    >
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="shrink-0 text-solar-hot transition-transform group-hover:scale-110">
        <path d="M12 3v12m0 0l-4-4m4 4l4-4" />
        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      </svg>
      <span>
        <span className="block font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-solar-hot">{label}</span>
        <span className="block font-mono text-[8.5px] tracking-[0.12em] text-dim">visão em 1ª pessoa · WASD para caminhar</span>
      </span>
    </button>
  );
}
