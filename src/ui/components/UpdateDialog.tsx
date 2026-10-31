import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { UpdateStatus } from '../../../electron/ipc';
import { useUpdateMessage } from './useUpdateMessage';

interface Props {
  open: boolean;
  status: UpdateStatus;
  onInstall(): void;
  onOpenPage(): void;
  /** Only hides the dialog; the app keeps knowing about the update. */
  onLater(): void;
}

export function UpdateDialog({ open, status, onInstall, onOpenPage, onLater }: Props) {
  const { t } = useTranslation();
  const say = useUpdateMessage();
  const ref = useRef<HTMLDialogElement>(null);
  const release = status.release;
  const busy = status.state === 'downloading' || status.state === 'ready';

  useEffect(() => {
    const d = ref.current!;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="dialog glass glass-strong update-dialog" aria-labelledby="update-title" onClose={onLater} data-testid="update-dialog">
      <h2 id="update-title">{t('updates.dialogTitle')}</h2>
      {release && (
        <div className="dialog-body">
          <p className="update-change">{t('updates.change', { current: status.currentVersion, version: release.tag })}</p>
          {/* shortcut: notes shown as plain text (no markdown renderer); add one if notes get rich formatting */}
          {release.notes && <div className="update-notes">{release.notes}</div>}
          {status.state === 'downloading' && <progress className="progress" value={status.progress} max={1} aria-label={say(status)} />}
          <p className={status.state === 'error' ? 'message' : 'update-note'} role="status">
            {status.state === 'available' ? t(release.hasInstaller ? 'updates.installNote' : 'updates.pageNote') : say(status)}
          </p>
        </div>
      )}
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={onLater} disabled={status.state === 'ready'}>
          {t('updates.later')}
        </button>
        <button type="button" className="btn" onClick={onOpenPage}>
          {t('updates.openPage')}
        </button>
        <button type="button" className="btn btn-primary" onClick={onInstall} disabled={busy}>
          {t('updates.install')}
        </button>
      </div>
    </dialog>
  );
}
