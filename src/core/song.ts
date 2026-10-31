import { parseProgression, type ChordSymbol } from './theory/chords';
import { voiceProgression } from './theory/voicing';

/** Editable range for any voice (C2–E5). */
export const EDIT_RANGE = { low: 36, high: 76 } as const;

export interface SongChord {
  symbol: ChordSymbol;
  startBeat: number;
  beats: number;
  /** MIDI notes, top voice first, bass last. */
  notes: readonly number[];
  /** True once the user changed any note by hand. */
  edited: boolean;
}

/** Songs are immutable: every change returns a new object, which keeps undo/redo trivial. */
export interface Song {
  chords: readonly SongChord[];
  totalBeats: number;
}

export interface BuiltSong {
  song: Song;
  invalid: string[];
}

/** Builds a song from progression text. Notes depend only on the text, never on the tempo. */
export function buildSong(text: string): BuiltSong {
  const { chords, invalid } = parseProgression(text);
  const voicings = voiceProgression(chords);
  let beat = 0;
  const songChords = chords.map((symbol, i) => {
    const chord: SongChord = { symbol, startBeat: beat, beats: symbol.beats, notes: voicings[i], edited: false };
    beat += symbol.beats;
    return chord;
  });
  return { song: { chords: songChords, totalBeats: beat }, invalid };
}

export function setNote(song: Song, chordIndex: number, voice: number, midi: number): Song {
  const target = song.chords[chordIndex];
  const clamped = Math.min(EDIT_RANGE.high, Math.max(EDIT_RANGE.low, Math.round(midi)));
  if (!target || target.notes[voice] === undefined || target.notes[voice] === clamped) return song;
  const notes = target.notes.map((n, v) => (v === voice ? clamped : n));
  const chords = song.chords.map((c, i) => (i === chordIndex ? { ...c, notes, edited: true } : c));
  return { ...song, chords };
}

export const hasEdits = (song: Song): boolean => song.chords.some((c) => c.edited);
