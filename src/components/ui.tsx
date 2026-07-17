import React from 'react';

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex flex-col safe-top safe-bottom bg-background">
      {children}
    </div>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-[#06111F] flex items-center justify-center flex-shrink-0">
        <span className="font-display italic text-[#C8A96E] text-xl leading-none">T</span>
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-foreground">Terê Studio</p>
        <p className="text-[10.5px] text-muted-foreground -mt-0.5">Prévia</p>
      </div>
    </div>
  );
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  const { loading, disabled, children, className = '', ...rest } = props;
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`h-12 w-full rounded-2xl bg-[#06111F] text-[#F7F4EF] text-sm font-semibold flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 ${className}`}
    >
      {loading ? 'Aguarde...' : children}
    </button>
  );
}

export function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { children, className = '', ...rest } = props;
  return (
    <button
      {...rest}
      className={`h-12 w-full rounded-2xl border border-border bg-card text-sm font-semibold text-foreground flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function LinkButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { children, className = '', ...rest } = props;
  return (
    <button {...rest} className={`text-sm font-semibold text-[#8A6F35] underline underline-offset-2 ${className}`}>
      {children}
    </button>
  );
}

export const TextField = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { label: string }>(
  function TextField({ label, className = '', ...rest }, ref) {
    return (
      <label className="block space-y-1.5 text-left">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">{label}</span>
        <input
          ref={ref}
          {...rest}
          className={`w-full h-12 rounded-2xl border border-border bg-card px-4 text-base outline-none focus:border-[#06111F] transition ${className}`}
        />
      </label>
    );
  }
);

export function ErrorNote({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="rounded-xl bg-red-50 border border-red-100 text-red-700 text-xs px-3 py-2.5 leading-snug">{children}</p>;
}

export function InfoNote({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="rounded-xl bg-[#F7F3EB] border border-[#EAC783]/60 text-[#6B5A32] text-xs px-3 py-2.5 leading-snug">{children}</p>;
}

export function maskCpf(value: string): string {
  const d = value.replace(/\D+/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}
