import {useCallback, useEffect, useMemo, useState} from 'react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {useToast} from '@/contexts/ToastContext'
import ConfirmDialog from './ConfirmDialog'
import {ADMIN_API, errorMessage, request} from './tournamentApi'
import {OUTCOMES} from './labels'
import {entryLabel, SCORE_HINT, sideLabel} from './drawUtils'

const selectClass = 'h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm'
const PLAYING = ['published', 'group_stage', 'knockout_stage', 'finished']

const STATE_LABEL = {
  provisional: 'Avança (provisório)', open: '—', qualified: 'Classificado', eliminated: 'Eliminado', tie_pending: 'Empate — decisão do organizador',
}

const resultText = (match) => {
  if (match.status !== 'completed') return null
  if (match.outcome === 'bye') return 'BYE'
  if (match.outcome === 'double_wo') return 'Duplo W.O.'
  if (match.outcome === 'wo') return 'W.O.'
  return match.score
}

function ResultDialog({ tournament, match, mode, onClose, onSaved }) {
  const { toast } = useToast()
  const first = match.entry1, second = match.entry2
  const winnerSide = match.winner_entry_id === first?.registration_id ? 1 : match.winner_entry_id === second?.registration_id ? 2 : 1
  const [form, setForm] = useState({
    outcome: mode === 'correct' && match.outcome ? match.outcome : 'normal',
    side: mode === 'correct' ? winnerSide : 1,
    score: mode === 'correct' && match.score ? match.score.replace(/\s*ret\.$/, '') : '',
    played_at: match.played_at ? match.played_at.slice(0, 10) : '',
  })
  const [saving, setSaving] = useState(false)
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  const needsScore = ['normal', 'retired'].includes(form.outcome)

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    const body = { outcome: form.outcome }
    if (form.outcome !== 'double_wo') body.winner_registration_id = (Number(form.side) === 1 ? first : second).registration_id
    if (needsScore) body.score = form.score
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
          <DialogDescription data-testid="result-dialog-match">{entryLabel(first)} × {entryLabel(second)}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="result-outcome">Desfecho</Label>
            <select id="result-outcome" data-testid="result-outcome" className={selectClass} value={form.outcome} onChange={set('outcome')}>
              {Object.entries(OUTCOMES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          {form.outcome !== 'double_wo' && (
            <div className="space-y-1.5">
              <Label htmlFor="result-winner">{form.outcome === 'retired' ? 'Quem continuou (vencedor)' : 'Vencedor'}</Label>
              <select id="result-winner" data-testid="result-winner" className={selectClass} value={form.side} onChange={set('side')}>
                <option value={1}>{entryLabel(first)}</option>
                <option value={2}>{entryLabel(second)}</option>
              </select>
            </div>
          )}
          {needsScore && (
            <div className="space-y-1.5">
              <Label htmlFor="result-score">{form.outcome === 'retired' ? 'Placar até a desistência' : 'Placar'}</Label>
              <Input id="result-score" data-testid="result-score" required value={form.score} onChange={set('score')} placeholder="6-4, 3-6, 10-8" autoComplete="off" />
              <p className="text-xs text-stone-500">{SCORE_HINT}</p>
            </div>
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

function Standings({ tournament, group, onChanged }) {
  const { toast } = useToast()
  const [ranks, setRanks] = useState({})
  const decide = async (tie) => {
    const order = [...tie.entries].sort((a, b) => Number(ranks[a.registration_id]) - Number(ranks[b.registration_id])).map((entry) => entry.registration_id)
    const result = await request('PUT', `${ADMIN_API}/${tournament.id}/groups/${group.id}/tiebreak`, { order })
    if (result.ok) {
      toast({ title: 'Empate decidido' })
      setRanks({})
      onChanged()
    } else {
      toast({ title: errorMessage(result), variant: 'destructive' })
    }
  }
  const ready = (tie) => {
    const chosen = tie.entries.map((entry) => ranks[entry.registration_id])
    return chosen.every(Boolean) && new Set(chosen).size === chosen.length
  }

  return (
    <div className="rounded-md border border-stone-200 bg-white p-3" data-testid={`standings-${group.name}`}>
      <p className="font-semibold text-stone-900 mb-2">Grupo {group.name}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-stone-500">
              <th className="pr-2">#</th><th className="pr-2">Jogador</th><th className="px-1">J</th><th className="px-1">V</th><th className="px-1">D</th>
              <th className="px-1">Sets</th><th className="px-1">Games</th><th className="pl-2">Situação</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row) => (
              <tr key={row.registration_id} className="border-t border-stone-100" data-testid={`standing-${group.name}-${row.registration_id}`}>
                <td className="pr-2 py-1">{row.position}</td>
                <td className="pr-2 font-medium">{row.display_name}</td>
                <td className="px-1">{row.played}</td><td className="px-1">{row.wins}</td><td className="px-1">{row.losses}</td>
                <td className="px-1 whitespace-nowrap">{row.sets_won - row.sets_lost > 0 ? '+' : ''}{row.sets_won - row.sets_lost}</td>
                <td className="px-1 whitespace-nowrap">{row.games_won - row.games_lost > 0 ? '+' : ''}{row.games_won - row.games_lost}</td>
                <td className="pl-2 text-xs" data-testid={`standing-state-${group.name}-${row.registration_id}`}>{STATE_LABEL[row.state]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {group.ties.filter((tie) => tie.relevant && group.complete).map((tie) => (
        <div key={tie.entries.map((e) => e.registration_id).join('-')} className="mt-3 rounded-md bg-orange-50 border border-orange-200 p-3 space-y-2" data-testid={`tie-${group.name}`}>
          <p className="text-sm font-semibold text-orange-900">Empate — decisão do organizador</p>
          <p className="text-xs text-orange-900">Os critérios (vitórias, jogos disputados, confronto direto, % de sets e de games) não separaram estes jogadores. Defina a ordem.</p>
          {tie.entries.map((entry) => (
            <div key={entry.registration_id} className="flex items-center gap-2">
              <span className="flex-1 text-sm">{entry.display_name}</span>
              <select
                aria-label={`Posição de ${entry.display_name}`} data-testid={`tie-rank-${entry.registration_id}`} className="h-10 rounded-md border border-gray-200 bg-white px-2 text-sm"
                value={ranks[entry.registration_id] || ''} onChange={(event) => setRanks({ ...ranks, [entry.registration_id]: event.target.value })}
              >
                <option value="">Posição…</option>
                {tie.entries.map((_, index) => <option key={index} value={index + 1}>{index + 1}º</option>)}
              </select>
            </div>
          ))}
          <Button onClick={() => decide(tie)} disabled={!ready(tie)} data-testid={`tie-submit-${group.name}`} className="min-h-[44px] bg-amber-700 hover:bg-amber-800 text-white">Decidir empate</Button>
        </div>
      ))}
    </div>
  )
}

function MatchRow({ match, tournament, onRecord, onCorrect, onAnnul }) {
  const ready = match.status === 'pending' && match.entry1 && match.entry2
  const text = resultText(match)
  const winner = (slot) => match.status === 'completed' && match.winner_entry_id && match[`entry${slot}`]?.registration_id === match.winner_entry_id
  const started = tournament.status === 'in_progress'
  return (
    <li className="rounded-md border border-stone-200 bg-white p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between" data-testid={`match-${match.id}`}>
      <div className="min-w-0">
        <p className="text-sm">
          <span className={winner(1) ? 'font-bold' : ''}>{sideLabel(match, 1)}</span>
          <span className="text-stone-400 mx-1.5">×</span>
          <span className={winner(2) ? 'font-bold' : ''}>{sideLabel(match, 2)}</span>
        </p>
        <p className="text-xs text-stone-500" data-testid={`match-status-${match.id}`}>
          {text ? `${text}${match.played_at ? ` · ${match.played_at.slice(8, 10)}/${match.played_at.slice(5, 7)}` : ''}` : (ready ? 'A jogar' : 'Aguardando adversário')}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {ready && <Button size="sm" onClick={() => onRecord(match)} disabled={!started} data-testid={`record-result-${match.id}`} className="min-h-[44px] bg-amber-700 hover:bg-amber-800 text-white">Lançar resultado</Button>}
        {match.status === 'completed' && match.outcome !== 'bye' && (
          <>
            <Button size="sm" variant="outline" onClick={() => onCorrect(match)} data-testid={`correct-result-${match.id}`} className="min-h-[44px]">Corrigir</Button>
            <Button size="sm" variant="outline" onClick={() => onAnnul(match)} data-testid={`annul-result-${match.id}`} className="min-h-[44px] text-red-700 border-red-300">Anular</Button>
          </>
        )}
      </div>
    </li>
  )
}

export default function MatchesPanel({ tournament, categories, reload }) {
  const { toast } = useToast()
  const playable = categories.filter((category) => PLAYING.includes(category.status))
  const [categoryId, setCategoryId] = useState('')
  const [draw, setDraw] = useState(null)
  const [groups, setGroups] = useState([])
  const [dialog, setDialog] = useState(null) // { match, mode }
  const [annulling, setAnnulling] = useState(null)
  const [busy, setBusy] = useState(false)
  const current = playable.find((c) => String(c.id) === String(categoryId)) || playable[0]

  const load = useCallback(async () => {
    if (!current) return
    const [drawResult, standingsResult] = await Promise.all([
      request('GET', `${ADMIN_API}/${tournament.id}/categories/${current.id}/draw`),
      current.draw_format === 'knockout' ? Promise.resolve({ ok: true, data: { groups: [] } }) : request('GET', `${ADMIN_API}/${tournament.id}/categories/${current.id}/standings`),
    ])
    if (drawResult.ok) setDraw(drawResult.data.draw)
    if (standingsResult.ok) setGroups(standingsResult.data.groups)
  }, [tournament.id, current?.id, current?.status])

  useEffect(() => { load() }, [load])

  const applyResult = (data) => {
    setDraw(data.draw)
    setGroups(data.standings || [])
    setDialog(null)
    reload()
  }

  const annul = async () => {
    setBusy(true)
    const result = await request('DELETE', `${ADMIN_API}/${tournament.id}/matches/${annulling.id}/result`)
    setBusy(false)
    setAnnulling(null)
    if (result.ok) { toast({ title: 'Resultado anulado' }); applyResult(result.data) }
    else toast({ title: errorMessage(result), variant: 'destructive' })
  }

  const matchesByGroup = useMemo(() => {
    if (!draw) return []
    return draw.groups.map((group) => ({ group, matches: [...group.matches].sort((a, b) => a.round_number - b.round_number || a.bracket_position - b.bracket_position) }))
  }, [draw])

  if (playable.length === 0) {
    return <p className="text-stone-600 border border-dashed border-stone-300 rounded-lg p-6 text-center" data-testid="matches-empty">Publique o sorteio de uma categoria para lançar resultados.</p>
  }

  return (
    <div className="space-y-5" data-testid="matches-panel">
      {tournament.status !== 'in_progress' && (
        <p className="text-sm text-stone-700 bg-amber-50 border border-amber-200 rounded-md p-3" data-testid="matches-not-started">
          {tournament.status === 'registration_closed' ? 'Inicie o torneio para lançar resultados.' : 'Os resultados só podem ser lançados com o torneio em andamento.'}
        </p>
      )}
      <select data-testid="matches-category" aria-label="Categoria" className={selectClass} value={current.id} onChange={(event) => { setDraw(null); setCategoryId(event.target.value) }}>
        {playable.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
      </select>

      {groups.length > 0 && (
        <section className="space-y-3" data-testid="standings-section">
          <h3 className="font-semibold text-stone-900">Classificação dos grupos</h3>
          <div className="grid gap-3 lg:grid-cols-2">
            {groups.map((group) => <Standings key={group.id} tournament={tournament} group={group} onChanged={() => { load(); reload() }} />)}
          </div>
        </section>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-2">
      {draw && matchesByGroup.map(({ group, matches }) => (
        <section key={group.id} className="space-y-2" data-testid={`group-matches-${group.name}`}>
          <h3 className="font-semibold text-stone-900">{draw.format === 'round_robin' ? 'Jogos' : `Jogos do grupo ${group.name}`}</h3>
          <ul className="space-y-2">
            {matches.map((match) => <MatchRow key={match.id} match={match} tournament={tournament} onRecord={(m) => setDialog({ match: m, mode: 'record' })} onCorrect={(m) => setDialog({ match: m, mode: 'correct' })} onAnnul={setAnnulling} />)}
          </ul>
        </section>
      ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
      {draw?.knockout && draw.knockout.rounds.map((round) => (
        <section key={round.round_number} className="space-y-2" data-testid={`knockout-round-${round.round_number}`}>
          <h3 className="font-semibold text-stone-900">{round.name}</h3>
          <ul className="space-y-2">
            {round.matches.map((match) => <MatchRow key={match.id} match={match} tournament={tournament} onRecord={(m) => setDialog({ match: m, mode: 'record' })} onCorrect={(m) => setDialog({ match: m, mode: 'correct' })} onAnnul={setAnnulling} />)}
          </ul>
        </section>
      ))}
      </div>
      {draw?.knockout_pending && (
        <p className="text-sm text-stone-600 bg-stone-100 rounded-md p-3" data-testid="knockout-pending-note">O mata-mata será sorteado quando os grupos terminarem.</p>
      )}

      {dialog && <ResultDialog tournament={tournament} match={dialog.match} mode={dialog.mode} onClose={() => setDialog(null)} onSaved={applyResult} />}
      <ConfirmDialog
        open={Boolean(annulling)} destructive busy={busy} title="Anular o resultado?"
        description="A partida volta a ficar pendente e o vencedor sai da partida seguinte. Só é possível se a partida seguinte ainda não tiver resultado."
        confirmLabel="Anular resultado" onConfirm={annul} onCancel={() => setAnnulling(null)}
      />
    </div>
  )
}
