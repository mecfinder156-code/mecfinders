// Short attention sound + haptic for a new job request. Uses the Web Audio API
// (no asset needed) so it works inside the Capacitor WebView. Browsers suspend
// the audio context until a user gesture, so call primeAudio() from a tap
// (e.g. the Online toggle) once before relying on playRequestBeep().

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

/** Unlock the audio context on a user gesture so later beeps can play. */
export function primeAudio() {
  const c = getCtx();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

/** Loud, shrill multi-beep + strong vibrate to alert the mechanic of a new request. */
export function playRequestBeep() {
  const c = getCtx();
  if (c) {
    if (c.state === 'suspended') c.resume().catch(() => {});
    const beep = (offset: number, freq: number) => {
      try {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'square'; // harsher/shriller than sine
        osc.frequency.value = freq;
        const t = c.currentTime + offset;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.9, t + 0.01); // louder
        gain.gain.setValueAtTime(0.9, t + 0.14);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
        osc.connect(gain).connect(c.destination);
        osc.start(t);
        osc.stop(t + 0.18);
      } catch {
        /* ignore */
      }
    };
    // Rising shrill triple-beep, repeated once.
    const tones = [2200, 2600, 3000, 2200, 2600, 3000];
    tones.forEach((f, i) => beep(i * 0.17, f));
  }
  try {
    if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
      (navigator as any).vibrate([300, 120, 300, 120, 300]);
    }
  } catch {
    /* ignore */
  }
}
