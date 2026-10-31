import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UpdateSettings, UpdateStatus } from '../../../electron/ipc';
import type { Channel } from '../../core/updates/releases';
import { Segmented } from './Segmented';
import { useUpdateMessage } from './useUpdateMessage';

interface Props {
  settings: UpdateSettings;
  status: UpdateStatus;
  onChange(patch: Partial<UpdateSettings>): void;
  onCheck(): void;
  onShowUpdate(): void;
}

export function UpdatesSection({ settings, status, onChange, onCheck, onShowUpdate }: Props) {
  const { t } = useTranslation();
  const say = useUpdateMessage();
  const [repo, setRepo] = useState(settings.updateRepository);
  useEffect(() => setRepo(settings.updateRepository), [settings.updateRepository]);
  const busy = status.state === 'checking' || status.state === 'downloading';

  return (
    <section className="settings-section" aria-labelledby="updates-title">
      <div className="section-head">
        <h3 id="updates-title">{t('updates.title')}</h3>
        <span className="badge" data-testid="app-version">
          {t('updates.version', { version: status.currentVersion })}
        </span>
      </div>
      <label className="switch-row">
        <input type="checkbox" role="switch" className="switch" checked={settings.checkForUpdates} onChange={(e) => onChange({ checkForUpdates: e.target.checked })} />
        {t('updates.auto')}
      </label>
      <div className="field">
        <span className="field-label">{t('updates.channel')}</span>
        <Segmented<Channel>
          name="channel"
          legend={t('updates.channel')}
          value={settings.updateChannel}
          options={[
            { value: 'stable', label: t('updates.channelStable') },
            { value: 'testing', label: t('updates.channelTesting') },
          ]}
          onChange={(updateChannel) => onChange({ updateChannel })}
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="update-repo">
          {t('updates.repository')}
        </label>
        <input
          id="update-repo"
          className="input input-mono"
          value={repo}
          spellCheck={false}
          autoComplete="off"
          placeholder="owner/name"
          onChange={(e) => setRepo(e.target.value)}
          onBlur={() => repo !== settings.updateRepository && onChange({ updateRepository: repo })}
        />
      </div>
      <div className="update-row">
        <button type="button" className="btn" onClick={onCheck} disabled={busy}>
          {t('updates.checkNow')}
        </button>
        {status.state === 'available' && (
          <button type="button" className="btn btn-primary" onClick={onShowUpdate}>
            {t('updates.install')}
          </button>
        )}
      </div>
      <p className={status.state === 'error' ? 'message' : 'update-note'} role="status" data-testid="update-message">
        {say(status)}
      </p>
    </section>
  );
}
