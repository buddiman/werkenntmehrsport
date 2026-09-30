import { Icon } from './Icon'

const MAX = 20

export function ScoreStepper({
  value,
  onChange,
  label,
}: {
  value: number
  onChange: (next: number) => void
  label: string
}) {
  return (
    <div className="flex flex-col items-center gap-1" role="group" aria-label={label}>
      <button
        type="button"
        className="grid size-9 place-items-center rounded-full bg-white/10 active:scale-90"
        onClick={() => onChange(Math.min(MAX, value + 1))}
        aria-label={`${label} erhöhen`}
      >
        <Icon name="plus" className="size-4" />
      </button>
      <div className="grid h-14 w-14 place-items-center rounded-xl bg-pitch-950 font-display text-4xl font-extrabold text-lime-brand ring-1 ring-white/15">
        {value}
      </div>
      <button
        type="button"
        className="grid size-9 place-items-center rounded-full bg-white/10 active:scale-90"
        onClick={() => onChange(Math.max(0, value - 1))}
        aria-label={`${label} verringern`}
      >
        <Icon name="minus" className="size-4" />
      </button>
    </div>
  )
}
