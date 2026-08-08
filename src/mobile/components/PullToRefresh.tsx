import React, { useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { hapticLight } from '../haptics';

export default function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
}) {
  const startY = useRef(0);
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);

  return (
    <div
      className="relative"
      onTouchStart={(e) => {
        if (window.scrollY <= 0) startY.current = e.touches[0]?.clientY ?? 0;
        else startY.current = 0;
      }}
      onTouchMove={(e) => {
        if (!startY.current || busy) return;
        const y = e.touches[0]?.clientY ?? 0;
        const dy = y - startY.current;
        if (dy > 0 && window.scrollY <= 0) setPull(Math.min(dy, 80));
      }}
      onTouchEnd={async () => {
        if (pull > 56 && !busy) {
          setBusy(true);
          void hapticLight();
          try {
            await onRefresh();
          } finally {
            setBusy(false);
          }
        }
        setPull(0);
        startY.current = 0;
      }}
    >
      <div
        className="flex justify-center items-center text-primary transition-all overflow-hidden"
        style={{ height: pull || (busy ? 36 : 0) }}
      >
        <RefreshCw size={20} className={busy || pull > 40 ? 'animate-spin' : ''} />
      </div>
      {children}
    </div>
  );
}
