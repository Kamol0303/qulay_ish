import { useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { SKILLS } from '../../constants/categories';
import { cn } from '../../lib/utils';

const EXTRA_SKILLS = [
  'Tozalash',
  'Ovqat pishirish',
  'Tikuvchilik',
  'O\'qituvchi',
  'Matematika',
  'Ingliz tili',
  'Rus tili',
  'Sartarosh',
  'Manikyur',
  'Bolalarga qarash',
  'Dasturlash',
  'Buxgalteriya',
  'Raqamli marketing',
];

export function SkillsSelector({
  value,
  onChange,
  editable = true,
}: {
  value: string[];
  onChange?: (skills: string[]) => void;
  editable?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState('');

  const catalog = useMemo(() => {
    const names = [...SKILLS.map((s) => s.name), ...EXTRA_SKILLS];
    return [...new Set(names)];
  }, []);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog
      .filter((name) => !value.includes(name))
      .filter((name) => !q || name.toLowerCase().includes(q))
      .slice(0, 12);
  }, [catalog, query, value]);

  const add = (skill: string) => {
    const next = skill.trim();
    if (!next || value.includes(next) || !onChange) return;
    onChange([...value, next]);
    setCustom('');
    setQuery('');
  };

  const remove = (skill: string) => {
    onChange?.(value.filter((s) => s !== skill));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {value.length === 0 && (
          <p className="text-sm text-muted-foreground">Hali ko\'nikma qo\'shilmagan</p>
        )}
        {value.map((skill) => (
          <span
            key={skill}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-800 dark:bg-slate-800 dark:text-slate-100"
          >
            {skill}
            {editable && (
              <button
                type="button"
                aria-label={`${skill} o'chirish`}
                onClick={() => remove(skill)}
                className="rounded-full p-0.5 hover:bg-black/10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
        ))}
      </div>

      {editable && (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ko'nikma qidirish..."
              className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((skill) => (
              <button
                key={skill}
                type="button"
                onClick={() => add(skill)}
                className={cn(
                  'rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition hover:border-primary hover:text-primary',
                )}
              >
                + {skill}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add(custom);
                }
              }}
              placeholder="O'zingiznikini yozing"
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => add(custom)}
              className="inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              Qo\'shish
            </button>
          </div>
        </>
      )}
    </div>
  );
}
