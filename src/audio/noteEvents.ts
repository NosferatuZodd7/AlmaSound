import type { Song } from '../core/song';
import { cosineEase, glideSeconds, secondsPerBeat, type Transition } from '../core/timeline';

/** A pitch glide inside a sounding note, in song seconds and MIDI. */
export interface Bend {
  start: number;
  end: number;
  from: number;
  to: number;
}

export interface NoteEvent {
  /** Seconds from the song start. */
  time: number;
  duration: number;
  /** Pitch at `time`. */
  midi: number;
  voice: number;
  /** Glides during the note (glide transition only), in time order. */
  bends: Bend[];
  /** Chord changes inside the note, re-articulated softly (glide transition only). */
  accents: number[];
}

/**
 * The notes to play, sorted by time. Shared by live playback and (later) offline export.
 * instant: one note per voice per chord. glide: one continuous note per voice for the whole song,
 * gliding to each new note exactly as the lines are drawn.
 */
export function noteEvents(song: Song, bpm: number, transition: Transition = 'glide'): NoteEvent[] {
  const spb = secondsPerBeat(bpm);
  const chords = song.chords;
  if (transition === 'instant' || chords.length === 0) {
    return chords.flatMap((c) =>
      c.notes.map((midi, voice) => ({ time: c.startBeat * spb, duration: c.beats * spb, midi, voice, bends: [], accents: [] })),
    );
  }
  return chords[0].notes.map((midi, voice) => {
    const bends: Bend[] = [];
    const accents: number[] = [];
    for (let i = 0; i + 1 < chords.length; i++) {
      const end = chords[i + 1].startBeat * spb;
      accents.push(end);
      const from = chords[i].notes[voice];
      const to = chords[i + 1].notes[voice];
      if (from !== to) bends.push({ start: end - glideSeconds(chords[i].beats * spb), end, from, to });
    }
    return { time: 0, duration: song.totalBeats * spb, midi, voice, bends, accents };
  });
}

/** Pitch of an event at song time `t` (same curve as timeline.pitchAt). */
export function pitchOfEvent(e: NoteEvent, t: number): number {
  let midi = e.midi;
  for (const b of e.bends) {
    if (t >= b.end) midi = b.to;
    else if (t > b.start) return b.from + (b.to - b.from) * cosineEase((t - b.start) / (b.end - b.start));
    else break;
  }
  return midi;
}

/** Identity used to keep sounding notes that did not change when the song is edited mid-playback. */
export const noteKey = (e: NoteEvent): string =>
  `${e.voice}|${e.time}|${e.midi}|${e.duration}|${e.bends.map((b) => `${b.start}>${b.to}`).join(',')}`;
