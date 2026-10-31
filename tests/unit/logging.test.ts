import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Logger } from '../../electron/logger';
import { redactSensitive } from '../../src/core/logging/redact';
import { renderReport, REPORT_END, type ReportData } from '../../src/core/logging/report';
import { Trace } from '../../src/core/logging/trace';

describe('redactSensitive', () => {
  it('hides values in JSON, key=value and headers, any case', () => {
    expect(redactSensitive('{"token":"abc123","name":"x"}')).toBe('{"token":"[REDACTED]","name":"x"}');
    expect(redactSensitive('password=hunter2 user=bob')).toBe('password=[REDACTED] user=bob');
    expect(redactSensitive('API_KEY: zzz')).toBe('API_KEY: [REDACTED]');
    expect(redactSensitive('apiKey=zzz')).toBe('apiKey=[REDACTED]');
    expect(redactSensitive('Authorization: Bearer abc.def')).toBe('Authorization: [REDACTED]');
    expect(redactSensitive('"access-token" : "q"')).toBe('"access-token" : "[REDACTED]"');
  });

  it('leaves ordinary text alone', () => {
    const text = 'Updates: checking owner/repo (testing), HTTP 200 in 120 ms';
    expect(redactSensitive(text)).toBe(text);
  });
});

describe('Trace', () => {
  it('records steps with results and durations; a new step closes the previous as OK', () => {
    let now = 1_000;
    const t = new Trace('Update check', () => now);
    t.begin('owner/repo');
    t.step('request', 'GET releases');
    now += 120;
    t.step('parse');
    now += 5;
    t.fail('not JSON');
    t.skip('pick', 'nothing to pick from');
    t.note('user pressed Later');
    t.end();
    expect(t.steps.map((s) => s.result)).toEqual(['ok', 'failed', 'skipped']);
    const s = t.summary();
    expect(s).toContain('Update check (owner/repo)');
    expect(s).toContain('[OK] request: GET releases (120 ms)');
    expect(s).toContain('[FAILED] parse: not JSON (5 ms)');
    expect(s).toContain('[SKIPPED] pick: nothing to pick from');
    expect(s).toContain('note +125 ms: user pressed Later');
  });

  it('says when nothing was attempted', () => {
    expect(new Trace('Install').summary()).toBe('Install: no attempt yet');
  });
});

describe('renderReport', () => {
  const data: ReportData = {
    app: 'AlmaSound',
    generatedAt: new Date('2026-10-31T10:00:00Z'),
    versions: { App: '0.1.0', Electron: '45.2.1' },
    network: ['eth0 192.0.2.10/255.255.255.0'],
    audio: null,
    updates: { state: 'idle' },
    settings: { theme: 'dark', token: 'shh-secret', nested: { password: 'p4ss' } },
    traces: ['Update check: no attempt yet'],
    files: { Log: '/x/almasound.log' },
    logTail: ['2026-10-31 10:00:00.000 [INFO] Startup: ready', 'oops password=leak'],
  };
  const report = renderReport(data);

  it('has every section, in order, and the end marker', () => {
    const order = ['Versions', 'Network', 'Audio', 'Updates', 'Settings', 'Last attempts', 'Files', 'Log (last lines)', REPORT_END];
    const idx = order.map((h) => report.indexOf(h));
    expect(idx.every((i) => i >= 0)).toBe(true);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    expect(report).toContain('not available (no window)');
  });

  it('contains no secret values', () => {
    expect(report).not.toContain('shh-secret');
    expect(report).not.toContain('p4ss');
    expect(report).not.toContain('leak');
    expect(report).toContain('theme: dark');
  });
});

describe('Logger', () => {
  const at = new Date('2026-10-31T19:34:56.236Z');
  const make = (o = {}) => new Logger({ console: false, now: () => at, ...o });

  it('formats UTC lines with milliseconds and filters by level', () => {
    const l = make();
    l.debug('hidden at Info');
    l.info('Startup: ready');
    l.level = 'debug';
    l.debug('now visible');
    expect(l.lines()).toEqual(['2026-10-31 19:34:56.236 [INFO] Startup: ready', '2026-10-31 19:34:56.236 [DEBUG] now visible']);
  });

  it('redacts before anything is stored', () => {
    const l = make();
    l.warn('token=abc');
    expect(l.lines()[0]).toContain('token=[REDACTED]');
  });

  it('keeps a bounded ring buffer', () => {
    const l = make({ ringSize: 3 });
    for (const m of ['a', 'b', 'c', 'd']) l.info(m);
    expect(l.lines().map((x) => x.slice(-1))).toEqual(['b', 'c', 'd']);
  });

  it('collapses bursts of the same message (numbers ignored)', () => {
    const l = make();
    for (let i = 0; i < 10; i++) l.warn(`buffer overflow at frame ${i}`);
    l.info('done');
    const lines = l.lines().map((x) => x.slice(24));
    expect(lines).toEqual([
      '[WARNING] buffer overflow at frame 0',
      '[WARNING] buffer overflow at frame 1',
      '[WARNING] buffer overflow at frame 2',
      '[WARNING] … 7 more like this',
      '[INFO] done',
    ]);
  });

  it('writes lines logged before the file was attached, and falls back to the next folder', () => {
    const dir = mkdtempSync(join(tmpdir(), 'log-'));
    const blocked = join(dir, 'file-not-dir');
    writeFileSync(blocked, '');
    const l = make();
    l.info('early breadcrumb');
    expect(l.attachFile([join(blocked, 'logs'), join(dir, 'ok')])).toBe(join(dir, 'ok', 'almasound.log'));
    l.info('later');
    expect(readFileSync(l.path!, 'utf8')).toMatch(/early breadcrumb\n.*later\n$/);
  });

  it('rotates at the size limit and keeps maxFiles files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'log-'));
    const l = make({ maxBytes: 200, maxFiles: 3 });
    l.attachFile([dir]);
    for (let i = 0; i < 40; i++) l.info(`line ${'x'.repeat(i % 2)} ${String.fromCharCode(97 + (i % 26))}`); // distinct, no bursts
    const p = l.path!;
    expect(existsSync(p) && existsSync(`${p}.1`) && existsSync(`${p}.2`)).toBe(true);
    expect(existsSync(`${p}.3`)).toBe(false);
    for (const f of [p, `${p}.1`, `${p}.2`]) expect(readFileSync(f).length).toBeLessThanOrEqual(200);
  });
});
