import type { ReactNode } from 'react';

export function Panel({
  title, subtitle, children, action,
}: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-lg border border-hairline bg-surface p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-ink-secondary">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PageHeader({
  eyebrow, title, lede, children,
}: { eyebrow: string; title: string; lede: string; children?: ReactNode }) {
  return (
    <header className="mb-6">
      <p className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">{eyebrow}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-secondary">{lede}</p>
      {children}
    </header>
  );
}

export function EmptyState({ what, why }: { what: string; why?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-hairline p-6 text-center">
      <p className="text-sm text-ink-secondary">{what}</p>
      {why && <p className="mt-1 text-xs text-ink-muted">{why}</p>}
    </div>
  );
}
