import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { THEMES, type Theme } from '../../../electron/ipc';
import { LOCALES } from '../../i18n/locales';
import { Segmented } from './Segmented';

interface Props {
  open: boolean;
  theme: Theme;
  onClose(): void;
  onLanguage(code: string): void;
  onTheme(theme: Theme): void;
}

const THEME_KEYS = { system: 'settings.themeSystem', light: 'settings.themeLight', dark: 'settings.themeDark' } as const;

export function SettingsDialog({ open, theme, onClose, onLanguage, onTheme }: Props) {
  const { t, i18n } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current!;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="dialog glass glass-strong" aria-labelledby="settings-title" onClose={onClose}>
      <h2 id="settings-title">{t('settings.title')}</h2>
      <div className="dialog-body">
        <div className="field">
          <label className="field-label" htmlFor="language">
            {t('settings.language')}
          </label>
          <select id="language" className="select" value={i18n.language} onChange={(e) => onLanguage(e.target.value)}>
            {LOCALES.map((l) => (
              <option key={l.code} value={l.code} lang={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <span className="field-label">
            {t('settings.theme')}
          </span>
          <Segmented name="theme" legend={t('settings.theme')} value={theme} options={THEMES.map((v) => ({ value: v, label: t(THEME_KEYS[v]) }))} onChange={onTheme} />
        </div>
      </div>
      <form method="dialog" className="dialog-actions">
        <button type="submit" className="btn btn-primary">
          {t('settings.close')}
        </button>
      </form>
    </dialog>
  );
}
