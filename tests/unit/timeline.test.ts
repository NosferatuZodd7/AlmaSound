import { describe, expect, it } from 'vitest';
import { buildSong, hasEdits, setNote } from '../../src/core/song';
import { History } from '../../src/core/history';
import { chordIndexAt, clampBpm, glideSeconds, pitchAt, songDuration } from '../../src/core/timeline';

describe('timing', () => {
  const { song } = buildSong('Am Dm7 G7 Cmaj7 Bm7b5:2 E7:2 A:8');

  it('lays chords end to end in beats', () => {
    expect(song.chords.map((c) => c.startBeat)).toEqual([0, 4, 8, 12, 16, 18, 20]);
    expect(song.totalBeats).toBe(28);
  });

  it('converts beats to seconds from the BPM', () => {
    expect(songDuration(song, 120)).toBe(14);
    expect(songDuration(song, 60)).toBe(28);
  });

  it('clamps BPM to 40–220', () => {
    expect(clampBpm(10)).toBe(40);
    expect(clampBpm(500)).toBe(220);
    expect(clampBpm(Number.NaN)).toBe(90);
  });

  it('finds the chord at a time', () => {
    expect(chordIndexAt(song, 120, 0)).toBe(0);
    expect(chordIndexAt(song, 120, 1.99)).toBe(0);
    expect(chordIndexAt(song, 120, 2)).toBe(1);
    expect(chordIndexAt(song, 120, 9.5)).toBe(5);
    expect(chordIndexAt(song, 120, 99)).toBe(6);
    expect(chordIndexAt(song, 120, -1)).toBe(0);
  });

  it('glides in the last min(0.35 s, 30 %) and lands on the next chord', () => {
    expect(glideSeconds(2)).toBe(0.35);
    expect(glideSeconds(0.5)).toBeCloseTo(0.15);
    const [a, b] = song.chords;
    const v = 0;
    expect(pitchAt(song, 120, v, 0)).toBe(a.notes[v]);
    expect(pitchAt(song, 120, v, 2 - 0.36)).toBe(a.notes[v]);
    expect(pitchAt(song, 120, v, 2 - 0.175)).toBeCloseTo((a.notes[v] + b.notes[v]) / 2);
    expect(pitchAt(song, 120, v, 2)).toBe(b.notes[v]);
  });
});

describe('editing and history', () => {
  it('edits one note, marks the chord and never mutates', () => {
    const { song } = buildSong('C G');
    const edited = setNote(song, 1, 0, song.chords[1].notes[0] + 1);
    expect(edited.chords[1].edited).toBe(true);
    expect(edited.chords[0]).toBe(song.chords[0]);
    expect(hasEdits(song)).toBe(false);
    expect(hasEdits(edited)).toBe(true);
    expect(setNote(song, 0, 0, song.chords[0].notes[0])).toBe(song);
    expect(setNote(song, 0, 0, 999).chords[0].notes[0]).toBe(76);
  });

  it('undoes and redoes', () => {
    const h = new History(1);
    h.push(2);
    h.push(3);
    expect(h.undo()).toBe(2);
    expect(h.undo()).toBe(1);
    expect(h.canUndo).toBe(false);
    expect(h.redo()).toBe(2);
    h.push(9);
    expect(h.canRedo).toBe(false);
  });
});
