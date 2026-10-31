import { isSecretKey, redactSensitive } from './redact';

/** Everything a diagnostics report shows; gathered by the main process, rendered here. */
export interface ReportData {
  app: string;
  generatedAt: Date;
  /** Label → value, e.g. "App": "0.1.0-dev.3". */
  versions: Record<string, string>;
  network: string[];
  /** From the window (absent with --print-diagnostics). */
  audio: string[] | null;
  updates: Record<string, string>;
  settings: Record<string, unknown>;
  traces: string[];
  files: Record<string, string>;
  logTail: string[];
}

export const REPORT_END = '-- end of diagnostics --';

const section = (title: string, lines: string[]) => [title, '-'.repeat(title.length), ...(lines.length ? lines : ['(none)']), ''];
const pairs = (o: Record<string, unknown>) => Object.entries(o).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);

/** Plain-text report, safe to paste in public: secret settings are skipped and every line is redacted. */
export function renderReport(d: ReportData): string {
  const settings = Object.fromEntries(Object.entries(d.settings).filter(([k]) => !isSecretKey(k)));
  const text = [
    `${d.app} diagnostics`,
    `Generated at ${d.generatedAt.toISOString()}`,
    '',
    ...section('Versions', pairs(d.versions)),
    ...section('Network', d.network),
    ...section('Audio', d.audio ?? ['not available (no window)']),
    ...section('Updates', pairs(d.updates)),
    ...section('Settings', pairs(settings)),
    ...section('Last attempts', d.traces),
    ...section('Files', pairs(d.files)),
    ...section('Log (last lines)', d.logTail),
    REPORT_END,
    '',
  ].join('\n');
  return redactSensitive(text);
}
