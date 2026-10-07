import {AlertTriangle, Check, Lock} from 'lucide-react'
import {matchTitle} from './scheduleUtils'

/** One match inside a window (or in the list of matches without a time). */
export default function MatchCell({ match, tone, level, selected, onSelect, onDragStart, compact = false }) {
  const pending = match.status === 'pending'
  const movable = pending && !match.locked
  const warn = level === 'error' ? 'ring-2 ring-red-600' : level === 'warning' ? 'ring-2 ring-orange-500' : ''
  return (
    <button
      type="button"
      data-testid={`schedule-match-${match.id}`}
      data-status={match.status}
      data-selected={selected ? 'true' : undefined}
      data-conflict={level || undefined}
      aria-pressed={selected}
      draggable={movable}
      onDragStart={movable ? (event) => { event.dataTransfer.setData('text/plain', String(match.id)); onDragStart?.(match.id) } : undefined}
      onClick={() => onSelect(match)}
      disabled={!pending}
      className={`group relative block w-full rounded-md border-l-4 border px-2 py-1.5 text-left text-xs shadow-sm transition ${tone} ${warn} ${selected ? 'outline outline-2 outline-offset-1 outline-amber-800' : ''} ${pending ? 'cursor-pointer hover:shadow-md' : 'cursor-default opacity-80'} ${compact ? '' : 'min-h-[4.5rem]'}`}
    >
      <span className="flex items-start justify-between gap-1">
        <span className="min-w-0 truncate font-semibold text-stone-800" title={match.category_name}>{match.category_name}</span>
        <span className="flex shrink-0 items-center gap-0.5">
          {match.locked && <><Lock className="h-3.5 w-3.5 text-stone-700" aria-hidden="true" /><span className="sr-only">Fixada</span></>}
          {level && <><AlertTriangle className={`h-3.5 w-3.5 ${level === 'error' ? 'text-red-700' : 'text-orange-700'}`} aria-hidden="true" /><span className="sr-only">{level === 'error' ? 'Conflito' : 'Aviso'}</span></>}
          {!pending && <><Check className="h-3.5 w-3.5 text-stone-700" aria-hidden="true" /><span className="sr-only">Disputada</span></>}
        </span>
      </span>
      <span className="block truncate text-[0.7rem] text-stone-600">{match.round_name}</span>
      <span className="block truncate text-stone-900" title={matchTitle(match)}>
        {match.sides.map((side, index) => (
          <span key={index}>{index > 0 ? ' × ' : ''}<span className={side.defined ? '' : 'italic text-stone-500'}>{side.name}</span></span>
        ))}
      </span>
      {!pending && match.score && <span className="block truncate text-[0.7rem] text-stone-600">{match.outcome === 'normal' ? match.score : match.outcome === 'wo' ? 'W.O.' : match.score}</span>}
    </button>
  )
}
