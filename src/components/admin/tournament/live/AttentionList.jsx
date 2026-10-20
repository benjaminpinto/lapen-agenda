import {Share2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {courtName, dayTitle, matchTitle} from '../schedule/scheduleUtils'

const STATE = {
  late: { label: 'Atrasada', className: 'bg-orange-600 text-white' },
  now: { label: 'Agora', className: 'bg-amber-800 text-white' },
  next: { label: 'A seguir', className: 'bg-stone-200 text-stone-800' },
}

/**
 * "Agora e a seguir": the games that should be on court, are late or start soon, each with the quick actions
 * (result, call in the group chat, W.O.). The header button calls all of them in one message.
 */
export default function AttentionList({ items, courts, today, canRecord, onRecord, onCall, onWalkover }) {
  if (items.length === 0) return null
  return (
    <section className="space-y-2" data-testid="live-attention">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-stone-900">Agora e a seguir</h3>
        <Button type="button" variant="outline" size="sm" onClick={() => onCall(items.map((item) => item.match))} data-testid="live-call-all" className="min-h-[44px]">
          <Share2 className="mr-1 h-4 w-4" aria-hidden="true" />Chamar todos no grupo
        </Button>
      </div>
      <ul className="space-y-2">
        {items.map(({ match, state }) => (
          <li key={match.id} className="flex flex-col gap-2 rounded-md border bg-white p-3 sm:flex-row sm:items-center sm:justify-between" data-testid={`live-attention-${match.id}`} data-state={state}>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
                <span className={`rounded px-1.5 py-0.5 font-semibold ${STATE[state].className}`}>{STATE[state].label}</span>
                <span>{match.window.date === today ? '' : `${dayTitle(match.window.date)} `}{match.window.time} · {courtName(courts, match.window.court_id)}</span>
                <span className="truncate">{match.category_name} · {match.round_name}</span>
              </p>
              <p className="truncate text-sm font-medium">{matchTitle(match)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" disabled={!canRecord} onClick={() => onRecord(match)} data-testid={`live-attention-record-${match.id}`} className="min-h-[44px] bg-amber-700 text-white hover:bg-amber-800">Resultado</Button>
              <Button type="button" size="sm" variant="outline" disabled={!canRecord} onClick={() => onWalkover(match)} data-testid={`live-attention-wo-${match.id}`} className="min-h-[44px]">W.O.</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => onCall([match])} data-testid={`live-attention-call-${match.id}`} className="min-h-[44px]">Chamar</Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
