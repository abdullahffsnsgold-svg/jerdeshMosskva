'use client';

import { useRef, useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Keyboard } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';

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

// Заглушка, если файл не загрузился
function FallbackUI() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-gray-600">
      <svg className="w-20 h-20 mb-4 opacity-20" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
      <p className="text-sm font-medium">Контент недоступен</p>
    </div>
  );
}

export default function StoriesModal({ stories, activeIndex, onClose }: StoriesModalProps) {
  if (!stories || stories.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-[120] text-3xl text-white transition hover:opacity-70 sm:right-8 sm:top-8"
      >
        ✕
      </button>

      <Swiper
        initialSlide={activeIndex}
        centeredSlides={true}
        slidesPerView={'auto'}
        spaceBetween={20}
        navigation={true}
        keyboard={{ enabled: true, onlyInViewport: true }}
        speed={600}
        modules={[Navigation, Keyboard]}
        className="stories-swiper !w-full !h-full flex items-center"
      >
        {stories.map((story) => (
          <SwiperSlide key={story.id} className="!w-auto flex items-center justify-center">
            {({ isActive }) => (
              <StoryCard story={story} isActive={isActive} />
            )}
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}

function StoryCard({ story, isActive }: { story: Story; isActive: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.play().catch(() => setHasError(true));
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  }, [isActive]);

  const isVideo = story.media_type === 'video' || VIDEO_EXTENSIONS.test(story.media_url ?? '');

  return (
    <div className={`relative overflow-hidden rounded-[24px] shadow-2xl transition-all duration-700 ease-in-out bg-black flex items-center justify-center
      ${isActive
        ? 'h-[70dvh] w-[88vw] max-w-[420px] opacity-100 scale-100 sm:h-[750px] sm:w-[420px]'
        : 'h-[70dvh] w-[88vw] max-w-[420px] opacity-30 scale-[0.6] blur-[2px] sm:h-[750px] sm:w-[420px]'}`}>

      {hasError ? (
        <FallbackUI />
      ) : isVideo ? (
        <video
          ref={videoRef}
          src={story.media_url}
          className="w-full h-full object-contain"
          muted
          loop
          playsInline
          preload="metadata"
          onError={() => setHasError(true)}
          onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.1; }}
        />
      ) : (
        <img
          src={story.media_url}
          className="w-full h-full object-contain"
          alt={story.title || 'Сторис'}
          onError={() => setHasError(true)}
        />
      )}

      {isActive && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/10 to-transparent p-4 text-white sm:p-8">
          <div className="pointer-events-auto">
            <h2 className="mb-2 text-lg font-bold drop-shadow-md sm:mb-3 sm:text-2xl">{story.title || 'Сторис'}</h2>
            <p className="mb-4 line-clamp-3 text-[13px] leading-relaxed text-white/90 drop-shadow-md sm:mb-6 sm:text-[15px]">
              {story.text || "Описание сторис..."}
            </p>
            <button className="w-full rounded-xl bg-[#2B41B7] py-3 font-bold transition-all hover:bg-[#1f308a] active:scale-[0.98] sm:py-4">
              Открыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
