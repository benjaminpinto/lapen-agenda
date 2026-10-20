import {useCallback, useState} from 'react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {useToast} from '@/contexts/ToastContext'
import {ADMIN_API, errorMessage, request} from './tournamentApi'
import {categoryMatchFormat, OUTCOMES} from './labels'
import {entryLabel} from './drawUtils'
import ScoreGrid from '@/components/shared/ScoreGrid'
import {emptyGrid, gridFromScore, isFilled, needsSuperTiebreak, SCORE_COLUMNS, scoreFromGrid, winnerSide} from '@/utils/scoreGrid'

const selectClass = 'h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm'

export default function ResultDialog({ tournament, category, match, mode, onClose, onSaved }) {
  const { toast } = useToast()
  const first = match.entry1, second = match.entry2
  const columns = SCORE_COLUMNS[categoryMatchFormat(tournament, category)] || SCORE_COLUMNS.best_of_3_super_tb
  const recordedWinner = match.winner_entry_id === first?.registration_id ? 1 : match.winner_entry_id === second?.registration_id ? 2 : ''
  const [form, setForm] = useState({
    outcome: mode === 'correct' && match.outcome ? match.outcome : 'normal',
    side: mode === 'correct' ? recordedWinner : '',
    played_at: match.played_at ? match.played_at.slice(0, 10) : '',
  })
  const [grid, setGrid] = useState(() => (mode === 'correct' && ['normal', 'retired'].includes(match.outcome) && match.score ? gridFromScore(match.score) : emptyGrid()))
  const [saving, setSaving] = useState(false)
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  const changeScore = useCallback((key, index, value) => {
    setGrid((current) => ({ ...current, [key]: current[key].map((cell, i) => (i === index ? value : cell)) }))
  }, [])

  const retired = form.outcome === 'retired'
  const needsScore = ['normal', 'retired'].includes(form.outcome)
  const names = [entryLabel(first), entryLabel(second)]
  // A normal result decides the winner by itself. A retirement is not decided by the score, so the organizer says who went on.
  const scoreWinner = form.outcome === 'normal' ? winnerSide(grid, columns) : null
  const stbEnabled = columns.length > 1 && (retired ? isFilled(grid.set1) && isFilled(grid.set2) : needsSuperTiebreak(grid))

  const problem = () => {
    if (form.outcome === 'double_wo') return null
    if (needsScore && !isFilled(grid.set1)) return retired ? 'Informe o placar até a desistência' : (columns.length > 1 ? 'Preencha os dois primeiros sets' : 'Preencha o placar do set')
    if (form.outcome === 'normal') {
      if (columns.length > 1 && !isFilled(grid.set2)) return 'Preencha os dois primeiros sets'
      if (columns.length > 1 && needsSuperTiebreak(grid) && !isFilled(grid.stb)) return 'Preencha o super tiebreak (terceiro set)'
      return scoreWinner ? null : 'Placar sem vencedor claro'
    }
    return form.side ? null : 'Selecione o vencedor'
  }

  const submit = async (event) => {
    event.preventDefault()
    const message = problem()
    if (message) {
      toast({ title: message, variant: 'destructive' })
      return
    }
    setSaving(true)
    const side = form.outcome === 'normal' ? scoreWinner : Number(form.side)
    const body = { outcome: form.outcome }
    if (form.outcome !== 'double_wo') body.winner_registration_id = (side === 1 ? first : second).registration_id
    if (needsScore) body.score = scoreFromGrid(grid, columns)
    if (form.played_at) body.played_at = form.played_at
    const result = await request(mode === 'correct' ? 'PATCH' : 'PUT', `${ADMIN_API}/${tournament.id}/matches/${match.id}/result`, body)
    setSaving(false)
    if (result.ok) {
      toast({ title: mode === 'correct' ? 'Resultado corrigido' : 'Resultado lançado' })
      onSaved(result.data)
    } else {
      toast({ title: errorMessage(result), variant: 'destructive' })
    }
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="w-full max-w-lg" data-testid="result-dialog">
        <DialogHeader>
          <DialogTitle>{mode === 'correct' ? 'Corrigir resultado' : 'Lançar resultado'}</DialogTitle>
          <DialogDescription data-testid="result-dialog-match">{names[0]} × {names[1]}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="result-outcome">Desfecho</Label>
            <select id="result-outcome" data-testid="result-outcome" className={selectClass} value={form.outcome} onChange={set('outcome')}>
              {Object.entries(OUTCOMES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          {needsScore && (
            <div className="space-y-1.5">
              <Label>{retired ? 'Placar até a desistência' : 'Placar'}</Label>
              <ScoreGrid players={names} grid={grid} onChange={changeScore} columns={columns} stbEnabled={stbEnabled} testIdPrefix="result-score" />
            </div>
          )}
          {scoreWinner && (
            <p className="text-sm text-stone-700" data-testid="result-winner-preview">Vencedor: <strong>{names[scoreWinner - 1]}</strong></p>
          )}
          {['wo', 'retired'].includes(form.outcome) && (
            <fieldset className="space-y-2" data-testid="result-winner">
              <legend className="text-sm font-medium leading-none mb-2">{retired ? 'Quem continuou (vencedor)' : 'Vencedor por W.O.'}</legend>
              {[1, 2].map((side) => (
                <label key={side} className="flex min-h-[44px] items-center gap-2 rounded-md border border-gray-200 px-3 text-sm">
                  <input type="radio" name="result-winner" value={side} checked={Number(form.side) === side} onChange={set('side')} data-testid={`result-winner-${side}`} />
                  <span>{names[side - 1]}</span>
                </label>
              ))}
            </fieldset>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="result-date">Data da partida (opcional)</Label>
            <Input id="result-date" data-testid="result-date" type="date" value={form.played_at} onChange={set('played_at')} />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} data-testid="result-cancel" className="min-h-[44px]">Voltar</Button>
            <Button type="submit" disabled={saving} data-testid="result-submit" className="min-h-[44px] bg-amber-700 hover:bg-amber-800 text-white">{saving ? 'Salvando…' : 'Salvar resultado'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
