import {useCallback, useEffect, useMemo, useState} from 'react'
import {AlertTriangle, Eye, EyeOff, Lock, Pencil, Plus, Trash2, Unlock, X} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {useToast} from '@/contexts/ToastContext'
import ConfirmDialog from '../ConfirmDialog'
import {ADMIN_API, errorMessage, request} from '../tournamentApi'
import ConflictsPanel from './ConflictsPanel'
import DistributePanel from './DistributePanel'
import ScheduleGrid from './ScheduleGrid'
import SessionDialog from './SessionDialog'
import UnscheduledList from './UnscheduledList'
import {buildDays, conflictLevels, courtName, dayTitle, matchTitle, publishedText, windowKey} from './scheduleUtils'

const chip = 'inline-flex items-center gap-1 rounded-full border bg-white px-3 py-1 text-xs font-medium'

/** The Cronograma tab: sessions, the day grid, matches without a time, conflicts and the automatic distribution. */
export default function SchedulePanel({ tournament }) {
  const { toast } = useToast()
  const [schedule, setSchedule] = useState(null)
  const [error, setError] = useState(null)
  const [day, setDay] = useState(null)
  const [selection, setSelection] = useState(null)      // {kind: 'match', id} | {kind: 'window', key, window}
  const [proposal, setProposal] = useState(null)
  const [sidebar, setSidebar] = useState('unscheduled')
  const [sessionDialog, setSessionDialog] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [attention, setAttention] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const [busy, setBusy] = useState(false)
  const terminal = ['finished', 'cancelled'].includes(tournament.status)
  const api = `${ADMIN_API}/${tournament.id}/schedule`

  const load = useCallback(async () => {
    const result = await request('GET', api)
    if (result.ok) { setSchedule(result.data); setError(null) } else setError(errorMessage(result))
  }, [api])
  useEffect(() => { load() }, [load])

  const days = useMemo(() => (schedule ? buildDays(schedule) : []), [schedule])
  const matches = schedule?.matches ?? []
  const byWindow = useMemo(() => new Map(matches.filter((m) => m.window).map((m) => [windowKey(m.window), m])), [matches])
  const categories = useMemo(() => {
    const seen = new Map()
    matches.forEach((m) => seen.set(m.category_id, m.category_name))
    return [...seen.entries()].map(([id, name]) => ({ id, name }))
  }, [matches])
  const categoryIds = categories.map((c) => c.id)
  const levels = useMemo(() => conflictLevels(schedule?.conflicts ?? []), [schedule])
  const unscheduled = matches.filter((m) => m.status === 'pending' && !m.window)
  const ghosts = useMemo(() => new Map((proposal?.assignments ?? []).map((a) => [windowKey(a), a])), [proposal])
  const activeDay = days.find((d) => d.date === day)?.date ?? days[0]?.date
  const matchById = (id) => matches.find((m) => m.id === id)

  /** Run a change. Warnings and "this window is occupied" ask first, then retry with force / unplace. */
  const mutate = async (method, path, body, retryWith) => {
    setBusy(true)
    const result = await request(method, `${api}${path}`, body)
    setBusy(false)
    if (result.ok) {
      setSchedule(result.data)
      setSelection(null)
      setProposal(null)
      setAttention(null)
      return true
    }
    const data = result.data || {}
    if (data.code === 'needs_confirmation') {
      setAttention({ title: 'Aplicar mesmo assim?', message: data.error, conflicts: data.conflicts, retry: () => mutate(method, path, { ...body, force: true }) })
    } else if (data.code === 'window_occupied') {
      setAttention({ title: 'Tirar a partida do horário?', message: data.error, list: data.matches, retry: () => mutate(method, path, { ...body, unplace: true }) })
    } else if (data.code === 'schedule_conflict') {
      setAttention({ title: 'Não dá para fazer isso', message: data.error, conflicts: data.conflicts })
    } else {
      toast({ title: errorMessage(result), variant: 'destructive' })
    }
    return false
  }

  const place = (matchId, w) => mutate('POST', '/place', { match_id: matchId, court_id: w.court_id, date: w.date, time: w.time })
  const swap = (a, b) => mutate('POST', '/swap', { match_id: a, other_match_id: b })
  const unplace = (id) => mutate('DELETE', `/matches/${id}`)
  const lock = (id, locked) => mutate('PUT', `/matches/${id}/lock`, { locked })
  const block = (w, blocked) => mutate('PUT', '/blocks', { court_id: w.court_id, date: w.date, time: w.time, blocked })

  const onMatch = (match) => {
    if (terminal || match.status !== 'pending') return
    if (!selection || selection.kind === 'window') setSelection({ kind: 'match', id: match.id })
    else if (selection.id === match.id) setSelection(null)
    else swap(selection.id, match.id)
  }
  const onWindow = (w) => {
    if (terminal) return
    if (selection?.kind === 'match' && !w.blocked) place(selection.id, w)
    else setSelection(selection?.kind === 'window' && selection.key === windowKey(w) ? null : { kind: 'window', key: windowKey(w), window: w })
  }
  const onDropOnMatch = (id, target) => { if (!terminal && id && id !== target.id && target.status === 'pending') swap(id, target.id) }
  const onDropOnWindow = (id, w) => { if (!terminal && id) place(id, w) }
  const onDropUnplace = (id) => { if (!terminal && matchById(id)?.window) unplace(id) }

  const showConflict = (conflict) => {
    const match = matchById(conflict.match_ids[0])
    if (match?.window) setDay(match.window.date)
    setSelection(match && match.status === 'pending' ? { kind: 'match', id: match.id } : null)
  }

  const setPublished = async (published) => {
    setBusy(true)
    const result = await request('POST', `${api}/${published ? 'publish' : 'unpublish'}`)
    setBusy(false)
    setPublishing(false)
    if (result.ok) {
      setSchedule(result.data)
      toast({ title: published ? 'Cronograma publicado' : 'Cronograma oculto do público' })
    } else {
      toast({ title: errorMessage(result), variant: 'destructive' })
    }
  }

  const removeSession = async () => {
    setBusy(true)
    const result = await request('DELETE', `${api}/sessions/${deleting.id}`)
    setBusy(false)
    setDeleting(null)
    if (result.ok) { setSchedule(result.data); setProposal(null); toast({ title: 'Sessão excluída' }) }
    else if (result.data?.code === 'window_in_use') setAttention({ title: 'A sessão tem partidas', message: result.data.error, list: result.data.matches })
    else toast({ title: errorMessage(result), variant: 'destructive' })
  }

  if (error) return <p className="text-red-700" data-testid="schedule-error">{error}</p>
  if (!schedule) return <p className="text-stone-500" data-testid="schedule-loading">Carregando…</p>

  const { summary } = schedule
  const published = schedule.tournament.schedule_published_at
  const selectedMatch = selection?.kind === 'match' ? matchById(selection.id) : null
  const sidebarTabs = [['unscheduled', `Sem horário (${unscheduled.length})`], ['conflicts', `Verificação (${schedule.conflicts.length})`], ['distribute', 'Distribuir']]
  const openSidebar = proposal ? 'distribute' : sidebar

  return (
    <div className="space-y-4" data-testid="schedule-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-3">
        <ul className="flex flex-wrap gap-2" data-testid="schedule-summary" aria-label="Resumo">
          <li className={chip} data-testid="summary-pending">Pendentes: <strong>{summary.pending}</strong></li>
          <li className={chip} data-testid="summary-placed">Com horário: <strong>{summary.placed}</strong></li>
          <li className={chip} data-testid="summary-unplaced">Sem horário: <strong>{summary.unplaced}</strong></li>
          <li className={chip} data-testid="summary-free">Janelas livres: <strong>{summary.free_windows}</strong></li>
          <li className={`${chip} ${schedule.conflicts.length ? 'border-orange-500 bg-orange-50' : ''}`} data-testid="summary-conflicts">
            {schedule.conflicts.length > 0 && <AlertTriangle className="h-3.5 w-3.5 text-orange-700" aria-hidden="true" />}Conflitos: <strong>{schedule.conflicts.length}</strong>
          </li>
        </ul>
        <div className="flex items-center gap-2">
          <span className="text-sm text-stone-600" data-testid="publish-status">
            {published ? `Publicado em ${publishedText(published)}` : 'Oculto ao público'}
          </span>
          {!terminal && (published
            ? <Button type="button" variant="outline" onClick={() => setPublished(false)} disabled={busy} data-testid="unpublish-button" className="min-h-[44px]"><EyeOff className="mr-1 h-4 w-4" aria-hidden="true" />Ocultar</Button>
            : <Button type="button" onClick={() => setPublishing(true)} disabled={busy || summary.placed === 0} data-testid="publish-button" className="min-h-[44px] bg-amber-700 text-white hover:bg-amber-800"><Eye className="mr-1 h-4 w-4" aria-hidden="true" />Publicar cronograma</Button>)}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2" data-testid="sessions-bar">
        <span className="text-sm font-semibold text-stone-700">Sessões:</span>
        {schedule.sessions.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1 rounded-full border bg-white py-1 pl-3 pr-1 text-sm" data-testid={`session-${s.id}`}>
            {dayTitle(s.date)} · {s.start}–{s.end} · {s.court_ids.length} quadra(s) · {s.windows} janelas
            {!terminal && (
              <>
                <button type="button" aria-label={`Editar sessão de ${dayTitle(s.date)}`} data-testid={`session-edit-${s.id}`} onClick={() => setSessionDialog(s)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-stone-100"><Pencil className="h-4 w-4" aria-hidden="true" /></button>
                <button type="button" aria-label={`Excluir sessão de ${dayTitle(s.date)}`} data-testid={`session-delete-${s.id}`} onClick={() => setDeleting(s)} className="flex h-8 w-8 items-center justify-center rounded-full text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
              </>
            )}
          </span>
        ))}
        {!terminal && <Button type="button" size="sm" variant="outline" onClick={() => setSessionDialog({})} data-testid="new-session-button" className="min-h-[44px]"><Plus className="mr-1 h-4 w-4" aria-hidden="true" />Nova sessão</Button>}
      </div>

      {days.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-stone-700" data-testid="schedule-empty">
          Comece criando as sessões: os dias e horários em que as quadras são do torneio. Depois é só distribuir as partidas.
        </p>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1 space-y-3">
            {selection && !terminal && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border-2 border-amber-700 bg-amber-50 p-3 text-sm" data-testid="selection-bar">
                {selectedMatch ? (
                  <>
                    <span className="min-w-0 flex-1" data-testid="selection-text"><strong>Selecionada:</strong> {selectedMatch.category_name} · {selectedMatch.round_name} · {matchTitle(selectedMatch)}.{' '}
                      {selectedMatch.window ? 'Toque em outra partida para trocar ou numa janela livre para mover.' : 'Toque numa janela livre para colocar.'}</span>
                    {selectedMatch.window && (
                      <>
                        <Button type="button" size="sm" variant="outline" onClick={() => lock(selectedMatch.id, !selectedMatch.locked)} disabled={busy} data-testid="selection-lock" className="min-h-[44px]">
                          {selectedMatch.locked ? <><Unlock className="mr-1 h-4 w-4" aria-hidden="true" />Liberar</> : <><Lock className="mr-1 h-4 w-4" aria-hidden="true" />Fixar</>}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => unplace(selectedMatch.id)} disabled={busy || selectedMatch.locked} data-testid="selection-unplace" className="min-h-[44px]">Remover do horário</Button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1" data-testid="selection-text"><strong>Janela {selection.window.time}</strong> · {courtName(schedule.courts, selection.window.court_id)} · {dayTitle(selection.window.date)}{selection.window.blocked ? ' (bloqueada)' : ' (livre)'}. Para colocar uma partida aqui, selecione-a antes.</span>
                    <Button type="button" size="sm" variant="outline" onClick={() => block(selection.window, !selection.window.blocked)} disabled={busy} data-testid="selection-block" className="min-h-[44px]">
                      {selection.window.blocked ? 'Desbloquear janela' : 'Bloquear janela'}
                    </Button>
                  </>
                )}
                <Button type="button" size="sm" variant="outline" onClick={() => setSelection(null)} data-testid="selection-clear" className="min-h-[44px]"><X className="mr-1 h-4 w-4" aria-hidden="true" />Cancelar</Button>
              </div>
            )}
            <ScheduleGrid
              days={days} day={activeDay} onDay={setDay} courts={schedule.courts} byWindow={byWindow} categoryIds={categoryIds} levels={levels}
              selection={selection} ghosts={ghosts} onMatch={onMatch} onWindow={onWindow} onDropOnMatch={onDropOnMatch} onDropOnWindow={onDropOnWindow} setDragging={() => {}}
            />
          </div>

          <aside className="w-full shrink-0 rounded-lg border bg-white p-3 lg:sticky lg:top-4 lg:w-[22rem] lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto" data-testid="schedule-sidebar">
            <div role="tablist" aria-label="Painel lateral" className="mb-3 flex flex-wrap gap-1">
              {sidebarTabs.map(([key, label]) => (
                <button
                  key={key} type="button" role="tab" aria-selected={openSidebar === key} data-testid={`sidebar-tab-${key}`} onClick={() => setSidebar(key)}
                  className={`min-h-[40px] rounded-md px-3 text-sm font-medium ${openSidebar === key ? 'bg-amber-800 text-white' : 'bg-stone-100 hover:bg-stone-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {openSidebar === 'unscheduled' && (
              <UnscheduledList
                matches={unscheduled} categories={categories} categoryIds={categoryIds} selectedId={selection?.kind === 'match' ? selection.id : null}
                levels={levels} onSelect={onMatch} setDragging={() => {}} onDropUnplace={onDropUnplace}
              />
            )}
            {openSidebar === 'conflicts' && <ConflictsPanel conflicts={schedule.conflicts} onShow={showConflict} />}
            {openSidebar === 'distribute' && (
              <DistributePanel
                tournamentId={tournament.id} schedule={schedule} proposal={proposal} onProposal={setProposal}
                onApplied={(data) => { setSchedule(data); setProposal(null); setSidebar('unscheduled') }}
              />
            )}
          </aside>
        </div>
      )}

      {sessionDialog && (
        <SessionDialog
          tournament={tournament} courts={schedule.courts} session={sessionDialog.id ? sessionDialog : null}
          onClose={() => setSessionDialog(null)} onSaved={(data) => { setSchedule(data); setProposal(null); setSessionDialog(null) }}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleting)} destructive busy={busy} title="Excluir a sessão?" confirmLabel="Excluir"
        description="As janelas dela deixam de existir. Só é possível se nenhuma partida estiver nelas."
        onConfirm={removeSession} onCancel={() => setDeleting(null)}
      />
      <ConfirmDialog
        open={publishing} busy={busy} title="Publicar o cronograma?" confirmLabel="Publicar"
        description="A partir de agora o público vê data, hora e quadra de cada partida, e qualquer troca aparece na hora."
        onConfirm={() => setPublished(true)} onCancel={() => setPublishing(false)}
      />
      {attention && (
        <Dialog open onOpenChange={(next) => { if (!next) setAttention(null) }}>
          <DialogContent className="w-full max-w-xl" data-testid="attention-dialog">
            <DialogHeader>
              <DialogTitle>{attention.title}</DialogTitle>
              <DialogDescription>{attention.message}</DialogDescription>
            </DialogHeader>
            {attention.conflicts?.length > 0 && (
              <ul className="space-y-2 text-sm" data-testid="attention-conflicts">
                {attention.conflicts.map((c, i) => (
                  <li key={i} className={`rounded-md border p-2 ${c.severity === 'error' ? 'border-red-400 bg-red-50' : 'border-orange-400 bg-orange-50'}`}>
                    <strong>{c.severity === 'error' ? 'Conflito: ' : 'Aviso: '}</strong>{c.message}
                  </li>
                ))}
              </ul>
            )}
            {attention.list?.length > 0 && <ul className="list-disc pl-5 text-sm" data-testid="attention-list">{attention.list.map((m) => <li key={m.id}>{m.label}</li>)}</ul>}
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setAttention(null)} data-testid="attention-cancel" className="min-h-[44px]">{attention.retry ? 'Voltar' : 'Entendi'}</Button>
              {attention.retry && <Button type="button" onClick={attention.retry} disabled={busy} data-testid="attention-confirm" className="min-h-[44px] bg-amber-700 text-white hover:bg-amber-800">Aplicar mesmo assim</Button>}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
