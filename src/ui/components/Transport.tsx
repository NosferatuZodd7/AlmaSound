import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AudioEngine } from '../../audio/engine';
import { BPM_RANGE } from '../../core/timeline';
import { formatDuration, formatNumber } from '../../i18n/format';

interface Props {
  engine: AudioEngine;
  playing: boolean;
  bpm: number;
  zoom: number;
  onBpm(bpm: number): void;
  onRestart(): void;
  onZoom(direction: 1 | -1): void;
}

export function Transport({ engine, playing, bpm, zoom, onBpm, onRestart, onZoom }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const [bpmDraft, setBpmDraft] = useState(String(bpm));
  const position = useRef<HTMLOutputElement>(null);
  useEffect(() => setBpmDraft(String(bpm)), [bpm]);

  // The clock text updates from the audio clock without re-rendering React.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (position.current) position.current.textContent = `${formatDuration(engine.position(), locale)} / ${formatDuration(engine.duration, locale)}`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine, locale]);

  const commitBpm = () => onBpm(Number(bpmDraft));

  return (
    <>
      <div className="field">
        <label htmlFor="bpm">{t('transport.bpm')}</label>
        <input
          id="bpm"
          type="number"
          min={BPM_RANGE.min}
          max={BPM_RANGE.max}
          value={bpmDraft}
          onChange={(e) => setBpmDraft(e.target.value)}
          onBlur={commitBpm}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitBpm();
          }}
        />
      </div>
      <button type="button" className="primary" onClick={() => engine.toggle()} aria-keyshortcuts="Space" data-testid="play">
        {playing ? t('transport.pause') : t('transport.play')} <kbd>{t('keys.space')}</kbd>
      </button>
      <button type="button" onClick={onRestart} aria-keyshortcuts="Home">
        {t('transport.restart')} <kbd>{t('keys.home')}</kbd>
      </button>
      <div className="zoom" role="group" aria-label={t('shortcuts.zoom')}>
        <button type="button" onClick={() => onZoom(-1)} aria-label={t('transport.zoomOut')} title={`${t('transport.zoomOut')} (${t('keys.ctrl')}+−)`}>
          −
        </button>
        <span>{t('transport.zoom', { value: `${formatNumber(zoom * 100, locale)} %` })}</span>
        <button type="button" onClick={() => onZoom(1)} aria-label={t('transport.zoomIn')} title={`${t('transport.zoomIn')} (${t('keys.ctrl')}+=)`}>
          +
        </button>
      </div>
      <output ref={position} className="clock" aria-label={t('transport.position')} />
    </>
  );
}
