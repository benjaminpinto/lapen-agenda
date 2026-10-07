import {useMemo, useState} from 'react'
import {Button} from '@/components/ui/button'
import {Label} from '@/components/ui/label'
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {useToast} from '@/contexts/ToastContext'
import {ADMIN_API, errorMessage, request} from '../tournamentApi'
import {daysBetween, dayTitle} from './scheduleUtils'

const selectClass = 'h-10 w-full rounded-md border border-stone-300 bg-white px-2 text-sm'
const SLOT_MINUTES = 90

const minutes = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }

/** Create or edit a session: a day, a stretch of hours and the courts that belong to the tournament in it. */
export default function SessionDialog({ tournament, courts, session, onClose, onSaved }) {
  const { toast } = useToast()
  const days = useMemo(() => daysBetween(tournament.start_date, tournament.end_date), [tournament])
  const [form, setForm] = useState({
    date: session?.date ?? days[0], start: session?.start ?? '08:00', end: session?.end ?? '17:00',
    court_ids: session?.court_ids ?? courts.map((c) => c.id),
  })
  const [saving, setSaving] = useState(false)
  const [blocking, setBlocking] = useState(null)
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  const toggleCourt = (id) => setForm((current) => ({ ...current, court_ids: current.court_ids.includes(id) ? current.court_ids.filter((c) => c !== id) : [...current.court_ids, id] }))

  const span = minutes(form.end) - minutes(form.start)
  const windows = span > 0 ? Math.floor(span / SLOT_MINUTES) : 0
  const leftover = span > 0 ? span % SLOT_MINUTES : 0

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setBlocking(null)
    const url = `${ADMIN_API}/${tournament.id}/schedule/sessions${session ? `/${session.id}` : ''}`
    const result = await request(session ? 'PUT' : 'POST', url, form)
    setSaving(false)
    if (result.ok) {
      toast({ title: session ? 'Sessão atualizada' : 'Sessão criada' })
      onSaved(result.data)
    } else if (result.data?.code === 'window_in_use') {
      setBlocking(result.data)
    } else {
      toast({ title: errorMessage(result), variant: 'destructive' })
    }
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="w-full max-w-lg" data-testid="session-dialog">
        <DialogHeader>
          <DialogTitle>{session ? 'Editar sessão' : 'Nova sessão'}</DialogTitle>
          <DialogDescription>As janelas têm 90 minutos, contadas a partir do horário inicial. Use duas sessões no mesmo dia para deixar uma pausa.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="session-date">Dia</Label>
              <select id="session-date" data-testid="session-date" className={selectClass} value={form.date} onChange={set('date')}>
                {days.map((d) => <option key={d} value={d}>{dayTitle(d)}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-start">Início</Label>
              <input id="session-start" data-testid="session-start" type="time" step="900" className={selectClass} value={form.start} onChange={set('start')} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-end">Fim</Label>
              <input id="session-end" data-testid="session-end" type="time" step="900" className={selectClass} value={form.end} onChange={set('end')} required />
            </div>
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Quadras</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {courts.map((c) => (
                <label key={c.id} className="flex min-h-[40px] items-center gap-2 text-sm">
                  <input type="checkbox" className="h-5 w-5 accent-amber-700" checked={form.court_ids.includes(c.id)} onChange={() => toggleCourt(c.id)} data-testid={`session-court-${c.id}`} />
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="rounded-md bg-stone-100 px-3 py-2 text-sm" data-testid="session-preview">
            {windows > 0
              ? <>{windows} janela(s) × {form.court_ids.length} quadra(s) = <strong>{windows * form.court_ids.length} jogos</strong>{leftover ? ` (sobram ${leftover} min no fim, que não formam uma janela)` : ''}</>
              : 'A sessão precisa ter ao menos 90 minutos.'}
          </p>
          {blocking && (
            <div className="rounded-md border border-red-400 bg-red-50 p-3 text-sm" role="alert" data-testid="session-blocking">
              <p className="font-semibold text-red-800">{blocking.error}</p>
              <ul className="mt-1 list-disc pl-4">{blocking.matches.map((m) => <li key={m.id}>{m.label}</li>)}</ul>
            </div>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} data-testid="session-cancel" className="min-h-[44px]">Voltar</Button>
            <Button type="submit" disabled={saving || windows === 0 || form.court_ids.length === 0} data-testid="session-submit" className="min-h-[44px] bg-amber-700 text-white hover:bg-amber-800">{saving ? 'Salvando…' : 'Salvar sessão'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
