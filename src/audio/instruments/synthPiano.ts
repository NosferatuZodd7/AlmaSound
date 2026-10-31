import { midiToFrequency } from '../../core/theory/notes';

export interface SoundingNote {
  /** Fades the note out quickly from `when` (no click). */
  stop(when: number): void;
  /** Context time after which the note is silent and its nodes are released. */
  readonly end: number;
}

/** Shape of a note that changes while it sounds (glide transition), in context time. */
export interface NoteShape {
  /** Pitch curves (MIDI values sampled evenly over [when, when + duration]). */
  pitchCurves: { when: number; duration: number; midi: number[] }[];
  /** Soft re-articulations, e.g. at each chord change. */
  accents: number[];
}

const ATTACK = 0.02;
const RELEASE = 0.5;
const BASS_VOICE = 4;

/**
 * Placeholder synthesized piano (Phase 1). Phase 2 replaces it with sampled instruments.
 * Works on any BaseAudioContext, so OfflineAudioContext export renders the same sound.
 */
export function playSynthPiano(
  ctx: BaseAudioContext,
  dest: AudioNode,
  midi: number,
  voice: number,
  when: number,
  duration: number,
  shape?: NoteShape,
): SoundingNote {
  const peak = voice === BASS_VOICE ? 0.12 : 0.07;
  const freq = midiToFrequency(midi);
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2400;
  filter.connect(gain).connect(dest);

  const g = gain.gain;
  const hold = Math.max(duration, ATTACK);
  g.setValueAtTime(0, when);
  g.linearRampToValueAtTime(peak, when + ATTACK);
  g.setTargetAtTime(peak * 0.4, when + ATTACK, 0.5);
  for (const a of shape?.accents ?? []) {
    g.setTargetAtTime(peak * 0.8, a, 0.01);
    g.setTargetAtTime(peak * 0.4, a + 0.04, 0.5);
  }
  g.setTargetAtTime(0, when + hold, RELEASE / 3);
  let end = when + hold + RELEASE + 0.2;

  const oscs = (
    [
      ['triangle', -4],
      ['sine', 5],
    ] as const
  ).map(([type, detune]) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    for (const c of shape?.pitchCurves ?? []) {
      o.frequency.setValueCurveAtTime(Float32Array.from(c.midi, midiToFrequency), c.when, c.duration);
    }
    o.connect(filter);
    o.start(when);
    o.stop(end);
    return o;
  });
  oscs[0].onended = () => gain.disconnect();

  return {
    get end() {
      return end;
    },
    stop(at: number) {
      if (at >= end) return;
      g.cancelScheduledValues(at);
      if (at <= when) g.setValueAtTime(0, at);
      else g.setTargetAtTime(0, at, 0.015);
      end = Math.max(at, when) + 0.1;
      for (const o of oscs) o.stop(end);
    },
  };
}
