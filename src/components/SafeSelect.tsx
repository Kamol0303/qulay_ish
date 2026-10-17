import React, { useMemo, useState } from 'react';

type Option = { value: string; label: string };

type Props = {
  id?: string;
  value?: string | number;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  onChange?: (event: { target: { value: string } }) => void;
  children?: React.ReactNode;
};

function flatten(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flatten).join('');
  if (React.isValidElement(node)) return flatten((node.props as { children?: React.ReactNode }).children);
  return '';
}

function readOptions(children: React.ReactNode): Option[] {
  const options: Option[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const props = child.props as { value?: string | number; children?: React.ReactNode };
    if (child.type === React.Fragment) {
      options.push(...readOptions(props.children));
      return;
    }
    if (child.type === 'option') {
      options.push({
        value: props.value == null ? '' : String(props.value),
        label: flatten(props.children).trim(),
      });
    }
  });
  return options;
}

/**
 * In-page choice list. A native <select> opens the Android picker and closes
 * the APK on some phones, so every dropdown in the app uses this instead.
 */
export default function SafeSelect({ id, value, disabled, required, className, onChange, children }: Props) {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => readOptions(children), [children]);
  const current = String(value ?? '');
  const selected = options.find((option) => option.value === current);
  const label = selected?.label || options.find((option) => option.value === '')?.label || options[0]?.label || '';

  return (
    <div className="min-w-0">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-required={required || undefined}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className={className}
      >
        <span className="flex items-center justify-between gap-2 text-left">
          <span className="truncate">{label}</span>
          <span aria-hidden="true" className="shrink-0 text-xs opacity-70">{open ? '▴' : '▾'}</span>
        </span>
      </button>
      {open && !disabled && (
        <div role="listbox" className="mt-2 max-h-64 overflow-y-auto grid grid-cols-1 gap-2">
          {options.map((option, index) => {
            const active = option.value === current;
            return (
              <button
                key={`${option.value}-${index}`}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange?.({ target: { value: option.value } });
                  setOpen(false);
                }}
                className={`min-h-[44px] w-full rounded-xl border px-4 py-2 text-left text-sm font-semibold ${
                  active
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-200 bg-white text-slate-900'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
