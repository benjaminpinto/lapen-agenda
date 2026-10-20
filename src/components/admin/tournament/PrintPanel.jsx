import {Printer} from 'lucide-react'
import {useEffect, useState} from 'react'
import {Button} from '@/components/ui/button'
import PrintRoot from '@/components/ui/PrintRoot'
import {gridFromScore, SCORE_COLUMNS} from '@/utils/scoreGrid'
import {sideLabel} from './drawUtils'
import {categoryMatchFormat, DRAW_FORMATS, formatDate, MATCH_FORMATS, PLAYING_STATUSES} from './labels'
import {ADMIN_API, errorMessage, request} from './tournamentApi'

const NOTE = { wo: 'W.O.', double_wo: 'Duplo W.O.', retired: 'Desistência' }
const BOX = 'border border-black px-1'
// A group of 5 (10 games) still fits a column whole; bigger blocks flow across columns instead of jumping to a new page.
const MAX_UNSPLIT_MATCHES = 10

/** One game on paper: a row per player with a box per set. A recorded result is written in the boxes. */
function MatchRows({ match, columns }) {
  const done = match.status === 'completed'
  const grid = done && ['normal', 'retired'].includes(match.outcome) && match.score ? gridFromScore(match.score) : null
  return (
    <tbody className="break-inside-avoid">
      {[1, 2].map((slot) => {
        const entry = match[`entry${slot}`]
        const won = done && entry && match.winner_entry_id === entry.registration_id
        const top = slot === 1 ? 'border-t-2' : ''
        return (
          <tr key={slot} className="h-[6mm]">
            <td className={`${BOX} ${top} ${won ? 'font-bold' : ''} ${entry ? '' : 'italic'}`}>{sideLabel(match, slot)}</td>
            {columns.map((column) => (
              <td key={column.key} className={`${BOX} ${top} text-center tabular-nums`}>{grid?.[column.key][slot - 1]}</td>
            ))}
            {slot === 1 && <td rowSpan={2} className={`${BOX} border-t-2 align-top text-[7pt]`}>{done ? NOTE[match.outcome] : null}</td>}
          </tr>
        )
      })}
    </tbody>
  )
}

function Block({ title, matches, columns }) {
  return (
    <section className={`mb-3 ${matches.length <= MAX_UNSPLIT_MATCHES ? 'break-inside-avoid' : ''}`}>
      <h3 className="mb-0.5 text-[9pt] font-bold">{title}</h3>
      <table className="w-full table-fixed border-collapse text-[8pt] leading-tight">
        <colgroup>
          <col />
          {columns.map((column) => <col key={column.key} className="w-[13mm]" />)}
          <col className="w-[17mm]" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className={`${BOX} text-left`}>Jogador</th>
            {columns.map((column) => <th key={column.key} scope="col" className={`${BOX} text-center`}>{column.label}</th>)}
            <th scope="col" className={`${BOX} text-left`}>Obs.</th>
          </tr>
        </thead>
        {matches.map((match) => <MatchRows key={match.id} match={match} columns={columns} />)}
      </table>
    </section>
  )
}

