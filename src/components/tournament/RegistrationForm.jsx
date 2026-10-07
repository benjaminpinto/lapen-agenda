import {useState} from 'react'
import {Link, useParams} from 'react-router-dom'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import BackButton from '@/components/ui/BackButton'
import {formatDateTime} from '@/components/admin/tournament/labels'
import {errorMessage, postJson, PUBLIC_API} from './tournamentApi'
import useTournamentData from './useTournamentData'

const EMPTY = { category_id: '', full_name: '', display_name: '', email: '', phone: '', notes: '', accepted_terms: false, data_consent: false, website: '' }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SELECT = 'h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500'

/** What the server would refuse, caught early. Returns { field: message }. */
function validate(form) {
  const errors = {}
  if (!form.category_id) errors.category_id = 'Escolha a categoria.'
  if (form.full_name.trim().length < 3) errors.full_name = 'Informe o nome completo.'
  if (!EMAIL.test(form.email.trim())) errors.email = 'Informe um e-mail válido.'
  const digits = form.phone.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 13) errors.phone = 'Informe o telefone com DDD.'
  if (!form.accepted_terms) errors.accepted_terms = 'É preciso aceitar o regulamento.'
  if (!form.data_consent) errors.data_consent = 'É preciso autorizar o uso dos dados.'
  return errors
}

const isFull = (category) => category.capacity.max_entries !== null && category.capacity.confirmed >= category.capacity.max_entries

function FieldError({ id, message }) {
  return message ? <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-red-700 dark:text-red-400" data-testid={`reg-error-${id}`}>{message}</p> : null
}

