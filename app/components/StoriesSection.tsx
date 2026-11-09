'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import StoriesModal, { type Story } from './StoriesModal';

const VIDEO_EXTENSIONS = /\.(mp4|mov|webm)(\?.*)?$/i;

function isVideoStory(story: Story) {
    return story.media_type === 'video' || VIDEO_EXTENSIONS.test(story.media_url ?? '');
}

export default function StoriesSection() {
    const [stories, setStories] = useState<Story[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalState, setModalState] = useState({ open: false, index: 0 });

    useEffect(() => {
        let cancelled = false;

        const fetchStories = async () => {
            const { data, error } = await supabase.from('user_stories').select('*').order('id', { ascending: false });

            if (cancelled) return;

            if (error) console.error('Ошибка загрузки сторис:', error);

            setStories((data as Story[] | null) ?? []);
            setLoading(false);
        };

        fetchStories();

        return () => {
            cancelled = true;
        };
    }, []);

    if (loading) return <div className="py-12 text-center text-gray-500">Загрузка...</div>;
    if (stories.length === 0) return null;

    const openStory = (index: number) => setModalState({ open: true, index });

    return (
        <>
            <section className="border-b border-gray-100 py-5 sm:py-8">
                <div className="mx-auto flex max-w-[1400px] gap-4 overflow-x-auto px-4 pb-1 scrollbar-hide sm:gap-6 sm:px-6">
                    {stories.map((story, idx) => (
                        <div
                            key={story.id}
                            className="flex w-[86px] shrink-0 flex-col items-center gap-2 sm:w-[104px]"
                        >
                            <button
                                type="button"
                                onClick={() => openStory(idx)}
                                aria-label={`Открыть сторис «${story.title || 'Сторис'}»`}
                                className="h-20 w-20 shrink-0 rounded-full bg-gradient-to-tr from-[#F9CE34] via-[#EE2A7B] to-[#6228D7] p-[3px] transition active:scale-95 sm:h-24 sm:w-24"
                            >
                                <span className="block h-full w-full overflow-hidden rounded-full border-2 border-white bg-gray-100">
                                    {isVideoStory(story) ? (
                                        <video
                                            src={story.media_url}
                                            className="h-full w-full object-cover"
                                            muted
                                            playsInline
                                            preload="metadata"
                                        />
                                    ) : (
                                        <img
                                            src={story.media_url}
                                            alt={story.title || 'Сторис'}
                                            className="h-full w-full object-cover"
                                        />
                                    )}
                                </span>
                            </button>

                            <span className="w-full truncate text-center text-[11px] font-semibold text-gray-800 sm:text-sm">
                                {story.title || 'Сторис'}
                            </span>

                            <button
                                type="button"
                                onClick={() => openStory(idx)}
                                className="min-h-[36px] rounded-full bg-[#2B41B7] px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#1f308a] active:scale-95"
                            >
                                Открыть
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            {modalState.open && (
                <StoriesModal
                    stories={stories}
                    activeIndex={modalState.index}
                    onClose={() => setModalState({ open: false, index: 0 })}
                />
            )}
        </>
    );
}
