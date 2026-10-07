import {useCallback, useEffect, useState} from 'react'
import {Button} from '@/components/ui/button'
import {useToast} from '@/contexts/ToastContext'
import ConfirmDialog from './ConfirmDialog'
import {ADMIN_API, errorMessage, request} from './tournamentApi'
import {CATEGORY_STATUS, DRAW_FORMATS} from './labels'
import {drawEntries, entryLabel, sideLabel} from './drawUtils'

const selectClass = 'h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm'

export function DrawPreview({ draw, testId }) {
  return (
    <div className="space-y-4" data-testid={testId}>
      {draw.groups.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {draw.groups.map((group) => (
            <div key={group.id} className="rounded-md border border-stone-200 p-3" data-testid={`preview-group-${group.name}`}>
              <p className="font-semibold text-stone-900 mb-2">{draw.format === 'round_robin' ? 'Jogadores' : `Grupo ${group.name}`}</p>
              <ol className="space-y-1 text-sm">
                {group.entries.map((entry) => <li key={entry.registration_id}>{entryLabel(entry)}</li>)}
              </ol>
              <p className="text-xs text-stone-500 mt-2">{group.matches.length} jogos</p>
            </div>
          ))}
        </div>
      )}
      {draw.knockout && (
        <div className="grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(15rem,1fr))]">
          {draw.knockout.rounds.map((round) => (
            <div key={round.round_number} data-testid={`preview-round-${round.round_number}`}>
              <p className="text-sm font-semibold text-stone-800 mb-1">{round.name}</p>
              <ul className="space-y-1">
                {round.matches.map((match) => (
                  <li key={match.id} className="text-sm rounded border border-stone-200 px-3 py-1.5 flex flex-wrap gap-x-2" data-testid={`preview-match-${match.id}`}>
                    <span className="font-medium">{sideLabel(match, 1)}</span><span className="text-stone-400">×</span><span className="font-medium">{sideLabel(match, 2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {draw.knockout_pending && (
        <p className="text-sm text-stone-600 bg-stone-100 rounded-md p-3" data-testid="knockout-pending-note">
          Os classificados não completam uma chave: o mata-mata será sorteado quando os grupos terminarem, com bye para as melhores campanhas.
        </p>
      )}
    </div>
  )
}

function CategoryDraw({ tournament, category, reload }) {
  const { toast } = useToast()
  const [result, setResult] = useState(null)
  const [warnings, setWarnings] = useState([])
  const [busy, setBusy] = useState(false)
  const [confirmUndo, setConfirmUndo] = useState(false)
  const [swap, setSwap] = useState({ first: '', second: '' })
  const base = `${ADMIN_API}/${tournament.id}/categories/${category.id}/draw`
  const canDraw = ['registration_closed', 'in_progress'].includes(tournament.status)
  const hasDraw = category.status !== 'awaiting_draw'

  const load = useCallback(async () => {
    if (!hasDraw) { setResult(null); return }
    const response = await request('GET', base)
    if (response.ok) setResult(response.data)
  }, [base, hasDraw, category.status])

  useEffect(() => { load() }, [load])

  const run = async (method, url, success) => {
    setBusy(true)
    const response = await request(method, url, method === 'PUT' ? { swap: [Number(swap.first), Number(swap.second)] } : undefined)
    setBusy(false)
    if (!response.ok) {
      toast({ title: errorMessage(response), variant: 'destructive' })
      return null
    }
    toast({ title: success })
    return response
  }

  const generate = async () => {
    const response = await run('POST', base, 'Pré-visualização gerada')
    if (response) { setResult(response.data); setWarnings(response.data.warnings || []); setSwap({ first: '', second: '' }); reload() }
  }
  const publish = async () => {
    const response = await run('POST', `${base}/publish`, 'Sorteio publicado')
    if (response) { setResult(response.data); setWarnings([]); reload() }
  }
  const doSwap = async () => {
    const response = await run('PUT', base, 'Posições trocadas')
    if (response) { setResult(response.data); setSwap({ first: '', second: '' }) }
  }
  const undo = async () => {
    const response = await run('DELETE', base, 'Sorteio desfeito')
    setConfirmUndo(false)
    if (response) { setResult(null); setWarnings([]); reload() }
  }

  const entries = result && category.status === 'drawn' ? drawEntries(result.draw) : []

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 space-y-3" data-testid={`draw-category-${category.id}`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <h3 className="font-semibold text-stone-900">{category.name}</h3>
          <p className="text-sm text-stone-600">{DRAW_FORMATS[category.draw_format]} · {CATEGORY_STATUS[category.status]}</p>
          <p className="text-xs text-stone-500" data-testid={`draw-confirmed-${category.id}`}>{category.counts.confirmed} confirmada(s) · mínimo {category.min_entries}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {category.status === 'awaiting_draw' && (
            <Button onClick={generate} disabled={busy || !canDraw} data-testid={`draw-generate-${category.id}`} className="min-h-[44px] bg-amber-700 hover:bg-amber-800 text-white">Sortear</Button>
          )}
          {category.status === 'drawn' && (
            <>
              <Button variant="outline" onClick={generate} disabled={busy} data-testid={`draw-regenerate-${category.id}`} className="min-h-[44px]">Sortear de novo</Button>
              <Button onClick={publish} disabled={busy} data-testid={`draw-publish-${category.id}`} className="min-h-[44px] bg-amber-700 hover:bg-amber-800 text-white">Publicar sorteio</Button>
            </>
          )}
          {hasDraw && !['finished'].includes(category.status) && (
            <Button variant="outline" onClick={() => setConfirmUndo(true)} disabled={busy} data-testid={`draw-undo-${category.id}`} className="min-h-[44px] text-red-700 border-red-300">Desfazer sorteio</Button>
          )}
        </div>
      </div>

      {category.status === 'awaiting_draw' && !canDraw && (
        <p className="text-sm text-stone-600 bg-stone-100 rounded-md p-3" data-testid={`draw-blocked-${category.id}`}>Encerre as inscrições do torneio para poder sortear.</p>
      )}
      {warnings.map((warning) => <p key={warning} className="text-sm text-orange-800 bg-orange-50 rounded-md p-3" data-testid={`draw-warning-${category.id}`}>{warning}</p>)}

      {category.status === 'drawn' && entries.length > 0 && (
        <div className="rounded-md border border-dashed border-stone-300 p-3 space-y-2" data-testid={`draw-swap-${category.id}`}>
          <p className="text-sm font-medium text-stone-800">Ajuste manual: trocar dois inscritos de lugar</p>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <select aria-label="Primeiro inscrito" data-testid={`draw-swap-first-${category.id}`} className={selectClass} value={swap.first} onChange={(event) => setSwap({ ...swap, first: event.target.value })}>
              <option value="">Primeiro inscrito…</option>
              {entries.map((entry) => <option key={entry.registration_id} value={entry.registration_id}>{entry.display_name}</option>)}
            </select>
            <select aria-label="Segundo inscrito" data-testid={`draw-swap-second-${category.id}`} className={selectClass} value={swap.second} onChange={(event) => setSwap({ ...swap, second: event.target.value })}>
              <option value="">Segundo inscrito…</option>
              {entries.map((entry) => <option key={entry.registration_id} value={entry.registration_id}>{entry.display_name}</option>)}
            </select>
            <Button variant="outline" onClick={doSwap} disabled={busy || !swap.first || !swap.second} data-testid={`draw-swap-submit-${category.id}`} className="min-h-[44px]">Trocar</Button>
          </div>
        </div>
      )}

      {result && <DrawPreview draw={result.draw} testId={`draw-preview-${category.id}`} />}

      <ConfirmDialog
        open={confirmUndo} destructive busy={busy} title="Desfazer o sorteio?"
        description="A chave e os grupos serão apagados e a categoria volta a aguardar o sorteio. Só é possível enquanto não houver resultados lançados."
        confirmLabel="Desfazer sorteio" onConfirm={undo} onCancel={() => setConfirmUndo(false)}
      />
    </section>
  )
}

export default function DrawPanel({ tournament, categories, reload }) {
  if (categories.length === 0) {
    return <p className="text-stone-600 border border-dashed border-stone-300 rounded-lg p-6 text-center" data-testid="draw-empty">Cadastre categorias antes de sortear.</p>
  }
  return (
    <div className="space-y-4" data-testid="draw-panel">
      {categories.map((category) => <CategoryDraw key={category.id} tournament={tournament} category={category} reload={reload} />)}
    </div>
  )
}
