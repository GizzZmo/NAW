
import { ProjectState, StemType, Track } from '../types';
import { TOTAL_BARS, STEM_COLORS } from '../constants';

const BASE_STATE = {
    isPlaying: false,
    currentBar: 0,
    totalBars: TOTAL_BARS,
    prompts: [],
    generationStage: 'IDLE' as const,
    generationProgress: 0,
};

const createTrack = (id: string, name: string, type: StemType, vol: number = 0.8): Track => ({
    id, name, type, volume: vol, muted: false, solo: false, clips: []
});

export const PRESETS: { id: string; name: string; description: string; state: ProjectState }[] = [
    {
        id: 'default',
        name: 'New Project (Default)',
        description: 'Clean slate. 124 BPM. Basic 4-stem setup.',
        state: {
            ...BASE_STATE,
            bpm: 124,
            tracks: [
                createTrack('t1', 'Drums', StemType.DRUMS, 0.8),
                createTrack('t2', 'Bass', StemType.BASS, 0.75),
                createTrack('t3', 'Vocals', StemType.VOCALS, 0.9),
                createTrack('t4', 'Other', StemType.OTHER, 0.7),
            ]
        }
    },
    {
        id: 'synthwave',
        name: 'Neon Nights (Synthwave)',
        description: '140 BPM. Retro-futuristic stem setup.',
        state: {
            ...BASE_STATE,
            bpm: 140,
            tracks: [
                createTrack('t1', 'LinnDrum', StemType.DRUMS, 0.9),
                createTrack('t2', 'Arp Bass', StemType.BASS, 0.8),
                createTrack('t3', 'Analog Lead', StemType.OTHER, 0.7),
                createTrack('t4', 'Pad', StemType.OTHER, 0.6),
            ]
        }
    },
    {
        id: 'lofi',
        name: 'Study Beats (Lo-Fi)',
        description: '85 BPM. Relaxed, swung setup.',
        state: {
            ...BASE_STATE,
            bpm: 85,
            tracks: [
                createTrack('t1', 'Vinyl Drums', StemType.DRUMS, 0.7),
                createTrack('t2', 'Sub Bass', StemType.BASS, 0.8),
                createTrack('t3', 'Keys', StemType.OTHER, 0.8),
                createTrack('t4', 'Ambience', StemType.OTHER, 0.5),
            ]
        }
    },
    {
        id: 'techno',
        name: 'Warehouse (Techno)',
        description: '132 BPM. Aggressive, industrial setup.',
        state: {
            ...BASE_STATE,
            bpm: 132,
            tracks: [
                createTrack('t1', '909 Kick', StemType.DRUMS, 1.0),
                createTrack('t2', 'Rumble', StemType.BASS, 0.9),
                createTrack('t3', 'Stabs', StemType.OTHER, 0.7),
                createTrack('t4', 'Hi-Hats', StemType.DRUMS, 0.8),
            ]
        }
    }
];
