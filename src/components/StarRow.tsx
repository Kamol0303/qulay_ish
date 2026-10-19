import { Star } from 'lucide-react';

/** Five stars filled up to the saved rating. */
export default function StarRow({
  rating,
  count,
  size = 14,
}: {
  rating?: number | null;
  count?: number | null;
  size?: number;
}) {
  const value = Number(rating) || 0;
  const filled = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className="inline-flex items-center gap-0.5 text-yellow-500">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          fill={star <= filled ? 'currentColor' : 'none'}
          className={star <= filled ? '' : 'text-gray-300'}
        />
      ))}
      {value > 0 ? <span className="ml-1 text-sm font-bold text-gray-900">{value}</span> : null}
      {count != null ? <span className="ml-1 text-xs text-gray-400">({count})</span> : null}
    </span>
  );
}
