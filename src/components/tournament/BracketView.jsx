import {useRef, useState} from 'react'
import MatchCard from './MatchCard'
import useMediaQuery from './useMediaQuery'

const LINE = 'absolute border-stone-400 dark:border-stone-600'
const sorted = (round) => [...round.matches].sort((a, b) => a.position - b.position)

/** Desktop: the whole tree, a column per round, each game centred between the two that feed it. */
function BracketTree({ rounds }) {
  const last = rounds.length - 1
  return (
    <div className="overflow-x-auto rounded-lg border bg-card p-3" data-testid="bracket-scroll">
      <div className="flex min-w-max" data-testid="bracket-tree">
        {rounds.map((round, roundIndex) => (
          <div key={round.round_number} className="flex w-60 shrink-0 flex-col" data-testid={`bracket-round-${round.round_number}`}>
            <h4 className="pb-2 text-center text-sm font-semibold">{round.name}</h4>
            <div className="flex flex-1 flex-col">
              {sorted(round).map((match, index) => (
                <div
                  key={match.id}
                  className={`relative flex min-h-[7.5rem] flex-1 items-center py-1 ${roundIndex > 0 ? 'pl-4' : ''} ${roundIndex < last ? 'pr-4' : ''}`}
                >
                  {roundIndex > 0 && <span aria-hidden="true" className={`${LINE} left-0 top-1/2 w-4 border-t`} />}
                  <MatchCard match={match} className="w-full" />
                  {roundIndex < last && (
                    <>
                      <span aria-hidden="true" className={`${LINE} right-0 top-1/2 w-4 border-t`} />
                      <span aria-hidden="true" className={`${LINE} right-0 border-r ${index % 2 === 0 ? 'top-1/2 bottom-0' : 'top-0 h-1/2'}`} />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const firstOpenRound = (rounds) => (rounds.find((round) => round.matches.some((m) => m.status !== 'completed')) || rounds[rounds.length - 1]).round_number

/** Phone: one round at a time, picked with the tabs or by swiping. */
function BracketRounds({ rounds }) {
  const [chosen, setChosen] = useState(null)
  const touchStart = useRef(null)
  const current = chosen ?? firstOpenRound(rounds)
  const index = Math.max(0, rounds.findIndex((r) => r.round_number === current))
  const round = rounds[index]

  const go = (to) => {
    if (to >= 0 && to < rounds.length) setChosen(rounds[to].round_number)
  }
  const onTouchEnd = (event) => {
    if (touchStart.current === null) return
    const delta = event.changedTouches[0].clientX - touchStart.current
    touchStart.current = null
    if (Math.abs(delta) > 60) go(index + (delta < 0 ? 1 : -1))
  }

  return (
    <div data-testid="bracket-rounds">
      <div role="tablist" aria-label="Rodadas da chave" className="mb-3 flex gap-1 overflow-x-auto border-b">
        {rounds.map((r, i) => (
          <button
            key={r.round_number} type="button" role="tab" aria-selected={i === index} data-testid={`bracket-tab-${r.round_number}`}
            onClick={() => go(i)}
            className={`min-h-[44px] shrink-0 border-b-2 px-3 text-sm font-medium ${i === index ? 'border-amber-700 text-amber-900 dark:border-amber-500 dark:text-amber-300' : 'border-transparent text-muted-foreground'}`}
          >
            {r.name}
          </button>
        ))}
      </div>
      <p className="mb-2 text-xs text-muted-foreground">Rodada {index + 1} de {rounds.length} · deslize para o lado para trocar</p>
      <div
        className="space-y-3 touch-pan-y" data-testid={`bracket-round-${round.round_number}`} role="tabpanel"
        onTouchStart={(event) => { touchStart.current = event.touches[0].clientX }} onTouchEnd={onTouchEnd}
      >
        {sorted(round).map((match) => <MatchCard key={match.id} match={match} />)}
      </div>
    </div>
  )
}

export default function BracketView({ bracket }) {
  const wide = useMediaQuery('(min-width: 768px)')
  return wide ? <BracketTree rounds={bracket.rounds} /> : <BracketRounds rounds={bracket.rounds} />
}
