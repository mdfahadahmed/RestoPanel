"use client";

interface AuthFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function AuthField({ label, error, id, ...props }: AuthFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-fog-300">
        {label}
      </label>
      <input
        id={id}
        className="w-full rounded-xl border border-line bg-ink-800/70 px-3.5 py-2.5 text-sm text-fog-100 outline-none transition placeholder:text-fog-500 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20"
        {...props}
      />
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
