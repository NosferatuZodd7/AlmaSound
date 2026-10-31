import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AudioEngine } from '../../audio/engine';
import { BPM_RANGE } from '../../core/timeline';
import { formatDuration, formatNumber } from '../../i18n/format';
import { IconButton } from './IconButton';

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
  const ctrl = t('keys.ctrl');
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
      <div className="transport">
        <IconButton
          icon={playing ? 'pause' : 'play'}
          label={playing ? t('transport.pause') : t('transport.play')}
          shortcut={t('keys.space')}
          keys="Space"
          variant="play"
          testId="play"
          onClick={() => engine.toggle()}
        />
        <IconButton icon="restart" label={t('transport.restart')} shortcut={t('keys.home')} keys="Home" onClick={onRestart} />
      </div>
      <output ref={position} className="badge" aria-label={t('transport.position')} data-testid="clock" />
      <div className="bpm">
        <label className="field-label" htmlFor="bpm">
          {t('transport.bpm')}
        </label>
        <input
          id="bpm"
          className="input input-mono"
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
      <div className="zoom" role="group" aria-label={t('shortcuts.zoom')}>
        <IconButton icon="minus" variant="ghost" label={t('transport.zoomOut')} shortcut={`${ctrl}+−`} onClick={() => onZoom(-1)} />
        <span className="zoom-value">{`${formatNumber(zoom * 100, locale)} %`}</span>
        <IconButton icon="plus" variant="ghost" label={t('transport.zoomIn')} shortcut={`${ctrl}+=`} onClick={() => onZoom(1)} />
      </div>
    </>
  );
}
