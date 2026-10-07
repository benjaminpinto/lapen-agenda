import {useState} from 'react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import {MATCH_FORMATS, toInputDateTime} from './labels'

const empty = {
  name: '', location: '', description: '', start_date: '', end_date: '',
  registration_opens_at: '', registration_closes_at: '',
  match_format: 'best_of_3_super_tb', no_ad: true, match_tiebreak_points: 10,
  rules_text: '', contact_info: '',
}

const fromTournament = (t) => ({
  ...empty,
  ...Object.fromEntries(Object.entries(t).filter(([key]) => key in empty).map(([key, value]) => [key, value ?? empty[key]])),
  registration_opens_at: toInputDateTime(t.registration_opens_at),
  registration_closes_at: toInputDateTime(t.registration_closes_at),
})

const Field = ({ label, htmlFor, hint, children, className = '' }) => (
  <div className={`space-y-1.5 ${className}`}>
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
    {hint && <p className="text-xs text-stone-500">{hint}</p>}
  </div>
)

/** Create or edit a tournament. onSubmit receives the payload and resolves to true when it worked. */
export default function TournamentForm({ tournament = null, onSubmit, submitLabel, disabled = false, readOnlyNote = null }) {
  const [form, setForm] = useState(tournament ? fromTournament(tournament) : empty)
  const [saving, setSaving] = useState(false)
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    const payload = {
      ...form,
      match_tiebreak_points: Number(form.match_tiebreak_points) || 10,
      registration_opens_at: form.registration_opens_at || null,
      registration_closes_at: form.registration_closes_at || null,
    }
    await onSubmit(payload)
    setSaving(false)
  }

  return (
    <form onSubmit={submit} className="max-w-4xl space-y-4" data-testid="tournament-form">
      {readOnlyNote && <p className="text-sm text-stone-600 bg-stone-100 rounded-md p-3" data-testid="tournament-form-note">{readOnlyNote}</p>}
      <fieldset disabled={disabled || saving} className="space-y-4 min-w-0">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome do torneio" htmlFor="tournament-name" className="sm:col-span-2">
            <Input id="tournament-name" data-testid="tournament-form-name" required value={form.name} onChange={set('name')} placeholder="Copa LAPEN 2026" />
          </Field>
          <Field label="Início" htmlFor="tournament-start">
            <Input id="tournament-start" data-testid="tournament-form-start-date" type="date" required value={form.start_date} onChange={set('start_date')} />
          </Field>
          <Field label="Término" htmlFor="tournament-end">
            <Input id="tournament-end" data-testid="tournament-form-end-date" type="date" required value={form.end_date} onChange={set('end_date')} />
          </Field>
          <Field label="Local" htmlFor="tournament-location" className="sm:col-span-2">
            <Input id="tournament-location" data-testid="tournament-form-location" value={form.location} onChange={set('location')} placeholder="Clube LAPEN" />
          </Field>
          <Field label="Abertura das inscrições" htmlFor="tournament-opens" hint="Opcional. Horário de Brasília.">
            <Input id="tournament-opens" data-testid="tournament-form-opens-at" type="datetime-local" value={form.registration_opens_at} onChange={set('registration_opens_at')} />
          </Field>
          <Field label="Encerramento das inscrições" htmlFor="tournament-closes" hint="Opcional. Depois dele, as inscrições fecham sozinhas.">
            <Input id="tournament-closes" data-testid="tournament-form-closes-at" type="datetime-local" value={form.registration_closes_at} onChange={set('registration_closes_at')} />
          </Field>
        </div>

        <div className="rounded-md border border-stone-200 p-3 space-y-3">
          <p className="text-sm font-semibold text-stone-800">Formato das partidas</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Formato" htmlFor="tournament-format" hint="Fica travado depois do primeiro resultado.">
              <select
                id="tournament-format" data-testid="tournament-form-match-format"
                className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
                value={form.match_format} onChange={set('match_format')}
              >
                {Object.entries(MATCH_FORMATS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            {form.match_format === 'best_of_3_super_tb' && (
              <Field label="Pontos do super tie-break" htmlFor="tournament-tiebreak">
                <Input id="tournament-tiebreak" data-testid="tournament-form-tiebreak-points" type="number" min="1" max="20" value={form.match_tiebreak_points} onChange={set('match_tiebreak_points')} />
              </Field>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm min-h-[44px]">
            <input
              type="checkbox" className="h-5 w-5 accent-amber-700" data-testid="tournament-form-no-ad"
              checked={form.no_ad} onChange={(event) => setForm((current) => ({ ...current, no_ad: event.target.checked }))}
            />
            Jogo sem vantagem (no-ad)
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Descrição" htmlFor="tournament-description">
            <Textarea id="tournament-description" data-testid="tournament-form-description" rows={3} value={form.description} onChange={set('description')} />
          </Field>
          <Field label="Contato do organizador" htmlFor="tournament-contact" hint="Público: telefone ou e-mail para dúvidas.">
            <Textarea id="tournament-contact" data-testid="tournament-form-contact" rows={3} value={form.contact_info} onChange={set('contact_info')} />
          </Field>
        </div>
        <Field label="Regulamento" htmlFor="tournament-rules" hint="Aparece na aba Regulamento da página pública.">
          <Textarea id="tournament-rules" data-testid="tournament-form-rules" rows={6} value={form.rules_text} onChange={set('rules_text')} />
        </Field>
      </fieldset>
      {!disabled && (
        <Button type="submit" disabled={saving} data-testid="tournament-form-submit" className="w-full sm:w-auto min-h-[44px]">
          {saving ? 'Salvando…' : submitLabel}
        </Button>
      )}
    </form>
  )
}
