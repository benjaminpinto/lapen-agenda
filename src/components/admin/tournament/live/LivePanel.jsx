import {useCallback, useEffect, useMemo, useState} from 'react'
import {useSearchParams} from 'react-router-dom'
import {RefreshCw, Share2, Tv} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {useToast} from '@/contexts/ToastContext'
import {getLocalDateString} from '@/utils/dateUtils'
import ConfirmDialog from '../ConfirmDialog'
import ResultDialog from '../ResultDialog'
import {ADMIN_API, errorMessage, request} from '../tournamentApi'
import {PLAYING_STATUSES} from '../labels'
import {buildDays, dayTitle, matchTitle, windowKey} from '../schedule/scheduleUtils'
import AttentionList from './AttentionList'
import LiveGrid from './LiveGrid'
import LiveOverview from './LiveOverview'
import ShareDialog from './ShareDialog'
import WalkoverDialog from './WalkoverDialog'
import {categoryProgress, defaultDay, focusMatches, isReady, resultLabel, tally} from './liveUtils'
import {callMessage, summaryText} from './messages'

const chip = 'inline-flex items-center gap-1 rounded-full border bg-white px-3 py-1 text-xs font-medium'
const CLOCK_REFRESH_MS = 30000

/** The schedule's match as the result form wants it. */
const forResultDialog = (match) => {
  const [first, second] = match.sides.map((side) => (side.defined ? { registration_id: side.registration_id, display_name: side.name } : null))
  return { id: match.id, entry1: first, entry2: second, outcome: match.outcome, score: match.score, played_at: match.played_at, winner_entry_id: match.winner_registration_id }
}

