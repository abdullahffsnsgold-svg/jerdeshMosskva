'use client';

import { useState, useEffect, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import { supabase } from '@/lib/supabase';
import { normalizePhone } from '@/lib/phone';
import { captureEvent } from '@/lib/analytics';
import { Upload, X, Loader2, Heart, Plus, User } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import AuthModal from '@/app/components/AuthModal';
import PageNav from '@/app/components/PageNav';

interface Category { id: number; name: string; }

const VIDEO_EXTENSIONS = /\.(mp4|mov|webm)(\?.*)?$/i;

export default function CreateAdPage() {
    const router = useRouter();
    const [categories, setCategories] = useState<Category[]>([]);
    const [images, setImages] = useState<string[]>([]);
    const [isLoadingMain, setIsLoadingMain] = useState(false);
    const [isImageLoading, setIsImageLoading] = useState(false);
    const [mode, setMode] = useState<'ad' | 'story'>('ad');

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [location, setLocation] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerNumber, setCustomerNumber] = useState('');
    const [isAuthOpen, setIsAuthOpen] = useState(false);

    useEffect(() => {
        async function fetchCategories() {
            const { data } = await supabase.from('categories').select('*');
            if (data) setCategories(data as Category[]);
        }
        fetchCategories();
    }, []);

    const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        setIsImageLoading(true);
        const file = e.target.files[0];
        const bucket = mode === 'ad' ? 'products' : 'stories';
        const cleanName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;

        const { error } = await supabase.storage.from(bucket).upload(cleanName, file);
        if (!error) {
            const { data } = supabase.storage.from(bucket).getPublicUrl(cleanName);
            setImages((prev) => mode === 'ad' ? [...prev, data.publicUrl] : [data.publicUrl]);
        } else {
            toast.error("Ошибка загрузки фото", { description: error.message });
        }
        setIsImageLoading(false);
    };

    const handleCancel = () => {
        router.back();
    };

    const handleSubmit = async () => {
        // 1. ПРОВЕРКА ФОТО (ОБЯЗАТЕЛЬНО)
        if (images.length === 0) {
            toast.warning("Нет фото", { description: "Загрузите хотя бы одну фотографию." });
            return;
        }

        // 2. ПРОВЕРКА НОМЕРА
        const cleanNumber = normalizePhone(customerNumber);
        if (cleanNumber.length < 10) {
            toast.warning("Неверный номер", { description: "Введите корректный номер телефона" });
            return;
        }

        if (mode === 'ad' && (!title || !categoryId || !location)) {
            toast.warning("Заполните форму", { description: "Заголовок, категория и локация обязательны!" });
            return;
        }

        if (mode === 'story' && !title) {
            toast.warning("Заполните форму", { description: "Заголовок обязателен!" });
            return;
        }

        setIsLoadingMain(true);

        if (mode === 'ad') {
            const { error } = await supabase.from('products').insert([{
                title,
                description,
                price: Number(price) || 0,
                category_id: Number(categoryId),
                location,
                customer_name: customerName,
                customer_number: cleanNumber,
                image_url: images[0]
            }]);

            if (error) toast.error("Ошибка", { description: error.message });
            else {
                // Ключевое событие воронки — публикация объявления
                captureEvent('listing_published', { mode: 'ad', category_id: Number(categoryId), price: Number(price) || 0 });
                toast.success("Успешно!", { description: "Объявление опубликовано" });
                router.push('/');
            }
        } else {
            const { error } = await supabase.from('user_stories').insert([{
                media_url: images[0],
                media_type: VIDEO_EXTENSIONS.test(images[0]) ? 'video' : 'image',
                title: title,
                text: description,
                customer_number: cleanNumber
            }]);

            if (error) toast.error("Ошибка", { description: error.message });
            else {
                // Ключевое событие воронки — публикация сторис
                captureEvent('listing_published', { mode: 'story' });
                toast.success("Успешно!", { description: "Сторис опубликован" });
                router.push('/');
            }
        }
        setIsLoadingMain(false);
    };

    return (
        <div className="min-h-screen bg-white text-[#08004D]">
            <header className="border-b border-gray-100">
                <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between sm:h-20">
                        <div className="flex items-center gap-3">
                            <div className="flex gap-1 text-[#2B41B7]"></div>
                            <span>
                                <img src="/logo.svg" alt="Jerdesh" className="h-8 w-auto sm:h-10" />
                            </span>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-4">
                            <Link href="/create-ad">
                                <button className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-[#3B51D5] px-3 py-2.5 text-xs font-medium text-white transition-colors hover:bg-[#2B41B7] sm:px-5 sm:text-sm">
                                    <Plus className="h-4 w-4" />
                                    <span className="hidden sm:inline">Опубликовать объявление</span>
                                    <span className="sm:hidden">Опубликовать</span>
                                </button>
                            </Link>

                            <Link
                                href="/favorites"
                                aria-label="Избранные"
                                className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#FFD214] px-3 py-2.5 text-sm font-medium text-[#FFD214] transition-colors hover:bg-[#FFD214]/5 sm:px-5"
                            >
                                <Heart className="h-4 w-4 fill-none" />
                                <span className="hidden sm:inline">Избранные</span>
                            </Link>

                            <button onClick={() => setIsAuthOpen(true)} className="flex min-h-[44px] items-center gap-2 rounded-full border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">
                                Войти
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                                    <User className="h-4 w-4" />
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                <PageNav items={[{ label: 'Главная', href: '/' }, { label: 'Создать' }]} />

                <div className="mb-8 flex max-w-md rounded-2xl bg-gray-100 p-1">
                    <button onClick={() => { setMode('ad'); setImages([]); }} className={`flex-1 py-3 rounded-xl font-bold transition-all ${mode === 'ad' ? 'bg-white shadow-sm text-[#2B41B7]' : 'text-gray-500'}`}>Объявление</button>
                    <button onClick={() => { setMode('story'); setImages([]); }} className={`flex-1 py-3 rounded-xl font-bold transition-all ${mode === 'story' ? 'bg-white shadow-sm text-[#2B41B7]' : 'text-gray-500'}`}>Сторис</button>
                </div>

                <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12">
                    <div className="space-y-6">
                        <div className="flex flex-wrap gap-4">
                            {images.map((url, i) => (
                                <div key={i} className="relative w-32 h-32 rounded-2xl overflow-hidden border">
                                    <img src={url} alt="ad" className="w-full h-full object-cover" />
                                    <button onClick={() => setImages(images.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-black/50 rounded-full p-1 text-white"><X size={14} /></button>
                                </div>
                            ))}
                            {(isImageLoading ? (
                                <div className="w-32 h-32 bg-gray-50 rounded-2xl flex items-center justify-center border-2 border-dashed border-gray-200">
                                    <Loader2 className="animate-spin text-gray-400" size={24} />
                                </div>
                            ) : (mode === 'ad' && images.length < 4) || (mode === 'story' && images.length < 1) ? (
                                <div className="relative w-32 h-32 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center hover:border-[#2B41B7]">
                                    <Upload size={24} className="text-gray-400" />
                                    <input type="file" accept={mode === 'story' ? 'image/*,video/*' : 'image/*'} className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} />
                                </div>
                            ) : null)}
                        </div>

                        {mode === 'ad' && <input placeholder="Метро / Локация" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full p-4 rounded-2xl bg-gray-50 outline-none" />}
                        {mode === 'ad' && (
                            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full p-4 rounded-2xl bg-gray-50 border-none outline-none">
                                <option value="">Выберите категорию</option>
                                {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                            </select>
                        )}
                        <input placeholder={mode === 'ad' ? "Заголовок объявления" : "Заголовок сторис"} value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-4 rounded-2xl bg-gray-50 outline-none" />
                        <textarea placeholder={mode === 'ad' ? "Описание" : "Текст сториса"} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-4 h-32 rounded-2xl bg-gray-50 outline-none resize-none" />
                    </div>

                    <div className="space-y-6">
                        {mode === 'ad' && (
                            <>
                                <input placeholder="Имя клиента" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full p-4 rounded-2xl bg-gray-50 outline-none" />
                                <input type="number" placeholder="Цена" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full p-4 rounded-2xl bg-gray-50 outline-none" />
                            </>
                        )}
                        <label className="text-sm ml-2 text-gray-500">Номер телефона</label>
                        <PhoneInput defaultCountry="kg" value={customerNumber} onChange={setCustomerNumber} />

                        <div className="flex flex-col-reverse gap-3 pt-6 sm:flex-row sm:gap-4">
                            <button onClick={handleSubmit} disabled={isLoadingMain} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#2B41B7] px-8 py-3 font-semibold text-white hover:bg-[#1d039e] disabled:opacity-60 sm:w-auto">
                                {isLoadingMain && <Loader2 className="animate-spin" size={20} />}
                                {isLoadingMain ? 'Публикация...' : 'Опубликовать'}
                            </button>
                            <button onClick={handleCancel} className="w-full rounded-full border border-gray-200 px-8 py-3 text-[#08004D] hover:bg-gray-50 sm:w-auto">Отмена</button>
                        </div>
                    </div>
                </div>
            </main>

            <AuthModal
                isOpen={isAuthOpen}
                onClose={() => setIsAuthOpen(false)}
                onSwitchToRegister={() => {
                    setIsAuthOpen(false);
                    router.push('/');
                }}
                onSwitchToForgot={() => {
                    setIsAuthOpen(false);
                    router.push('/');
                }}
            />
        </div>
    );
}
