import {useEffect, useMemo, useState} from 'react'
import {Plus, Trash2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {useToast} from '@/contexts/ToastContext'
import {ADMIN_API, errorMessage, request} from '../tournamentApi'
import {daysBetween, dayTitle} from './scheduleUtils'

const selectClass = 'h-10 w-full rounded-md border border-stone-300 bg-white px-2 text-sm'
const describe = (item) => `${dayTitle(item.date)} · ${item.whole_day ? 'dia todo' : `${item.start}–${item.end}`}`

/** Days and times when a player cannot play. Private to the organizer; the distribution never schedules a match then. */
export default function UnavailabilityDialog({ tournament, registration, onClose, onSaved }) {
  const { toast } = useToast()
  const days = useMemo(() => daysBetween(tournament.start_date, tournament.end_date), [tournament])
  const url = `${ADMIN_API}/${tournament.id}/registrations/${registration.id}/unavailability`
  const [items, setItems] = useState(null)
  const [alsoIn, setAlsoIn] = useState([])
  const [draft, setDraft] = useState({ date: days[0], whole_day: true, start: '08:00', end: '12:00', note: '' })
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState(null)
  const set = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }))

  useEffect(() => {
    request('GET', url).then((result) => {
      if (result.ok) { setItems(result.data.items); setAlsoIn(result.data.also_in) }
      else toast({ title: errorMessage(result), variant: 'destructive' })
    })
  }, [url])

  const add = () => {
    if (!draft.whole_day && draft.end <= draft.start) { setProblem('A hora final deve ser depois da inicial.'); return }
    setProblem(null)
    setItems((current) => [...current, { date: draft.date, whole_day: draft.whole_day, start: draft.whole_day ? null : draft.start, end: draft.whole_day ? null : draft.end, note: draft.note.trim() || null }]
      .sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? '')))
    setDraft((current) => ({ ...current, note: '' }))
  }

  const save = async () => {
    setSaving(true)
    const result = await request('PUT', url, { items: items.map((i) => ({ date: i.date, start: i.whole_day ? null : i.start, end: i.whole_day ? null : i.end, note: i.note })) })
    setSaving(false)
    if (result.ok) { toast({ title: 'Impedimentos salvos' }); onSaved() }
    else toast({ title: errorMessage(result), variant: 'destructive' })
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="w-full max-w-xl" data-testid="unavailability-dialog">
        <DialogHeader>
          <DialogTitle>Impedimentos de {registration.display_name}</DialogTitle>
          <DialogDescription>Dias e horários em que a pessoa não pode jogar. A distribuição automática respeita e o quadro avisa se você colocar uma partida nesse horário. Só o organizador vê.</DialogDescription>
        </DialogHeader>
        {alsoIn.length > 0 && (
          <p className="mb-3 rounded-md bg-stone-100 px-3 py-2 text-sm" data-testid="unavailability-also-in">
            A mesma pessoa também está em: <strong>{alsoIn.map((o) => o.category_name).join(', ')}</strong>. Os impedimentos valem para todas as inscrições dela.
          </p>
        )}
        {items === null && <p className="text-stone-500">Carregando…</p>}
        {items !== null && (
          <>
            {items.length === 0
              ? <p className="mb-3 rounded-md border border-dashed border-stone-300 p-3 text-center text-sm text-stone-600" data-testid="unavailability-empty">Nenhum impedimento marcado.</p>
              : (
                <ul className="mb-3 divide-y rounded-md border" data-testid="unavailability-list">
                  {items.map((item, index) => (
                    <li key={index} className="flex items-center justify-between gap-2 px-3 py-2 text-sm" data-testid={`unavailability-item-${index}`}>
                      <span><strong>{describe(item)}</strong>{item.note ? <span className="text-stone-600"> · {item.note}</span> : null}</span>
                      <button type="button" aria-label={`Remover impedimento de ${describe(item)}`} data-testid={`unavailability-remove-${index}`}
                        onClick={() => setItems((current) => current.filter((_, i) => i !== index))} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-red-700 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            <fieldset className="space-y-3 rounded-md border border-stone-200 p-3">
              <legend className="px-1 text-sm font-semibold">Adicionar impedimento</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="imp-date">Dia</Label>
                  <select id="imp-date" data-testid="unavailability-date" className={selectClass} value={draft.date} onChange={set('date')}>
                    {days.map((d) => <option key={d} value={d}>{dayTitle(d)}</option>)}
                  </select>
                </div>
                <label className="flex min-h-[40px] items-center gap-2 text-sm sm:col-span-2 sm:pt-6">
                  <input type="checkbox" className="h-5 w-5 accent-amber-700" checked={draft.whole_day} onChange={set('whole_day')} data-testid="unavailability-whole-day" />
                  O dia todo
                </label>
              </div>
              {!draft.whole_day && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label htmlFor="imp-start">Das</Label><input id="imp-start" type="time" step="900" className={selectClass} value={draft.start} onChange={set('start')} data-testid="unavailability-start" /></div>
                  <div className="space-y-1.5"><Label htmlFor="imp-end">Até</Label><input id="imp-end" type="time" step="900" className={selectClass} value={draft.end} onChange={set('end')} data-testid="unavailability-end" /></div>
                </div>
              )}
              <div className="space-y-1.5"><Label htmlFor="imp-note">Observação (opcional)</Label><Input id="imp-note" maxLength={200} value={draft.note} onChange={set('note')} data-testid="unavailability-note" placeholder="Ex.: trabalho" /></div>
              {problem && <p className="text-sm text-red-700" role="alert" data-testid="unavailability-problem">{problem}</p>}
              <Button type="button" variant="outline" onClick={add} data-testid="unavailability-add" className="min-h-[44px]"><Plus className="mr-1 h-4 w-4" aria-hidden="true" />Adicionar à lista</Button>
            </fieldset>
          </>
        )}
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} data-testid="unavailability-cancel" className="min-h-[44px]">Voltar</Button>
          <Button type="button" onClick={save} disabled={saving || items === null} data-testid="unavailability-save" className="min-h-[44px] bg-amber-700 text-white hover:bg-amber-800">{saving ? 'Salvando…' : 'Salvar impedimentos'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
