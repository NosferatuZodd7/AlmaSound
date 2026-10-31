import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  text: string;
  problems: string[];
  empty: boolean;
  /** Applies the text; resolves false when the user kept the old one. */
  onApply(text: string): Promise<boolean>;
}

export function ProgressionInput({ text, problems, empty, onApply }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(text);
  const applying = useRef(false);
  useEffect(() => setDraft(text), [text]);

  const apply = async () => {
    if (applying.current) return; // Enter then blur (when the dialog opens) must not ask twice
    applying.current = true;
    try {
      if (!(await onApply(draft))) setDraft(text);
    } finally {
      applying.current = false;
    }
  };

  const message = empty ? t('progression.empty') : problems.length ? t('progression.invalid', { tokens: problems.join(', ') }) : '';

  return (
    <>
      <input
        id="progression"
        className="input input-mono"
        value={draft}
        autoComplete="off"
        spellCheck={false}
        placeholder={t('progression.help')}
        title={t('progression.help')}
        aria-describedby="progression-message"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void apply()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void apply();
        }}
      />
      <p id="progression-message" className="message" role="status">
        {message}
      </p>
    </>
  );
}
