import type { ReactNode } from 'react'

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children?: ReactNode
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-4xl font-extrabold uppercase leading-none tracking-wide">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-white/60">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}
