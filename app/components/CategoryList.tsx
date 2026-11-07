'use client';

import { Star, ShoppingBag } from 'lucide-react';

export interface Category {
  id: number;
  name: string;
  count: number;
}

interface CategoryListProps {
  categories: Category[];
  activeCategoryId: number | null;
  onSelectCategory: (id: number | null) => void;
}

const colorPalette = [
  'bg-[#EEEDFC] text-[#4343D9]',
  'bg-[#EAF9E6] text-[#34A853]',
  'bg-[#F9E6FA] text-[#C325D3]',
  'bg-[#FFEFE6] text-[#FF7A00]',
  'bg-[#F2F9E6] text-[#82D325]',
  'bg-[#FCE6F2] text-[#D32588]',
  'bg-[#E6F5FC] text-[#25A2D3]',
  'bg-[#FCE6E6] text-[#EA4335]',
];

export default function CategoryList({ categories, activeCategoryId, onSelectCategory }: CategoryListProps) {
  return (
    <div className="w-full py-4 sm:py-6">
      {/* На мобильных — горизонтальная прокрутка, на широких экранах — перенос строк */}
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 scrollbar-hide sm:mx-0 sm:flex-wrap sm:items-center sm:gap-6 sm:overflow-visible sm:px-0">
        <button
          type="button"
          onClick={() => onSelectCategory(null)}
          aria-pressed={activeCategoryId === null}
          className={`flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80 ${
            activeCategoryId === null ? 'opacity-100' : 'opacity-60'
          }`}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF9E6] text-[#FFCC00]">
            <Star size={18} fill="currentColor" />
          </span>
          <span
            className={`text-[14px] font-semibold text-[#FFCC00] ${
              activeCategoryId === null ? 'underline decoration-2 underline-offset-4' : ''
            }`}
          >
            Все
          </span>
        </button>

        {categories.map((cat, index) => {
          const isActive = activeCategoryId === cat.id;

          return (
            <button
              type="button"
              key={cat.id}
              onClick={() => onSelectCategory(isActive ? null : cat.id)}
              aria-pressed={isActive}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap transition-opacity hover:opacity-80 ${
                isActive ? 'opacity-100' : 'opacity-70'
              }`}
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${colorPalette[index % colorPalette.length]}`}>
                <ShoppingBag size={18} />
              </span>
              <span
                className={`text-[14px] font-medium text-[#1F1F1F] ${
                  isActive ? 'underline decoration-2 underline-offset-4' : ''
                }`}
              >
                {cat.name} <span className="font-normal text-[#8E8E93]">({cat.count})</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
