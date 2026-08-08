import React from 'react';
import { Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { hapticMedium } from '../haptics';

export default function FAB({
  onClick,
  label = 'Yangi',
  className,
  icon,
}: {
  onClick: () => void;
  label?: string;
  className?: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        void hapticMedium();
        onClick();
      }}
      className={cn(
        'fixed z-[60] right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))]',
        'min-h-[56px] min-w-[56px] rounded-full bg-primary text-primary-foreground',
        'shadow-lg shadow-primary/35 flex items-center justify-center gap-2 px-5',
        'active:scale-95 transition-transform font-bold',
        className,
      )}
    >
      {icon ?? <Plus size={24} strokeWidth={2.5} />}
      <span className="text-sm">{label}</span>
    </button>
  );
}
