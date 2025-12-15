import { StemType, Track, Clip, NoteEvent } from '../types';

// Helper: Note Name to Frequency
const NOTE_TO_FREQ: { [key: string]: number } = {
  'C': 16.35, 'C#': 17.32, 'Db': 17.32, 'D': 18.35, 'D#': 19.45, 'Eb': 19.45, 'E': 20.60,
  'F': 21.83, 'F#': 23.12, 'Gb': 23.12, 'G': 24.50, 'G#': 25.96, 'Ab': 25.96, 'A': 27.50,
  'A#': 29.14, 'Bb': 29.14, 'B': 30.87
};

const getFreq = (note: string | number): number => {
  if (typeof note === 'number') return note;
  if (!note || note === 'REST') return 0;
  
  // Parse Scientific Notation e.g. "C#4"
  const match = note.match(/^([A-G][#b]?)(-?\d+)$/);
  if (!match) return 440; // Default fallback
  
  const noteName = match[1];
  const octave = parseInt(match[2], 10);
  
  const baseFreq = NOTE_TO_FREQ[noteName];
  if (!baseFreq) return 440;
  
  return baseFreq * Math.pow(2, octave);
};

class AudioEngine {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  compressor: DynamicsCompressorNode | null = null;
  
  isPlaying: boolean = false;
  bpm: number = 120;
  startTime: number = 0;
  startBar: number = 0;
  
  // Scheduler
  lookahead: number = 25.0; // ms
  scheduleAheadTime: number = 0.1; // s
  nextNoteTime: number = 0.0;
  current16thNote: number = 0;
  timerID: number | null = null;
  
  tracks: Track[] = [];

  constructor() {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
        this.ctx = new AudioContextClass();
    }
  }

  init() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    if (!this.masterGain) {
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -18;
        this.compressor.ratio.value = 12;
        this.compressor.connect(this.ctx.destination);
        
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.6;
        this.masterGain.connect(this.compressor);
    }
  }

  setTracks(tracks: Track[]) {
    this.tracks = tracks;
  }

  setBpm(bpm: number) {
    this.bpm = bpm;
  }

  getCurrentBar(): number {
      if (!this.ctx || !this.isPlaying) return this.startBar;
      const elapsedTime = this.ctx.currentTime - this.startTime;
      const secondsPerBar = (60 / this.bpm) * 4;
      return this.startBar + (elapsedTime / secondsPerBar);
  }

  start(startBar: number = 0) {
    if (!this.ctx) return;
    this.init();
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.startBar = startBar;
    this.startTime = this.ctx.currentTime;
    
    this.current16thNote = Math.floor(startBar * 16);
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    
    this.scheduler();
  }

  stop() {
    this.isPlaying = false;
    if (this.timerID) window.clearTimeout(this.timerID);
  }

  scheduler() {
    if (!this.ctx) return;
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.current16thNote, this.nextNoteTime);
      this.advanceNote();
    }
    if (this.isPlaying) {
      this.timerID = window.setTimeout(() => this.scheduler(), this.lookahead);
    }
  }

  advanceNote() {
    const secondsPerBeat = 60.0 / this.bpm;
    this.nextNoteTime += 0.25 * secondsPerBeat;
    this.current16thNote++;
  }

  scheduleNote(beatIndex: number, time: number) {
    const bar = Math.floor(beatIndex / 16);
    
    this.tracks.forEach(track => {
      if (track.muted) return;
      if (this.tracks.some(t => t.solo) && !track.solo) return;

      if (!track.clips) return;

      // Find active clip
      const activeClip = track.clips.find(c => bar >= c.startBar && bar < c.startBar + c.lengthBars);
      
      if (activeClip) {
        this.playClipEvents(track, activeClip, time, beatIndex);
      }
    });
  }

  playClipEvents(track: Track, clip: Clip, time: number, globalBeatIndex: number) {
    if (!clip.events || clip.events.length === 0) return;

    // Calculate step relative to clip start
    const clipStartStep = clip.startBar * 16;
    const stepInClip = globalBeatIndex - clipStartStep;
    
    // Looping Logic: Modulo the step by the clip length (in steps)
    const loopLengthSteps = clip.lengthBars * 16;
    const currentLoopStep = stepInClip % loopLengthSteps;

    // Find events triggering on this specific step
    const events = clip.events.filter(e => e.step === currentLoopStep);

    events.forEach(event => {
       this.triggerEvent(track, event, time);
    });
  }

  triggerEvent(track: Track, event: NoteEvent, time: number) {
     if (!this.ctx || !this.masterGain) return;
     
     const trackGain = this.ctx.createGain();
     trackGain.gain.value = track.volume * event.velocity;
     trackGain.connect(this.masterGain);
     
     if (track.type === StemType.DRUMS) {
        const type = String(event.note).toUpperCase();
        if (type === 'KICK') this.playKick(time, trackGain);
        else if (type === 'SNARE' || type === 'CLAP') this.playSnare(time, trackGain);
        else if (type === 'CHAT') this.playHiHat(time, false, trackGain); // Closed
        else if (type === 'OHAT') this.playHiHat(time, true, trackGain);  // Open
     } 
     else if (track.type === StemType.BASS) {
        const freq = getFreq(event.note);
        this.playBass(time, freq, event.duration, trackGain);
     }
     else if (track.type === StemType.VOCALS) {
        const freq = getFreq(event.note);
        this.playVocalSynth(time, freq, event.duration, trackGain);
     }
     else if (track.type === StemType.OTHER) {
        const freq = getFreq(event.note);
        this.playPad(time, freq, event.duration, trackGain);
     }
  }

  // --- Synthesis Implementation ---

  playKick(time: number, dest: AudioNode) {
     if (!this.ctx) return;
     const osc = this.ctx.createOscillator();
     const gain = this.ctx.createGain();
     osc.connect(gain);
     gain.connect(dest);
     
     osc.frequency.setValueAtTime(150, time);
     osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
     
     gain.gain.setValueAtTime(1, time);
     gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
     
     osc.start(time);
     osc.stop(time + 0.5);
  }

  playSnare(time: number, dest: AudioNode) {
     if (!this.ctx) return;
     const bufferSize = this.ctx.sampleRate * 0.2;
     const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
     const data = buffer.getChannelData(0);
     for (let i = 0; i < bufferSize; i++) {
       data[i] = (Math.random() * 2 - 1);
     }
     
     const noise = this.ctx.createBufferSource();
     noise.buffer = buffer;
     const filter = this.ctx.createBiquadFilter();
     filter.type = 'highpass';
     filter.frequency.value = 800;
     const gain = this.ctx.createGain();
     
     noise.connect(filter);
     filter.connect(gain);
     gain.connect(dest);

     gain.gain.setValueAtTime(0.7, time);
     gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
     noise.start(time);
     noise.stop(time + 0.2);
     
     // Tone
     const osc = this.ctx.createOscillator();
     osc.type = 'triangle';
     const oscGain = this.ctx.createGain();
     osc.connect(oscGain);
     oscGain.connect(dest);
     osc.frequency.setValueAtTime(180, time);
     osc.frequency.exponentialRampToValueAtTime(100, time + 0.1);
     oscGain.gain.setValueAtTime(0.5, time);
     oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
     osc.start(time);
     osc.stop(time + 0.1);
  }
  
  playHiHat(time: number, open: boolean, dest: AudioNode) {
     if (!this.ctx) return;
     const decay = open ? 0.3 : 0.05;
     const bufferSize = this.ctx.sampleRate * decay;
     const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
     const data = buffer.getChannelData(0);
     for (let i = 0; i < bufferSize; i++) {
       data[i] = (Math.random() * 2 - 1);
     }
     const noise = this.ctx.createBufferSource();
     noise.buffer = buffer;
     
     const filter = this.ctx.createBiquadFilter();
     filter.type = 'highpass';
     filter.frequency.value = 8000;
     
     const gain = this.ctx.createGain();
     
     noise.connect(filter);
     filter.connect(gain);
     gain.connect(dest);
     
     gain.gain.setValueAtTime(0.6, time);
     gain.gain.exponentialRampToValueAtTime(0.001, time + decay);
     noise.start(time);
     noise.stop(time + decay);
  }

  playBass(time: number, freq: number, durationSteps: number, dest: AudioNode) {
    if (!this.ctx) return;
    const dur = (durationSteps * 0.25 * (60/this.bpm));
    
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const gain = this.ctx.createGain();
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    
    osc.frequency.value = freq;
    
    // Acid Envelope
    filter.frequency.setValueAtTime(300, time);
    filter.frequency.exponentialRampToValueAtTime(3000, time + 0.05);
    filter.frequency.exponentialRampToValueAtTime(300, time + 0.3);
    filter.Q.value = 5;
    
    gain.gain.setValueAtTime(1, time);
    gain.gain.setTargetAtTime(0, time + dur - 0.05, 0.05);
    
    osc.start(time);
    osc.stop(time + dur);
  }

  playVocalSynth(time: number, freq: number, durationSteps: number, dest: AudioNode) {
     if (!this.ctx) return;
     const dur = (durationSteps * 0.25 * (60/this.bpm));
     const osc = this.ctx.createOscillator();
     osc.type = 'triangle';
     const filter = this.ctx.createBiquadFilter();
     filter.type = 'bandpass'; // Formant-ish
     filter.frequency.value = 1200; 
     filter.Q.value = 1;

     const gain = this.ctx.createGain();
     
     osc.connect(filter);
     filter.connect(gain);
     gain.connect(dest);
     
     osc.frequency.value = freq;
     // Vibrato
     const lfo = this.ctx.createOscillator();
     lfo.frequency.value = 5;
     const lfoGain = this.ctx.createGain();
     lfoGain.gain.value = 5;
     lfo.connect(lfoGain);
     lfoGain.connect(osc.frequency);
     lfo.start(time);
     lfo.stop(time + dur);

     gain.gain.setValueAtTime(0, time);
     gain.gain.linearRampToValueAtTime(0.4, time + 0.05);
     gain.gain.linearRampToValueAtTime(0, time + dur);
     
     osc.start(time);
     osc.stop(time + dur);
  }

  playPad(time: number, freq: number, durationSteps: number, dest: AudioNode) {
     if (!this.ctx) return;
     const dur = (durationSteps * 0.25 * (60/this.bpm));
     const osc1 = this.ctx.createOscillator();
     const osc2 = this.ctx.createOscillator();
     osc1.type = 'sine';
     osc2.type = 'triangle';
     osc2.detune.value = 15;
     
     const gain = this.ctx.createGain();
     osc1.connect(gain);
     osc2.connect(gain);
     gain.connect(dest);
     
     osc1.frequency.value = freq;
     osc2.frequency.value = freq;

     gain.gain.setValueAtTime(0, time);
     gain.gain.linearRampToValueAtTime(0.2, time + 0.2);
     gain.gain.setTargetAtTime(0, time + dur - 0.2, 0.2);
     
     osc1.start(time);
     osc1.stop(time + dur + 0.5);
     osc2.start(time);
     osc2.stop(time + dur + 0.5);
  }
}

export const audioEngine = new AudioEngine();
