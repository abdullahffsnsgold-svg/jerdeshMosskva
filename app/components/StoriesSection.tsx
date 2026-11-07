'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import StoriesModal, { type Story } from './StoriesModal';

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

    return (
        <>
            <section className="border-b border-gray-100 py-6 sm:py-10">
                <div className="mx-auto flex max-w-[1400px] gap-5 overflow-x-auto px-4 scrollbar-hide sm:gap-8 sm:px-6">
                    {stories.map((story, idx) => (
                        <div
                            key={story.id}
                            className="flex flex-col items-center gap-4 cursor-pointer group"
                            onClick={() => setModalState({ open: true, index: idx })}
                        >
                            <div className="h-20 w-20 overflow-hidden rounded-full border-4 border-[#2B41B7] p-[3px] transition group-hover:scale-105 sm:h-24 sm:w-24">
                                <img src={story.media_url} alt={story.title || 'Сторис'} className="w-full h-full object-cover rounded-full" />
                            </div>
                            <span className="text-xs font-semibold text-gray-800 sm:text-sm">{story.title || 'Сторис'}</span>
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
