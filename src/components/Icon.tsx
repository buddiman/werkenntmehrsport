const PATHS = {
  home: 'M3 11l9-8 9 8M5 10v10h14V10',
  predict: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8l3.5 2.5-1.3 4h-4.4l-1.3-4z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3',
  history: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 018 0v3',
  check: 'M5 12l5 5 9-10',
  minus: 'M6 12h12',
  plus: 'M12 6v12M6 12h12',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, className = 'size-5' }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
