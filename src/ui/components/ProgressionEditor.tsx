import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProgressionInput } from './ProgressionInput';
import { Segmented } from './Segmented';
import { SimpleBuilder } from './SimpleBuilder';
import type { Key } from '../../core/theory/keys';

export type InputMode = 'simple' | 'full';

const STORAGE_KEY = 'almasound.inputMode';

/** Remembered per user; the simple mode is the default. */
function storedMode(): InputMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'full' ? 'full' : 'simple';
  } catch {
    return 'simple';
  }
}

interface Props {
  text: string;
  problems: string[];
  empty: boolean;
  onApply(text: string): Promise<boolean>;
  onPreview(label: string): void;
}

/** The progression area: a small tab switches between the simple builder and the full text field. */
export function ProgressionEditor({ text, problems, empty, onApply, onPreview }: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<InputMode>(storedMode);
  const [key, setKey] = useState<Key>({ tonic: 9, mode: 'minor' }); // A minor, like the example song

  const changeMode = (next: InputMode) => {
    setMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage unavailable: the choice lasts for this session only
    }
  };

  return (
    <div className="field progression">
      <div className="progression-head">
        {mode === 'full' ? (
          <label className="field-label" htmlFor="progression">
            {t('progression.label')}
          </label>
        ) : (
          <span className="field-label">{t('progression.label')}</span>
        )}
        <Segmented<InputMode>
          name="input-mode"
          legend={t('input.mode')}
          value={mode}
          options={[
            { value: 'simple', label: t('input.simple') },
            { value: 'full', label: t('input.full') },
          ]}
          onChange={changeMode}
        />
      </div>
      {mode === 'full' ? (
        <ProgressionInput text={text} problems={problems} empty={empty} onApply={onApply} />
      ) : (
        <SimpleBuilder text={text} musicKey={key} onKey={setKey} onApply={onApply} onPreview={onPreview} />
      )}
    </div>
  );
}
