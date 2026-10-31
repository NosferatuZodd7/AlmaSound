import { describe, expect, it } from 'vitest';
import { noteEvents, pitchOfEvent } from '../../src/audio/noteEvents';
import { buildSong } from '../../src/core/song';
import { pitchAt } from '../../src/core/timeline';

const { song } = buildSong('Am Dm7 G7:2 Cmaj7');
const BPM = 120; // 2 s per 4-beat chord

describe('noteEvents', () => {
  it('instant: one note per voice per chord, no glides', () => {
    const events = noteEvents(song, BPM, 'instant');
    expect(events).toHaveLength(4 * 5);
    expect(events.every((e) => e.bends.length === 0 && e.accents.length === 0)).toBe(true);
    expect(events.filter((e) => e.voice === 0).map((e) => e.time)).toEqual([0, 2, 4, 5]);
  });

  it('glide: one continuous note per voice spanning the song, accented at each chord change', () => {
    const events = noteEvents(song, BPM, 'glide');
    expect(events).toHaveLength(5);
    for (const e of events) {
      expect(e.time).toBe(0);
      expect(e.duration).toBe(7);
      expect(e.accents).toEqual([2, 4, 5]);
    }
  });

  it('glide: the sound follows exactly the curve the lines draw', () => {
    for (const e of noteEvents(song, BPM, 'glide')) {
      for (let t = 0; t <= 7; t += 0.01) expect(pitchOfEvent(e, t)).toBeCloseTo(pitchAt(song, BPM, e.voice, t, 'glide'), 9);
    }
  });

  it('glides end exactly on the next chord start', () => {
    const bass = noteEvents(song, BPM, 'glide')[4];
    for (const b of bass.bends) expect([2, 4, 5]).toContain(b.end);
  });
});

describe('instant transition', () => {
  it('jumps at the chord start instead of gliding', () => {
    const [a, b] = song.chords;
    expect(pitchAt(song, BPM, 0, 1.99, 'instant')).toBe(a.notes[0]);
    expect(pitchAt(song, BPM, 0, 2, 'instant')).toBe(b.notes[0]);
  });
});
