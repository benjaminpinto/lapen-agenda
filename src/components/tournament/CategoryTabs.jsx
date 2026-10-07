import {Trophy} from 'lucide-react'
import {Link} from 'react-router-dom'
import {Button} from '@/components/ui/button'
import BracketView from './BracketView'
import GroupCard from './GroupCard'
import MatchCard from './MatchCard'
import ProgressTrack from './ProgressTrack'
import TiebreakExplainer from './TiebreakExplainer'

const Empty = ({ children, testId }) => (
  <p className="rounded-lg border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground" data-testid={testId}>{children}</p>
)

function MatchSection({ title, matches, emptyText, linkLabel, onMore, testId }) {
  return (
    <section className="space-y-2" data-testid={testId}>
      <h3 className="text-base font-semibold">{title}</h3>
      {matches.length === 0 ? <Empty>{emptyText}</Empty> : (
        <div className="grid gap-2 md:grid-cols-2">
          {matches.map((match) => <MatchCard key={match.id} match={match} showContext />)}
        </div>
      )}
      {matches.length > 0 && (
        <Button type="button" variant="outline" size="sm" className="min-h-[44px]" onClick={onMore} data-testid={`${testId}-more`}>{linkLabel}</Button>
      )}
    </section>
  )
}

export function ProgressTab({ data, onTab }) {
  const { category } = data
  const preDraw = category.status === 'awaiting_draw'
  const { capacity } = category
  return (
    <div className="space-y-6" data-testid="tab-andamento">
      {category.champion && (
        <div className="flex items-center gap-3 rounded-lg border-2 border-amber-600 bg-amber-50 p-4 dark:bg-amber-950/30" data-testid="champion-banner">
          <Trophy className="h-8 w-8 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-300">Campeão</p>
            <p className="text-lg font-bold" data-testid="champion-name">{category.champion.display_name}</p>
            {category.runner_up && <p className="text-sm text-muted-foreground" data-testid="runner-up-name">Vice: {category.runner_up.display_name}</p>}
          </div>
        </div>
      )}
      <ProgressTrack stage={category.stage} progress={category.progress} />
      {preDraw && (
        <p className="rounded-lg border bg-card px-4 py-3 text-sm" data-testid="pre-draw-note">
          {capacity.confirmed} {capacity.confirmed === 1 ? 'inscrito confirmado' : 'inscritos confirmados'}
          {capacity.max_entries ? ` (máximo de ${capacity.max_entries})` : ''}. O sorteio ainda não foi realizado; a chave e os grupos aparecem aqui assim que for publicado.
        </p>
      )}
      {!preDraw && (
        <>
          {category.status !== 'finished' && (
            <MatchSection
              title="Próximos jogos" matches={data.upcoming} testId="section-upcoming"
              emptyText="Nenhum jogo pronto para ser disputado no momento." linkLabel="Ver todos os jogos" onMore={() => onTab('jogos')}
            />
          )}
          <MatchSection
            title="Últimos resultados" matches={data.results} testId="section-results"
            emptyText="Nenhum resultado ainda." linkLabel="Ver todos os resultados" onMore={() => onTab('resultados')}
          />
        </>
      )}
    </div>
  )
}

export function GroupsTab({ data }) {
  const { category } = data
  if (category.draw_format === 'knockout') return <Empty testId="tab-grupos">Esta categoria é eliminatória: não há fase de grupos. Veja a aba Chave.</Empty>
  if (!category.draw_published) return <Empty testId="tab-grupos">Os grupos aparecem aqui quando o sorteio for publicado.</Empty>
  return (
    <div className="space-y-4" data-testid="tab-grupos">
      <div className="grid gap-4 lg:grid-cols-2">
        {data.groups.map((group) => <GroupCard key={group.id} group={group} bracket={data.bracket} />)}
      </div>
      <TiebreakExplainer />
    </div>
  )
}

export function BracketTab({ data }) {
  const { category } = data
  if (category.draw_format === 'round_robin') return <Empty testId="tab-chave">Esta categoria é todos contra todos: não há chave. Veja a aba Grupos.</Empty>
  if (!category.draw_published) return <Empty testId="tab-chave">A chave aparece aqui quando o sorteio for publicado.</Empty>
  if (data.knockout_pending) return <Empty testId="tab-chave">A chave do mata-mata será montada quando os grupos terminarem. Veja quem está avançando na aba Grupos.</Empty>
  return <div data-testid="tab-chave"><BracketView bracket={data.bracket} /></div>
}

export function EntriesTab({ data, registrationOpen }) {
  const { entries, category } = data
  return (
    <div className="space-y-3" data-testid="tab-inscritos">
      <p className="text-sm text-muted-foreground" data-testid="entries-count">
        {entries.length} {entries.length === 1 ? 'inscrito confirmado' : 'inscritos confirmados'}
        {category.capacity.max_entries ? ` de ${category.capacity.max_entries} vagas` : ''}.
        {registrationOpen ? ' Novas inscrições aparecem aqui depois que o organizador confirmar.' : ''}
      </p>
      {entries.length === 0 ? <Empty>Ainda não há inscrições confirmadas nesta categoria.</Empty> : (
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry, index) => (
            <li key={entry.id} data-testid={`entry-${entry.id}`} className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm">
              <span className="min-w-0 truncate"><span className="mr-2 text-muted-foreground tabular-nums">{index + 1}.</span>{entry.display_name}</span>
              {entry.seed ? <span className="shrink-0 rounded-full border border-amber-400 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">Cabeça {entry.seed}</span> : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export function RulesTab({ tournament, category, slug }) {
  const rows = [
    ['Formato das partidas', tournament.format_text],
    ['Cabeças de chave', category.num_seeds ? String(category.num_seeds) : null],
    ['Tolerância para W.O.', category.wo_tolerance_min ? `${category.wo_tolerance_min} minutos` : null],
    ['Descanso entre jogos do mesmo atleta', category.min_rest_min ? `${category.min_rest_min} minutos` : null],
  ].filter(([, value]) => value)
  return (
    <div className="space-y-4" data-testid="tab-regulamento">
      {tournament.description && <p className="whitespace-pre-line text-sm" data-testid="rules-description">{tournament.description}</p>}
      <dl className="divide-y rounded-lg border bg-card text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5 px-4 py-2 sm:flex-row sm:justify-between">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {tournament.rules_text && (
        <section className="rounded-lg border bg-card p-4">
          <h3 className="mb-2 font-semibold">Regulamento</h3>
          <p className="whitespace-pre-line text-sm" data-testid="rules-text">{tournament.rules_text}</p>
        </section>
      )}
      {tournament.contact_info && (
        <section className="rounded-lg border bg-card p-4">
          <h3 className="mb-2 font-semibold">Contato da organização</h3>
          <p className="whitespace-pre-line text-sm" data-testid="rules-contact">{tournament.contact_info}</p>
        </section>
      )}
      <TiebreakExplainer open />
      {tournament.registration.open && (
        <Link to={`/tournaments/${slug}/register`} data-testid="rules-register-link">
          <Button type="button" className="min-h-[44px] bg-amber-700 text-white hover:bg-amber-800">Inscrever-se</Button>
        </Link>
      )}
    </div>
  )
}
