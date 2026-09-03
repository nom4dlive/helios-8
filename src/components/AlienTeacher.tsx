import { useEffect, useMemo, useRef, useState } from "react";
import { ALIEN_FACTS, systemFacts, type ExoSystem } from "../data/catalog";
import { sfx } from "../lib/sound";

interface Props {
  system: ExoSystem;
  enabled: boolean;
}

/** desenha o Prof. Zyx em canvas — flutuação, piscadas e aceno ao falar */
function drawAlien(g: CanvasRenderingContext2D, t: number, talking: boolean) {
  const w = g.canvas.width;
  const h = g.canvas.height;
  g.clearRect(0, 0, w, h);
  const cx = w / 2;
  const bob = Math.sin(t * 1.8) * 6;
  const cy = h / 2 + bob;

  /* jetpack flame */
  const fl = 10 + Math.sin(t * 22) * 4 + (talking ? 3 : 0);
  const fg = g.createLinearGradient(cx, cy + 46, cx, cy + 46 + fl * 2);
  fg.addColorStop(0, "rgba(255,210,120,0.9)");
  fg.addColorStop(1, "rgba(255,120,40,0)");
  g.fillStyle = fg;
  g.beginPath();
  g.moveTo(cx - 9, cy + 44);
  g.lineTo(cx + 9, cy + 44);
  g.lineTo(cx, cy + 46 + fl * 2);
  g.closePath();
  g.fill();

  /* corpo */
  g.fillStyle = "#7fd4a0";
  g.strokeStyle = "rgba(10,30,20,0.55)";
  g.lineWidth = 3;
  g.beginPath();
  g.ellipse(cx, cy + 18, 26, 30, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  /* braços: o direito acena quando fala */
  const wave = talking ? Math.sin(t * 7) * 0.5 - 0.6 : 0.5;
  g.strokeStyle = "#6cc490";
  g.lineWidth = 9;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(cx - 22, cy + 8);
  g.lineTo(cx - 40, cy + 26 + Math.sin(t * 2) * 3);
  g.stroke();
  g.beginPath();
  g.moveTo(cx + 22, cy + 8);
  g.lineTo(cx + 42, cy + 8 + wave * 26);
  g.stroke();

  /* cabeça */
  g.fillStyle = "#8fe4b0";
  g.beginPath();
  g.ellipse(cx, cy - 26, 30, 26, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  /* antenas */
  const sway = Math.sin(t * 3) * 4;
  g.strokeStyle = "#6cc490";
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(cx - 12, cy - 48);
  g.quadraticCurveTo(cx - 18, cy - 66, cx - 14 + sway, cy - 72);
  g.moveTo(cx + 12, cy - 48);
  g.quadraticCurveTo(cx + 18, cy - 66, cx + 14 + sway, cy - 72);
  g.stroke();
  const tipPulse = 3 + Math.sin(t * 5) * 1.4;
  g.fillStyle = "#ffd27a";
  g.beginPath();
  g.arc(cx - 14 + sway, cy - 72, tipPulse, 0, Math.PI * 2);
  g.arc(cx + 14 + sway, cy - 72, tipPulse, 0, Math.PI * 2);
  g.fill();

  /* olhos grandes com piscada */
  const blink = (Math.sin(t * 0.9) > 0.985 ? 0.15 : 1);
  g.fillStyle = "#0d1f16";
  g.beginPath();
  g.ellipse(cx - 12, cy - 28, 8, 10 * blink, 0, 0, Math.PI * 2);
  g.ellipse(cx + 12, cy - 28, 8, 10 * blink, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#bfffe0";
  g.beginPath();
  g.arc(cx - 9, cy - 31, 2.4, 0, Math.PI * 2);
  g.arc(cx + 15, cy - 31, 2.4, 0, Math.PI * 2);
  g.fill();

  /* boca */
  g.strokeStyle = "#0d1f16";
  g.lineWidth = 3;
  g.beginPath();
  if (talking) {
    g.ellipse(cx, cy - 12, 5, 3.5 + Math.abs(Math.sin(t * 9)) * 3, 0, 0, Math.PI * 2);
  } else {
    g.moveTo(cx - 7, cy - 12);
    g.quadraticCurveTo(cx, cy - 7, cx + 7, cy - 12);
  }
  g.stroke();
}

/** renderiza **negrito** como <strong> */
function Rich({ text }: { text: string }) {
  const parts = text.split("**");
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-solar-hot">
            {p}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

export default function AlienTeacher({ system, enabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const queue = useMemo(
    () => [...ALIEN_FACTS.map((f) => f.text), ...systemFacts(system).map((f) => f.text)],
    [system.id]
  );
  const [idx, setIdx] = useState(0);
  const [chars, setChars] = useState(0);
  const full = queue[idx % queue.length];
  const talking = chars < full.length;

  /* reposiciona a fila quando o sistema muda (fatos dinâmicos do sistema novo) */
  useEffect(() => {
    setIdx(ALIEN_FACTS.length);
    setChars(0);
  }, [system.id]);

  /* animação do canvas */
  useEffect(() => {
    if (!enabled) return;
    const cv = canvasRef.current;
    if (!cv) return;
    const g = cv.getContext("2d");
    if (!g) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = () => {
      drawAlien(g, (performance.now() - t0) / 1000, talking);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, talking]);

  /* máquina de escrever */
  useEffect(() => {
    if (!enabled || !talking) return;
    const id = window.setInterval(() => setChars((c) => Math.min(full.length, c + 2)), 28);
    return () => window.clearInterval(id);
  }, [enabled, talking, full]);

  /* avança sozinho após pausa de leitura */
  useEffect(() => {
    if (!enabled || talking) return;
    const id = window.setTimeout(() => {
      setChars(0);
      setIdx((i) => (i + 1) % queue.length);
      sfx.toggle();
    }, 7000);
    return () => window.clearTimeout(id);
  }, [enabled, talking, queue]);

  if (!enabled) return null;

  const skip = () => {
    if (talking) setChars(full.length);
    else {
      setChars(0);
      setIdx((i) => (i + 1) % queue.length);
      sfx.toggle();
    }
  };

  return (
    <div className="pointer-events-none absolute bottom-[86px] right-4 z-20 flex w-[340px] items-end gap-2">
      <button
        onClick={skip}
        className="pointer-events-auto shrink-0 rounded-full transition-transform hover:scale-105"
        title="Clique para pular"
      >
        <canvas ref={canvasRef} width={150} height={170} />
      </button>
      <button
        onClick={skip}
        className="alien-bubble pointer-events-auto mb-6 w-full bg-[#081018]/95 px-3.5 py-3 text-left shadow-[0_10px_40px_rgba(0,0,0,0.6)]"
        title="Clique para pular"
      >
        <div className="mb-1 flex items-center gap-2 font-mono text-[8px] tracking-[0.26em] text-[#7fe8de]">
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[#7fe8de]" />
          PROF. ZYX · CURIOSIDADE {((idx % queue.length) + 1)}/{queue.length}
        </div>
        <p className="font-body text-[12.5px] leading-relaxed text-ink">
          <Rich text={full.slice(0, chars)} />
          {talking && <span className="animate-pulse text-[#7fe8de]">▌</span>}
        </p>
      </button>
    </div>
  );
}
