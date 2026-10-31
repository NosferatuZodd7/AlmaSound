import { EDIT_RANGE, type Song } from '../../core/song';
import { chordIndexAt, cosineEase, glideSeconds, pitchAt, secondsPerBeat, type Transition } from '../../core/timeline';
import { noteName } from '../../core/theory/notes';
import { timeOfX, xOfTime, yOfMidi, type StageGeometry } from './geometry';

export const VOICE_COUNT = 5;

/** Stage colours, read from the CSS design tokens so the canvas follows the light/dark theme. */
export interface StageTheme {
  voices: string[];
  grid: string;
  gridC: string;
  band: string;
  label: string;
  chordLine: string;
  chip: string;
  chipRim: string;
  chipText: string;
  edited: string;
  lens: string;
  lensRim: string;
  font: string;
}

export function readStageTheme(el: Element = document.documentElement): StageTheme {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    voices: Array.from({ length: VOICE_COUNT }, (_, i) => v(`--voice-${i + 1}`)),
    grid: v('--stage-grid'),
    gridC: v('--stage-grid-c'),
    band: v('--stage-band'),
    label: v('--text-2'),
    chordLine: v('--stage-chord-line'),
    chip: v('--stage-chip'),
    chipRim: v('--stage-chip-rim'),
    chipText: v('--text'),
    edited: v('--edited'),
    lens: v('--stage-lens'),
    lensRim: v('--stage-lens-rim'),
    font: v('--font'),
  };
}

export interface DragView {
  chordIndex: number;
  voice: number;
  x: number;
}

/**
 * Draws one frame: octave bands, chord chips, voice lines (solid behind the playhead, dotted
 * ahead of it), the glass playhead lens with one orb per voice, and the note names.
 */
export function drawStage(
  c: CanvasRenderingContext2D,
  g: StageGeometry,
  theme: StageTheme,
  song: Song,
  bpm: number,
  transition: Transition,
  now: number,
  drag: DragView | null,
): void {
  c.clearRect(0, 0, g.width, g.height);
  drawGrid(c, g, theme);
  if (song.chords.length === 0) return;

  const spb = secondsPerBeat(bpm);
  const total = song.totalBeats * spb;
  const first = chordIndexAt(song, bpm, timeOfX(g, 0, now));
  const last = chordIndexAt(song, bpm, timeOfX(g, g.width, now));

  // Chord changes: hairline plus a glass chip with the name
  c.lineWidth = 1;
  c.font = `600 12px ${theme.font}`;
  for (let i = first; i <= last; i++) {
    const ch = song.chords[i];
    const x = Math.round(xOfTime(g, ch.startBeat * spb, now)) + 0.5;
    c.strokeStyle = theme.chordLine;
    line(c, x, g.top - 12, x, g.bottom);
    const text = ch.symbol.label;
    const w = c.measureText(text).width + (ch.edited ? 30 : 20);
    pill(c, theme, x, g.top - 40, w, 24);
    c.fillStyle = ch.edited ? theme.edited : theme.chipText;
    c.textBaseline = 'middle';
    c.fillText(text, x + 10, g.top - 28);
    if (ch.edited) dot(c, x + w - 10, g.top - 28, 3, theme.edited);
  }

  // Voice lines, bass first so the top voice sits on top
  for (let v = VOICE_COUNT - 1; v >= 0; v--) {
    const path = voicePath(g, song, spb, transition, now, v, first, last);
    const color = theme.voices[v];
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = color;

    c.save();
    clip(c, 0, g.playX);
    c.globalAlpha = 0.16;
    c.lineWidth = 10;
    c.stroke(path);
    c.globalAlpha = 1;
    c.lineWidth = 3;
    c.stroke(path);
    c.restore();

    c.save();
    clip(c, g.playX, g.width);
    if (drag?.voice === v) {
      c.lineWidth = 3;
    } else {
      c.globalAlpha = 0.55;
      c.lineWidth = 2.5;
      c.setLineDash([0.1, 7]); // dotted "ghost" of what is coming
    }
    c.stroke(path);
    c.restore();
  }

  drawLens(c, g, theme);

  // Orbs and note names at the playhead
  const tNow = Math.min(total, Math.max(0, now));
  const current = song.chords[chordIndexAt(song, bpm, tNow)];
  c.font = `600 11px ${theme.font}`;
  c.textBaseline = 'middle';
  let lastY = -99;
  let flip = false;
  for (let v = 0; v < VOICE_COUNT; v++) {
    const y = yOfMidi(g, pitchAt(song, bpm, v, tNow, transition));
    orb(c, g.playX, y, theme.voices[v]);
    flip = Math.abs(y - lastY) < 20 ? !flip : false;
    lastY = y;
    noteTag(c, theme, noteName(current.notes[v]), g.playX + (flip ? 64 : 16), y, theme.voices[v]);
  }

  if (drag) {
    const ch = song.chords[drag.chordIndex];
    c.font = `700 13px ${theme.font}`;
    noteTag(c, theme, noteName(ch.notes[drag.voice]), drag.x + 16, yOfMidi(g, ch.notes[drag.voice]) - 18, theme.voices[drag.voice]);
  }
  c.textBaseline = 'alphabetic';
}

