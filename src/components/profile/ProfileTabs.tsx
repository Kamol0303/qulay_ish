import { cn } from '../../lib/utils';
import type { ProfileTab } from '../../types';

export interface TabItem {
  id: ProfileTab;
  label: string;
}

export function ProfileTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem[];
  active: ProfileTab;
  onChange: (id: ProfileTab) => void;
}) {
  return (
    <div
      className="sticky top-0 z-20 -mx-1 overflow-x-auto border-b border-border bg-background/95 px-1 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      role="tablist"
      aria-label="Profil bo'limlari"
    >
      <div className="flex min-w-max gap-1 py-2">
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(tab.id)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
