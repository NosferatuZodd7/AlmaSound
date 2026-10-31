interface Props<T extends string> {
  name: string;
  legend: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange(value: T): void;
}

/** Glass segmented control built on native radios (arrow keys and focus come for free). */
export function Segmented<T extends string>({ name, legend, value, options, onChange }: Props<T>) {
  return (
    <fieldset className="segmented" aria-label={legend}>
      {options.map((o) => (
        <label key={o.value}>
          <input type="radio" name={name} value={o.value} checked={o.value === value} onChange={() => onChange(o.value)} />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}
