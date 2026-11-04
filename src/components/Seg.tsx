import type { ReactNode } from 'react';

/** Segmented control: one button per option, the chosen one highlighted. */
export function Seg<T extends string | number | boolean>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg small">
      {options.map((o) => (
        <button key={String(o.value)} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
