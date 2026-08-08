import React from 'react';
import { cn } from '../../lib/utils';

export default function MobileCard({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick();
            }
          : undefined
      }
      className={cn(
        'rounded-2xl bg-card border border-border/80 shadow-sm p-4 active:scale-[0.99] transition-transform',
        onClick && 'cursor-pointer min-h-[44px]',
        className,
      )}
    >
      {children}
    </div>
  );
}
