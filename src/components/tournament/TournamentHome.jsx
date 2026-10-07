import {CalendarDays, MapPin, Trophy} from 'lucide-react'
import {Link} from 'react-router-dom'
import {Button} from '@/components/ui/button'
import StatusBadge from '@/components/admin/tournament/StatusBadge'
import {formatDateTime, TOURNAMENT_STATUS} from '@/components/admin/tournament/labels'
import {formatDate} from './format'
import {PUBLIC_API} from './tournamentApi'
import useTournamentData from './useTournamentData'

function registrationNote(registration) {
  if (registration.state === 'not_started' && registration.opens_at) return `Inscrições abrem em ${formatDateTime(registration.opens_at)}.`
  if (registration.open && registration.closes_at) return `Inscrições até ${formatDateTime(registration.closes_at)}.`
  return null
}

function CurrentTournament({ tournament }) {
  const note = registrationNote(tournament.registration)
  return (
    <section className="space-y-3 rounded-lg border-2 border-amber-600 bg-card p-4 sm:p-6" data-testid="current-tournament">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold sm:text-2xl" data-testid="current-tournament-name">{tournament.name}</h2>
        <StatusBadge info={TOURNAMENT_STATUS[tournament.status]} testId="current-tournament-status" />
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" aria-hidden="true" />{formatDate(tournament.start_date)} a {formatDate(tournament.end_date)}</span>
        {tournament.location && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden="true" />{tournament.location}</span>}
      </p>
      {tournament.description && <p className="whitespace-pre-line text-sm">{tournament.description}</p>}
      {note && <p className="text-sm font-medium" data-testid="registration-note">{note}</p>}
      <div className="flex flex-wrap gap-2">
        <Link to={`/tournaments/${tournament.slug}`} data-testid="follow-tournament-link">
          <Button type="button" className="min-h-[44px] bg-amber-700 text-white hover:bg-amber-800">Acompanhar torneio</Button>
        </Link>
        {tournament.registration.open && (
          <Link to={`/tournaments/${tournament.slug}/register`} data-testid="register-link">
            <Button type="button" variant="outline" className="min-h-[44px] border-amber-700 text-amber-900 dark:text-amber-300">Inscrever-se</Button>
          </Link>
        )}
      </div>
    </section>
  )
}

function HistoryItem({ tournament }) {
  return (
    <li className="space-y-2 rounded-lg border bg-card p-4" data-testid={`history-${tournament.slug}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <Link to={`/tournaments/${tournament.slug}`} className="font-semibold text-amber-900 underline-offset-2 hover:underline dark:text-amber-300" data-testid={`history-link-${tournament.slug}`}>
          {tournament.name}
        </Link>
        <span className="text-xs text-muted-foreground">{formatDate(tournament.start_date)} a {formatDate(tournament.end_date)}</span>
      </div>
      {tournament.categories.some((c) => c.champion) && (
        <ul className="space-y-0.5 text-sm">
          {tournament.categories.filter((c) => c.champion).map((c) => (
            <li key={c.name} className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
              <span className="text-muted-foreground">{c.name}:</span> <strong>{c.champion}</strong>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

/** /tournaments: the tournament happening now and the ones that came before. */
export default function TournamentHome() {
  const { data, error, loading } = useTournamentData(PUBLIC_API)
  return (
    <div className="mx-auto max-w-3xl space-y-6" data-testid="tournament-home">
      <h1 className="text-2xl font-bold sm:text-3xl">Torneios</h1>
      {loading && <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>}
      {error && !data && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800" data-testid="home-error">{error}</p>}
      {data && (
        <>
          {data.current
            ? <CurrentTournament tournament={data.current} />
            : <p className="rounded-lg border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground" data-testid="no-current-tournament">Nenhum torneio aberto no momento.</p>}
          {data.history.length > 0 && (
            <section className="space-y-3" data-testid="tournament-history">
              <h2 className="text-lg font-semibold">Torneios anteriores</h2>
              <ul className="space-y-3">{data.history.map((t) => <HistoryItem key={t.id} tournament={t} />)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
