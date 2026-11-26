let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {
      // Ignore autoplay restriction errors until user interacts
    });
  }
  return audioCtx;
}

/**
 * Crisp percussive woodblock / marimba tick played on each roll step.
 * @param progress 0 (start) to 1 (slowing down right before reveal)
 */
export function playRollTick(progress: number = 0.5, volume: number = 0.35): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // Slightly rising pitch as excitement builds toward the final selection
  const baseFreq = 520 + Math.min(Math.max(progress, 0), 1) * 260;
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.65, now + 0.045);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(volume * 0.45, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.055);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.06);
}

/**
 * Warm celebratory chime arpeggio when a student is selected.
 */
export function playWinnerChime(volume: number = 0.45): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  // Bright C major 9th chord arpeggio: C5, E5, G5, B5, D6, C6
  const notes = [523.25, 659.25, 783.99, 1046.5];

  notes.forEach((freq, idx) => {
    const startTime = now + idx * 0.065;
    const osc = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(freq * 2, startTime);

    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.12, startTime);

    const peak = idx === notes.length - 1 ? volume * 0.55 : volume * 0.38;
    const duration = idx === notes.length - 1 ? 0.85 : 0.42;

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(peak, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

    osc.connect(gain);
    overtone.connect(overtoneGain);
    overtoneGain.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    overtone.start(startTime);
    osc.stop(startTime + duration + 0.02);
    overtone.stop(startTime + duration + 0.02);
  });
}

/**
 * Crisp cascading notes when automatic grouping finishes.
 */
export function playGroupCompleteSound(volume: number = 0.35): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [440, 554.37, 659.25, 880];

  notes.forEach((freq, idx) => {
    const startTime = now + idx * 0.055;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(volume * 0.32, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0008, startTime + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.3);
  });
}
