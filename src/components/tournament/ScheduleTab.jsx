import {Printer} from 'lucide-react'
import {useMemo, useState} from 'react'
import {Button} from '@/components/ui/button'
import {
    buildDays,
    courtName,
    dayTitle,
    matchTitle,
    toneFor,
    windowKey
} from '@/components/admin/tournament/schedule/scheduleUtils'
import PrintSchedule from './PrintSchedule'
import RefreshBar from './RefreshBar'
import {PUBLIC_API} from './tournamentApi'
import useTournamentData from './useTournamentData'

/** One placed match in a cell. Read-only: the public screen never drags or moves anything. */
function MatchBlock({ match, tone }) {
  return (
    <div
      data-testid={`schedule-match-${match.id}`} data-status={match.status}
      className={`h-full min-h-[5rem] rounded-md border-l-4 border px-2 py-1.5 text-xs shadow-sm ${tone} ${match.status !== 'pending' ? 'opacity-90' : ''}`}
    >
      <span className="block truncate font-semibold text-stone-800" title={match.category_name}>{match.category_name}</span>
      <span className="block truncate text-[0.7rem] text-stone-600">{match.round_name}</span>
      <span className="block truncate text-stone-900" title={matchTitle(match)}>
        {match.sides.map((side, index) => (
          <span key={index}>{index > 0 ? ' × ' : ''}<span className={side.defined ? '' : 'italic text-stone-500'}>{side.name}</span></span>
        ))}
      </span>
      {match.status !== 'pending' && match.score && <span className="block truncate text-[0.7rem] text-stone-600">{match.outcome === 'normal' ? match.score : match.outcome === 'wo' ? 'W.O.' : match.score}</span>}
    </div>
  )
}

const emptyCell = 'flex h-full min-h-[5rem] items-center justify-center rounded-md border-2 border-dashed text-xs text-muted-foreground'
const empty = (text, dashed) => <div className={`${emptyCell} ${dashed ? 'border-muted-foreground/40' : 'border-transparent bg-muted/40'}`}>{text}</div>

/** The Cronograma tab: the published day grid (times in rows, courts in columns), like the organizer sees. */
export default function ScheduleTab({ slug }) {
  const { data, error, loading, refreshing, updatedAt, refresh } = useTournamentData(`${PUBLIC_API}/${slug}/schedule`)
  const [day, setDay] = useState(null)

  const days = useMemo(() => (data?.windows?.length ? buildDays(data) : []), [data])
  const byWindow = useMemo(() => new Map((data?.matches ?? []).filter((m) => m.window).map((m) => [windowKey(m.window), m])), [data])
  const categoryIds = useMemo(() => [...new Set((data?.matches ?? []).map((m) => m.category_id))], [data])
  const current = days.find((d) => d.date === day) || days[0]

  return (
    <div className="space-y-4" data-testid="schedule-tab">
      <RefreshBar updatedAt={updatedAt} refreshing={refreshing} error={error} onRefresh={refresh} />
      {loading && <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>}
      {error && !data && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800" data-testid="schedule-error">{error}</p>}
      {data && !data.published && <p className="rounded-lg border bg-card px-4 py-3 text-sm" data-testid="schedule-unpublished">O organizador ainda não publicou o cronograma.</p>}
      {data?.published && !current && <p className="rounded-lg border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground" data-testid="schedule-empty">Ainda não há partidas com horário definido.</p>}

      {data?.published && current && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div role="tablist" aria-label="Dias do cronograma" className="flex flex-wrap gap-1" data-testid="schedule-days">
              {days.map((d) => {
                const placed = [...d.windows.values()].filter((w) => byWindow.has(windowKey(w))).length
                const isCurrent = d.date === current.date
                return (
                  <button
                    key={d.date} type="button" role="tab" aria-selected={isCurrent} data-testid={`schedule-day-${d.date}`}
                    onClick={() => setDay(d.date)}
                    className={`min-h-[44px] rounded-md border px-3 text-sm font-medium ${isCurrent ? 'border-amber-800 bg-amber-800 text-white' : 'bg-card hover:bg-muted'}`}
                  >
                    {dayTitle(d.date)} <span className="text-xs opacity-80">· {placed}/{d.windows.size}</span>
                  </button>
                )
              })}
            </div>
            <Button type="button" variant="outline" size="sm" className="min-h-[44px]" onClick={() => window.print()} data-testid="schedule-print-button">
              <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
              Imprimir cronograma
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full border-collapse text-sm" data-testid={`schedule-table-${current.date}`}>
              <thead>
                <tr className="bg-muted/50">
                  <th scope="col" className="sticky left-0 z-10 w-16 border-b bg-muted/50 px-2 py-2 text-left text-xs font-semibold text-muted-foreground">Horário</th>
                  {current.courtIds.map((id) => (
                    <th key={id} scope="col" className="min-w-[10rem] border-b border-l px-2 py-2 text-left text-xs font-semibold" data-testid={`schedule-court-${id}`}>{courtName(data.courts, id)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {current.times.map((time) => (
                  <tr key={time}>
                    <th scope="row" className="sticky left-0 z-10 border-b bg-card px-2 py-1 text-left align-top text-xs font-semibold tabular-nums">{time}</th>
                    {current.courtIds.map((courtId) => {
                      const key = windowKey({ court_id: courtId, date: current.date, time })
                      const window = current.windows.get(key)
                      const match = byWindow.get(key)
                      return (
                        <td key={courtId} className="h-px border-b border-l p-1 align-top" data-testid={`schedule-cell-${courtId}-${current.date}-${time}`}>
                          {!window && empty(null, false)}
                          {window && match && <MatchBlock match={match} tone={toneFor(categoryIds, match.category_id)} />}
                          {window && !match && empty(window.blocked ? '—' : 'Livre', !window.blocked)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PrintSchedule data={data} days={days} byWindow={byWindow} updatedAt={updatedAt} />
        </>
      )}
    </div>
  )
}
