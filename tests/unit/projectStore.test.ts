import { describe, expect, it } from 'vitest';
import { ProjectStore } from '../../src/ui/projectStore';

describe('ProjectStore', () => {
  it('asks before regenerating over hand edits, and keeps them when declined', () => {
    const s = new ProjectStore('C G');
    s.editNote(0, 0, 70);
    expect(s.applyText('Am F')).toBe('needsConfirm');
    expect(s.getState().text).toBe('C G');
    expect(s.getState().song.chords[0].notes[0]).toBe(70);
    expect(s.applyText('Am F', true)).toBe('applied');
    expect(s.getState().song.chords[0].symbol.label).toBe('Am');
  });

  it('blank text clears the song (asking first over hand edits) and undo brings it back', () => {
    const s = new ProjectStore('C G');
    expect(s.applyText('')).toBe('applied');
    expect(s.getState().song.chords).toHaveLength(0);
    expect(s.getState().song.totalBeats).toBe(0);
    s.undo();
    expect(s.getState().song.chords).toHaveLength(2);
    s.editNote(0, 0, 70);
    expect(s.applyText('  ')).toBe('needsConfirm');
  });

  it('regenerates without asking when nothing was edited', () => {
    const s = new ProjectStore('C G');
    expect(s.applyText('Am F')).toBe('applied');
  });

  it('keeps the previous song when the new text has no chords', () => {
    const s = new ProjectStore('C G');
    expect(s.applyText('xx yy')).toBe('empty');
    expect(s.getState().empty).toBe(true);
    expect(s.getState().song.chords).toHaveLength(2);
    expect(s.applyText('C G')).toBe('unchanged');
    expect(s.getState().empty).toBe(false);
  });

  it('counts a whole drag as one undo step', () => {
    const s = new ProjectStore('C G');
    const original = s.getState().song.chords[0].notes[0];
    s.startGesture();
    s.editNote(0, 0, original + 1);
    s.editNote(0, 0, original + 2);
    s.editNote(0, 0, original + 3);
    s.endGesture();
    expect(s.getState().song.chords[0].notes[0]).toBe(original + 3);
    s.undo();
    expect(s.getState().song.chords[0].notes[0]).toBe(original);
    expect(s.getState().canUndo).toBe(false);
    s.redo();
    expect(s.getState().song.chords[0].notes[0]).toBe(original + 3);
  });

  it('undo restores the previous progression text', () => {
    const s = new ProjectStore('C G');
    s.applyText('Am F');
    s.undo();
    expect(s.getState().text).toBe('C G');
  });

  it('keeps hand edits when the tempo changes', () => {
    const s = new ProjectStore('C G');
    s.editNote(1, 2, 66);
    s.setBpm(140);
    expect(s.getState().bpm).toBe(140);
    expect(s.getState().song.chords[1].notes[2]).toBe(66);
  });

  it('clamps zoom', () => {
    const s = new ProjectStore('C');
    s.setZoom(100);
    expect(s.getState().zoom).toBe(4);
    s.setZoom(0);
    expect(s.getState().zoom).toBe(0.25);
  });
});
