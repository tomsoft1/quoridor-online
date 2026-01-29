// Simple sound effects using Web Audio API

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

export function playMoveSound() {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.frequency.setValueAtTime(440, ctx.currentTime); // A4
  oscillator.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1); // A5

  gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

  oscillator.type = "sine";
  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.15);
}

export function playWallSound() {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.frequency.setValueAtTime(150, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.2);

  gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

  oscillator.type = "square";
  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.25);
}

export function playWinSound() {
  const ctx = getAudioContext();
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

  notes.forEach((freq, i) => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    const startTime = ctx.currentTime + i * 0.15;
    oscillator.frequency.setValueAtTime(freq, startTime);

    gainNode.gain.setValueAtTime(0.3, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

    oscillator.type = "sine";
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.3);
  });
}

export function playLoseSound() {
  const ctx = getAudioContext();
  const notes = [392, 349.23, 329.63, 261.63]; // G4, F4, E4, C4

  notes.forEach((freq, i) => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    const startTime = ctx.currentTime + i * 0.2;
    oscillator.frequency.setValueAtTime(freq, startTime);

    gainNode.gain.setValueAtTime(0.3, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.35);

    oscillator.type = "triangle";
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.35);
  });
}
