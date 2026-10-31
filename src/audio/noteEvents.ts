import type { Song } from '../core/song';
import { secondsPerBeat } from '../core/timeline';

export interface NoteEvent {
  /** Seconds from the song start. */
  time: number;
  duration: number;
  midi: number;
  voice: number;
}

/** One note per voice per chord, sorted by time. Shared by live playback and (later) offline export. */
export function noteEvents(song: Song, bpm: number): NoteEvent[] {
  const spb = secondsPerBeat(bpm);
  return song.chords.flatMap((c) =>
    c.notes.map((midi, voice) => ({ time: c.startBeat * spb, duration: c.beats * spb, midi, voice })),
  );
}

/** Identity used to keep sounding notes that did not change when the song is edited mid-playback. */
export const noteKey = (e: NoteEvent): string => `${e.voice}|${e.time}|${e.midi}|${e.duration}`;
