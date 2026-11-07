'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function CommentForm({ productId }: { productId: string }) {
  const [text, setText] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    await supabase.from('comments').insert({
      product_id: productId,
      text: text,
      username: 'Гость'
    });
    
    setText('');
    router.refresh(); // Обновляет страницу, чтобы показать новый комментарий
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input 
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="flex-1 h-[54px] rounded-full bg-[#efefef] px-6 outline-none"
        placeholder="Написать комментарий..."
      />
      <button type="submit" className="w-[54px] h-[54px] rounded-full bg-[#5B5BFF] text-white">↑</button>
    </form>
  );
}