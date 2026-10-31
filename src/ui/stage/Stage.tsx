import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { AudioEngine } from '../../audio/engine';
import type { ProjectStore } from '../projectStore';
import { ZOOM } from '../projectStore';
import { drawStage, type DragView } from './drawStage';
import { hitTest, midiOfY, stageGeometry } from './geometry';

type Drag =
  | ({ kind: 'note' } & DragView)
  | { kind: 'scrub'; x0: number; from: number; moved: boolean; chordIndex: number | null };

interface Props {
  store: ProjectStore;
  engine: AudioEngine;
}

/** Canvas with the voice lines. Draws every frame from the store and the audio clock, outside React. */
export function Stage({ store, engine }: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const c = canvas.getContext('2d')!;
    let size = { w: 0, h: 0 };
    let drag: Drag | null = null;
    let raf = 0;

    const geometry = () => stageGeometry(size.w, size.h, store.getState().zoom);
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      size = { w: r.width, h: r.height };
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const frame = () => {
      const s = store.getState();
      drawStage(c, geometry(), s.song, s.bpm, engine.position(), drag?.kind === 'note' ? drag : null);
      raf = requestAnimationFrame(frame);
    };
    const point = (e: PointerEvent | WheelEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const { x, y } = point(e);
      const s = store.getState();
      const now = engine.position();
      const hit = hitTest(geometry(), s.song, s.bpm, now, x, y);
      canvas.setPointerCapture(e.pointerId);
      if (hit && hit.voice !== null) {
        drag = { kind: 'note', chordIndex: hit.chordIndex, voice: hit.voice, x };
        store.startGesture();
        engine.preview(s.song.chords[hit.chordIndex].notes, hit.voice);
      } else {
        drag = { kind: 'scrub', x0: x, from: now, moved: false, chordIndex: hit?.chordIndex ?? null };
      }
    };
    const onMove = (e: PointerEvent) => {
      const { x, y } = point(e);
      const g = geometry();
      if (!drag) {
        const s = store.getState();
        const hit = hitTest(g, s.song, s.bpm, engine.position(), x, y);
        canvas.classList.toggle('over-line', hit?.voice != null);
        return;
      }
      if (drag.kind === 'scrub') {
        if (Math.abs(x - drag.x0) > 4) drag.moved = true;
        if (drag.moved && !engine.playing) engine.seek(drag.from - (x - drag.x0) / g.pps);
        return;
      }
      drag.x = x;
      if (store.editNote(drag.chordIndex, drag.voice, Math.round(midiOfY(g, y)))) {
        engine.preview(store.getState().song.chords[drag.chordIndex].notes, drag.voice);
      }
    };
    const onUp = () => {
      if (drag?.kind === 'scrub' && !drag.moved && drag.chordIndex !== null) {
        engine.preview(store.getState().song.chords[drag.chordIndex].notes);
      }
      if (drag?.kind === 'note') store.endGesture();
      drag = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) {
        store.zoomBy(e.deltaY < 0 ? ZOOM.step : 1 / ZOOM.step);
        return;
      }
      if (!engine.playing) engine.seek(engine.position() + (e.deltaY + e.deltaX) / geometry().pps);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [store, engine]);

  return <canvas ref={ref} className="stage" role="img" aria-label={t('stage.label')} data-testid="stage" />;
}
