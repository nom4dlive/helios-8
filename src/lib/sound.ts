let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(m: boolean) {
  muted = m;
}
export function isMuted() {
  return muted;
}

function ensure(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function blip(freq: number, dur: number, gain: number, type: OscillatorType, glideTo?: number) {
  const ac = ensure();
  if (!ac) return;
  const t0 = ac.currentTime;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  select() {
    blip(660, 0.16, 0.05, "sine", 990);
  },
  deselect() {
    blip(520, 0.14, 0.04, "sine", 320);
  },
  toggle() {
    blip(880, 0.07, 0.03, "triangle");
  },
  pause() {
    blip(440, 0.12, 0.04, "sine", 260);
  },
  play() {
    blip(392, 0.14, 0.045, "sine", 588);
  },
  visit() {
    blip(262, 0.34, 0.05, "sine", 784);
    blip(131, 0.4, 0.04, "triangle", 196);
  },
  step(rate = 1) {
    blip(90 + 40 * rate, 0.06, 0.02, "triangle");
  },
};
