import { toggleClass } from "./controls";

// A group of pill options where one is selected (what to search, how to search). Uses aria-pressed buttons inside a labelled group.
export default function Toggle<T extends string>({ label, options, value, onChange, className = "" }: { label: string; options: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="group" aria-label={label} className={`flex flex-wrap gap-2 ${className}`}>
      {options.map(([k, l]) => <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)} className={toggleClass(value === k)}>{l}</button>)}
    </div>
  );
}
