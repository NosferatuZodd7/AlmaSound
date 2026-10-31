import { EDIT_RANGE, type Song } from '../../core/song';
import { chordIndexAt, secondsPerBeat } from '../../core/timeline';

export interface StageGeometry {
  width: number;
  height: number;
  /** Pixels per second. */
  pps: number;
  /** Fixed x of the playhead. */
  playX: number;
  top: number;
  bottom: number;
}

export function stageGeometry(width: number, height: number, zoom: number): StageGeometry {
  return {
    width,
    height,
    pps: Math.max(80, width / 8) * zoom,
    playX: width * (width < 600 ? 0.3 : 0.38),
    top: Math.max(140, height * 0.26),
    bottom: height - 40,
  };
}

const SPAN = EDIT_RANGE.high - EDIT_RANGE.low;
export const yOfMidi = (g: StageGeometry, midi: number): number => g.bottom - ((midi - EDIT_RANGE.low) / SPAN) * (g.bottom - g.top);
export const midiOfY = (g: StageGeometry, y: number): number => EDIT_RANGE.low + ((g.bottom - y) / (g.bottom - g.top)) * SPAN;
export const xOfTime = (g: StageGeometry, t: number, now: number): number => g.playX + (t - now) * g.pps;
export const timeOfX = (g: StageGeometry, x: number, now: number): number => now + (x - g.playX) / g.pps;

const GRAB_PX = 14;

export interface Hit {
  chordIndex: number;
  /** Voice whose held note is under the pointer, or null for the background. */
  voice: number | null;
}

/** What is under (x, y): a chord (by time) and possibly one of its voice lines. */
export function hitTest(g: StageGeometry, song: Song, bpm: number, now: number, x: number, y: number): Hit | null {
  const t = timeOfX(g, x, now);
  if (song.chords.length === 0 || t < 0 || t > song.totalBeats * secondsPerBeat(bpm)) return null;
  const chordIndex = chordIndexAt(song, bpm, t);
  let voice: number | null = null;
  if (y >= g.top - 10) {
    let best = GRAB_PX;
    song.chords[chordIndex].notes.forEach((m, v) => {
      const d = Math.abs(yOfMidi(g, m) - y);
      if (d < best) {
        best = d;
        voice = v;
      }
    });
  }
  return { chordIndex, voice };
}
