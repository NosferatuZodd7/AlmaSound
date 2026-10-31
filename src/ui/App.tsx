import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import type { AlmaSoundApi, MenuAction, Theme } from '../../electron/ipc';
import type { AudioEngine } from '../audio/engine';
import { ZOOM, type ProjectStore } from './projectStore';
import { ChordTitle } from './components/ChordTitle';
import { IconButton } from './components/IconButton';
import { ProgressionInput } from './components/ProgressionInput';
import { SettingsDialog } from './components/SettingsDialog';
import { Transport } from './components/Transport';
import type { StageInsets } from './stage/geometry';
import { Stage } from './stage/Stage';

interface Props {
  store: ProjectStore;
  engine: AudioEngine;
  initialTheme: Theme;
  /** Electron bridge; absent when the UI runs in a plain browser. */
  api?: AlmaSoundApi;
}

const isTextField = (el: Element | null): boolean => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;

export function App({ store, engine, initialTheme, api }: Props) {
  const { t, i18n } = useTranslation();
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const playing = useSyncExternalStore(engine.subscribe, () => engine.playing);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState(initialTheme);
  const [chordIndex, setChordIndex] = useState(0);
  const topbar = useRef<HTMLElement>(null);
  const dock = useRef<HTMLElement>(null);
  const insets = useRef<StageInsets>({ top: 0, bottom: 0 });
  const ctrl = t('keys.ctrl');

  // The stage keeps notes clear of the floating panels; they resize with the language and window.
  useEffect(() => {
    const measure = () => {
      const top = topbar.current!.getBoundingClientRect();
      const bottom = dock.current!.getBoundingClientRect();
      insets.current = { top: top.bottom, bottom: window.innerHeight - bottom.top };
    };
    const observer = new ResizeObserver(measure);
    observer.observe(topbar.current!);
    observer.observe(dock.current!);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const changeTheme = (next: Theme) => {
    setTheme(next);
    void api?.setTheme(next);
  };

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

  const chord = state.song.chords[Math.min(chordIndex, state.song.chords.length - 1)];

  return (
    <div className="app">
      <div className="backdrop" aria-hidden="true" />
      <Stage store={store} engine={engine} insets={insets} onChord={setChordIndex} />
      <header ref={topbar} className="topbar">
        <div className="brand glass">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">{t('app.title')}</span>
        </div>
        {chord && <ChordTitle key={chord.symbol.label + chordIndex} label={chord.symbol.label} edited={chord.edited} />}
        <nav className="toolbar glass" aria-label={t('menu.edit')}>
          <IconButton icon="undo" variant="ghost" tipBelow label={t('shortcuts.undo')} shortcut={`${ctrl}+Z`} keys="Control+Z" disabled={!state.canUndo} onClick={() => store.undo()} />
          <IconButton icon="redo" variant="ghost" tipBelow label={t('shortcuts.redo')} shortcut={`${ctrl}+Y`} keys="Control+Y" disabled={!state.canRedo} onClick={() => store.redo()} />
          <IconButton icon="settings" variant="ghost" tipBelow label={t('settings.open')} shortcut={`${ctrl}+,`} keys="Control+Comma" onClick={() => setSettingsOpen(true)} />
        </nav>
      </header>
      <footer ref={dock} className="dock glass">
        <ProgressionInput text={state.text} problems={state.problems} empty={state.empty} onApply={applyText} />
        <div className="dock-row">
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
          <p className="hint">
            {t('stage.hint')} · <span className="edited-mark" aria-hidden="true" />
            {t('stage.edited')}
          </p>
        </div>
      </footer>
      <SettingsDialog open={settingsOpen} theme={theme} onClose={() => setSettingsOpen(false)} onLanguage={changeLanguage} onTheme={changeTheme} />
    </div>
  );
}
