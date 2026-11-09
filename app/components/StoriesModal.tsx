'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface Story {
  id: string | number;
  title?: string | null;
  text?: string | null;
  media_url: string;
  media_type?: string | null;
}

interface StoriesModalProps {
  stories: Story[];
  activeIndex: number;
  onClose: () => void;
}

const VIDEO_EXTENSIONS = /\.(mp4|mov|webm)(\?.*)?$/i;

/** Сколько показывается фото, прежде чем перелистнуть (как в инстаграме). */
const IMAGE_DURATION = 5000;

/** Доля ширины слева/справа, по которой тап листает назад/вперёд. */
const TAP_ZONE = 0.35;

/** Сдвиг пальца, который считается свайпом. */
const SWIPE_DISTANCE = 50;

/** Удержание дольше этого времени — пауза, а не перелистывание. */
const HOLD_DURATION = 300;

function isVideoStory(story: Story) {
  return story.media_type === 'video' || VIDEO_EXTENSIONS.test(story.media_url ?? '');
}

export default function StoriesModal({ stories, activeIndex, onClose }: StoriesModalProps) {
  const [index, setIndex] = useState(activeIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hasError, setHasError] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef(0);
  const gesture = useRef({ startX: 0, startY: 0, startedAt: 0, moved: false });

  const story = stories[index];
  const isVideo = story ? isVideoStory(story) : false;

  const goTo = useCallback(
    (next: number) => {
      if (next < 0) {
        // Первый сторис: остаёмся на нём и начинаем показ заново
        setIndex(0);
        setProgress(0);
        progressRef.current = 0;
        return;
      }

      if (next >= stories.length) {
        onClose();
        return;
      }

      setIndex(next);
      setProgress(0);
      progressRef.current = 0;
      setHasError(false);
    },
    [onClose, stories.length],
  );

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  // Автоперелистывание фото: прогресс считается по кадрам, поэтому пауза честная
  useEffect(() => {
    if (!story || isVideo || paused) return;

    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const delta = now - last;
      last = now;

      progressRef.current = Math.min(100, progressRef.current + (delta / IMAGE_DURATION) * 100);
      setProgress(progressRef.current);

      if (progressRef.current >= 100) {
        next();
        return;
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [isVideo, next, paused, story]);

  // Видео: пауза по удержанию, звук выключен как в ленте
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (paused) {
      video.pause();
    } else {
      video.play().catch(() => setHasError(true));
    }
  }, [paused, index]);

  // Клавиатура: стрелки листают, Esc закрывает
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') next();
      if (event.key === 'ArrowLeft') prev();
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [next, onClose, prev]);

  // Пока открыт просмотр, страница под ним не прокручивается
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (!story) return null;

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    gesture.current = {
      startX: event.clientX,
      startY: event.clientY,
      startedAt: performance.now(),
      moved: false,
    };

    // Захватываем палец: иначе отпускание за пределами карточки оставит паузу навсегда
    event.currentTarget.setPointerCapture(event.pointerId);
    setPaused(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dx = event.clientX - gesture.current.startX;
    const dy = event.clientY - gesture.current.startY;

    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      gesture.current.moved = true;
    }
  };

  const endGesture = (event: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    const { startX, startY, startedAt, moved } = gesture.current;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const held = performance.now() - startedAt;

    setPaused(false);

    if (cancelled) return;

    // Свайп вниз — закрыть, как в инстаграме
    if (dy > 100 && Math.abs(dy) > Math.abs(dx)) {
      onClose();
      return;
    }

    // Свайп влево — следующий, вправо — предыдущий
    if (Math.abs(dx) > SWIPE_DISTANCE) {
      if (dx < 0) next();
      else prev();
      return;
    }

    // Пауза удержанием или случайное дрожание пальца — не листаем
    if (moved || held > HOLD_DURATION) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;

    if (x < TAP_ZONE) prev();
    else if (x > 1 - TAP_ZONE) next();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр сторис"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
    >
      <div
        className="relative h-[100dvh] w-full touch-none select-none overflow-hidden bg-black sm:h-[750px] sm:max-h-[calc(100dvh-48px)] sm:w-[420px] sm:rounded-[24px] sm:shadow-2xl"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => endGesture(event)}
        onPointerCancel={(event) => endGesture(event, true)}
      >
        {hasError ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gray-900 text-gray-500">
            <svg className="h-16 w-16 opacity-30" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
            <p className="text-sm font-medium">Контент недоступен</p>
          </div>
        ) : isVideo ? (
          <video
            ref={videoRef}
            key={story.id}
            src={story.media_url}
            className="pointer-events-none h-full w-full object-contain sm:object-cover"
            autoPlay
            muted
            playsInline
            preload="auto"
            onTimeUpdate={(event) => {
              const video = event.currentTarget;
              if (!video.duration) return;

              progressRef.current = (video.currentTime / video.duration) * 100;
              setProgress(progressRef.current);
            }}
            onEnded={next}
            onError={() => setHasError(true)}
          />
        ) : (
          <img
            key={story.id}
            src={story.media_url}
            className="pointer-events-none h-full w-full object-cover sm:object-contain"
            alt={story.title || 'Сторис'}
            onError={() => setHasError(true)}
          />
        )}

        {/* Затемнение сверху под прогресс и автора */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 to-transparent" />
        {/* Затемнение снизу под подпись */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

        {/* Полоски прогресса */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex gap-1 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          {stories.map((item, itemIndex) => (
            <span key={item.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
              <span
                className="block h-full rounded-full bg-white transition-[width] duration-100 ease-linear"
                style={{
                  width:
                    itemIndex < index ? '100%' : itemIndex === index ? `${progress}%` : '0%',
                }}
              />
            </span>
          ))}
        </div>

        {/* Автор и закрытие */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-3 px-3 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-[#F9CE34] via-[#EE2A7B] to-[#6228D7] p-[2px]">
            <span className="flex h-full w-full items-center justify-center rounded-full bg-black/60 text-xs font-bold text-white">
              {(story.title || 'S').slice(0, 1).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{story.title || 'Сторис'}</p>
            <p className="text-[11px] text-white/60">
              {index + 1} из {stories.length}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть сторис"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-white/90 transition hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        {/* Подпись */}
        {(story.title || story.text) && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] text-white">
            {story.title && (
              <h2 className="mb-1 text-base font-bold drop-shadow-sm sm:text-lg">{story.title}</h2>
            )}
            {story.text && (
              <p className="line-clamp-4 text-[13px] leading-relaxed text-white/85 sm:text-sm">
                {story.text}
              </p>
            )}
          </div>
        )}

        {/* Подсказка для десктопа: на телефоне и так понятно */}
        <div className="pointer-events-none absolute inset-x-0 bottom-3 hidden justify-center gap-2 text-[11px] text-white/50 sm:flex">
          <span>← предыдущий</span>
          <span>·</span>
          <span>следующий →</span>
        </div>
      </div>
    </div>
  );
}
