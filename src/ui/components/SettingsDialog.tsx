import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LOCALES } from '../../i18n/locales';

interface Props {
  open: boolean;
  onClose(): void;
  onLanguage(code: string): void;
}

export function SettingsDialog({ open, onClose, onLanguage }: Props) {
  const { t, i18n } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current!;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="settings" aria-labelledby="settings-title" onClose={onClose}>
      <h2 id="settings-title">{t('settings.title')}</h2>
      <div className="field">
        <label htmlFor="language">{t('settings.language')}</label>
        <select id="language" value={i18n.language} onChange={(e) => onLanguage(e.target.value)}>
          {LOCALES.map((l) => (
            <option key={l.code} value={l.code} lang={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      <form method="dialog">
        <button type="submit" className="primary">
          {t('settings.close')}
        </button>
      </form>
    </dialog>
  );
}
