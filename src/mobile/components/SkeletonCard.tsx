import React from 'react';
import { cn } from '../../lib/utils';

export default function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-border bg-card p-4 space-y-3 animate-pulse', className)}>
      <div className="h-4 w-2/3 rounded-lg bg-muted" />
      <div className="h-3 w-full rounded-lg bg-muted" />
      <div className="h-3 w-4/5 rounded-lg bg-muted" />
      <div className="flex gap-2 pt-1">
        <div className="h-8 w-20 rounded-full bg-muted" />
        <div className="h-8 w-16 rounded-full bg-muted" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
