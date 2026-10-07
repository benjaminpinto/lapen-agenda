import {Ban} from 'lucide-react'
import MatchCell from './MatchCell'
import {courtName, dayTitle, toneFor, windowKey} from './scheduleUtils'

const cellClass = 'h-full min-h-[5rem] w-full rounded-md border-2 border-dashed px-2 py-1 text-xs transition'

/**
 * The day grid: a row per start time, a column per court. A cell is a match, a free window, a blocked one, or nothing
 * (the court is not part of any session at that time). A proposal is drawn as dashed ghost cards in the free windows it fills.
 */
export default function ScheduleGrid({
  days, day, onDay, courts, byWindow, categoryIds, levels, selection, ghosts, onMatch, onWindow, onDropOnMatch, onDropOnWindow, setDragging,
}) {
  const current = days.find((d) => d.date === day) || days[0]
  if (!current) return null
  const dragId = (event) => Number(event.dataTransfer.getData('text/plain'))

  return (
    <div data-testid="schedule-grid">
      <div role="tablist" aria-label="Dias do cronograma" className="mb-3 flex flex-wrap gap-1">
        {days.map((d) => {
          const placed = [...d.windows.values()].filter((w) => byWindow.has(windowKey(w))).length
          return (
            <button
              key={d.date} type="button" role="tab" aria-selected={d.date === current.date} data-testid={`schedule-day-${d.date}`}
              onClick={() => onDay(d.date)}
              className={`min-h-[44px] rounded-md border px-3 text-sm font-medium ${d.date === current.date ? 'border-amber-800 bg-amber-800 text-white' : 'bg-white hover:bg-stone-50'}`}
            >
              {dayTitle(d.date)} <span className="text-xs opacity-80">· {placed}/{d.windows.size}</span>
            </button>
          )
        })}
      </div>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full border-collapse text-sm" data-testid={`schedule-table-${current.date}`}>
          <thead>
            <tr className="bg-stone-50">
              <th scope="col" className="sticky left-0 z-10 w-16 border-b bg-stone-50 px-2 py-2 text-left text-xs font-semibold text-stone-600">Horário</th>
              {current.courtIds.map((id) => (
                <th key={id} scope="col" className="min-w-[10rem] border-b border-l px-2 py-2 text-left text-xs font-semibold text-stone-700" data-testid={`schedule-court-${id}`}>{courtName(courts, id)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {current.times.map((time) => (
              <tr key={time}>
                <th scope="row" className="sticky left-0 z-10 border-b bg-white px-2 py-1 text-left align-top text-xs font-semibold tabular-nums text-stone-700">{time}</th>
                {current.courtIds.map((courtId) => {
                  const window = current.windows.get(windowKey({ court_id: courtId, date: current.date, time }))
                  const key = windowKey({ court_id: courtId, date: current.date, time })
                  const match = byWindow.get(key)
                  const ghost = ghosts.get(key)
                  const isWindowSelected = selection?.kind === 'window' && selection.key === key
                  return (
                    <td key={courtId} className="h-px border-b border-l p-1 align-top" data-testid={`schedule-cell-${courtId}-${current.date}-${time}`}>
                      {!window && <div className="h-full min-h-[5rem] rounded-md bg-stone-100/70" aria-label="Sem janela" />}
                      {window && match && (
                        <div
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => { event.preventDefault(); onDropOnMatch(dragId(event), match) }}
                        >
                          <MatchCell
                            match={match} tone={toneFor(categoryIds, match.category_id)} level={levels.get(match.id)}
                            selected={selection?.kind === 'match' && selection.id === match.id} onSelect={onMatch} onDragStart={setDragging}
                          />
                        </div>
                      )}
                      {window && !match && window.blocked && (
                        <button
                          type="button" data-testid={`schedule-window-${courtId}-${current.date}-${time}`} data-blocked="true" aria-pressed={isWindowSelected}
                          onClick={() => onWindow(window)}
                          className={`${cellClass} flex flex-col items-center justify-center gap-1 border-stone-400 bg-stone-200 text-stone-700 ${isWindowSelected ? 'outline outline-2 outline-offset-1 outline-amber-800' : ''}`}
                        >
                          <Ban className="h-4 w-4" aria-hidden="true" /> Bloqueada
                        </button>
                      )}
                      {window && !match && !window.blocked && (
                        <button
                          type="button" data-testid={`schedule-window-${courtId}-${current.date}-${time}`} aria-pressed={isWindowSelected}
                          onClick={() => onWindow(window)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => { event.preventDefault(); onDropOnWindow(dragId(event), window) }}
                          className={`${cellClass} ${ghost ? 'border-amber-600 bg-amber-50 text-left' : 'border-stone-300 text-stone-400 hover:border-amber-500 hover:text-stone-700'} ${isWindowSelected ? 'outline outline-2 outline-offset-1 outline-amber-800' : ''}`}
                        >
                          {ghost
                            ? <span data-testid={`schedule-ghost-${ghost.match_id}`} className="block"><span className="block font-semibold text-amber-900">Proposta</span><span className="block text-stone-800">{ghost.label}</span></span>
                            : 'Livre'}
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
