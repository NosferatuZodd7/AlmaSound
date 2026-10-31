// Core logger. Plain Node (no Electron import), so it is unit-tested directly.
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { redactSensitive } from '../src/core/logging/redact';

import type { LogLevel } from './ipc';

export type { LogLevel };
const RANK: Record<LogLevel | 'off', number> = { debug: 0, info: 1, warn: 2, error: 3, off: 4 };
const TAG: Record<LogLevel, string> = { debug: 'DEBUG', info: 'INFO', warn: 'WARNING', error: 'ERROR' };

export interface LoggerOptions {
  fileName?: string;
  maxBytes?: number;
  maxFiles?: number;
  ringSize?: number;
  console?: boolean;
  now?: () => Date;
}

/** Bursts of the same message (numbers ignored) keep their first lines, then "… N more like this". */
const BURST_KEEP = 3;

/**
 * Thread-safety is free here (one JS thread). Every line is redacted once, then goes to the
 * console, the rotating file (flushed per line), a ring buffer and live subscribers.
 */
export class Logger {
  level: LogLevel | 'off' = 'info';
  /** Off for --print-diagnostics, whose stdout must carry only the report. */
  toConsole: boolean;
  private _path: string | null = null;
  private _size = 0;
  private _ring: string[] = [];
  private _sinks = new Set<(line: string) => void>();
  private _burstKey = '';
  private _burstCount = 0;
  private _burstLevel: LogLevel = 'info';
  private readonly _o: Required<LoggerOptions>;

  constructor(options: LoggerOptions = {}) {
    this._o = { fileName: 'almasound.log', maxBytes: 5 * 1024 * 1024, maxFiles: 5, ringSize: 500, console: true, now: () => new Date(), ...options };
    this.toConsole = this._o.console;
  }

  get path(): string | null {
    return this._path;
  }

  /**
   * Opens the log file in the first directory that accepts an append (e.g. data folder, then the
   * exe folder, then temp). Lines logged before this are written then.
   */
  attachFile(dirs: string[]): string | null {
    for (const dir of dirs) {
      const path = join(dir, this._o.fileName);
      try {
        mkdirSync(dir, { recursive: true });
        closeSync(openSync(path, 'a'));
        this._path = path;
        this._size = statSync(path).size;
        for (const line of this._ring) this._write(line);
        return path;
      } catch {
        // not writable: try the next folder
      }
    }
    return null;
  }

  debug = (msg: string) => this.log('debug', msg);
  info = (msg: string) => this.log('info', msg);
  warn = (msg: string) => this.log('warn', msg);
  error = (msg: string) => this.log('error', msg);

  log(level: LogLevel, msg: string): void {
    if (RANK[level] < RANK[this.level]) return;
    const key = msg.replace(/\d+/g, '#');
    if (key === this._burstKey && level === this._burstLevel) {
      if (++this._burstCount > BURST_KEEP) return;
    } else {
      this._flushBurst();
      this._burstKey = key;
      this._burstLevel = level;
      this._burstCount = 1;
    }
    this._emit(level, msg);
  }

  /** The last lines (already redacted), oldest first. */
  lines(): string[] {
    this._flushBurst();
    return [...this._ring];
  }

  onLine(sink: (line: string) => void): () => void {
    this._sinks.add(sink);
    return () => this._sinks.delete(sink);
  }

  private _flushBurst(): void {
    const extra = this._burstCount - BURST_KEEP;
    if (extra > 0) this._emit(this._burstLevel, `… ${extra} more like this`);
    this._burstCount = Math.min(this._burstCount, BURST_KEEP);
  }

  private _emit(level: LogLevel, msg: string): void {
    const ts = this._o.now().toISOString().replace('T', ' ').replace('Z', ''); // UTC, milliseconds
    const line = redactSensitive(`${ts} [${TAG[level]}] ${msg}`);
    this._ring.push(line);
    if (this._ring.length > this._o.ringSize) this._ring.shift();
    if (this.toConsole) (RANK[level] >= RANK.warn ? process.stderr : process.stdout).write(`${line}\n`);
    this._write(line);
    for (const sink of this._sinks) {
      try {
        sink(line);
      } catch {
        // a broken subscriber must not break logging
      }
    }
  }

  private _write(line: string): void {
    if (!this._path) return;
    try {
      const bytes = Buffer.byteLength(line) + 1;
      if (this._size > 0 && this._size + bytes > this._o.maxBytes) this._rotate();
      appendFileSync(this._path, `${line}\n`);
      this._size += bytes;
    } catch {
      // never crash because of logging
    }
  }

  /** almasound.log → .1 → … → .{maxFiles-1}; the oldest is deleted. */
  private _rotate(): void {
    const p = this._path!;
    const oldest = `${p}.${this._o.maxFiles - 1}`;
    if (existsSync(oldest)) unlinkSync(oldest);
    for (let i = this._o.maxFiles - 2; i >= 1; i--) if (existsSync(`${p}.${i}`)) renameSync(`${p}.${i}`, `${p}.${i + 1}`);
    renameSync(p, `${p}.1`);
    this._size = 0;
  }
}

/** The app's logger; main.ts attaches its file once the data folder is known. */
export const log = new Logger();
