import { useTranslation } from 'react-i18next';
import type { UpdateStatus } from '../../../electron/ipc';

/** Turns an update status into translated text (messages travel as keys, so a language switch applies). */
export function useUpdateMessage(): (status: UpdateStatus) => string {
  const { t, i18n } = useTranslation();
  return (status) => {
    if (status.state === 'checking') return t('updates.checking');
    if (status.state === 'downloading') {
      return t('updates.downloading', { percent: new Intl.NumberFormat(i18n.language, { style: 'percent' }).format(status.progress) });
    }
    return status.message ? t(status.message.key, status.message.params) : '';
  };
}
