import {useEffect, useMemo, useState} from 'react'
import {Link, useParams} from 'react-router-dom'
import {Maximize2, Minimize2} from 'lucide-react'
import {buildDays, courtName, dayTitle} from '@/components/admin/tournament/schedule/scheduleUtils'
import {courtBoard, defaultDay, recentResults, resultLabel} from '@/components/admin/tournament/live/liveUtils'
import {getLocalDateString} from '@/utils/dateUtils'
import {updatedText} from './format'
import {PUBLIC_API} from './tournamentApi'
import useTournamentData from './useTournamentData'

const BOARD_POLL_MS = 30_000
const CLOCK_MS = 15_000
const RESULTS_SHOWN = 6

const clock = (date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

/** The two players, one per line; an open slot ("1º Grupo A") in italics. */
const Players = ({ match, className }) => (
  <p className={className}>
    {match.sides.map((side, index) => (
      <span key={index} className={`block truncate ${side.defined ? '' : 'italic text-stone-400'}`}>{side.name}</span>
    ))}
  </p>
)

function CourtCard({ name, courtId, onCourt, next }) {
  return (
    <section className="space-y-3 rounded-xl border border-amber-900/60 bg-stone-900 p-4 sm:p-5" data-testid={`board-court-${courtId}`}>
      <h2 className="text-lg font-semibold text-amber-400 sm:text-xl">{name}</h2>
      {onCourt ? (
        <div data-testid={`board-on-court-${courtId}`} data-match={onCourt.id}>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-500">Em quadra · desde {onCourt.window.time}</p>
          <p className="truncate text-xs text-stone-400">{onCourt.category_name} · {onCourt.round_name}</p>
          <Players match={onCourt} className="text-2xl font-bold leading-snug sm:text-3xl" />
        </div>
      ) : (
        <p className="text-lg text-stone-400" data-testid={`board-free-${courtId}`}>Quadra livre no momento</p>
      )}
      {next.length > 0 && (
        <div className="space-y-2 border-t border-stone-700 pt-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">A seguir</p>
          {next.map((match) => (
            <div key={match.id} data-testid={`board-next-${match.id}`}>
              <p className="truncate text-xs text-stone-400">{match.window.time} · {match.category_name} · {match.round_name}</p>
              <Players match={match} className="text-lg font-semibold leading-snug sm:text-xl" />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

const Notice = ({ children, testId }) => <p className="py-16 text-center text-xl text-stone-300" data-testid={testId}>{children}</p>

/** The courts on a screen for the venue: who is on court, who is next and the latest results. Refreshes by itself. */
export default function LiveBoard() {
  const { slug } = useParams()
  const { data, error, loading, updatedAt } = useTournamentData(`${PUBLIC_API}/${slug}/schedule`, { pollMs: BOARD_POLL_MS })
  const [now, setNow] = useState(() => new Date())
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_MS)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const days = useMemo(() => (data?.published && data.windows.length ? buildDays(data) : []), [data])
  const today = getLocalDateString(now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const day = defaultDay([...new Set((data?.matches ?? []).map((match) => match.window.date))], today) // only days that have games
  const current = days.find((d) => d.date === day)
  const dayMatches = (data?.matches ?? []).filter((match) => match.window?.date === day)
  const isToday = day === today
  const results = recentResults(dayMatches, RESULTS_SHOWN)
  const toggleFullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950 p-4 text-amber-50 sm:p-8" data-testid="live-board">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link to={`/tournaments/${slug}`} className="text-xs text-stone-400 underline" data-testid="board-back">Voltar ao torneio</Link>
          <h1 className="text-2xl font-bold text-amber-300 sm:text-4xl" data-testid="board-title">{data?.tournament.name ?? 'Ao vivo'}</h1>
          {current && (
            <p className="text-sm text-stone-300 sm:text-base" data-testid="board-day">
              Ao vivo · {dayTitle(day)}{isToday ? ' · hoje' : ''}
              {!isToday && ' (hoje não há jogos)'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-3xl font-bold tabular-nums text-amber-200 sm:text-5xl" data-testid="board-clock">{clock(now)}</p>
            {updatedAt && <p className="text-xs text-stone-400" data-testid="board-updated">Atualizado às {updatedText(updatedAt)}</p>}
          </div>
          <button
            type="button" onClick={toggleFullscreen} data-testid="board-fullscreen" aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-stone-600 text-stone-200 hover:bg-stone-800"
          >
            {fullscreen ? <Minimize2 className="h-5 w-5" aria-hidden="true" /> : <Maximize2 className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </header>

      {loading && <Notice testId="board-loading">Carregando…</Notice>}
      {error && !data && <Notice testId="board-error">{error}</Notice>}
      {data && !data.published && <Notice testId="board-unpublished">O organizador ainda não publicou o cronograma.</Notice>}
      {data?.published && !current && <Notice testId="board-empty">Ainda não há partidas com horário definido.</Notice>}

      {current && (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="board-courts">
            {current.courtIds.map((courtId) => {
              const { onCourt, next } = courtBoard(dayMatches.filter((match) => match.window.court_id === courtId), isToday, nowMinutes)
              return <CourtCard key={courtId} courtId={courtId} name={courtName(data.courts, courtId)} onCourt={onCourt} next={next} />
            })}
          </div>
          <section className="space-y-2" data-testid="board-results">
            <h2 className="text-lg font-semibold text-amber-400 sm:text-xl">Últimos resultados</h2>
            {results.length === 0 ? (
              <p className="text-stone-400" data-testid="board-no-results">Nenhum resultado ainda neste dia.</p>
            ) : (
              <ul className="grid gap-x-8 gap-y-2 text-base sm:text-lg lg:grid-cols-2">
                {results.map((match) => (
                  <li key={match.id} className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-stone-800 pb-1" data-testid={`board-result-${match.id}`}>
                    <span className="min-w-0 truncate">
                      <span className={match.winner_side === 1 ? 'font-bold text-amber-300' : ''}>{match.sides[0].name}</span>
                      {' × '}
                      <span className={match.winner_side === 2 ? 'font-bold text-amber-300' : ''}>{match.sides[1].name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-stone-300">{resultLabel(match)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
