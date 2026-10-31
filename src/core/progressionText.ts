import { DEFAULT_BEATS, parseChord } from './theory/chords';
import { withBeats } from './theory/keys';

/** One token of the progression text, as the simple editor shows it. */
export interface ProgressionToken {
  label: string;
  beats: number;
  valid: boolean;
}

const split = (text: string): string[] => text.split(/[\s|,]+/).filter(Boolean);

export function progressionTokens(text: string): ProgressionToken[] {
  return split(text).map((raw) => {
    const chord = parseChord(raw);
    return chord ? { label: chord.label, beats: chord.beats, valid: true } : { label: raw, beats: DEFAULT_BEATS, valid: false };
  });
}

export const appendChord = (text: string, label: string, beats: number = DEFAULT_BEATS): string => [...split(text), withBeats(label, beats)].join(' ');

export const removeToken = (text: string, index: number): string => split(text).filter((_, i) => i !== index).join(' ');

/** Rewrites one chord's duration; invalid tokens are left untouched. */
export function setTokenBeats(text: string, index: number, beats: number): string {
  return split(text)
    .map((raw, i) => {
      if (i !== index) return raw;
      const chord = parseChord(raw);
      return chord ? withBeats(chord.label, beats) : raw;
    })
    .join(' ');
}

/** Durations offered in the simple editor, in the order a click cycles through them. */
export const BEAT_CHOICES = [4, 2, 1, 8] as const;

export function nextBeats(beats: number): number {
  const i = BEAT_CHOICES.indexOf(beats as (typeof BEAT_CHOICES)[number]);
  return BEAT_CHOICES[(i + 1) % BEAT_CHOICES.length];
}
