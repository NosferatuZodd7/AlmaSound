import type { Song } from './song';

export const BPM_RANGE = { min: 40, max: 220, default: 90 } as const;
export const BEATS_PER_BAR = 4; // 4/4 only for now

export const clampBpm = (bpm: number): number =>
  Number.isFinite(bpm) ? Math.min(BPM_RANGE.max, Math.max(BPM_RANGE.min, Math.round(bpm))) : BPM_RANGE.default;

export const secondsPerBeat = (bpm: number): number => 60 / bpm;
export const songDuration = (song: Song, bpm: number): number => song.totalBeats * secondsPerBeat(bpm);

/** Glide length at the end of a chord: min(0.35 s, 30 % of the chord). */
export const glideSeconds = (chordSeconds: number): number => Math.min(0.35, chordSeconds * 0.3);

export const cosineEase = (x: number): number => 0.5 - 0.5 * Math.cos(Math.PI * x);

/** Index of the chord sounding at `seconds` (clamped to the first/last chord); -1 for an empty song. */
export function chordIndexAt(song: Song, bpm: number, seconds: number): number {
  const beat = seconds / secondsPerBeat(bpm);
  const cs = song.chords;
  if (cs.length === 0) return -1;
  let lo = 0;
  let hi = cs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cs[mid].startBeat <= beat) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Continuous pitch of `voice` at `seconds`: held during the chord, then a cosine glide that
 * lands exactly on the next chord's start.
 */
export function pitchAt(song: Song, bpm: number, voice: number, seconds: number): number {
  const i = chordIndexAt(song, bpm, seconds);
  const chord = song.chords[i];
  const next = song.chords[i + 1];
  if (!next) return chord.notes[voice];
  const spb = secondsPerBeat(bpm);
  const end = next.startBeat * spb;
  const glide = glideSeconds(chord.beats * spb);
  if (seconds < end - glide) return chord.notes[voice];
  return chord.notes[voice] + (next.notes[voice] - chord.notes[voice]) * cosineEase((seconds - (end - glide)) / glide);
}
