import type { Song } from '../core/song';
import { secondsPerBeat, songDuration, type Transition } from '../core/timeline';
import { noteEvents, noteKey, pitchOfEvent, type NoteEvent } from './noteEvents';
import { playSynthPiano, type SoundingNote } from './instruments/synthPiano';

const LOOKAHEAD = 0.15; // seconds scheduled ahead of the audio clock
const TICK_MS = 25;
const START_DELAY = 0.05;
const PREVIEW_SECONDS = 0.5;
const CURVE_POINTS = 32; // samples per pitch glide (the cosine shape survives a mid-glide start)

/**
 * Transport with a lookahead scheduler: a timer places notes on the audio clock slightly ahead
 * of time, so timing never depends on the UI thread. The visuals read `position()`, which is
 * derived from the same clock (minus output latency), so sound and lines stay together.
 */
export class AudioEngine {
  private _ctx: AudioContext | null = null;
  private _master: GainNode | null = null;
  private _song: Song;
  private _bpm: number;
  private _transition: Transition;
  private _events: NoteEvent[];
  private _cursor = 0;
  private _playing = false;
  /** Audio-clock time at which song time 0 is scheduled. */
  private _origin = 0;
  private _pausedAt = 0;
  private _sounding = new Map<string, SoundingNote>();
  private _timer: ReturnType<typeof setInterval> | null = null;
  private _listeners = new Set<() => void>();

  constructor(song: Song, bpm: number, transition: Transition = 'glide') {
    this._song = song;
    this._bpm = bpm;
    this._transition = transition;
    this._events = noteEvents(song, bpm, transition);
  }

  get playing(): boolean {
    return this._playing;
  }

  get duration(): number {
    return songDuration(this._song, this._bpm);
  }

  /** Song time the listener hears right now, in seconds. */
  position(): number {
    if (!this._playing || !this._ctx) return this._pausedAt;
    return Math.max(0, this._ctx.currentTime - (this._ctx.outputLatency || 0) - this._origin);
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  };

  play(): void {
    if (this._playing) return;
    const ctx = this._ensureContext();
    void ctx.resume();
    if (this._pausedAt >= this.duration) this._pausedAt = 0;
    this._startAt(this._pausedAt);
    this._playing = true;
    this._timer = setInterval(() => this._tick(), TICK_MS);
    this._emit();
  }

  pause(): void {
    if (!this._playing) return;
    this._pausedAt = Math.min(this.position(), this.duration);
    this._stopAll();
    this._halt();
  }

  toggle(): void {
    if (this._playing) this.pause();
    else this.play();
  }

  seek(seconds: number): void {
    const t = Math.min(this.duration, Math.max(0, seconds));
    if (!this._playing) {
      this._pausedAt = t;
      this._emit();
      return;
    }
    this._stopAll();
    this._startAt(t);
  }

  /** Swaps in an edited song. While playing, unchanged notes keep sounding; changed ones are replaced. */
  setSong(song: Song, bpm: number, transition: Transition = this._transition): void {
    const tempoChanged = bpm !== this._bpm;
    const restart = tempoChanged || transition !== this._transition;
    const beatNow = (this._playing ? this._songClock() : this._pausedAt) / secondsPerBeat(this._bpm);
    this._song = song;
    this._bpm = bpm;
    this._transition = transition;
    this._events = noteEvents(song, bpm, transition);
    const atSameBeat = Math.min(this.duration, beatNow * secondsPerBeat(bpm));
    if (!this._playing) {
      this._pausedAt = tempoChanged ? atSameBeat : Math.min(this._pausedAt, this.duration);
      this._emit();
      return;
    }
    if (restart) {
      this._stopAll();
      this._startAt(atSameBeat);
      return;
    }
    const ctx = this._ctx!;
    const keys = new Set(this._events.map(noteKey));
    for (const [key, note] of this._sounding) {
      if (!keys.has(key)) {
        note.stop(ctx.currentTime);
        this._sounding.delete(key);
      }
    }
    const now = this._songClock();
    for (const e of this._events) if (e.time <= now && now < e.time + e.duration) this._schedule(e, now);
    this._cursor = this._firstAfter(now);
    this._tick();
  }

  /** Plays notes once, now (chord click, or one voice while dragging). */
  preview(notes: readonly number[], onlyVoice?: number): void {
    const ctx = this._ensureContext();
    void ctx.resume();
    const when = ctx.currentTime + 0.01;
    notes.forEach((midi, voice) => {
      if (onlyVoice === undefined || onlyVoice === voice) playSynthPiano(ctx, this._master!, midi, voice, when, PREVIEW_SECONDS);
    });
  }

  dispose(): void {
    this._halt();
    void this._ctx?.close();
    this._ctx = null;
  }

  private _ensureContext(): AudioContext {
    if (!this._ctx) {
      this._ctx = new AudioContext({ latencyHint: 'interactive' });
      this._master = this._ctx.createGain();
      this._master.gain.value = 0.9;
      this._master.connect(this._ctx.destination);
    }
    return this._ctx;
  }

  /** Song time on the scheduling clock (ahead of what is heard by the output latency). */
  private _songClock(): number {
    return this._ctx!.currentTime - this._origin;
  }

  private _startAt(songTime: number): void {
    const ctx = this._ctx!;
    this._origin = ctx.currentTime + START_DELAY - songTime;
    for (const e of this._events) if (e.time < songTime && songTime < e.time + e.duration) this._schedule(e, songTime);
    this._cursor = this._firstAfter(songTime - 1e-9);
    this._tick();
  }

  private _firstAfter(songTime: number): number {
    const i = this._events.findIndex((e) => e.time > songTime);
    return i === -1 ? this._events.length : i;
  }

  private _schedule(e: NoteEvent, fromSongTime: number): void {
    const key = noteKey(e);
    if (this._sounding.has(key)) return;
    const start = Math.max(e.time, fromSongTime);
    const o = this._origin;
    const pitchCurves = e.bends
      .filter((b) => b.end > start)
      .map((b) => {
        const s = Math.max(b.start, start);
        const midi = Array.from({ length: CURVE_POINTS }, (_, k) => pitchOfEvent(e, s + ((b.end - s) * k) / (CURVE_POINTS - 1)));
        return { when: o + s, duration: b.end - s, midi };
      });
    const accents = e.accents.filter((a) => a > start).map((a) => o + a);
    const note = playSynthPiano(this._ctx!, this._master!, pitchOfEvent(e, start), e.voice, o + start, e.time + e.duration - start, { pitchCurves, accents });
    this._sounding.set(key, note);
  }

  private _tick(): void {
    const ctx = this._ctx;
    if (!ctx) return;
    const horizon = this._songClock() + LOOKAHEAD;
    while (this._cursor < this._events.length && this._events[this._cursor].time < horizon) {
      this._schedule(this._events[this._cursor], this._events[this._cursor].time);
      this._cursor++;
    }
    for (const [key, note] of this._sounding) if (note.end < ctx.currentTime) this._sounding.delete(key);
    if (this._cursor >= this._events.length && this.position() >= this.duration) {
      this._pausedAt = this.duration; // the last notes ring out on their own
      this._halt();
    }
  }

  private _stopAll(): void {
    const now = this._ctx?.currentTime ?? 0;
    for (const note of this._sounding.values()) note.stop(now);
    this._sounding.clear();
  }

  private _halt(): void {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    this._playing = false;
    this._emit();
  }

  private _emit(): void {
    for (const l of this._listeners) l();
  }
}
