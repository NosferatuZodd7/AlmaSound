import { LETTER_PC, mod12 } from './notes';

/** Intervals in semitones from the root, root first. */
export const QUALITY_INTERVALS = {
  maj: [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  mMaj7: [0, 3, 7, 11],
  m7b5: [0, 3, 6, 10],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '7sus4': [0, 5, 7, 10],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  add9: [0, 4, 7, 2],
  madd9: [0, 3, 7, 2],
  '9': [0, 4, 7, 10, 2],
  m9: [0, 3, 7, 10, 2],
  maj9: [0, 4, 7, 11, 2],
  '5': [0, 7],
} as const satisfies Record<string, readonly number[]>;

export type Quality = keyof typeof QUALITY_INTERVALS;

/** Accepted spellings (after ♯→#, ♭→b) mapped to a quality. Case matters: M7 is major, m7 minor. */
const QUALITY_ALIASES: Readonly<Record<string, Quality>> = {
  '': 'maj', M: 'maj', maj: 'maj',
  m: 'm', min: 'm', '-': 'm',
  '7': '7',
  maj7: 'maj7', M7: 'maj7', 'Δ': 'maj7', 'Δ7': 'maj7',
  m7: 'm7', min7: 'm7', '-7': 'm7',
  mMaj7: 'mMaj7', mmaj7: 'mMaj7', mM7: 'mMaj7', 'm(maj7)': 'mMaj7',
  m7b5: 'm7b5', 'm7(b5)': 'm7b5', 'ø': 'm7b5', 'ø7': 'm7b5',
  dim: 'dim', '°': 'dim', o: 'dim',
  dim7: 'dim7', '°7': 'dim7', o7: 'dim7',
  aug: 'aug', '+': 'aug',
  sus2: 'sus2',
  sus4: 'sus4', sus: 'sus4',
  '7sus4': '7sus4', '7sus': '7sus4',
  '6': '6',
  m6: 'm6',
  add9: 'add9',
  madd9: 'madd9', 'm(add9)': 'madd9',
  '9': '9',
  m9: 'm9',
  maj9: 'maj9', M9: 'maj9',
  '5': '5',
};

export interface ChordSymbol {
  /** Chord name as typed, without the ":N" duration. */
  label: string;
  root: number;
  quality: Quality;
  /** Pitch classes, root first. */
  pitchClasses: number[];
  /** Pitch class of the bass: the "/X" note, or the root. */
  bass: number;
  beats: number;
}

export const DEFAULT_BEATS = 4;

const CHORD_RE = /^([A-G])([#b]?)(.*?)(?:\/([A-G])([#b]?))?$/;
const accidental = (s: string): number => (s === '#' ? 1 : s === 'b' ? -1 : 0);

/** Parses one token such as "Bm7b5:2" or "E/G#"; returns null when it is not a chord we know. */
export function parseChord(token: string): ChordSymbol | null {
  const [label = '', beatsText, extra] = token.split(':');
  if (extra !== undefined) return null;
  let beats = DEFAULT_BEATS;
  if (beatsText !== undefined) {
    if (!/^\d+(\.\d+)?$/.test(beatsText)) return null;
    beats = Number(beatsText);
    if (!(beats > 0)) return null;
  }
  const m = CHORD_RE.exec(label.replace(/♯/g, '#').replace(/♭/g, 'b'));
  if (!m) return null;
  const quality = QUALITY_ALIASES[m[3]];
  if (quality === undefined) return null;
  const root = mod12(LETTER_PC[m[1]] + accidental(m[2]));
  return {
    label,
    root,
    quality,
    pitchClasses: QUALITY_INTERVALS[quality].map((i) => mod12(root + i)),
    bass: m[4] ? mod12(LETTER_PC[m[4]] + accidental(m[5])) : root,
    beats,
  };
}

export interface ParsedProgression {
  chords: ChordSymbol[];
  /** Tokens that were not recognised, in input order. */
  invalid: string[];
}

export function parseProgression(text: string): ParsedProgression {
  const chords: ChordSymbol[] = [];
  const invalid: string[] = [];
  for (const token of text.split(/[\s|,]+/).filter(Boolean)) {
    const chord = parseChord(token);
    if (chord) chords.push(chord);
    else invalid.push(token);
  }
  return { chords, invalid };
}

/** Splits a label into root and the rest, e.g. "Dm7" → ["D", "m7"], for the big chord title. */
export function splitLabel(label: string): [root: string, rest: string] {
  const m = /^([A-G][#b♯♭]?)(.*)$/.exec(label);
  return m ? [m[1].replace('#', '♯').replace('b', '♭'), m[2]] : [label, ''];
}
