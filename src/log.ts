import type { LogLevel } from '../electron/ipc';

/** Renderer-side logging into the app log (console outside Electron). Prefix the module: "Audio: …". */
export function log(level: LogLevel, message: string): void {
  if (window.almasound) window.almasound.log(level, message);
  else console[level === 'debug' ? 'log' : level](message);
}
