import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appendChord, nextBeats, progressionTokens, removeToken, setTokenBeats } from '../../core/progressionText';
import { splitLabel } from '../../core/theory/chords';
import { ALL_KEYS, diatonicChords, IDEAS, ideaText, keyFromId, keyId, tonicName, type Key } from '../../core/theory/keys';

interface Props {
  text: string;
  /** Kept by the parent so it survives switching to the full mode and back. */
  musicKey: Key;
  onKey(key: Key): void;
  /** Applies the text; resolves false when the user kept the old one. */
  onApply(text: string): Promise<boolean>;
  /** Plays a chord once. */
  onPreview(label: string): void;
}

const pretty = (label: string) => splitLabel(label).join('');

/**
 * Chord building without knowing notes: pick a key, click the chords that belong to it, or start
 * from a well-known progression. It edits the same progression text as the full mode.
 */
export function SimpleBuilder({ text, musicKey: key, onKey: setKey, onApply, onPreview }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(text);
  const applying = useRef(false);
  useEffect(() => setDraft(text), [text]);

  const chords = diatonicChords(key);
  const tokens = progressionTokens(draft);
  const keyName = (k: Key) => t(k.mode === 'major' ? 'simple.major' : 'simple.minor', { tonic: pretty(tonicName(k)) });

  const commit = async (next: string) => {
    if (applying.current) return;
    setDraft(next);
    // Only unknown chords: keep the current song until there is something valid. Blank clears it.
    if (next.trim() !== '' && !progressionTokens(next).some((tk) => tk.valid)) return;
    applying.current = true;
    try {
      if (!(await onApply(next))) setDraft(text);
    } finally {
      applying.current = false;
    }
  };

  return (
    <div className="simple">
      <div className="simple-row">
        <div className="field">
          <label className="field-label" htmlFor="simple-key">
            {t('simple.key')}
          </label>
          <select id="simple-key" className="select select-compact" value={keyId(key)} onChange={(e) => setKey(keyFromId(e.target.value))}>
            {ALL_KEYS.map((k) => (
              <option key={keyId(k)} value={keyId(k)}>
                {keyName(k)}
              </option>
            ))}
          </select>
        </div>
        <div className="field pads-field">
          <span className="field-label">{t('simple.chords')}</span>
          <div className="pads" role="group" aria-label={t('simple.chords')}>
            {chords.map((c) => (
              <button
                key={c.label}
                type="button"
                className="pad"
                data-tip={t('simple.add', { chord: pretty(c.label) })}
                onClick={() => {
                  onPreview(c.label);
                  void commit(appendChord(draft, c.label));
                }}
              >
                <span className="pad-name">{pretty(c.label)}</span>
                <span className="pad-numeral">{c.numeral}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="simple-ideas">
            {t('simple.ideasLabel')}
          </label>
          <select
            id="simple-ideas"
            className="select select-compact"
            value=""
            onChange={(e) => {
              const idea = IDEAS.find((i) => i.id === e.target.value);
              if (idea) void commit(ideaText(idea, key));
            }}
          >
            <option value="" disabled>
              {t('simple.ideasPlaceholder')}
            </option>
            {IDEAS.map((i) => (
              <option key={i.id} value={i.id}>
                {t(`simple.idea.${i.id}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="chips" role="list" aria-label={t('simple.progression')} data-testid="chips">
        {tokens.length === 0 && <span className="update-note">{t('simple.empty')}</span>}
        {tokens.map((tk, i) => (
          <span key={i} role="listitem" className={`chip${tk.valid ? '' : ' chip-invalid'}`}>
            <button type="button" className="chip-name" disabled={!tk.valid} onClick={() => onPreview(tk.label)}>
              {tk.valid ? pretty(tk.label) : tk.label}
            </button>
            {tk.valid && (
              <button
                type="button"
                className="chip-beats"
                aria-label={t('simple.beats', { count: tk.beats })}
                data-tip={t('simple.beats', { count: tk.beats })}
                onClick={() => void commit(setTokenBeats(draft, i, nextBeats(tk.beats)))}
              >
                {tk.beats}
              </button>
            )}
            <button type="button" className="chip-remove" aria-label={t('simple.remove', { chord: tk.label })} onClick={() => void commit(removeToken(draft, i))}>
              ×
            </button>
          </span>
        ))}
        {tokens.length > 0 && (
          <button type="button" className="btn btn-ghost chip-clear" onClick={() => void commit('')}>
            {t('simple.clear')}
          </button>
        )}
      </div>
    </div>
  );
}
