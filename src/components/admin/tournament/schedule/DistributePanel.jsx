import {useMemo, useState} from 'react'
import {Button} from '@/components/ui/button'
import {useToast} from '@/contexts/ToastContext'
import {ADMIN_API, errorMessage, request} from '../tournamentApi'
import {dayTitle} from './scheduleUtils'

const selectClass = 'h-10 w-full rounded-md border border-stone-300 bg-white px-2 text-sm'

const when = (iso) => {
  if (!iso) return '—'
  const [date, time] = iso.split('T')
  return `${dayTitle(date)} ${time.slice(0, 5)}`
}

const waitText = (minutes) => (minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60 ? String(minutes % 60).padStart(2, '0') : ''}` : `${minutes} min`)

/**
 * Distribute the pending matches: choose the scope, get a proposal (drawn on the grid, nothing written), then apply it.
 */
export default function DistributePanel({ tournamentId, schedule, proposal, onProposal, onApplied }) {
  const { toast } = useToast()
  const categories = useMemo(() => {
    const seen = new Map()
    schedule.matches.forEach((m) => seen.set(m.category_id, m.category_name))
    return [...seen.entries()].map(([id, name]) => ({ id, name }))
  }, [schedule.matches])
  const knockoutRounds = useMemo(() => {
    const rounds = new Map()
    schedule.matches.filter((m) => m.stage === 'knockout').forEach((m) => { if (!rounds.has(m.round_number)) rounds.set(m.round_number, m.round_name.replace(/ \d+$/, '')) })
    return [...rounds.entries()].sort(([a], [b]) => a - b)
  }, [schedule.matches])
  const [chosen, setChosen] = useState(null)               // null = all categories
  const [phase, setPhase] = useState('all')
  const [sessionIds, setSessionIds] = useState(null)       // null = all sessions
  const [from, setFrom] = useState('')
  const [redo, setRedo] = useState(false)
  const [busy, setBusy] = useState(false)

  const isChecked = (list, id) => list === null || list.includes(id)
  const toggle = (list, all, id) => {
    const current = list === null ? all : list
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    return next.length === all.length ? null : next
  }

  const body = () => {
    const options = { redo }
    if (chosen !== null) options.category_ids = chosen
    if (phase === 'group' || phase === 'knockout') options.stage = phase
    if (phase.startsWith('round-')) { options.stage = 'knockout'; options.round_number = Number(phase.slice(6)) }
    if (sessionIds !== null) options.session_ids = sessionIds
    if (from) options.from = from
    return options
  }

  const generate = async () => {
    setBusy(true)
    const result = await request('POST', `${ADMIN_API}/${tournamentId}/schedule/distribute`, body())
    setBusy(false)
    if (result.ok) onProposal(result.data)
    else toast({ title: errorMessage(result), variant: 'destructive' })
  }

  const apply = async () => {
    setBusy(true)
    const result = await request('POST', `${ADMIN_API}/${tournamentId}/schedule/apply`, { assignments: proposal.assignments, unassign: proposal.unassign })
    setBusy(false)
    if (result.ok) {
      toast({ title: `${proposal.assignments.length} partida(s) com horário` })
      onApplied(result.data)
    } else {
      toast({ title: errorMessage(result), description: result.data?.code === 'stale_proposal' ? 'Gere a proposta de novo.' : undefined, variant: 'destructive' })
    }
  }

  const allCategories = categories.map((c) => c.id)
  const allSessions = schedule.sessions.map((s) => s.id)
  const noSessions = schedule.sessions.length === 0

  return (
    <div className="space-y-4" data-testid="distribute-panel">
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-semibold text-stone-800">Categorias</legend>
        {categories.map((c) => (
          <label key={c.id} className="flex min-h-[40px] items-center gap-2 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-amber-700" checked={isChecked(chosen, c.id)} data-testid={`distribute-category-${c.id}`}
              onChange={() => setChosen(toggle(chosen, allCategories, c.id))} />
            {c.name}
          </label>
        ))}
      </fieldset>
      <label className="block space-y-1.5 text-sm font-semibold text-stone-800">
        Fase
        <select className={`${selectClass} font-normal`} value={phase} onChange={(e) => setPhase(e.target.value)} data-testid="distribute-phase">
          <option value="all">Todas as fases</option>
          <option value="group">Só a fase de grupos</option>
          <option value="knockout">Só o mata-mata (todas as rodadas)</option>
          {knockoutRounds.map(([round, name]) => <option key={round} value={`round-${round}`}>Mata-mata: rodada {round} ({name})</option>)}
        </select>
      </label>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-semibold text-stone-800">Sessões</legend>
        {noSessions && <p className="text-sm text-stone-600">Crie ao menos uma sessão para distribuir.</p>}
        {schedule.sessions.map((s) => (
          <label key={s.id} className="flex min-h-[40px] items-center gap-2 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-amber-700" checked={isChecked(sessionIds, s.id)} data-testid={`distribute-session-${s.id}`}
              onChange={() => setSessionIds(toggle(sessionIds, allSessions, s.id))} />
            {dayTitle(s.date)} · {s.start}–{s.end} ({s.windows} janelas)
          </label>
        ))}
      </fieldset>
      <label className="block space-y-1.5 text-sm font-semibold text-stone-800">
        A partir de <span className="font-normal text-stone-500">(opcional: nada antes disso muda)</span>
        <input type="datetime-local" className={`${selectClass} font-normal`} value={from} onChange={(e) => setFrom(e.target.value)} data-testid="distribute-from" />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 h-5 w-5 accent-amber-700" checked={redo} onChange={(e) => setRedo(e.target.checked)} data-testid="distribute-redo" />
        <span>Refazer também as partidas que já têm horário <span className="text-stone-500">(as fixadas não mudam)</span></span>
      </label>
      <Button type="button" onClick={generate} disabled={busy || noSessions} data-testid="distribute-generate" className="min-h-[44px] w-full bg-amber-700 text-white hover:bg-amber-800">
        {busy && !proposal ? 'Calculando…' : proposal ? 'Gerar outra proposta' : 'Gerar proposta'}
      </Button>

      {proposal && (
        <div className="space-y-3 rounded-lg border-2 border-amber-600 bg-amber-50 p-3 text-sm" data-testid="distribute-result">
          <p className="font-semibold text-amber-950" data-testid="distribute-summary">
            {proposal.assignments.length} partida(s) com horário{proposal.unplaced.length ? `, ${proposal.unplaced.length} não couberam` : ''}.
          </p>
          <p className="text-stone-700" data-testid="distribute-feasibility">
            {proposal.feasibility.matches} a distribuir em {proposal.feasibility.windows} janelas livres.
            {proposal.feasibility.hint ? ` ${proposal.feasibility.hint}` : ''}
          </p>
          <ul className="space-y-0.5 text-stone-700" data-testid="distribute-metrics">
            <li>Termina: {when(proposal.metrics.ends_at)}</li>
            <li>Maior espera de um atleta: {waitText(proposal.metrics.max_wait_minutes)}</li>
            <li>Máximo de jogos de um atleta no mesmo dia: {proposal.metrics.max_matches_per_person_day}</li>
          </ul>
          {proposal.unplaced.length > 0 && (
            <details open data-testid="distribute-unplaced">
              <summary className="cursor-pointer font-semibold text-red-800">Não couberam ({proposal.unplaced.length})</summary>
              <ul className="mt-1 space-y-2">
                {proposal.unplaced.map((u) => (
                  <li key={u.match_id} className="rounded border border-red-300 bg-white p-2" data-testid={`unplaced-${u.match_id}`}>
                    <p className="font-medium">{u.label}</p>
                    <ul className="list-disc pl-4 text-xs text-stone-700">{u.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="text-xs text-stone-600">A proposta aparece tracejada no quadro. Nada é gravado até aplicar.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={apply} disabled={busy || (proposal.assignments.length === 0 && proposal.unassign.length === 0)} data-testid="distribute-apply" className="min-h-[44px] flex-1 bg-amber-700 text-white hover:bg-amber-800">Aplicar</Button>
            <Button type="button" variant="outline" onClick={() => onProposal(null)} data-testid="distribute-discard" className="min-h-[44px]">Descartar</Button>
          </div>
        </div>
      )}
    </div>
  )
}