/** /tournaments/:slug/register: public sign-up. Nothing is confirmed here; the organizer confirms afterwards. */
export default function RegistrationForm() {
  const { slug } = useParams()
  const { data, error, status, loading, refresh } = useTournamentData(`${PUBLIC_API}/${slug}`)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState(null)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(null)

  const set = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setForm((previous) => ({ ...previous, [field]: value }))
    setErrors((previous) => ({ ...previous, [field]: undefined }))
  }

  if (status === 404) return <p className="py-10 text-center text-muted-foreground" data-testid="register-not-found">Torneio não encontrado.</p>
  if (error && !data) return <p role="alert" className="py-10 text-center text-red-700" data-testid="register-error">{error}</p>
  if (loading || !data) return <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>

  const { tournament, categories } = data
  const open = categories.filter((c) => c.status === 'awaiting_draw')
  const canRegister = tournament.registration.open && open.length > 0

  const submit = async (event) => {
    event.preventDefault()
    const found = validate(form)
    setErrors(found)
    setServerError(null)
    if (Object.keys(found).length) return
    setSending(true)
    const result = await postJson(`${PUBLIC_API}/${slug}/registrations`, { ...form, category_id: Number(form.category_id) })
    setSending(false)
    if (result.ok) {
      setDone(result.data)
      return
    }
    setServerError(errorMessage(result, 'Não foi possível enviar a inscrição. Tente novamente.'))
    if (['registration_closed', 'registration_not_started'].includes(result.data?.code)) refresh()
  }

  const another = () => {
    setDone(null)
    setForm((previous) => ({ ...EMPTY, full_name: previous.full_name, display_name: previous.display_name, email: previous.email, phone: previous.phone }))
  }

  return (
    <div className="mx-auto max-w-xl space-y-5" data-testid="registration-page">
      <BackButton to={`/tournaments/${slug}`} label="Voltar ao torneio" className="mb-0" />
      <header>
        <h1 className="text-2xl font-bold sm:text-3xl">Inscrição</h1>
        <p className="text-muted-foreground" data-testid="registration-tournament-name">{tournament.name}</p>
      </header>

      {done && (
        <div className="space-y-4 rounded-lg border-2 border-amber-600 bg-amber-50 p-4 dark:bg-amber-950/30" role="status" data-testid="registration-success" data-waitlisted={done.waitlisted ? 'true' : 'false'}>
          <p className="font-semibold">{done.waitlisted ? 'Você entrou na lista de espera.' : 'Inscrição recebida!'}</p>
          <p className="text-sm" data-testid="registration-success-message">{done.message}</p>
          <div className="flex flex-wrap gap-2">
            {open.length > 0 && <Button type="button" variant="outline" className="min-h-[44px]" onClick={another} data-testid="register-another">Inscrever-se em outra categoria</Button>}
            <Link to={`/tournaments/${slug}`}><Button type="button" className="min-h-[44px] bg-amber-700 text-white hover:bg-amber-800" data-testid="back-to-tournament">Ver o torneio</Button></Link>
          </div>
        </div>
      )}

      {!done && !canRegister && (
        <div className="space-y-3 rounded-lg border bg-card p-4 text-sm" data-testid="registration-closed">
          <p>
            {tournament.registration.state === 'not_started' && tournament.registration.opens_at
              ? `As inscrições abrem em ${formatDateTime(tournament.registration.opens_at)}.`
              : 'As inscrições deste torneio estão encerradas.'}
          </p>
          <Link to={`/tournaments/${slug}`}><Button type="button" variant="outline" className="min-h-[44px]">Acompanhar o torneio</Button></Link>
        </div>
      )}

      {!done && canRegister && (
        <form onSubmit={submit} noValidate className="space-y-4 rounded-lg border bg-card p-4" data-testid="registration-form">
          <div>
            <Label htmlFor="category_id">Categoria</Label>
            <select id="category_id" value={form.category_id} onChange={set('category_id')} className={SELECT} data-testid="reg-category" aria-invalid={Boolean(errors.category_id)}>
              <option value="">Selecione…</option>
              {open.map((c) => <option key={c.id} value={c.id}>{c.name}{isFull(c) ? ' (lotada: lista de espera)' : ''}</option>)}
            </select>
            <FieldError id="category_id" message={errors.category_id} />
          </div>
          <div>
            <Label htmlFor="full_name">Nome completo</Label>
            <Input id="full_name" value={form.full_name} onChange={set('full_name')} autoComplete="name" maxLength={255} data-testid="reg-full-name" aria-invalid={Boolean(errors.full_name)} />
            <FieldError id="full_name" message={errors.full_name} />
          </div>
          <div>
            <Label htmlFor="display_name">Como seu nome aparece na lista pública <span className="font-normal text-muted-foreground">(opcional)</span></Label>
            <Input id="display_name" value={form.display_name} onChange={set('display_name')} maxLength={100} placeholder="Ex.: João Silva" data-testid="reg-display-name" />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={form.email} onChange={set('email')} autoComplete="email" maxLength={255} data-testid="reg-email" aria-invalid={Boolean(errors.email)} />
            <FieldError id="email" message={errors.email} />
          </div>
          <div>
            <Label htmlFor="phone">Telefone (WhatsApp) com DDD</Label>
            <Input id="phone" type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" maxLength={30} placeholder="(24) 99999-0000" data-testid="reg-phone" aria-invalid={Boolean(errors.phone)} />
            <FieldError id="phone" message={errors.phone} />
          </div>
          <div>
            <Label htmlFor="notes">Observações <span className="font-normal text-muted-foreground">(opcional)</span></Label>
            <Textarea id="notes" value={form.notes} onChange={set('notes')} maxLength={500} rows={3} data-testid="reg-notes" />
          </div>

          {/* honeypot: people never see or fill this; bots do */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label htmlFor="website">Não preencha este campo</label>
            <input id="website" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} data-testid="reg-website" />
          </div>

          <div className="space-y-2">
            <label className="flex min-h-[44px] items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-amber-700" checked={form.accepted_terms} onChange={set('accepted_terms')} data-testid="reg-terms" aria-invalid={Boolean(errors.accepted_terms)} />
              <span>Li e aceito o <Link to={`/tournaments/${slug}?aba=regulamento`} target="_blank" rel="noopener" className="!inline !min-h-0 !min-w-0 underline" data-testid="reg-rules-link">regulamento</Link> do torneio.</span>
            </label>
            <FieldError id="accepted_terms" message={errors.accepted_terms} />
            <label className="flex min-h-[44px] items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-amber-700" checked={form.data_consent} onChange={set('data_consent')} data-testid="reg-consent" aria-invalid={Boolean(errors.data_consent)} />
              <span>Autorizo a organização a usar meus dados para gerir o torneio. Só o nome de exibição aparece na lista pública; e-mail e telefone não são divulgados.</span>
            </label>
            <FieldError id="data_consent" message={errors.data_consent} />
          </div>

          {serverError && <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800" data-testid="reg-error">{serverError}</p>}
          <Button type="submit" disabled={sending} className="min-h-[44px] w-full bg-amber-700 text-white hover:bg-amber-800" data-testid="reg-submit">
            {sending ? 'Enviando…' : 'Enviar inscrição'}
          </Button>
          <p className="text-xs text-muted-foreground">A inscrição só vale depois que o organizador confirmar. Ele entra em contato pelo telefone informado.</p>
        </form>
      )}
    </div>
  )
}
