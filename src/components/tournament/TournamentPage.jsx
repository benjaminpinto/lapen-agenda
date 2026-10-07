import {CalendarDays, MapPin, Swords} from 'lucide-react'
import {Link, useParams, useSearchParams} from 'react-router-dom'
import {Button} from '@/components/ui/button'
import BackButton from '@/components/ui/BackButton'
import StatusBadge from '@/components/admin/tournament/StatusBadge'
import {TOURNAMENT_STATUS} from '@/components/admin/tournament/labels'
import {BracketTab, EntriesTab, GroupsTab, ProgressTab, RulesTab} from './CategoryTabs'
import MatchListTab from './MatchListTab'
import RefreshBar from './RefreshBar'
import {formatDate} from './format'
import {PUBLIC_API} from './tournamentApi'
import useTournamentData from './useTournamentData'

const TABS = [
  { key: 'andamento', label: 'Andamento' },
  { key: 'grupos', label: 'Grupos' },
  { key: 'chave', label: 'Chave' },
  { key: 'jogos', label: 'Jogos' },
  { key: 'resultados', label: 'Resultados' },
  { key: 'inscritos', label: 'Inscritos' },
  { key: 'regulamento', label: 'Regulamento' },
]

const Message = ({ children, testId }) => (
  <div className="mx-auto max-w-xl space-y-4 py-10 text-center" data-testid={testId}>
    <p className="text-muted-foreground">{children}</p>
    <Link to="/tournaments"><Button variant="outline" className="min-h-[44px]">Ver torneios</Button></Link>
  </div>
)

export default function TournamentPage() {
  const { slug } = useParams()
  const [params, setParams] = useSearchParams()
  const page = useTournamentData(`${PUBLIC_API}/${slug}`)
  const tournament = page.data?.tournament
  const categories = page.data?.categories || []
  const category = categories.find((c) => c.id === Number(params.get('categoria'))) || categories[0]
  const requestedTab = params.get('aba')
  const tab = TABS.some((t) => t.key === requestedTab) ? requestedTab : 'andamento'
  const detail = useTournamentData(category ? `${PUBLIC_API}/${slug}/categories/${category.id}` : null)

  const choose = (key, value) => setParams((previous) => {
    const next = new URLSearchParams(previous)
    next.set(key, value)
    return next
  }, { replace: true })

  if (page.status === 404) return <Message testId="tournament-not-found">Torneio não encontrado.</Message>
  if (page.error && !page.data) return <Message testId="tournament-error">{page.error}</Message>
  if (!tournament) return <p className="py-10 text-center text-sm text-muted-foreground" data-testid="tournament-loading">Carregando…</p>

  const listTab = tab === 'jogos' || tab === 'resultados'
  const refreshAll = () => {
    page.refresh()
    detail.refresh()
  }

  return (
    <div className="space-y-5" data-testid="tournament-page">
      <BackButton to="/tournaments" label="Torneios" className="mb-0" />
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold sm:text-3xl" data-testid="tournament-name">{tournament.name}</h1>
          <StatusBadge info={TOURNAMENT_STATUS[tournament.status]} testId="tournament-status" />
        </div>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1" data-testid="tournament-dates"><CalendarDays className="h-4 w-4" aria-hidden="true" />{formatDate(tournament.start_date)} a {formatDate(tournament.end_date)}</span>
          {tournament.location && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden="true" />{tournament.location}</span>}
          <span className="inline-flex items-center gap-1"><Swords className="h-4 w-4" aria-hidden="true" />{tournament.format_text}</span>
        </p>
        {tournament.registration.open && (
          <Link to={`/tournaments/${slug}/register`} data-testid="header-register-link">
            <Button type="button" className="min-h-[44px] bg-amber-700 text-white hover:bg-amber-800">Inscrever-se</Button>
          </Link>
        )}
      </header>

      {categories.length === 0 && <p className="rounded-lg border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground" data-testid="no-categories">Este torneio ainda não tem categorias.</p>}

      {category && (
        <>
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Categoria" data-testid="category-chips">
              {categories.map((c) => (
                <button
                  key={c.id} type="button" aria-pressed={c.id === category.id} data-testid={`category-chip-${c.id}`}
                  onClick={() => choose('categoria', c.id)}
                  className={`min-h-[44px] rounded-full border px-4 text-sm font-medium ${c.id === category.id ? 'border-amber-800 bg-amber-800 text-white' : 'bg-card hover:bg-muted'}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          <div role="tablist" aria-label="Seções do torneio" className="flex gap-1 overflow-x-auto border-b" data-testid="tournament-tabs">
            {TABS.map((t) => (
              <button
                key={t.key} type="button" role="tab" aria-selected={t.key === tab} data-testid={`tab-button-${t.key}`}
                onClick={() => choose('aba', t.key)}
                className={`min-h-[44px] shrink-0 border-b-2 px-3 text-sm font-medium ${t.key === tab ? 'border-amber-700 text-amber-900 dark:border-amber-500 dark:text-amber-300' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {!listTab && <RefreshBar updatedAt={detail.updatedAt} refreshing={page.refreshing || detail.refreshing} error={page.error || detail.error} onRefresh={refreshAll} />}

          <div role="tabpanel" aria-label={TABS.find((t) => t.key === tab).label}>
            {listTab && <MatchListTab key={`${category.id}-${tab}`} slug={slug} categoryId={category.id} view={tab === 'jogos' ? 'upcoming' : 'results'} published={tournament.schedule_published} />}
            {!listTab && detail.error && !detail.data && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800" data-testid="category-error">{detail.error}</p>}
            {!listTab && detail.loading && <p className="py-8 text-center text-sm text-muted-foreground" data-testid="category-loading">Carregando…</p>}
            {!listTab && detail.data && (
              <>
                {tab === 'andamento' && <ProgressTab data={detail.data} onTab={(key) => choose('aba', key)} />}
                {tab === 'grupos' && <GroupsTab data={detail.data} />}
                {tab === 'chave' && <BracketTab data={detail.data} />}
                {tab === 'inscritos' && <EntriesTab data={detail.data} registrationOpen={tournament.registration.open} />}
                {tab === 'regulamento' && <RulesTab tournament={detail.data.tournament} category={detail.data.category} slug={slug} />}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
