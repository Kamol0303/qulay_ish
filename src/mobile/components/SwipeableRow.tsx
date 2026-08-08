import React, { useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { hapticLight } from '../haptics';

export default function SwipeableRow({
  children,
  onSwipeLeft,
  leftLabel = 'O‘chirish',
  className,
}: {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  leftLabel?: string;
  className?: string;
}) {
  const startX = useRef(0);
  const [offset, setOffset] = useState(0);

  if (!onSwipeLeft) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={cn('relative overflow-hidden rounded-2xl', className)}>
      <div className="absolute inset-y-0 right-0 w-28 bg-destructive text-destructive-foreground flex items-center justify-center font-bold text-sm">
        {leftLabel}
      </div>
      <div
        className="relative bg-card transition-transform"
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={(e) => {
          startX.current = e.touches[0]?.clientX ?? 0;
        }}
        onTouchMove={(e) => {
          const x = e.touches[0]?.clientX ?? 0;
          const dx = x - startX.current;
          if (dx < 0) setOffset(Math.max(dx, -112));
          else setOffset(0);
        }}
        onTouchEnd={() => {
          if (offset < -72) {
            void hapticLight();
            onSwipeLeft();
          }
          setOffset(0);
        }}
      >
        {children}
      </div>
    </div>
  );
}
