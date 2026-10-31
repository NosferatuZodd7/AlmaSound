import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AlmaSoundApi, ReportTarget } from '../../../electron/ipc';
import type { AudioEngine } from '../../audio/engine';

interface Props {
  api: AlmaSoundApi;
  engine: AudioEngine;
  debugLogging: boolean;
  onDebugLogging(on: boolean): void;
  onClose(): void;
}

const MAX_LINES = 2000;
const levelClass = (line: string) => (line.includes('[ERROR]') ? 'log-error' : line.includes('[WARNING]') ? 'log-warn' : line.includes('[DEBUG]') ? 'log-debug' : '');

/** Live log plus one-click report: what a bug report needs, safe to paste in public. */
export function DiagnosticsDialog({ api, engine, debugLogging, onDebugLogging, onClose }: Props) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const view = useRef<HTMLPreElement>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [path, setPath] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [follow, setFollow] = useState(true);
  const [status, setStatus] = useState('');

  useEffect(() => {
    dialog.current!.showModal();
    void api.getLog().then((l) => {
      setLines(l.lines);
      setPath(l.path);
    });
    return api.onLogLine((line) => setLines((prev) => [...prev.slice(-(MAX_LINES - 1)), line]));
  }, [api]);

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return lines.filter((l) => (!problemsOnly || /\[(ERROR|WARNING)\]/.test(l)) && (!f || l.toLowerCase().includes(f)));
  }, [lines, filter, problemsOnly]);

  useEffect(() => {
    if (follow && view.current) view.current.scrollTop = view.current.scrollHeight;
  }, [shown, follow]);

  const save = async (target: ReportTarget) => {
    const r = await api.saveDiagnostics(target, await engine.probe());
    if (r.cancelled) return;
    setStatus(r.error ? t('diagnostics.saveFailed', { error: r.error }) : r.path ? t('diagnostics.saved', { path: r.path }) : t('diagnostics.copied'));
  };

  return (
    <dialog ref={dialog} className="dialog glass glass-strong diagnostics" aria-labelledby="diag-title" onClose={onClose} data-testid="diagnostics">
      <h2 id="diag-title">{t('diagnostics.title')}</h2>
      <p className="update-note">{t('diagnostics.hint')}</p>
      <div className="diag-tools">
        <input
          type="search"
          className="input"
          aria-label={t('diagnostics.filter')}
          placeholder={t('diagnostics.filterPlaceholder')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <label className="switch-row">
          <input type="checkbox" role="switch" className="switch" checked={problemsOnly} onChange={(e) => setProblemsOnly(e.target.checked)} />
          {t('diagnostics.problemsOnly')}
        </label>
        <label className="switch-row">
          <input type="checkbox" role="switch" className="switch" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
          {t('diagnostics.follow')}
        </label>
        <label className="switch-row">
          <input type="checkbox" role="switch" className="switch" checked={debugLogging} onChange={(e) => onDebugLogging(e.target.checked)} />
          {t('diagnostics.debug')}
        </label>
      </div>
      <pre ref={view} className="log-view" tabIndex={0} aria-label={t('diagnostics.log')} data-testid="log-view">
        {shown.map((l, i) => (
          <span key={i} className={levelClass(l)}>
            {l}
            {'\n'}
          </span>
        ))}
      </pre>
      <p className="update-note diag-path">{path ? t('diagnostics.logFile', { path }) : t('diagnostics.noLogFile')}</p>
      <p className="update-note" role="status" data-testid="diag-status">
        {status}
      </p>
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={() => dialog.current!.close()}>
          {t('diagnostics.close')}
        </button>
        <button type="button" className="btn" onClick={() => void save('copy')}>
          {t('diagnostics.copy')}
        </button>
        <button type="button" className="btn" onClick={() => void save('choose')}>
          {t('diagnostics.saveAs')}
        </button>
        <button type="button" className="btn btn-primary" onClick={() => void save('desktop')}>
          {t('diagnostics.saveDesktop')}
        </button>
      </div>
    </dialog>
  );
}
