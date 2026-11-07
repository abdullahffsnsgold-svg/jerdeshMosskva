'use client';

import { useState, useEffect, ChangeEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { captureEvent } from '@/lib/analytics';
import { Upload, X, Loader2, Film, Image as ImageIcon } from 'lucide-react';
import PageNav from '@/app/components/PageNav';

export default function CreateStoryPage() {
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);

    // Освобождаем blob-ссылку, когда превью больше не нужно
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    // Обработка выбора файла и создание превью
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
        }
    };

    const handleReset = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setFile(null);
        setPreviewUrl(null);
        setText('');
    };

    const handleSubmit = async () => {
        if (!file) return alert("Пожалуйста, выберите фото или видео");

        setLoading(true);

        try {
            // 1. Определяем media_type
            const mediaType = file.type.startsWith('video/') ? 'video' : 'image';

            // 2. Загружаем файл в бакет 'stories'
            const cleanName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            const { error: uploadError } = await supabase.storage
                .from('stories')
                .upload(cleanName, file);

            if (uploadError) throw uploadError;

            // 3. Получаем публичную ссылку
            const { data: { publicUrl } } = supabase.storage.from('stories').getPublicUrl(cleanName);

            // 4. Записываем данные в таблицу 'user_stories'
            const { error: dbError } = await supabase.from('user_stories').insert([
                {
                    media_url: publicUrl,
                    media_type: mediaType,
                    // Заголовок нужен карточке сторис в ленте
                    title: text.trim().slice(0, 40) || 'Сторис',
                    text: text,
                    user_id: null // Добавим авторизацию позже
                }
            ]);

            if (dbError) throw dbError;

            // Ключевое событие воронки — публикация сторис
            captureEvent('listing_published', { mode: 'story' });

            alert("Сторис успешно опубликован!");
            handleReset();

        } catch (error) {
            console.error(error);
            const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
            alert("Ошибка: " + message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 text-[#08004D] pb-10">
            {/* Шапка */}
            <header className="bg-white border-b border-gray-100 p-4">
                <div className="max-w-xl mx-auto flex items-center justify-center">
                    <h1 className="text-lg font-bold">Создать сторис</h1>
                </div>
            </header>

            <main className="max-w-xl mx-auto p-4 mt-4 sm:mt-6">
                <PageNav items={[{ label: 'Главная', href: '/' }, { label: 'Создать сторис' }]} />
                <div className="bg-white rounded-3xl shadow-sm p-6 space-y-6">

                    {/* Зона загрузки / Предпросмотр */}
                    <div className="relative w-full aspect-[9/16] max-h-[500px] bg-gray-100 rounded-2xl overflow-hidden border-2 border-dashed border-gray-200 flex flex-col items-center justify-center">
                        {previewUrl ? (
                            <>
                                {file?.type.startsWith('video/') ? (
                                    <video src={previewUrl} className="w-full h-full object-cover" controls />
                                ) : (
                                    <img src={previewUrl} className="w-full h-full object-cover" alt="preview" />
                                )}
                                <button
                                    onClick={handleReset}
                                    className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
                                >
                                    <X size={20} />
                                </button>
                            </>
                        ) : (
                            <label className="flex flex-col items-center cursor-pointer p-10 text-center">
                                <div className="bg-[#2B41B7]/10 p-4 rounded-full mb-4">
                                    <Upload className="text-[#2B41B7]" size={32} />
                                </div>
                                <span className="font-semibold text-lg">Загрузить медиа</span>
                                <p className="text-gray-400 text-sm mt-2">Фото или видео (до 15 сек рекомендуемо)</p>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*,video/*"
                                    onChange={handleFileChange}
                                />
                            </label>
                        )}
                    </div>

                    {/* Поле для текста */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-500 ml-1">Текст сториса (подпись)</label>
                        <textarea
                            placeholder="Введите текст (например, #Срочно или Ищу работу)..."
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-[#2B41B7]/20 resize-none h-24"
                        />
                    </div>

                    {/* Кнопки действий */}
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={handleSubmit}
                            disabled={loading || !file}
                            className="w-full bg-[#2B41B7] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#1d039e] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    <span>Публикация...</span>
                                </>
                            ) : (
                                <span>Опубликовать сторис</span>
                            )}
                        </button>

                        <button
                            onClick={handleReset}
                            className="w-full py-4 text-gray-500 font-medium hover:bg-gray-50 rounded-2xl transition-all"
                        >
                            Отмена
                        </button>
                    </div>
                </div>

                {/* Подсказки */}
                <div className="mt-6 grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-4 rounded-2xl flex items-center gap-3">
                        <ImageIcon className="text-[#2B41B7]" size={20} />
                        <span className="text-xs text-[#2B41B7] font-medium">Вертикальные фото выглядят лучше</span>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-2xl flex items-center gap-3">
                        <Film className="text-purple-600" size={20} />
                        <span className="text-xs text-purple-600 font-medium">Видео не должно быть тяжелым</span>
                    </div>
                </div>
            </main>
        </div>
    );
}