/** Same shape as timeline.pitchAt: held note, then a cosine glide (or a step) onto the next chord. */
function voicePath(g: StageGeometry, song: Song, spb: number, transition: Transition, now: number, v: number, first: number, last: number): Path2D {
  const p = new Path2D();
  for (let i = first; i <= last; i++) {
    const ch = song.chords[i];
    const next = song.chords[i + 1];
    const xs = xOfTime(g, ch.startBeat * spb, now);
    const xe = xOfTime(g, (ch.startBeat + ch.beats) * spb, now);
    const y = yOfMidi(g, ch.notes[v]);
    if (i === first) p.moveTo(xs, y);
    else p.lineTo(xs, y);
    if (!next || transition === 'instant') {
      p.lineTo(xe, y); // the next chord's moveTo/lineTo draws the vertical step
      continue;
    }
    const xg = xe - glideSeconds(ch.beats * spb) * g.pps;
    p.lineTo(xg, y);
    const yn = yOfMidi(g, next.notes[v]);
    if (yn === y) continue;
    const steps = Math.max(6, Math.ceil((xe - xg) / 3));
    for (let s = 1; s <= steps; s++) p.lineTo(xg + ((xe - xg) * s) / steps, y + (yn - y) * cosineEase(s / steps));
  }
  return p;
}

/** Soft alternating octave bands, hairlines per semitone, stronger on each C. */
function drawGrid(c: CanvasRenderingContext2D, g: StageGeometry, theme: StageTheme): void {
  for (let m = EDIT_RANGE.low; m < EDIT_RANGE.high; m += 12) {
    if (((m - EDIT_RANGE.low) / 12) % 2 === 0) continue;
    const y0 = yOfMidi(g, Math.min(m + 12, EDIT_RANGE.high));
    c.fillStyle = theme.band;
    c.fillRect(0, y0, g.width, yOfMidi(g, m) - y0);
  }
  c.lineWidth = 1;
  c.font = `600 10px ${theme.font}`;
  c.textBaseline = 'alphabetic';
  for (let m = EDIT_RANGE.low; m <= EDIT_RANGE.high; m++) {
    const y = Math.round(yOfMidi(g, m)) + 0.5;
    const isC = m % 12 === 0;
    c.strokeStyle = isC ? theme.gridC : theme.grid;
    line(c, 0, y, g.width, y);
    if (isC) {
      c.fillStyle = theme.label;
      c.fillText(noteName(m), 12, y - 4);
    }
  }
}

/** The playhead as a vertical glass capsule with a bright rim. */
function drawLens(c: CanvasRenderingContext2D, g: StageGeometry, theme: StageTheme): void {
  const w = 16;
  const x = g.playX - w / 2;
  const y = g.top - 12;
  const h = g.bottom - y + 12;
  c.beginPath();
  c.roundRect(x, y, w, h, w / 2);
  c.fillStyle = theme.lens;
  c.fill();
  const rim = c.createLinearGradient(0, y, 0, y + h);
  rim.addColorStop(0, theme.lensRim);
  rim.addColorStop(0.5, 'transparent');
  rim.addColorStop(1, theme.lensRim);
  c.strokeStyle = rim;
  c.lineWidth = 1;
  c.stroke();
}

function orb(c: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  c.save();
  c.shadowColor = color;
  c.shadowBlur = 14;
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, 6, 0, Math.PI * 2);
  c.fill();
  c.restore();
  // Specular highlight
  const hl = c.createRadialGradient(x - 2, y - 2.5, 0, x - 2, y - 2.5, 4);
  hl.addColorStop(0, 'rgba(255,255,255,.95)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = hl;
  c.beginPath();
  c.arc(x, y, 6, 0, Math.PI * 2);
  c.fill();
}

/** A small glass pill with a colour dot and the note name. */
function noteTag(c: CanvasRenderingContext2D, theme: StageTheme, text: string, x: number, y: number, color: string): void {
  const w = c.measureText(text).width + 24;
  pill(c, theme, x, y - 10, w, 20);
  dot(c, x + 9, y, 3, color);
  c.fillStyle = theme.chipText;
  c.fillText(text, x + 16, y);
}

function pill(c: CanvasRenderingContext2D, theme: StageTheme, x: number, y: number, w: number, h: number): void {
  c.beginPath();
  c.roundRect(x, y, w, h, h / 2);
  c.fillStyle = theme.chip;
  c.fill();
  c.strokeStyle = theme.chipRim;
  c.lineWidth = 1;
  c.stroke();
}

function dot(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}

function clip(c: CanvasRenderingContext2D, x0: number, x1: number): void {
  c.beginPath();
  c.rect(x0, 0, x1 - x0, 1e5);
  c.clip();
}

function line(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.stroke();
}