const clockText = (date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

/** The "Dia do evento" tab: the day's courts with results recorded on the spot, plus a quick look at groups and progress. */
export default function LivePanel({ tournament, categories, reload }) {
  const { toast } = useToast()
  const [, setParams] = useSearchParams()
  const [schedule, setSchedule] = useState(null)
  const [standings, setStandings] = useState({})
  const [error, setError] = useState(null)
  const [pickedDay, setPickedDay] = useState(null)
  const [now, setNow] = useState(() => new Date())
  const [updatedAt, setUpdatedAt] = useState(null)
  const [dialog, setDialog] = useState(null) // { match, mode: 'record' | 'correct' }
  const [detail, setDetail] = useState(null) // a match that already has a result
  const [annulling, setAnnulling] = useState(null)
  const [walkover, setWalkover] = useState(null) // a match to record a W.O. for
  const [share, setShare] = useState(null) // { description, text } of the WhatsApp message
  const [busy, setBusy] = useState(false)
  const canRecord = tournament.status === 'in_progress'
  const playable = useMemo(() => categories.filter((category) => PLAYING_STATUSES.includes(category.status)), [categories])
  const playableKey = playable.map((category) => `${category.id}:${category.status}`).join(',')

  const load = useCallback(async () => {
    const result = await request('GET', `${ADMIN_API}/${tournament.id}/schedule`)
    if (!result.ok) {
      setError(errorMessage(result))
      return
    }
    setError(null)
    setSchedule(result.data)
    const grouped = playable.filter((category) => category.draw_format !== 'knockout')
    const tables = await Promise.all(grouped.map((category) => request('GET', `${ADMIN_API}/${tournament.id}/categories/${category.id}/standings`)))
    setStandings(Object.fromEntries(grouped.flatMap((category, index) => (tables[index].ok ? [[category.id, tables[index].data]] : []))))
    setUpdatedAt(new Date())
  }, [tournament.id, playableKey])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_REFRESH_MS)
    return () => clearInterval(timer)
  }, [])

  const days = useMemo(() => (schedule ? buildDays(schedule) : []), [schedule])
  const matches = useMemo(() => schedule?.matches ?? [], [schedule])
  const byWindow = useMemo(() => new Map(matches.filter((match) => match.window).map((match) => [windowKey(match.window), match])), [matches])
  const progress = useMemo(() => categoryProgress(matches), [matches])
  const categoryIds = useMemo(() => [...new Set(matches.map((match) => match.category_id))], [matches])

  if (error) return <p className="text-red-700" data-testid="live-error">{error}</p>
  if (!schedule) return <p className="text-stone-500" data-testid="live-loading">Carregando…</p>

  const today = getLocalDateString(now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const slotMinutes = schedule.slot_minutes
  const dates = days.map((day) => day.date)
  const activeDay = dates.includes(pickedDay) ? pickedDay : defaultDay(dates, today)
  const dayMatches = matches.filter((match) => match.window?.date === activeDay)
  const dayTally = tally(dayMatches, today, nowMinutes, slotMinutes)
  const unscheduled = matches.filter((match) => isReady(match) && !match.window)
  const focus = focusMatches(matches, today, nowMinutes, slotMinutes)
  const ties = Object.values(standings).flatMap((table) => table.groups).filter((group) => group.blocked).length

  const refresh = () => { load(); reload() }
  const record = (match) => setDialog({ match, mode: 'record' })
  const openMatch = (match) => (match.status === 'completed' ? setDetail(match) : record(match))
  const call = (list) => setShare({
    description: 'Chamada de jogos, para enviar no grupo do torneio',
    text: callMessage({ tournamentName: tournament.name, matches: list, courts: schedule.courts, today }),
  })
  const shareSummary = () => setShare({
    description: `Resumo de ${dayTitle(activeDay)} e jogos do próximo dia, para enviar no grupo do torneio`,
    text: summaryText({ tournamentName: tournament.name, day: activeDay, matches, courts: schedule.courts }),
  })

  const annul = async () => {
    setBusy(true)
    const result = await request('DELETE', `${ADMIN_API}/${tournament.id}/matches/${annulling.id}/result`)
    setBusy(false)
    setAnnulling(null)
    if (result.ok) {
      toast({ title: 'Resultado anulado' })
      refresh()
    } else {
      toast({ title: errorMessage(result), variant: 'destructive' })
    }
  }

  const dialogCategory = playable.find((category) => category.id === dialog?.match.category_id)

  return (
    <div className="space-y-5" data-testid="live-panel">
      {!canRecord && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-stone-700" data-testid="live-not-started">
          {tournament.status === 'registration_closed' ? 'Inicie o torneio para lançar resultados.' : 'Os resultados só podem ser lançados com o torneio em andamento.'}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-3">
        <ul className="flex flex-wrap gap-2" data-testid="live-summary" aria-label="Resumo do dia">
          <li className={chip} data-testid="live-total">Jogos do dia: <strong>{dayTally.total}</strong></li>
          <li className={chip} data-testid="live-done">Com resultado: <strong>{dayTally.done}</strong></li>
          <li className={chip} data-testid="live-remaining">Faltam: <strong>{dayTally.total - dayTally.done}</strong></li>
          <li className={`${chip} ${dayTally.late ? 'border-orange-500 bg-orange-50' : ''}`} data-testid="live-late">Resultados atrasados: <strong>{dayTally.late}</strong></li>
          <li className={`${chip} ${unscheduled.length ? 'border-amber-500 bg-amber-50' : ''}`} data-testid="live-unscheduled-count">Prontos sem horário: <strong>{unscheduled.length}</strong></li>
          <li className={`${chip} ${ties ? 'border-orange-500 bg-orange-50' : ''}`} data-testid="live-ties">Empates a decidir: <strong>{ties}</strong></li>
        </ul>
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-600" data-testid="live-updated">{updatedAt ? `Atualizado às ${clockText(updatedAt)}` : ''}</span>
          <Button type="button" variant="outline" onClick={refresh} data-testid="live-refresh" className="min-h-[44px]"><RefreshCw className="mr-1 h-4 w-4" aria-hidden="true" />Atualizar</Button>
          <Button type="button" variant="outline" onClick={() => setParams({ tab: 'cronograma' }, { replace: true })} data-testid="live-go-schedule" className="min-h-[44px]">Editar cronograma</Button>
          <Button type="button" variant="outline" disabled={!activeDay} onClick={shareSummary} data-testid="live-summary-button" className="min-h-[44px]"><Share2 className="mr-1 h-4 w-4" aria-hidden="true" />Resumo do dia</Button>
          <Button type="button" variant="outline" onClick={() => window.open(`/tournaments/${tournament.slug}/ao-vivo`, '_blank', 'noopener')} data-testid="live-board-button" className="min-h-[44px]"><Tv className="mr-1 h-4 w-4" aria-hidden="true" />Abrir telão</Button>
        </div>
      </div>
      {!schedule.tournament.schedule_published_at && (
        <p className="text-xs text-stone-600" data-testid="live-board-note">O telão só mostra os jogos depois que o cronograma for publicado (aba Cronograma).</p>
      )}
      {ties > 0 && (
        <p className="rounded-md border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900" data-testid="live-ties-note">
          Há empate na classificação que os critérios não resolvem. A chave só avança depois que você decidir, na aba{' '}
          <button type="button" className="font-semibold underline" onClick={() => setParams({ tab: 'partidas' }, { replace: true })} data-testid="live-go-matches">Partidas</button>.
        </p>
      )}

      <AttentionList items={focus} courts={schedule.courts} today={today} canRecord={canRecord} onRecord={record} onCall={call} onWalkover={setWalkover} />

      {days.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-stone-700" data-testid="live-empty">
          Ainda não há sessões. Crie os dias e horários na aba Cronograma para acompanhar o dia do evento por aqui.
        </p>
      ) : (
        <LiveGrid
          days={days} day={activeDay} onDay={setPickedDay} courts={schedule.courts} byWindow={byWindow} categoryIds={categoryIds}
          today={today} nowMinutes={nowMinutes} slotMinutes={slotMinutes} canRecord={canRecord} onOpen={openMatch}
        />
      )}

      {unscheduled.length > 0 && (
        <section className="space-y-2" data-testid="live-unscheduled">
          <h3 className="text-base font-semibold text-stone-900">Prontos para jogar, sem horário</h3>
          <ul className="grid gap-2 md:grid-cols-2">
            {unscheduled.map((match) => (
              <li key={match.id} className="flex items-center justify-between gap-2 rounded-md border bg-white p-3 text-sm" data-testid={`live-unscheduled-${match.id}`}>
                <span className="min-w-0">
                  <span className="block truncate text-xs text-stone-600">{match.category_name} · {match.round_name}</span>
                  <span className="block truncate">{matchTitle(match)}</span>
                </span>
                <Button type="button" size="sm" disabled={!canRecord} onClick={() => record(match)} data-testid={`live-record-${match.id}`} className="min-h-[44px] shrink-0 bg-amber-700 text-white hover:bg-amber-800">Lançar resultado</Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <LiveOverview categories={playable} matches={matches} progress={progress} standings={standings} />

      {dialog && dialogCategory && (
        <ResultDialog
          tournament={tournament} category={dialogCategory} match={forResultDialog(dialog.match)} mode={dialog.mode}
          onClose={() => setDialog(null)} onSaved={() => { setDialog(null); refresh() }}
        />
      )}
      {walkover && (
        <WalkoverDialog tournament={tournament} match={walkover} onClose={() => setWalkover(null)} onSaved={() => { setWalkover(null); refresh() }} />
      )}
      {share && <ShareDialog description={share.description} text={share.text} onClose={() => setShare(null)} />}
      {detail && (
        <Dialog open onOpenChange={(next) => { if (!next) setDetail(null) }}>
          <DialogContent className="w-full max-w-md" data-testid="live-detail-dialog">
            <DialogHeader>
              <DialogTitle>{detail.category_name} · {detail.round_name}</DialogTitle>
              <DialogDescription data-testid="live-detail-match">{matchTitle(detail)}</DialogDescription>
            </DialogHeader>
            <p className="text-sm" data-testid="live-detail-result">Resultado: <strong>{resultLabel(detail)}</strong></p>
            <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setDetail(null)} data-testid="live-detail-close" className="min-h-[44px]">Fechar</Button>
              <Button type="button" variant="outline" disabled={!canRecord} onClick={() => { setAnnulling(detail); setDetail(null) }} data-testid="live-detail-annul" className="min-h-[44px] border-red-300 text-red-700">Anular</Button>
              <Button type="button" disabled={!canRecord} onClick={() => { setDialog({ match: detail, mode: 'correct' }); setDetail(null) }} data-testid="live-detail-correct" className="min-h-[44px] bg-amber-700 text-white hover:bg-amber-800">Corrigir</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      <ConfirmDialog
        open={Boolean(annulling)} destructive busy={busy} title="Anular o resultado?"
        description="A partida volta a ficar pendente e o vencedor sai da partida seguinte. Só é possível se a partida seguinte ainda não tiver resultado."
        confirmLabel="Anular resultado" onConfirm={annul} onCancel={() => setAnnulling(null)}
      />
    </div>
  )
}
