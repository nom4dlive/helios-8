/** micro-feedback sonoro via WebAudio — sem assets, criado no primeiro gesto */
let ctx: AudioContext | null = null;
let muted = false;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function blip(freq: number, dur = 0.08, gain = 0.04, type: OscillatorType = "sine", slideTo?: number) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(40, freq), t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
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
  whoosh() {
    blip(180, 0.4, 0.035, "sawtooth", 720);
  },
  step(rate = 1) {
    blip(90 + 40 * rate, 0.06, 0.02, "triangle");
  },
  setMuted(m: boolean) {
    muted = m;
  },
  isMuted() {
    return muted;
  },
};
