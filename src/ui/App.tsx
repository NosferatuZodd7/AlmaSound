import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import type { AlmaSoundApi, MenuAction } from '../../electron/ipc';
import type { AudioEngine } from '../audio/engine';
import { ZOOM, type ProjectStore } from './projectStore';
import { ProgressionInput } from './components/ProgressionInput';
import { SettingsDialog } from './components/SettingsDialog';
import { Transport } from './components/Transport';
import { Stage } from './stage/Stage';

interface Props {
  store: ProjectStore;
  engine: AudioEngine;
  /** Electron bridge; absent when the UI runs in a plain browser. */
  api?: AlmaSoundApi;
}

const isTextField = (el: Element | null): boolean => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;

export function App({ store, engine, api }: Props) {
  const { t, i18n } = useTranslation();
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const playing = useSyncExternalStore(engine.subscribe, () => engine.playing);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const applyText = async (text: string): Promise<boolean> => {
    if (store.applyText(text) !== 'needsConfirm') return true;
    const ok = api
      ? await api.confirm({
          message: t('dialog.discardEdits.message'),
          detail: t('dialog.discardEdits.detail'),
          confirm: t('dialog.discardEdits.confirm'),
          cancel: t('dialog.discardEdits.cancel'),
        })
      : window.confirm(`${t('dialog.discardEdits.message')}\n\n${t('dialog.discardEdits.detail')}`);
    if (ok) store.applyText(text, true);
    return ok;
  };

  const changeLanguage = (code: string) => {
    void i18n.changeLanguage(code);
    document.documentElement.lang = code;
    void api?.setLanguage(code);
  };

  const run = useCallback(
    (action: MenuAction) => {
      switch (action) {
        case 'settings':
          return setSettingsOpen(true);
        case 'undo':
        case 'redo':
          // In a text field the shortcut edits the text; elsewhere it undoes note edits.
          if (isTextField(document.activeElement)) document.execCommand(action);
          else if (action === 'undo') store.undo();
          else store.redo();
          return;
        case 'zoomIn':
          return store.zoomBy(ZOOM.step);
        case 'zoomOut':
          return store.zoomBy(1 / ZOOM.step);
        case 'zoomReset':
          return store.setZoom(1);
        case 'playPause':
          return engine.toggle();
        case 'restart':
          return engine.seek(0);
      }
    },
    [store, engine],
  );

  useEffect(() => api?.onMenu(run), [api, run]);

  useEffect(() => {
    // Single place for every shortcut (the native menu only displays them).
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as Element;
      if (target.closest?.('dialog')) return;
      const inText = isTextField(target);
      const k = e.key.toLowerCase();
      let action: MenuAction | null = null;
      if (e.ctrlKey || e.metaKey) {
        if (k === ',') action = 'settings';
        else if (k === '=' || k === '+') action = 'zoomIn';
        else if (k === '-') action = 'zoomOut';
        else if (k === '0') action = 'zoomReset';
        else if (!inText && k === 'z') action = e.shiftKey ? 'redo' : 'undo';
        else if (!inText && k === 'y') action = 'redo';
      } else if (!inText && e.code === 'Space') action = 'playPause';
      else if (!inText && e.code === 'Home') action = 'restart';
      if (!action) return;
      e.preventDefault(); // also stops a focused button from being clicked by Space
      run(action);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [run]);

  return (
    <div className="app">
      <main className="stage-wrap">
        <Stage store={store} engine={engine} />
      </main>
      <footer className="bar">
        <ProgressionInput text={state.text} problems={state.problems} empty={state.empty} onApply={applyText} />
        <Transport
          engine={engine}
          playing={playing}
          bpm={state.bpm}
          zoom={state.zoom}
          onBpm={(b) => store.setBpm(b)}
          onRestart={() => run('restart')}
          onZoom={(d) => run(d > 0 ? 'zoomIn' : 'zoomOut')}
        />
        <span className="spacer" />
        <button type="button" onClick={() => store.undo()} disabled={!state.canUndo} aria-keyshortcuts="Control+Z">
          {t('shortcuts.undo')} <kbd>{t('keys.ctrl')}+Z</kbd>
        </button>
        <button type="button" onClick={() => store.redo()} disabled={!state.canRedo} aria-keyshortcuts="Control+Y">
          {t('shortcuts.redo')} <kbd>{t('keys.ctrl')}+Y</kbd>
        </button>
        <button type="button" onClick={() => setSettingsOpen(true)} aria-keyshortcuts="Control+Comma">
          {t('settings.open')} <kbd>{t('keys.ctrl')}+,</kbd>
        </button>
        <p className="hint">
          {t('stage.hint')} · <span className="edited-mark">*</span> {t('stage.edited')}
        </p>
      </footer>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} onLanguage={changeLanguage} />
    </div>
  );
}
