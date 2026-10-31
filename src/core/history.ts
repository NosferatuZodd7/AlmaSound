/** Undo/redo over immutable snapshots. */
export class History<T> {
  private _past: T[] = [];
  private _future: T[] = [];

  constructor(
    private _present: T,
    private readonly _limit = 200,
  ) {}

  get present(): T {
    return this._present;
  }

  get canUndo(): boolean {
    return this._past.length > 0;
  }

  get canRedo(): boolean {
    return this._future.length > 0;
  }

  push(next: T): void {
    if (Object.is(next, this._present)) return;
    this._past.push(this._present);
    if (this._past.length > this._limit) this._past.shift();
    this._present = next;
    this._future = [];
  }

  /** Changes the present without a new undo step (e.g. while a drag is still going). */
  replace(next: T): void {
    this._present = next;
  }

  undo(): T {
    const prev = this._past.pop();
    if (prev !== undefined) {
      this._future.push(this._present);
      this._present = prev;
    }
    return this._present;
  }

  redo(): T {
    const next = this._future.pop();
    if (next !== undefined) {
      this._past.push(this._present);
      this._present = next;
    }
    return this._present;
  }
}
