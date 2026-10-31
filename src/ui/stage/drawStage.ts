import { EDIT_RANGE, type Song } from '../../core/song';
import { chordIndexAt, cosineEase, glideSeconds, pitchAt, secondsPerBeat } from '../../core/timeline';
import { splitLabel } from '../../core/theory/chords';
import { noteName } from '../../core/theory/notes';
import { timeOfX, xOfTime, yOfMidi, type StageGeometry } from './geometry';

/** Voice colours, top voice first: white, cyan, lilac, pink, yellow (bass). */
export const VOICE_COLORS = ['#f4f7ff', '#7fe3ff', '#c9a8ff', '#ff8fd0', '#ffe066'] as const;
const EDITED_COLOR = VOICE_COLORS[4];
const FONT = '"Segoe UI", system-ui, sans-serif';

export interface DragView {
  chordIndex: number;
  voice: number;
  x: number;
}

export function drawStage(c: CanvasRenderingContext2D, g: StageGeometry, song: Song, bpm: number, now: number, drag: DragView | null): void {
  c.clearRect(0, 0, g.width, g.height);
  drawGrid(c, g);
  if (song.chords.length === 0) return;

  const spb = secondsPerBeat(bpm);
  const total = song.totalBeats * spb;
  const first = chordIndexAt(song, bpm, timeOfX(g, 0, now));
  const last = chordIndexAt(song, bpm, timeOfX(g, g.width, now));

  // Chord changes and names
  c.font = `600 12px ${FONT}`;
  c.textAlign = 'left';
  c.lineWidth = 1;
  for (let i = first; i <= last; i++) {
    const ch = song.chords[i];
    const x = Math.round(xOfTime(g, ch.startBeat * spb, now)) + 0.5;
    c.strokeStyle = 'rgba(170,195,255,.25)';
    line(c, x, g.top - 26, x, g.bottom);
    c.fillStyle = ch.edited ? EDITED_COLOR : 'rgba(210,225,255,.75)';
    c.fillText(ch.symbol.label + (ch.edited ? ' *' : ''), x + 5, g.top - 30);
  }
  c.strokeStyle = 'rgba(230,240,255,.6)';
  line(c, g.playX, g.top - 26, g.playX, g.bottom);

  // Voice lines: bright with glow in the past, thin and faint in the future
  for (let v = VOICE_COLORS.length - 1; v >= 0; v--) {
    const path = voicePath(g, song, spb, now, v, first, last);
    const hot = drag?.voice === v;
    c.save();
    c.beginPath();
    c.rect(0, 0, g.playX, g.height);
    c.clip();
    c.strokeStyle = VOICE_COLORS[v];
    c.globalAlpha = 0.18;
    c.lineWidth = 8;
    c.stroke(path);
    c.globalAlpha = 1;
    c.lineWidth = 2.5;
    c.stroke(path);
    c.restore();

    c.save();
    c.beginPath();
    c.rect(g.playX, 0, g.width - g.playX, g.height);
    c.clip();
    c.strokeStyle = VOICE_COLORS[v];
    c.globalAlpha = hot ? 1 : 0.35;
    c.lineWidth = hot ? 2.5 : 1.5;
    c.stroke(path);
    c.restore();
  }

  // Dots and note names at the playhead
  const tNow = Math.min(total, Math.max(0, now));
  const current = song.chords[chordIndexAt(song, bpm, tNow)];
  c.font = `600 12px ${FONT}`;
  let lastY = -99;
  let flip = false;
  for (let v = 0; v < VOICE_COLORS.length; v++) {
    const y = yOfMidi(g, pitchAt(song, bpm, v, tNow));
    c.fillStyle = VOICE_COLORS[v];
    c.shadowColor = VOICE_COLORS[v];
    c.shadowBlur = 14;
    c.beginPath();
    c.arc(g.playX, y, 4.5, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
    flip = Math.abs(y - lastY) < 14 ? !flip : false;
    lastY = y;
    c.fillText(noteName(current.notes[v]), g.playX + (flip ? 44 : 12), y + 4);
  }

  drawTitle(c, g, current.symbol.label, current.edited);

  if (drag) {
    const ch = song.chords[drag.chordIndex];
    c.fillStyle = VOICE_COLORS[drag.voice];
    c.font = `800 15px ${FONT}`;
    c.fillText(noteName(ch.notes[drag.voice]), drag.x + 14, yOfMidi(g, ch.notes[drag.voice]) - 10);
  }
}

/** Same shape as timeline.pitchAt: held note, then a cosine glide that lands on the next chord. */
function voicePath(g: StageGeometry, song: Song, spb: number, now: number, v: number, first: number, last: number): Path2D {
  const p = new Path2D();
  for (let i = first; i <= last; i++) {
    const ch = song.chords[i];
    const next = song.chords[i + 1];
    const xs = xOfTime(g, ch.startBeat * spb, now);
    const xe = xOfTime(g, (ch.startBeat + ch.beats) * spb, now);
    const y = yOfMidi(g, ch.notes[v]);
    if (i === first) p.moveTo(xs, y);
    else p.lineTo(xs, y);
    if (!next) {
      p.lineTo(xe, y);
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

function drawGrid(c: CanvasRenderingContext2D, g: StageGeometry): void {
  c.lineWidth = 1;
  c.font = `600 10px ${FONT}`;
  c.textAlign = 'left';
  for (let m = EDIT_RANGE.low; m <= EDIT_RANGE.high; m++) {
    const y = Math.round(yOfMidi(g, m)) + 0.5;
    const isC = m % 12 === 0;
    c.strokeStyle = isC ? 'rgba(160,190,255,.22)' : 'rgba(140,170,255,.07)';
    line(c, 0, y, g.width, y);
    if (isC) {
      c.fillStyle = 'rgba(180,200,255,.5)';
      c.fillText(noteName(m), 6, y - 3);
    }
  }
}

/** Big root plus smaller quality, centred at the top, e.g. "D" + "m7". */
function drawTitle(c: CanvasRenderingContext2D, g: StageGeometry, label: string, edited: boolean): void {
  const [root, rest] = splitLabel(label);
  const sub = rest + (edited ? ' *' : '');
  const big = Math.min(72, g.width / 7);
  const bigFont = `800 ${big}px ${FONT}`;
  const smallFont = `600 ${big * 0.5}px ${FONT}`;
  c.font = bigFont;
  const w1 = c.measureText(root).width;
  c.font = smallFont;
  const w2 = c.measureText(sub).width;
  const x = g.width / 2 - (w1 + w2) / 2;
  const y = Math.min(g.top - 50, 20 + big);
  c.fillStyle = '#fff';
  c.textAlign = 'left';
  c.font = bigFont;
  c.fillText(root, x, y);
  c.font = smallFont;
  c.fillText(sub, x + w1 + 2, y);
}

function line(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.stroke();
}
