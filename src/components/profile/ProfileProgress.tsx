import { CheckCircle2, Circle } from 'lucide-react';
import type { CompletionItem } from '../../lib/profileCompletion';
import { ProfileCard } from './ProfileCard';

export function ProfileProgress({
  percent,
  items,
}: {
  percent: number;
  items: CompletionItem[];
}) {
  return (
    <ProfileCard title="Profil to'liqligi" description={`${percent}% tayyor`}>
      <div className="mb-4 h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            {item.done ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className={item.done ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
          </li>
        ))}
      </ul>
    </ProfileCard>
  );
}
