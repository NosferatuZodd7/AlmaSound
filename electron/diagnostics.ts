import { app, nativeTheme } from 'electron';
import { readdirSync, writeFileSync } from 'node:fs';
import { arch, networkInterfaces, release, type as osType, version as osVersion } from 'node:os';
import { join } from 'node:path';
import { renderReport } from '../src/core/logging/report';
import type { Trace } from '../src/core/logging/trace';
import type { AppSettings, UpdateStatus } from './ipc';
import { log } from './logger';

export interface DiagnosticsContext {
  settings(): AppSettings;
  settingsPath: string;
  updateStatus(): UpdateStatus;
  traces: readonly Trace[];
  /** Why the app runs with software rendering, or null. */
  safeMode: string | null;
}

function crashDumps(): string {
  const dir = app.getPath('crashDumps');
  try {
    const dumps = readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith('.dmp'));
    return `${dir} (${dumps.length} minidump${dumps.length === 1 ? '' : 's'})`;
  } catch {
    return `${dir} (none)`;
  }
}

/** IPv4 interfaces with netmask; shows at a glance when the PC is on an unexpected network. */
function network(): string[] {
  return Object.entries(networkInterfaces()).flatMap(([name, addrs]) =>
    (addrs ?? []).filter((a) => a.family === 'IPv4').map((a) => `${name} ${a.address}/${a.netmask}${a.internal ? ' (loopback)' : ''}`),
  );
}

function gpu(): string {
  if (!app.isReady()) return 'unknown (not ready)';
  const status = app.getGPUFeatureStatus() as unknown as Record<string, string>;
  return ['gpu_compositing', 'webgl', 'rasterization', 'video_decode'].map((k) => `${k}=${status[k] ?? '?'}`).join(', ');
}

/** The full report. `audio` comes from the window (null with --print-diagnostics). */
export function buildReport(ctx: DiagnosticsContext, audio: string[] | null): string {
  const u = ctx.updateStatus();
  const s = ctx.settings();
  return renderReport({
    app: 'AlmaSound',
    generatedAt: new Date(),
    versions: {
      App: `${app.getVersion()}${app.isPackaged ? '' : ' (development)'}`,
      Electron: process.versions.electron,
      Chromium: process.versions.chrome,
      Node: process.versions.node,
      OS: `${osType()} ${release()} (${osVersion()}), ${arch()}`,
      Locale: app.getLocale(),
      Theme: `${s.theme} (dark now: ${nativeTheme.shouldUseDarkColors})`,
      Rendering: ctx.safeMode ? `software (safe mode: ${ctx.safeMode})` : 'hardware',
      GPU: gpu(),
    },
    network: network(),
    audio,
    updates: {
      State: u.state,
      Message: u.message ? `${u.message.key} ${JSON.stringify(u.message.params ?? {})}` : '-',
      Installed: u.currentVersion,
      Offered: u.release?.tag ?? '-',
      Repository: s.updateRepository || '(not set)',
      Channel: s.updateChannel,
    },
    settings: { ...s },
    traces: ctx.traces.map((t) => t.summary()),
    files: {
      Settings: ctx.settingsPath,
      Log: log.path ?? '(no log file could be opened)',
      'Data folder': app.getPath('userData'),
      'Crash dumps': crashDumps(),
    },
    logTail: log.lines(),
  });
}

/** AlmaSound-diagnostics-YYYY-MM-DD-HHMMSS.txt in `dir`, so an earlier report is never overwritten. */
export function saveReport(text: string, dir: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const name = `AlmaSound-diagnostics-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.txt`;
  const path = join(dir, name);
  writeFileSync(path, text);
  log.info(`Diagnostics: report saved to ${path}`);
  return path;
}
