import { useTranslation } from 'react-i18next';
import { splitLabel } from '../../core/theory/chords';

/** The chord under the playhead: big root, smaller quality, a dot when edited by hand. */
export function ChordTitle({ label, edited }: { label: string; edited: boolean }) {
  const { t } = useTranslation();
  const [root, quality] = splitLabel(label);
  return (
    <div className="chord-title glass" data-testid="chord-title">
      <span className="chord-root">{root}</span>
      <span className="chord-quality">{quality}</span>
      {edited && <span className="chord-edited" role="img" aria-label={t('stage.edited')} />}
    </div>
  );
}
