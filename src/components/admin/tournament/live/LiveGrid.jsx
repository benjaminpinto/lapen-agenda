import {Ban, Check} from 'lucide-react'
import {courtName, dayTitle, toneFor, windowKey} from '../schedule/scheduleUtils'
import {clockState, isCurrentRow, resultLabel} from './liveUtils'

const CLOCK = {
  now: { label: 'Agora', ring: 'ring-2 ring-amber-700', badge: 'bg-amber-800 text-white' },
  late: { label: 'Atrasada', ring: 'ring-2 ring-orange-600', badge: 'bg-orange-600 text-white' },
}

function LiveCell({ match, tone, clock, canRecord, onOpen }) {
  const done = match.status === 'completed'
  const ready = match.sides.every((side) => side.defined)
  const clickable = done ? match.outcome !== 'bye' : ready && canRecord
  const flag = CLOCK[clock]
  const hint = done ? resultLabel(match) : (!ready ? 'Aguardando definição' : (canRecord ? 'Toque para lançar o resultado' : 'Torneio não iniciado'))
  return (
    <button
      type="button" data-testid={`live-match-${match.id}`} data-status={match.status} data-clock={clock || undefined}
      disabled={!clickable} onClick={() => onOpen(match)}
      className={`block min-h-[5rem] w-full rounded-md border border-l-4 px-2 py-1.5 text-left text-xs shadow-sm transition ${tone} ${flag?.ring ?? ''} ${clickable ? 'cursor-pointer hover:shadow-md' : 'cursor-default opacity-70'}`}
    >
      <span className="flex items-start justify-between gap-1">
        <span className="min-w-0 truncate font-semibold text-stone-800" title={match.category_name}>{match.category_name}</span>
        {done && <><Check className="h-3.5 w-3.5 shrink-0 text-stone-700" aria-hidden="true" /><span className="sr-only">Disputada</span></>}
        {!done && flag && <span className={`shrink-0 rounded px-1 text-[0.65rem] font-semibold ${flag.badge}`} data-testid={`live-clock-${match.id}`}>{flag.label}</span>}
      </span>
      <span className="block truncate text-[0.7rem] text-stone-600">{match.round_name}</span>
      {match.sides.map((side, index) => {
        const won = match.winner_registration_id && side.registration_id === match.winner_registration_id
        return <span key={index} className={`block truncate ${won ? 'font-bold text-stone-900' : 'text-stone-800'} ${side.defined ? '' : 'italic text-stone-500'}`}>{side.name}</span>
      })}
      <span className="block truncate text-[0.7rem] text-stone-600">{hint}</span>
    </button>
  )
}

/**
 * The grid of one day for the event: a row per start time, a column per court. Matches open the result form;
 * the running slot is marked and so is any game whose slot is over without a result.
 */
export default function LiveGrid({ days, day, onDay, courts, byWindow, categoryIds, today, nowMinutes, slotMinutes, canRecord, onOpen }) {
  const current = days.find((d) => d.date === day) || days[0]
  if (!current) return null
  return (
    <div data-testid="live-grid">
      <div role="tablist" aria-label="Dias do torneio" className="mb-3 flex flex-wrap gap-1">
        {days.map((d) => {
          const placed = [...d.windows.values()].map((w) => byWindow.get(windowKey(w))).filter(Boolean)
          const done = placed.filter((m) => m.status === 'completed').length
          return (
            <button
              key={d.date} type="button" role="tab" aria-selected={d.date === current.date} data-testid={`live-day-${d.date}`} onClick={() => onDay(d.date)}
              className={`min-h-[44px] rounded-md border px-3 text-sm font-medium ${d.date === current.date ? 'border-amber-800 bg-amber-800 text-white' : 'bg-white hover:bg-stone-50'}`}
            >
              {dayTitle(d.date)}{d.date === today ? ' · Hoje' : ''} <span className="text-xs opacity-80">· {done}/{placed.length}</span>
            </button>
          )
        })}
      </div>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full border-collapse text-sm" data-testid={`live-table-${current.date}`}>
          <thead>
            <tr className="bg-stone-50">
              <th scope="col" className="sticky left-0 z-10 w-16 border-b bg-stone-50 px-2 py-2 text-left text-xs font-semibold text-stone-600">Horário</th>
              {current.courtIds.map((id) => (
                <th key={id} scope="col" className="min-w-[10rem] border-b border-l px-2 py-2 text-left text-xs font-semibold text-stone-700">{courtName(courts, id)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {current.times.map((time) => {
              const running = isCurrentRow(current.date, time, today, nowMinutes, slotMinutes)
              return (
                <tr key={time} data-testid={`live-row-${time}`} data-current={running ? 'true' : undefined}>
                  <th scope="row" className={`sticky left-0 z-10 border-b px-2 py-1 text-left align-top text-xs font-semibold tabular-nums ${running ? 'bg-amber-100 text-amber-900' : 'bg-white text-stone-700'}`}>
                    {time}{running && <span className="block text-[0.65rem] font-semibold uppercase">Agora</span>}
                  </th>
                  {current.courtIds.map((courtId) => {
                    const key = windowKey({ court_id: courtId, date: current.date, time })
                    const window = current.windows.get(key)
                    const match = byWindow.get(key)
                    return (
                      <td key={courtId} className={`h-px border-b border-l p-1 align-top ${running ? 'bg-amber-50/60' : ''}`} data-testid={`live-cell-${courtId}-${current.date}-${time}`}>
                        {!window && <div className="min-h-[5rem] rounded-md bg-stone-100/70" aria-label="Sem janela" />}
                        {window && match && (
                          <LiveCell
                            match={match} tone={toneFor(categoryIds, match.category_id)} canRecord={canRecord} onOpen={onOpen}
                            clock={clockState(match, today, nowMinutes, slotMinutes)}
                          />
                        )}
                        {window && !match && (
                          <div className="flex min-h-[5rem] items-center justify-center rounded-md border border-dashed border-stone-200 text-xs text-stone-400">
                            {window.blocked ? <><Ban className="mr-1 h-3.5 w-3.5" aria-hidden="true" />Bloqueada</> : 'Livre'}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
