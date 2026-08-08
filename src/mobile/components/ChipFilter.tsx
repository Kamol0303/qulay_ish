import React from 'react';
import { cn } from '../../lib/utils';
import { hapticLight } from '../haptics';

export type ChipOption = { id: string; label: string };

export default function ChipFilter({
  options,
  value,
  onChange,
  className,
}: {
  options: ChipOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              void hapticLight();
              onChange(opt.id);
            }}
            className={cn(
              'shrink-0 min-h-[40px] px-4 rounded-full text-sm font-semibold border transition-colors',
              active
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
