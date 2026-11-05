/**
 * Sonneries générées (Web Audio) : aucun fichier audio à charger ni à licencier.
 *  - « ring » : appel entrant (deux bips répétés) ;
 *  - « ringback » : tonalité de retour d'appel côté appelant (bip long, silence).
 * Le navigateur peut bloquer le son tant que la page n'a reçu aucune interaction : on l'ignore.
 */
export interface Tone {
  stop: () => void;
}

const PATTERNS = {
  ring: { freq: [880, 660], on: [0.25, 0.25], gap: 0.15, pause: 1.6 },
  ringback: { freq: [440], on: [1.2], gap: 0, pause: 2.8 },
} as const;

export function startTone(kind: keyof typeof PATTERNS): Tone {
  const AudioCtx =
    typeof window !== 'undefined'
      ? (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
      : undefined;
  if (!AudioCtx) return { stop: () => undefined };

  let ctx: AudioContext;
  try {
    ctx = new AudioCtx();
  } catch {
    return { stop: () => undefined };
  }
  const pattern = PATTERNS[kind];
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(ctx.destination);
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.connect(gain);
  osc.start();

  const period =
    pattern.on.reduce((a, b) => a + b, 0) + pattern.gap * (pattern.on.length - 1) + pattern.pause;

  const schedule = (start: number) => {
    let t = start;
    pattern.on.forEach((duration, i) => {
      osc.frequency.setValueAtTime(pattern.freq[i % pattern.freq.length], t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      gain.gain.setValueAtTime(0.12, t + duration - 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      t += duration + pattern.gap;
    });
  };

  let next = ctx.currentTime + 0.05;
  schedule(next);
  const timer = setInterval(() => {
    next += period;
    schedule(next);
  }, period * 1000);

  return {
    stop: () => {
      clearInterval(timer);
      try {
        osc.stop();
      } catch {
        /* déjà arrêté */
      }
      void ctx.close();
    },
  };
}
