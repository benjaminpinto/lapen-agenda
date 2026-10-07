import {ArrowRight} from 'lucide-react'

const STATE_LABEL = {
  provisional: 'Avança (provisório)',
  qualified: 'Classificado',
  eliminated: 'Eliminado',
  tie_pending: 'Empate',
}
const STATE_BAR = {
  provisional: 'border-l-amber-400',
  qualified: 'border-l-amber-700',
  tie_pending: 'border-l-orange-600',
  eliminated: 'border-l-stone-300 dark:border-l-stone-600',
  open: 'border-l-transparent',
}
const STATE_CELL = {
  provisional: 'bg-amber-50/70 dark:bg-amber-950/20',
  qualified: 'bg-amber-100/70 dark:bg-amber-900/30',
  tie_pending: 'bg-orange-50 dark:bg-orange-950/30',
  eliminated: 'text-muted-foreground',
  open: '',
}
const STATE_BADGE = {
  provisional: 'border-amber-400 bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  qualified: 'border-amber-800 bg-amber-800 text-white',
  tie_pending: 'border-orange-500 bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200',
  eliminated: 'border-stone-300 bg-stone-100 text-stone-600 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-300',
}

const signed = (n) => (n > 0 ? `+${n}` : String(n))

/** Where a row goes next: the confirmed destination, or (while provisional) the bracket slot it would take. */
function destinationOf(row, groupName, bracket) {
  if (row.destination) return row.destination
  if (row.state !== 'provisional' || !bracket) return null
  const label = `${row.position}º Grupo ${groupName}`
  const first = bracket.rounds[0]
  const match = first?.matches.find((m) => m.sides.some((side) => side.source === label))
  if (!match) return null
  return first.matches.length > 1 ? `${match.round_name} ${match.position}` : match.round_name
}

/** The table of one group, in the order the organizer's rules produce (see TiebreakExplainer). */
export default function StandingsTable({ group, bracket }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid={`standings-${group.name}`}>
        <caption className="sr-only">Classificação do Grupo {group.name}</caption>
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th scope="col" className="w-9 py-1.5 pl-2 text-left font-medium">#</th>
            <th scope="col" className="py-1.5 text-left font-medium">Jogador</th>
            <th scope="col" className="hidden w-7 py-1.5 text-center font-medium sm:table-cell" title="Jogos">J</th>
            <th scope="col" className="w-7 py-1.5 text-center font-medium" title="Vitórias">V</th>
            <th scope="col" className="w-7 py-1.5 text-center font-medium" title="Derrotas">D</th>
            <th scope="col" className="w-11 py-1.5 text-center font-medium" title="Saldo de sets">Sets</th>
            <th scope="col" className="w-12 py-1.5 pr-2 text-center font-medium" title="Saldo de games">Games</th>
          </tr>
        </thead>
        <tbody>
          {group.rows.map((row) => {
            const destination = destinationOf(row, group.name, bracket)
            return (
              <tr key={row.entry.id} data-testid={`standings-row-${row.entry.id}`} data-state={row.state} className="border-t">
                <td className={`border-l-4 py-2 pl-1.5 align-top font-semibold tabular-nums ${STATE_BAR[row.state]} ${STATE_CELL[row.state]}`}>
                  {row.tied ? '=' : ''}{row.position}º
                </td>
                <td className={`py-2 pr-1 align-top ${STATE_CELL[row.state]}`}>
                  <div className="font-medium">
                    {row.entry.seed ? <span className="mr-1 text-xs font-normal text-muted-foreground">({row.entry.seed})</span> : null}
                    {row.entry.display_name}
                    {row.entry.withdrawn ? <span className="ml-1 text-xs font-normal">(desistiu)</span> : null}
                  </div>
                  {STATE_LABEL[row.state] && (
                    <span data-testid={`standings-state-${row.entry.id}`} className={`mt-1 inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold ${STATE_BADGE[row.state]}`}>
                      {STATE_LABEL[row.state]}
                    </span>
                  )}
                  {destination && (
                    <span data-testid={`standings-destination-${row.entry.id}`} className="ml-1 mt-1 inline-flex items-center gap-0.5 text-xs font-medium text-amber-900 dark:text-amber-300">
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />{destination}
                    </span>
                  )}
                </td>
                {[row.played, row.wins, row.losses, signed(row.sets_diff), signed(row.games_diff)].map((value, index) => (
                  <td key={index} className={`py-2 text-center align-top tabular-nums ${STATE_CELL[row.state]} ${index === 0 ? 'hidden sm:table-cell' : ''} ${index === 4 ? 'pr-2' : ''}`}>{value}</td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
