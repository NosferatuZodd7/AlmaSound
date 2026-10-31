import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { AudioEngine } from './audio/engine';
import { createI18n, resolveLanguage } from './i18n/locales';
import { App } from './ui/App';
import { ProjectStore } from './ui/projectStore';
import './ui/styles.css';

async function start(): Promise<void> {
  const api = window.almasound;
  const settings = api
    ? await api.getSettings()
    : { language: null, theme: 'system' as const, checkForUpdates: false, debugLogging: false, updateChannel: 'stable' as const, updateRepository: '', systemLanguage: navigator.language };
  const i18n = createI18n(resolveLanguage(settings.language ?? settings.systemLanguage));
  document.documentElement.lang = i18n.language;

  const store = new ProjectStore();
  const engine = new AudioEngine(store.getState().song, store.getState().bpm, store.getState().transition);
  let last = store.getState();
  store.subscribe(() => {
    const s = store.getState();
    if (s.song !== last.song || s.bpm !== last.bpm || s.transition !== last.transition) engine.setSong(s.song, s.bpm, s.transition);
    last = s;
  });

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <App store={store} engine={engine} initialSettings={settings} api={api} />
      </I18nextProvider>
    </StrictMode>,
  );
  // Two frames: the first paint has really happened, so the startup guard can stand down.
  requestAnimationFrame(() => requestAnimationFrame(() => api?.firstFrame()));
}

void start();