/** The category's sheet: header with the tournament data, then the games of every group and round. */
function Sheet({ tournament, category, draw, updated }) {
  const matchFormat = categoryMatchFormat(tournament, category)
  const columns = SCORE_COLUMNS[matchFormat] || SCORE_COLUMNS.best_of_3_super_tb
  const blocks = [
    ...draw.groups.map((group) => ({
      key: `group-${group.id}`,
      title: draw.format === 'round_robin' ? 'Jogos' : `Grupo ${group.name}`,
      matches: [...group.matches].sort((a, b) => a.round_number - b.round_number || a.bracket_position - b.bracket_position),
    })),
    ...(draw.knockout?.rounds ?? []).map((round) => ({
      key: `round-${round.round_number}`,
      title: round.name,
      matches: [...round.matches].sort((a, b) => a.bracket_position - b.bracket_position),
    })),
  ]
  const total = blocks.reduce((sum, block) => sum + block.matches.length, 0)
  const info = [
    DRAW_FORMATS[category.draw_format],
    MATCH_FORMATS[matchFormat],
    `${formatDate(tournament.start_date)} a ${formatDate(tournament.end_date)}`,
    tournament.location,
  ].filter(Boolean).join(' · ')

  return (
    <section className="break-after-page last:break-after-auto" data-testid={`score-sheet-${category.id}`}>
      <header className="mb-2 border-b border-black pb-1 text-[9pt] leading-tight">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <h1 className="text-[13pt] font-bold">{tournament.name} — {category.name}</h1>
          <span className="text-[8pt]">Resultados lançados até {updated}</span>
        </div>
        <p>{info}</p>
        <p className="text-[8pt]">
          Anote os games de cada set (ex.: 6 e 4). STB: super tie-break, só se o jogo estiver 1 set a 1. W.O. ou desistência: escreva em Obs. e circule o vencedor.
        </p>
      </header>
      <div className={`${total > 14 ? 'columns-3' : 'columns-2'} gap-x-6`}>
        {blocks.map((block) => <Block key={block.key} title={block.title} matches={block.matches} columns={columns} />)}
        {draw.knockout_pending && <p className="break-inside-avoid text-[8pt] italic">O mata-mata será sorteado quando os grupos terminarem.</p>}
      </div>
    </section>
  )
}

export default function PrintPanel({ tournament, categories }) {
  const playable = categories.filter((category) => PLAYING_STATUSES.includes(category.status))
  const key = playable.map((category) => category.id).join(',')
  const [draws, setDraws] = useState(null)
  const [loadedAt, setLoadedAt] = useState(null)
  const [error, setError] = useState(null)
  const [skipped, setSkipped] = useState(() => new Set())

  // The sheets carry the results recorded so far, so they are read again every time the tab opens.
  useEffect(() => {
    let cancelled = false
    setDraws(null)
    Promise.all(playable.map((category) => request('GET', `${ADMIN_API}/${tournament.id}/categories/${category.id}/draw`))).then((results) => {
      if (cancelled) return
      const failed = results.find((result) => !result.ok)
      if (failed) {
        setError(errorMessage(failed))
        return
      }
      setError(null)
      setDraws(Object.fromEntries(playable.map((category, index) => [category.id, results[index].data.draw])))
      setLoadedAt(new Date())
    })
    return () => { cancelled = true }
  }, [tournament.id, key])

  if (playable.length === 0) {
    return <p className="text-stone-600 border border-dashed border-stone-300 rounded-lg p-6 text-center" data-testid="print-empty">Publique o sorteio de uma categoria para imprimir a folha de resultados.</p>
  }

  const selected = playable.filter((category) => !skipped.has(category.id))
  const toggle = (id) => setSkipped((current) => {
    const next = new Set(current)
    if (!next.delete(id)) next.add(id)
    return next
  })

  return (
    <div className="space-y-4" data-testid="print-panel">
      <p className="text-sm text-stone-700">
        Uma folha A4 (paisagem) por categoria, com os jogos dos grupos e da chave. Os resultados já lançados saem preenchidos; os demais ficam em branco para anotar à mão.
      </p>
      <fieldset className="space-y-2" data-testid="print-categories">
        <legend className="mb-2 text-sm font-medium">Categorias</legend>
        {playable.map((category) => (
          <label key={category.id} className="flex min-h-[44px] items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm">
            <input type="checkbox" checked={!skipped.has(category.id)} onChange={() => toggle(category.id)} data-testid={`print-category-${category.id}`} />
            <span>{category.name}</span>
          </label>
        ))}
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-700" data-testid="print-error">{error}</p>}
      <Button
        type="button" onClick={() => window.print()} disabled={!draws || selected.length === 0}
        className="min-h-[44px] bg-amber-700 hover:bg-amber-800 text-white" data-testid="print-submit"
      >
        <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
        {draws ? `Imprimir ${selected.length} folha(s)` : 'Carregando…'}
      </Button>

      {draws && selected.length > 0 && (
        <PrintRoot testId="score-sheets">
          {selected.map((category) => (
            <Sheet
              key={category.id} tournament={tournament} category={category} draw={draws[category.id]}
              updated={loadedAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
            />
          ))}
        </PrintRoot>
      )}
    </div>
  )
}
