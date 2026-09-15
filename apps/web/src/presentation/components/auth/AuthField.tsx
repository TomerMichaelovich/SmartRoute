import type { InputHTMLAttributes } from "react";

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function AuthField({ label, error, hint, id, ...rest }: AuthFieldProps) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-neutral-700">{label}</span>
      <input
        id={id}
        className="rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-base focus:border-cyan-500 focus:outline-none"
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      {hint && !error && <span className="text-xs text-neutral-500">{hint}</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  );
}
