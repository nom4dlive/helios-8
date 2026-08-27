import { useEffect, useMemo, useRef, useState } from "react";
import { SolarSystem, type HudData } from "./three/SolarSystem";
import { SUN, PLANETS, findMoon } from "./data/bodies";
import Hud from "./components/Hud";
import NavRail from "./components/NavRail";
import ControlDock, { type Toggles } from "./components/ControlDock";
import InfoPanel, { type SelInfo } from "./components/InfoPanel";
import { sfx, setMuted } from "./lib/sound";
import SurfaceVisit from "./components/SurfaceVisit";
import { getSurfaceView } from "./data/surfaceViews";

const DEFAULT_SPEED = 4;

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const sysRef = useRef<SolarSystem | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hud, setHud] = useState<HudData>({
    fps: 60,
    simDays: 0,
    daysPerSec: 8 * DEFAULT_SPEED,
    paused: false,
  });
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [toggles, setToggles] = useState<Toggles>({ orbits: true, labels: true, belt: true });
  const [muted, setMutedState] = useState(false);
  const [visitId, setVisitId] = useState<string | null>(null);

  useEffect(() => {
    if (!mountRef.current || !labelsRef.current) return;
    const sys = new SolarSystem(mountRef.current, labelsRef.current, {
      onSelect: (id) => {
        setSelectedId(id);
        if (id) sfx.select();
        else sfx.deselect();
      },
      onHover: () => {},
      onHud: (h) => {
        setHud(h);
        setPaused(h.paused);
      },
    });
    sys.setSpeed(DEFAULT_SPEED);
    sysRef.current = sys;
    return () => {
      sys.dispose();
      sysRef.current = null;
    };
  }, []);

  /* atalhos do modo de visita: V = visitar, Esc = sair da visita */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && visitId) {
        setVisitId(null);
        return;
      }
      if ((e.key === "v" || e.key === "V") && !visitId && selectedId) {
        const v = getSurfaceView(selectedId);
        if (v) {
          setVisitId(selectedId);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visitId, selectedId]);

  const handleVisit = (id: string) => {
    if (getSurfaceView(id)) {
      sfx.play();
      setVisitId(id);
    }
  };

  const info = useMemo<SelInfo | null>(() => {
    if (!selectedId) return null;
    if (selectedId === "sun") {
      return {
        kind: "star",
        name: SUN.name,
        accent: SUN.accent,
        typeLabel: SUN.typeLabel,
        diameterKm: SUN.diameterKm,
        fact: SUN.fact,
        def: SUN,
      };
    }
    const planet = PLANETS.find((p) => p.id === selectedId);
    if (planet) {
      return {
        kind: "planet",
        name: planet.name,
        accent: planet.accent,
        typeLabel: planet.typeLabel,
        diameterKm: planet.diameterKm,
        fact: planet.fact,
        def: planet,
      };
    }
    const mf = findMoon(selectedId);
    if (mf) {
      return {
        kind: "moon",
        name: mf.moon.name,
        accent: mf.moon.accent,
        typeLabel: "Satélite natural",
        diameterKm: mf.moon.diameterKm,
        fact: mf.moon.fact,
        moon: mf.moon,
        parent: mf.parent,
      };
    }
    return null;
  }, [selectedId]);

  const visitBody = useMemo(() => {
    if (!visitId) return null;
    const view = getSurfaceView(visitId);
    if (!view) return null;
    if (visitId === "sun") return null;
    const planet = PLANETS.find((p) => p.id === visitId);
    if (planet) return { name: planet.name, accent: planet.accent, view };
    const mf = findMoon(visitId);
    if (mf) return { name: mf.moon.name, accent: mf.moon.accent, view };
    return null;
  }, [visitId]);

  const handleTogglePause = () => {
    const next = !paused;
    sysRef.current?.setPaused(next);
    setPaused(next);
    if (next) sfx.pause();
    else sfx.play();
  };

  const handleSpeed = (v: number) => {
    setSpeed(v);
    sysRef.current?.setSpeed(v);
  };

  const handleToggleKey = (k: keyof Toggles) => {
    sfx.toggle();
    setToggles((t) => {
      const next = { ...t, [k]: !t[k] };
      const sys = sysRef.current;
      if (sys) {
        if (k === "orbits") sys.setOrbits(next.orbits);
        if (k === "labels") sys.setLabels(next.labels);
        if (k === "belt") sys.setBelt(next.belt);
      }
      return next;
    });
  };

  const handleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (!next) sfx.toggle();
  };

  const select = (id: string | null) => sysRef.current?.select(id);

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-void font-body text-ink">
      {/* cena 3D */}
      <div ref={mountRef} className="absolute inset-0 z-0" />
      {/* rótulos projetados */}
      <div ref={labelsRef} className="pointer-events-none absolute inset-0 z-10 overflow-hidden" />

      <Hud hud={hud} />
      <NavRail selected={selectedId} onSelect={(id) => select(id)} />

      {info && (
        <InfoPanel
          info={info}
          onClose={() => select(null)}
          onSelect={(id) => select(id)}
          onVisit={handleVisit}
        />
      )}

      <ControlDock
        paused={paused}
        speed={speed}
        muted={muted}
        toggles={toggles}
        onTogglePause={handleTogglePause}
        onSpeed={handleSpeed}
        onToggleKey={handleToggleKey}
        onOverview={() => select(null)}
        onToggleMute={handleMute}
      />

      {/* guia de interação */}
      {!visitBody && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-20 hidden flex-col gap-0.5 font-mono text-[9px] tracking-[0.18em] text-dim md:flex">
          <span>ARRASTE — ORBITAR A CÂMERA · ROLE — ZOOM</span>
          <span>CLIQUE NUM CORPO — DADOS · V — VISITAR SUPERFÍCIE</span>
          <span className="text-dim/70">DISTÂNCIAS E TAMANHOS NÃO ESTÃO EM ESCALA REAL</span>
        </div>
      )}

      {/* modo de visita à superfície */}
      {visitBody && visitId && (
        <SurfaceVisit
          bodyId={visitId}
          bodyName={visitBody.name}
          accent={visitBody.accent}
          view={visitBody.view}
          onClose={() => setVisitId(null)}
        />
      )}
    </div>
  );
}
