export type StepResult = 'running' | 'ok' | 'failed' | 'skipped';

export interface TraceStep {
  name: string;
  detail: string;
  result: StepResult;
  start: number;
  end?: number;
}

/**
 * Step-by-step record of the last attempt of a multi-step flow (e.g. checking for or installing an
 * update), with timings, so a report says which step stopped, after how long and why.
 */
export class Trace {
  private _subject = '';
  private _started = 0;
  private _steps: TraceStep[] = [];
  private _notes: { at: number; text: string }[] = [];
  private _ended = false;

  constructor(
    readonly title: string,
    private readonly _now: () => number = () => Date.now(),
  ) {}

  /** Starts a new attempt and forgets the previous one. */
  begin(subject = ''): void {
    this._subject = subject;
    this._started = this._now();
    this._steps = [];
    this._notes = [];
    this._ended = false;
  }

  /** Opens a step; a step still running is closed as OK first. */
  step(name: string, detail = ''): void {
    this._close('ok');
    this._steps.push({ name, detail, result: 'running', start: this._now() });
  }

  ok(detail?: string): void {
    this._close('ok', detail);
  }

  fail(detail: string): void {
    this._close('failed', detail);
  }

  skip(name: string, reason: string): void {
    this._close('ok');
    const now = this._now();
    this._steps.push({ name, detail: reason, result: 'skipped', start: now, end: now });
  }

  note(text: string): void {
    this._notes.push({ at: this._now(), text });
  }

  end(): void {
    this._close('ok');
    this._ended = true;
  }

  get steps(): readonly TraceStep[] {
    return this._steps;
  }

  /** Pasteable text: one line per step with result and duration, then the notes. */
  summary(): string {
    if (!this._started) return `${this.title}: no attempt yet`;
    const lines = [`${this.title}${this._subject ? ` (${this._subject})` : ''}, started ${new Date(this._started).toISOString()}${this._ended ? '' : ', not finished'}`];
    for (const s of this._steps) {
      const ms = s.end === undefined ? `${this._now() - s.start} ms so far` : `${s.end - s.start} ms`;
      lines.push(`  [${s.result.toUpperCase()}] ${s.name}${s.detail ? `: ${s.detail}` : ''} (${ms})`);
    }
    for (const n of this._notes) lines.push(`  note +${n.at - this._started} ms: ${n.text}`);
    return lines.join('\n');
  }

  private _close(result: StepResult, detail?: string): void {
    const open = this._steps.at(-1);
    if (!open || open.result !== 'running') return;
    open.result = result;
    open.end = this._now();
    if (detail) open.detail = open.detail ? `${open.detail} → ${detail}` : detail;
  }
}
