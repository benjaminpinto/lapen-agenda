import {Check} from 'lucide-react'
import {plannedText, playedText, scoreParts} from './format'

function SetScore({ set, side }) {
  const own = set.games[side]
  const other = set.games[1 - side]
  const text = set.superTiebreak ? `[${own}]` : String(own)
  return (
    <span className={`inline-block min-w-[1.25rem] text-center ${own > other ? 'font-bold' : ''}`}>
      {text}
      {!set.superTiebreak && set.tiebreak !== null && own < other && <sup className="text-[0.6rem] text-muted-foreground">{set.tiebreak}</sup>}
    </span>
  )
}

function PlayerRow({ side, index, winnerSide, completed, sets, bye }) {
  const { entry, source } = side
  const won = winnerSide === index + 1
  const lost = completed && winnerSide && !won
  return (
    <div
      data-testid={`match-player-${index + 1}`}
      data-winner={won ? 'true' : undefined}
      className={`flex items-center justify-between gap-2 px-2 py-1.5 ${won ? 'bg-amber-100 font-semibold dark:bg-amber-900/30' : ''} ${lost ? 'text-muted-foreground' : ''}`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {won && <Check className="h-3.5 w-3.5 shrink-0 text-amber-800 dark:text-amber-400" aria-hidden="true" />}
        {won && <span className="sr-only">Vencedor: </span>}
        {entry ? (
          <span className="min-w-0 truncate" title={entry.display_name}>
            {entry.seed ? <span className="mr-1 text-xs font-normal text-muted-foreground">({entry.seed})</span> : null}
            {entry.display_name}
            {entry.withdrawn ? <span className="ml-1 text-xs font-normal">(desistiu)</span> : null}
          </span>
        ) : (
          <span className="min-w-0 truncate italic text-muted-foreground" title={source || (bye ? 'Bye' : 'A definir')}>{source || (bye ? 'Bye' : 'A definir')}</span>
        )}
      </span>
      {sets.length > 0 && (
        <span className="flex shrink-0 gap-1 font-mono text-sm tabular-nums">
          {sets.map((set, i) => <SetScore key={i} set={set} side={index} />)}
        </span>
      )}
    </div>
  )
}

function footer(match, note) {
  if (match.outcome === 'bye') return 'Avança sem jogar'
  if (match.status === 'completed') {
    const when = playedText(match)
    return [note, when && `Jogado em ${when}`].filter(Boolean).join(' · ') || 'Encerrado'
  }
  const ready = match.sides.every((side) => side.entry)
  if (!ready) return 'Aguardando definição dos jogadores'
  return plannedText(match) || 'A agendar'
}

/** One game: both players, who won, the score by set and when/where it is (or was) played. */
export default function MatchCard({ match, showContext = false, className = '' }) {
  const { sets, note } = scoreParts(match)
  const completed = match.status === 'completed'
  const context = match.stage === 'group' ? `Grupo ${match.group} · Rodada ${match.round_number}` : match.round_name
  return (
    <div
      data-testid={`match-card-${match.id}`}
      data-status={match.status}
      data-outcome={match.outcome || undefined}
      className={`overflow-hidden rounded-md border bg-card text-sm shadow-sm ${className}`}
    >
      {showContext && context && <div className="border-b bg-muted/50 px-2 py-1 text-xs font-medium text-muted-foreground">{context}</div>}
      <div className="divide-y">
        {match.sides.map((side, index) => (
          <PlayerRow key={index} side={side} index={index} winnerSide={match.winner_side} completed={completed} sets={sets} bye={match.outcome === 'bye'} />
        ))}
      </div>
      <div className="border-t bg-muted/30 px-2 py-1 text-xs text-muted-foreground" data-testid={`match-footer-${match.id}`}>
        {footer(match, note)}
      </div>
    </div>
  )
}
