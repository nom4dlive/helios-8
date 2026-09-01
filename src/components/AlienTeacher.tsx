import { useEffect, useMemo, useRef, useState } from "react";
import { ALIEN_FACTS, systemFacts, type AlienFact } from "../data/alienFacts";
import type { ExoSystem } from "../data/exoplanets";
import { sfx } from "../lib/sound";

interface Props {
  sys: ExoSystem;
}

type Phase = "in" | "talk" | "hold" | "out";

/** desenha o Prof. Zyx — blob alien com antenas, olhos grandes e jetpack */
function drawAlien(g: CanvasRenderingContext2D, t: number, talking: number, blink: number) {
  const W = 150;
  const H = 140;
  g.clearRect(0, 0, W, H);
  g.save();
  const bob = Math.sin(t * 1.5) * 4;
  g.translate(W / 2, H / 2 + 6 + bob);
  g.rotate(Math.sin(t * 0.9) * 0.045);

  /* chama do jetpack */
  const fl = 0.6 + 0.4 * Math.sin(t * 22);
  const flame = g.createLinearGradient(0, 46, 0, 74);
  flame.addColorStop(0, "rgba(255,190,90,0.9)");
  flame.addColorStop(1, "rgba(255,110,40,0)");
  g.fillStyle = flame;
  g.beginPath();
  g.moveTo(-8, 44);
  g.quadraticCurveTo(0, 60 + 14 * fl, 8, 44);
  g.closePath();
  g.fill();

  /* antenas */
  for (const s of [-1, 1]) {
    const tipX = s * 22 + Math.sin(t * 2.2 + s) * 3;
    const tipY = -52 + Math.cos(t * 2.6) * 2;
    g.strokeStyle = "#3fae9c";
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(s * 12, -30);
    g.quadraticCurveTo(s * 20, -44, tipX, tipY);
    g.stroke();
    const pulse = 0.6 + 0.4 * Math.sin(t * 3.4 + s * 2);
    g.fillStyle = `rgba(127,232,222,${pulse})`;
    g.beginPath();
    g.arc(tipX, tipY, 4.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.beginPath();
    g.arc(tipX - 1.2, tipY - 1.2, 1.3, 0, Math.PI * 2);
    g.fill();
  }

  /* braço esquerdo */
  g.strokeStyle = "#3fae9c";
  g.lineWidth = 6;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(-34, 6);
  g.quadraticCurveTo(-46, 14, -44, 26);
  g.stroke();

  /* braço direito — acena quando fala */
  const wave = talking > 0.1 ? Math.sin(t * 7) * 0.55 : Math.sin(t * 1.2) * 0.12;
  g.save();
  g.translate(34, 4);
  g.rotate(-0.9 + wave);
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(10, -8, 16, -16);
  g.stroke();
  g.restore();

  /* corpo */
  const body = g.createRadialGradient(-10, -14, 6, 0, 0, 46);
  body.addColorStop(0, "#8af0dc");
  body.addColorStop(0.55, "#4fc4ae");
  body.addColorStop(1, "#1e7d6c");
  g.fillStyle = body;
  g.beginPath();
  g.ellipse(0, 4, 36, 38, 0, 0, Math.PI * 2);
  g.fill();

  /* barriga */
  g.fillStyle = "rgba(210,250,240,0.35)";
  g.beginPath();
  g.ellipse(0, 18, 20, 16, 0, 0, Math.PI * 2);
  g.fill();

  /* olhos */
  for (const s of [-1, 1]) {
    const ex = s * 14;
    const ey = -12;
    g.fillStyle = "#f4fffb";
    g.beginPath();
    g.ellipse(ex, ey, 11, 12.5 * (1 - blink * 0.92), 0, 0, Math.PI * 2);
    g.fill();
    if (blink < 0.8) {
      g.fillStyle = "#123530";
      g.beginPath();
      g.arc(ex + 3.4, ey + 1.5, 4.6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(ex + 1.6, ey - 0.6, 1.6, 0, Math.PI * 2);
      g.fill();
    }
  }

  /* boca — abre no ritmo da fala */
  g.fillStyle = "#123530";
  g.beginPath();
  g.ellipse(0, 12, 7, 2.5 + talking * 6, 0, 0, Math.PI * 2);
  g.fill();

  g.restore();
}

/** converte **negrito** em <strong> com destaque de cor */
function RichText({ text }: { text: string }) {
  const parts = text.split("**");
  return (
    <p className="font-body text-[12.5px] leading-relaxed text-ink/95">
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-[#7fe8de]">
            {p}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </p>
  );
}

export default function AlienTeacher({ sys }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState("");
  const [factIdx, setFactIdx] = useState(0);
  const [counter, setCounter] = useState(1);

  const facts = useMemo<AlienFact[]>(() => {
    const own = systemFacts(sys);
    const generic = [...ALIEN_FACTS].sort(() => Math.random() - 0.5);
    /* intercala: 1 do sistema, 2 genéricas */
    const out: AlienFact[] = [];
    let gi = 0;
    for (let i = 0; i < own.length; i++) {
      out.push(own[i]);
      out.push(generic[gi++ % generic.length], generic[gi++ % generic.length]);
    }
    while (gi < generic.length) out.push(generic[gi++]);
    return out;
  }, [sys]);

  const state = useRef({
    phase: "in" as Phase,
    t: 0,
    phaseT: 0,
    typed: 0,
    talkAmp: 0,
    blinkNext: 2.5,
    blinkT: 0,
    x: -520,
  });

  /* reinicia a fila quando muda o sistema */
  useEffect(() => {
    const s = state.current;
    s.phase = "out";
    s.phaseT = 0;
    setFactIdx(0);
    setCounter(1);
  }, [facts]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const typeTimer = { acc: 0 };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const s = state.current;
      s.t += dt;
      s.phaseT += dt;

      const travel = Math.min(window.innerWidth * 0.42, 560);
      const fact = facts[factIdx % facts.length];
      const fullLen = fact ? fact.text.length : 0;

      /* máquina de estados de travessia */
      if (s.phase === "in") {
        const k = Math.min(s.phaseT / 1.3, 1);
        s.x = -520 + (520 + travel * 0.16) * (1 - Math.pow(1 - k, 3));
        if (k >= 1) {
          s.phase = "talk";
          s.phaseT = 0;
          s.typed = 0;
          typeTimer.acc = 0;
          setShown("");
        }
      } else if (s.phase === "talk") {
        typeTimer.acc += dt;
        while (typeTimer.acc > 0.034 && s.typed < fullLen) {
          typeTimer.acc -= 0.034;
          s.typed++;
        }
        setShown(fact.text.slice(0, s.typed));
        s.talkAmp += ((s.typed < fullLen ? 1 : 0) - s.talkAmp) * Math.min(1, dt * 10);
        if (s.typed >= fullLen) {
          s.phase = "hold";
          s.phaseT = 0;
        }
      } else if (s.phase === "hold") {
        s.talkAmp += (0 - s.talkAmp) * Math.min(1, dt * 6);
        if (s.phaseT > 3.4) {
          s.phase = "out";
          s.phaseT = 0;
        }
      } else {
        s.talkAmp = 0;
        const k = Math.min(s.phaseT / 1.2, 1);
        s.x = travel * 0.16 - (travel * 0.16 + 560) * (1 - Math.pow(1 - k, 2.4));
        if (k >= 1) {
          setFactIdx((i) => (i + 1) % Math.max(1, facts.length));
          setCounter((c) => c + 1);
          s.phase = "in";
          s.phaseT = 0;
          s.x = -520;
          sfx.toggle();
        }
      }

      if (wrapRef.current) {
        wrapRef.current.style.transform = `translate3d(${s.x.toFixed(1)}px,0,0)`;
      }

      /* piscadas periódicas */
      let blink = 0;
      if (s.t > s.blinkNext) {
        s.blinkT += dt;
        if (s.blinkT > 0.24) {
          s.blinkT = 0;
          s.blinkNext = s.t + 2.2 + Math.random() * 2.6;
        }
        blink = Math.sin(Math.min(s.blinkT / 0.24, 1) * Math.PI);
      }

      const cv = canvasRef.current;
      if (cv) {
        const g = cv.getContext("2d");
        if (g) {
          g.save();
          g.scale(2, 2);
          drawAlien(g, s.t, s.talkAmp, blink);
          g.restore();
        }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [facts, factIdx]);

  const skip = () => {
    const s = state.current;
    const fact = facts[factIdx % facts.length];
    if (!fact) return;
    if (s.phase === "talk") {
      s.typed = fact.text.length;
      setShown(fact.text);
    } else if (s.phase === "hold") {
      s.phase = "out";
      s.phaseT = 0;
    }
  };

  return (
    <div className="pointer-events-none absolute bottom-14 left-4 z-20 flex items-end gap-1.5" ref={wrapRef}>
      <button
        onClick={skip}
        className="alien-bubble pointer-events-auto max-w-[300px] border border-[#4fc4ae]/40 bg-[#061418]/92 p-3 text-left shadow-[0_10px_36px_rgba(0,0,0,0.55)] backdrop-blur-md transition-transform duration-150 hover:scale-[1.02]"
      >
        <div className="mb-1 flex items-center justify-between gap-3">
          <span className="font-mono text-[8px] tracking-[0.24em] text-[#7fe8de]">
            PROF. ZYX · CURIOSIDADE #{counter}
          </span>
          <span className="font-mono text-[8px] tracking-[0.18em] text-dim/80">clique p/ pular ▸</span>
        </div>
        <div className="min-h-[54px]">
          {shown ? <RichText text={shown} /> : <span className="font-mono text-[10px] tracking-[0.2em] text-dim">sintonizando…</span>}
        </div>
      </button>
      <canvas
        ref={canvasRef}
        width={300}
        height={280}
        style={{ width: 150, height: 140 }}
        className="pointer-events-auto cursor-pointer drop-shadow-[0_6px_18px_rgba(79,196,174,0.35)]"
        onClick={skip}
        title="Prof. Zyx"
      />
    </div>
  );
}
