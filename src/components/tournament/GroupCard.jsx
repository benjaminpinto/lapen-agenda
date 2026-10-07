import {ChevronDown} from 'lucide-react'
import MatchCard from './MatchCard'
import StandingsTable from './StandingsTable'

function groupStatus(group) {
  if (!group.complete) return 'Em andamento'
  return group.blocked ? 'Empate a decidir' : 'Encerrado'
}

/** A group: its table and, below, its games. */
export default function GroupCard({ group, bracket, roundRobin = false }) {
  const decided = group.matches.filter((m) => m.status === 'completed').length
  return (
    <section className="overflow-hidden rounded-lg border bg-card" data-testid={`group-card-${group.name}`} data-complete={group.complete ? 'true' : 'false'}>
      <header className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
        <h3 className="font-semibold">Grupo {group.name}</h3>
        <span className="text-xs font-medium text-muted-foreground" data-testid={`group-status-${group.name}`}>
          {groupStatus(group)} · {decided}/{group.matches.length} jogos
        </span>
      </header>
      <StandingsTable group={group} bracket={bracket} roundRobin={roundRobin} />
      {!roundRobin && (
        <p className="px-3 pb-2 text-xs text-muted-foreground">
          {group.qualifiers === 1 ? 'Avança o 1º colocado.' : `Avançam os ${group.qualifiers} primeiros colocados.`}
        </p>
      )}
      {group.blocked && (
        <p className="mx-3 mb-3 rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-sm text-orange-900 dark:border-orange-700 dark:bg-orange-950/30 dark:text-orange-200" data-testid={`group-tie-notice-${group.name}`}>
          {roundRobin ? 'Há empate que os critérios não resolvem.' : 'Há empate na zona de classificação que os critérios não resolvem.'} O organizador vai decidir e a tabela será atualizada.
        </p>
      )}
      <details className="group border-t" open={!group.complete || undefined} data-testid={`group-matches-${group.name}`}>
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-medium">
          Jogos do grupo
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="grid gap-2 px-3 pb-3 sm:grid-cols-2">
          {group.matches.map((match) => <MatchCard key={match.id} match={match} showContext />)}
        </div>
      </details>
    </section>
  )
}
