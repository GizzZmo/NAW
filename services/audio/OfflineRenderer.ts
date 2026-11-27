/**
 * Offline renderer for synthesized stems / mixdown (v1.6).
 *
 * Renders the current symbolic note patterns through the same basic
 * oscillator synthesis used for live playback, into an OfflineAudioContext.
 * This enables real WAV export of the prototype synthesis (not neural audio).
 */

import { StemType, Track, NoteEvent } from '../types';

const NOTE_TO_FREQ: Record<string, number> = {
  'C': 16.35, 'C#': 17.32, 'Db': 17.32, 'D': 18.35, 'D#': 19.45, 'Eb': 19.45, 'E': 20.60,
  'F': 21.83, 'F#': 23.12, 'Gb': 23.12, 'G': 24.50, 'G#': 25.96, 'Ab': 25.96, 'A': 27.50,
  'A#': 29.14, 'Bb': 29.14, 'B': 30.87,
};

function getFreq(note: string | number): number {
  if (typeof note === 'number') return note;
  if (!note || note === 'REST') return 0;
  const match = note.match(/^([A-G][#b]?)(-?\d+)$/);
  if (!match) return 440;
  const base = NOTE_TO_FREQ[match[1]];
  if (!base) return 440;
  return base * Math.pow(2, parseInt(match[2], 10));
}

function writeWav(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * bytesPerSample, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export async function renderTrackToWav(
  track: Track,
  bpm: number,
  totalBars: number,
  sampleRate = 44100,
): Promise<Blob> {
  const secondsPerBar = (60 / bpm) * 4;
  const duration = totalBars * secondsPerBar;
  const length = Math.ceil(duration * sampleRate);

  const offline = new OfflineAudioContext(1, length, sampleRate);
  const master = offline.createGain();
  master.gain.value = 0.8;
  master.connect(offline.destination);

  const stepDuration = 60 / bpm / 4;

  if (!track.muted) {
    for (const clip of track.clips || []) {
      const clipStartTime = clip.startBar * secondsPerBar;
      for (const event of clip.events || []) {
        const t = clipStartTime + event.step * stepDuration;
        if (t >= duration) continue;
        const freq = getFreq(event.note);
        if (freq <= 0) continue;

        const osc = offline.createOscillator();
        const gain = offline.createGain();
        osc.frequency.value = freq;
        osc.type = track.type === StemType.DRUMS ? 'sine' : track.type === StemType.BASS ? 'sawtooth' : 'triangle';
        gain.gain.value = (track.volume ?? 1) * (event.velocity ?? 0.7) * 0.4;
        osc.connect(gain);
        gain.connect(master);
        osc.start(t);
        osc.stop(t + (event.duration || 1) * stepDuration);
      }
    }
  }

  const rendered = await offline.startRendering();
  const channel = rendered.getChannelData(0);
  return writeWav(channel, sampleRate);
}

export async function exportWavStems(
  tracks: Track[],
  bpm: number,
  totalBars: number,
  sampleRate = 44100,
): Promise<void> {
  for (const track of tracks) {
    if (track.muted) continue;
    const blob = await renderTrackToWav(track, bpm, totalBars, sampleRate);
    const safeName = (track.name || track.id || 'track').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    downloadBlob(blob, `naw-stem-${safeName}-${Date.now()}.wav`);
    // Small delay so browsers don't block multiple downloads
    await new Promise(r => setTimeout(r, 300));
  }
}

export async function renderProjectToWav(
  tracks: Track[],
  bpm: number,
  totalBars: number,
  sampleRate = 44100,
): Promise<Blob> {
  const secondsPerBar = (60 / bpm) * 4;
  const duration = totalBars * secondsPerBar;
  const length = Math.ceil(duration * sampleRate);

  const offline = new OfflineAudioContext(1, length, sampleRate);
  const master = offline.createGain();
  master.gain.value = 0.5;
  master.connect(offline.destination);

  const stepDuration = 60 / bpm / 4;

  for (const track of tracks) {
    if (track.muted) continue;
    for (const clip of track.clips || []) {
      const clipStartTime = clip.startBar * secondsPerBar;
      for (const event of clip.events || []) {
        const t = clipStartTime + event.step * stepDuration;
        if (t >= duration) continue;
        const freq = getFreq(event.note);
        if (freq <= 0) continue;

        const osc = offline.createOscillator();
        const gain = offline.createGain();
        osc.frequency.value = freq;
        osc.type = track.type === StemType.DRUMS ? 'sine' : track.type === StemType.BASS ? 'sawtooth' : 'triangle';
        gain.gain.value = (track.volume ?? 1) * (event.velocity ?? 0.7) * 0.3;
        osc.connect(gain);
        gain.connect(master);
        osc.start(t);
        osc.stop(t + (event.duration || 1) * stepDuration);
      }
    }
  }

  const rendered = await offline.startRendering();
  const channel = rendered.getChannelData(0);
  return writeWav(channel, sampleRate);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
