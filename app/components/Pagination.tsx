interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 mt-10">
      <button
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="w-12 h-12 rounded-full border flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 transition"
      >
        {"<"}
      </button>

      {[...Array(totalPages)].map((_, i) => (
        <button
          key={i}
          onClick={() => onPageChange(i + 1)}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            currentPage === i + 1 ? 'bg-blue-600 text-white shadow-lg' : 'border hover:bg-gray-50'
          }`}
        >
          {i + 1}
        </button>
      ))}
      <button
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="w-12 h-12 rounded-full border flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 transition"
      >
        {">"}
      </button>
    </div>
  );
}
