import { History } from '../core/history';
import { buildSong, hasEdits, setNote, type Song } from '../core/song';
import { BPM_RANGE, clampBpm } from '../core/timeline';

export const DEFAULT_PROGRESSION =
  'Am Dm7 G7 Cmaj7 Fmaj7 Bm7b5:2 E7sus4:1 E7:1 Am Am/G Fmaj7 E/G# Am C/G F Dm Esus4:2 E:2 Am F C G Am Dm/F E7sus4:2 E7:2 A:8';

export const ZOOM = { min: 0.25, max: 4, step: 1.25 } as const;

/** What undo/redo restores: the text, its voices (with hand edits) and its parse problems. */
interface Snapshot {
  text: string;
  song: Song;
  invalid: string[];
}

export interface ProjectState extends Snapshot {
  /** The last text tried had no valid chord (the previous song is kept). */
  empty: boolean;
  /** Tokens to report: from the last text tried. */
  problems: string[];
  bpm: number;
  zoom: number;
  canUndo: boolean;
  canRedo: boolean;
}

export type ApplyResult = 'unchanged' | 'applied' | 'empty' | 'needsConfirm';

export class ProjectStore {
  private readonly _history: History<Snapshot>;
  private _state: ProjectState;
  private _listeners = new Set<() => void>();
  private _inGesture = false;
  private _gestureStepTaken = false;

  constructor(text: string = DEFAULT_PROGRESSION, bpm: number = BPM_RANGE.default) {
    const built = buildSong(text);
    const snapshot: Snapshot = { text, song: built.song, invalid: built.invalid };
    this._history = new History(snapshot);
    this._state = { ...snapshot, empty: false, problems: built.invalid, bpm: clampBpm(bpm), zoom: 1, canUndo: false, canRedo: false };
  }

  readonly getState = (): ProjectState => this._state;

  readonly subscribe = (listener: () => void): (() => void) => {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  };

  /**
   * Regenerates the voices from new text. Hand edits are only discarded with `discardEdits`;
   * otherwise the caller gets 'needsConfirm' and should ask the user first.
   */
  applyText(text: string, discardEdits = false): ApplyResult {
    if (text === this._state.text) {
      this._set({ empty: false, problems: this._state.invalid });
      return 'unchanged';
    }
    const built = buildSong(text);
    if (built.song.chords.length === 0) {
      this._set({ empty: true, problems: built.invalid });
      return 'empty';
    }
    if (!discardEdits && hasEdits(this._state.song)) return 'needsConfirm';
    this._history.push({ text, song: built.song, invalid: built.invalid });
    this._restore();
    return 'applied';
  }

  /** Marks the start of a drag: all note changes until endGesture() are one undo step. */
  startGesture(): void {
    this._inGesture = true;
    this._gestureStepTaken = false;
  }

  endGesture(): void {
    this._inGesture = false;
  }

  /** Returns true when the note actually changed. */
  editNote(chordIndex: number, voice: number, midi: number): boolean {
    const song = setNote(this._state.song, chordIndex, voice, midi);
    if (song === this._state.song) return false;
    const next = { ...this._history.present, song };
    if (this._inGesture && this._gestureStepTaken) this._history.replace(next);
    else this._history.push(next);
    this._gestureStepTaken = this._inGesture;
    this._restore();
    return true;
  }

  undo(): void {
    this._history.undo();
    this._restore();
  }

  redo(): void {
    this._history.redo();
    this._restore();
  }

  /** Tempo only changes timing; hand edits are kept. */
  setBpm(bpm: number): void {
    this._set({ bpm: clampBpm(bpm) });
  }

  setZoom(zoom: number): void {
    this._set({ zoom: Math.min(ZOOM.max, Math.max(ZOOM.min, zoom)) });
  }

  zoomBy(factor: number): void {
    this.setZoom(this._state.zoom * factor);
  }

  private _restore(): void {
    const p = this._history.present;
    this._set({ ...p, empty: false, problems: p.invalid, canUndo: this._history.canUndo, canRedo: this._history.canRedo });
  }

  private _set(patch: Partial<ProjectState>): void {
    this._state = { ...this._state, ...patch };
    for (const l of this._listeners) l();
  }
}
