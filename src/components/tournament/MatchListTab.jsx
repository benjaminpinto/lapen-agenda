import {PUBLIC_API} from './tournamentApi'
import useTournamentData from './useTournamentData'
import MatchCard from './MatchCard'
import RefreshBar from './RefreshBar'
import {dayHeading} from './format'

/** Day -> start time -> matches (the API already sends them in that order). Matches without a time close the list. */
function byDay(matches) {
  const days = []
  for (const match of matches) {
    const key = match.planned_date || 'sem-data'
    let day = days.find((d) => d.key === key)
    if (!day) {
      day = { key, title: match.planned_date ? dayHeading(match.planned_date) : 'Sem data definida', slots: [] }
      days.push(day)
    }
    const time = match.planned_time || ''
    let slot = day.slots.find((s) => s.time === time)
    if (!slot) {
      slot = { time, matches: [] }
      day.slots.push(slot)
    }
    slot.matches.push(match)
  }
  return days
}

/** The Jogos (everything ready to be played) and Resultados (everything played) tabs: all of the category, not just the latest. */
export default function MatchListTab({ slug, categoryId, view, published }) {
  const { data, error, loading, refreshing, updatedAt, refresh } = useTournamentData(`${PUBLIC_API}/${slug}/matches?view=${view}&category=${categoryId}`)
  const upcoming = view === 'upcoming'
  const matches = data?.matches || []
  return (
    <div className="space-y-4" data-testid={`tab-${upcoming ? 'jogos' : 'resultados'}`}>
      <RefreshBar updatedAt={updatedAt} refreshing={refreshing} error={error} onRefresh={refresh} />
      {upcoming && !published && (
        <p className="rounded-lg border bg-card px-4 py-3 text-sm" data-testid="schedule-unpublished-note">
          Os horários e quadras serão divulgados aqui quando o organizador publicar o cronograma.
        </p>
      )}
      {loading && <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>}
      {error && !data && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {data && matches.length === 0 && (
        <p className="rounded-lg border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground" data-testid="match-list-empty">
          {upcoming ? 'Nenhum jogo pronto para ser disputado no momento.' : 'Nenhum resultado ainda.'}
        </p>
      )}
      {upcoming
        ? byDay(matches).map((day) => (
          <section key={day.key} className="space-y-2" data-testid={`day-${day.key}`}>
            <h3 className="text-sm font-semibold text-muted-foreground">{day.title}</h3>
            {day.slots.map((slot) => (
              <div key={slot.time || 'sem-hora'} className="space-y-1.5" data-testid={`slot-${day.key}-${slot.time || 'sem-hora'}`}>
                {slot.time && <h4 className="text-sm font-bold tabular-nums">{slot.time}</h4>}
                <div className="grid gap-2 md:grid-cols-2">{slot.matches.map((match) => <MatchCard key={match.id} match={match} showContext />)}</div>
              </div>
            ))}
          </section>
        ))
        : matches.length > 0 && <div className="grid gap-2 md:grid-cols-2">{matches.map((match) => <MatchCard key={match.id} match={match} showContext />)}</div>}
    </div>
  )
}
