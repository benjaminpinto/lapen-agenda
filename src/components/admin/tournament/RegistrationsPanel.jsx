import {useCallback, useEffect, useMemo, useState} from 'react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {CalendarOff, MessageCircle, Plus, Search} from 'lucide-react'
import {useToast} from '@/contexts/ToastContext'
import CategoryChips from './CategoryChips'
import StatusBadge from './StatusBadge'
import UnavailabilityDialog from './schedule/UnavailabilityDialog'
import {ADMIN_API, errorMessage, request} from './tournamentApi'
import {REGISTRATION_STATUS} from './labels'

const selectClass = 'h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm'

const Field = ({ label, id, children }) => (
  <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>
)

function RejectDialog({ count, onCancel, onConfirm }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onCancel() }}>
      <DialogContent className="w-full max-w-md" data-testid="reject-dialog">
        <DialogHeader>
          <DialogTitle>Recusar {count > 1 ? `${count} inscrições` : 'inscrição'}?</DialogTitle>
          <DialogDescription>O motivo é opcional e fica só no painel. A pessoa pode se inscrever de novo.</DialogDescription>
        </DialogHeader>
        <Textarea data-testid="reject-reason" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo (opcional)" />
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onCancel} data-testid="reject-cancel" className="min-h-[44px]">Voltar</Button>
          <Button
            disabled={busy} data-testid="reject-confirm" className="min-h-[44px] bg-red-700 hover:bg-red-800 text-white"
            onClick={async () => { setBusy(true); await onConfirm(reason); setBusy(false) }}
          >
            Recusar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function EditDialog({ registration, categories, tournament, onClose, onSaved }) {
  const { toast } = useToast()
  const category = categories.find((c) => c.id === registration.category_id)
  const live = ['pending', 'confirmed', 'waitlist'].includes(registration.status)
  const beforeDraw = category?.status === 'awaiting_draw'
  const [form, setForm] = useState({
    full_name: registration.full_name, display_name: registration.display_name, email: registration.email,
    phone: registration.phone, notes: registration.notes || '', category_id: registration.category_id,
    seed: registration.seed ?? '', user_id: registration.user_id ?? '',
  })
  const [members, setMembers] = useState([])
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  useEffect(() => {
    request('GET', '/api/admin/users').then((result) => {
      if (result.ok) setMembers(result.data.filter((u) => u.is_lapen_member && u.lapen_approved))
    })
  }, [])

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase()
    return members.filter((u) => !term || `${u.name} ${u.short_name || ''} ${u.email}`.toLowerCase().includes(term)).slice(0, 30)
  }, [members, search])

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    const patch = {
      full_name: form.full_name, display_name: form.display_name, email: form.email, phone: form.phone, notes: form.notes,
      user_id: form.user_id === '' ? null : Number(form.user_id),
    }
    if (live && beforeDraw) patch.category_id = Number(form.category_id)
    if (registration.status === 'confirmed' && beforeDraw && category?.num_seeds > 0) patch.seed = form.seed === '' ? null : Number(form.seed)
    const result = await request('PATCH', `${ADMIN_API}/${tournament.id}/registrations/${registration.id}`, patch)
    setSaving(false)
    if (result.ok) {
      toast({ title: 'Inscrição atualizada' })
      onSaved()
    } else {
      toast({ title: errorMessage(result), variant: 'destructive' })
    }
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="w-full max-w-xl" data-testid="edit-registration-dialog">
        <DialogHeader>
          <DialogTitle>Editar inscrição</DialogTitle>
          <DialogDescription>Corrija contato, mude de categoria, defina o cabeça de chave ou vincule a um membro LAPEN.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome completo" id="reg-full"><Input id="reg-full" data-testid="edit-full-name" required value={form.full_name} onChange={set('full_name')} /></Field>
            <Field label="Nome de exibição" id="reg-display"><Input id="reg-display" data-testid="edit-display-name" required value={form.display_name} onChange={set('display_name')} /></Field>
            <Field label="E-mail" id="reg-email"><Input id="reg-email" data-testid="edit-email" type="email" required value={form.email} onChange={set('email')} /></Field>
            <Field label="Telefone / WhatsApp" id="reg-phone"><Input id="reg-phone" data-testid="edit-phone" required value={form.phone} onChange={set('phone')} /></Field>
          </div>
          <Field label="Observações" id="reg-notes"><Textarea id="reg-notes" data-testid="edit-notes" rows={2} value={form.notes} onChange={set('notes')} /></Field>
          {live && beforeDraw && (
            <Field label="Categoria" id="reg-category">
              <select id="reg-category" data-testid="edit-category" className={selectClass} value={form.category_id} onChange={set('category_id')}>
                {categories.filter((c) => c.status === 'awaiting_draw').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          )}
          {registration.status === 'confirmed' && beforeDraw && category?.num_seeds > 0 && (
            <Field label={`Cabeça de chave (1 a ${category.num_seeds}, vazio = sem cabeça)`} id="reg-seed">
              <Input id="reg-seed" data-testid="edit-seed" type="number" min="1" max={category.num_seeds} value={form.seed} onChange={set('seed')} />
            </Field>
          )}
          <div className="space-y-1.5 rounded-md border border-stone-200 p-3">
            <Label htmlFor="member-search">Vínculo com membro LAPEN (só aprovados)</Label>
            <Input id="member-search" data-testid="edit-member-search" placeholder="Buscar por nome ou e-mail" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select data-testid="edit-member" className={selectClass} value={form.user_id} onChange={set('user_id')}>
              <option value="">— sem vínculo —</option>
              {form.user_id !== '' && !shown.some((u) => u.id === Number(form.user_id)) && <option value={form.user_id}>Membro #{form.user_id} (vinculado)</option>}
              {shown.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.email}</option>)}
            </select>
            <p className="text-xs text-stone-500">O vínculo faz o resultado aparecer nas estatísticas do membro.</p>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} data-testid="edit-cancel" className="min-h-[44px]">Voltar</Button>
            <Button type="submit" disabled={saving} data-testid="edit-submit" className="min-h-[44px] bg-amber-700 hover:bg-amber-800 text-white">{saving ? 'Salvando…' : 'Salvar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddDialog({ categories, tournament, onClose, onSaved }) {
  const { toast } = useToast()
  const open = categories.filter((c) => c.status === 'awaiting_draw')
  const [form, setForm] = useState({ category_id: open[0]?.id ?? '', full_name: '', display_name: '', email: '', phone: '', notes: '', status: 'confirmed' })
  const [saving, setSaving] = useState(false)
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    const result = await request('POST', `${ADMIN_API}/${tournament.id}/registrations`, { ...form, category_id: Number(form.category_id) })
    setSaving(false)
    if (result.ok) {
      toast({ title: 'Inscrição criada' })
      onSaved()
    } else {
      toast({ title: errorMessage(result), variant: 'destructive' })
    }
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="w-full max-w-xl" data-testid="add-registration-dialog">
        <DialogHeader>
          <DialogTitle>Nova inscrição</DialogTitle>
          <DialogDescription>Para quem se inscreveu por outro canal, como WhatsApp.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Categoria" id="add-category">
            <select id="add-category" data-testid="add-category" required className={selectClass} value={form.category_id} onChange={set('category_id')}>
              {open.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome completo" id="add-full"><Input id="add-full" data-testid="add-full-name" required value={form.full_name} onChange={set('full_name')} /></Field>
            <Field label="Nome de exibição" id="add-display"><Input id="add-display" data-testid="add-display-name" value={form.display_name} onChange={set('display_name')} placeholder="Padrão: dois primeiros nomes" /></Field>
            <Field label="E-mail" id="add-email"><Input id="add-email" data-testid="add-email" type="email" required value={form.email} onChange={set('email')} /></Field>
            <Field label="Telefone / WhatsApp" id="add-phone"><Input id="add-phone" data-testid="add-phone" required value={form.phone} onChange={set('phone')} placeholder="(24) 99999-0000" /></Field>
          </div>
          <Field label="Situação inicial" id="add-status">
            <select id="add-status" data-testid="add-status" className={selectClass} value={form.status} onChange={set('status')}>
              <option value="confirmed">Confirmada</option><option value="pending">Pendente</option>
            </select>
          </Field>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} data-testid="add-cancel" className="min-h-[44px]">Voltar</Button>
            <Button type="submit" disabled={saving || open.length === 0} data-testid="add-submit" className="min-h-[44px] bg-amber-700 hover:bg-amber-800 text-white">{saving ? 'Salvando…' : 'Criar inscrição'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function RegistrationsPanel({ tournament, categories, reload }) {
  const { toast } = useToast()
  const [filters, setFilters] = useState({ category: '', status: '', q: '' })
  const [query, setQuery] = useState('')
  const [data, setData] = useState({ registrations: [], counts: {} })
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState([])
  const [editing, setEditing] = useState(null)
  const [rejecting, setRejecting] = useState(null) // list of ids
  const [adding, setAdding] = useState(false)
  const [impeding, setImpeding] = useState(null)
  const terminal = ['finished', 'cancelled'].includes(tournament.status)

  useEffect(() => {
    const timer = setTimeout(() => setFilters((current) => ({ ...current, q: query })), 300)
    return () => clearTimeout(timer)
  }, [query])

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (filters.category) params.set('category_id', filters.category)
    if (filters.status) params.set('status', filters.status)
    if (filters.q) params.set('q', filters.q)
    const result = await request('GET', `${ADMIN_API}/${tournament.id}/registrations?${params}`)
    if (result.ok) setData(result.data)
    else toast({ title: errorMessage(result, 'Erro ao carregar inscrições'), variant: 'destructive' })
    setLoading(false)
  }, [tournament.id, filters])

  useEffect(() => { load() }, [load])

  const refresh = () => { setSelected([]); load(); reload() }

  const patch = async (registration, body, success) => {
    const result = await request('PATCH', `${ADMIN_API}/${tournament.id}/registrations/${registration.id}`, body)
    if (result.ok) {
      toast({ title: success })
      refresh()
    } else {
      toast({ title: errorMessage(result), variant: 'destructive' })
    }
  }

  const batch = async (ids, status, reason) => {
    const result = await request('POST', `${ADMIN_API}/${tournament.id}/registrations/batch`, { ids, status, rejection_reason: reason || undefined })
    if (!result.ok) {
      toast({ title: errorMessage(result), variant: 'destructive' })
      return
    }
    const { updated, failed } = result.data
    toast({
      title: `${updated.length} atualizada(s)${failed.length ? `, ${failed.length} não` : ''}`,
      description: failed[0]?.error, variant: failed.length ? 'destructive' : 'default',
    })
    refresh()
  }

  const rejectConfirmed = async (reason) => {
    const ids = rejecting
    if (ids.length === 1) await patch({ id: ids[0] }, { status: 'rejected', rejection_reason: reason || undefined }, 'Inscrição recusada')
    else await batch(ids, 'rejected', reason)
    setRejecting(null)
  }

  const categoryOf = (registration) => categories.find((c) => c.id === registration.category_id)
  const toggle = (id) => setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]))

  const actionsFor = (registration) => {
    const category = categoryOf(registration)
    const before = category?.status === 'awaiting_draw'
    const items = []
    if (terminal) return items
    if (['pending', 'waitlist'].includes(registration.status) && before) items.push({ key: 'confirm', label: 'Confirmar', primary: true, run: () => patch(registration, { status: 'confirmed' }, 'Inscrição confirmada') })
    if (['pending', 'waitlist'].includes(registration.status)) items.push({ key: 'reject', label: 'Recusar', run: () => setRejecting([registration.id]) })
    if (['pending', 'waitlist', 'confirmed'].includes(registration.status) && (before || registration.status !== 'confirmed')) items.push({ key: 'cancel', label: 'Cancelar', run: () => patch(registration, { status: 'cancelled' }, 'Inscrição cancelada') })
    if (['rejected', 'cancelled'].includes(registration.status) && before) items.push({ key: 'reopen', label: 'Reabrir', run: () => patch(registration, { status: 'pending' }, 'Inscrição reaberta: voltou para pendente') })
    if (registration.status === 'confirmed' && !before) items.push({ key: 'withdraw', label: 'Desistência', run: () => patch(registration, { status: 'withdrawn' }, 'Desistência registrada: os jogos pendentes viraram W.O.') })
    return items
  }

  const canBatch = selected.length > 0 && !terminal

  return (
    <div data-testid="registrations-panel" className="space-y-4">
      <CategoryChips testId="filter-category" categories={categories} allLabel="Todas" value={filters.category} onChange={(category) => setFilters({ ...filters, category })} />
      <div className="grid gap-3 md:grid-cols-3">
        <select data-testid="filter-status" aria-label="Situação" className={selectClass} value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
          <option value="">Todas as situações</option>
          {Object.entries(REGISTRATION_STATUS).map(([value, info]) => <option key={value} value={value}>{info.label}</option>)}
        </select>
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-3 h-4 w-4 text-stone-400" />
          <Input data-testid="filter-search" className="pl-9" placeholder="Buscar nome, e-mail ou telefone" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-stone-600" data-testid="registrations-count">{data.registrations.length} inscrição(ões)</p>
        <div className="flex flex-wrap gap-2">
          {canBatch && (
            <>
              <Button size="sm" onClick={() => batch(selected, 'confirmed')} data-testid="batch-confirm" className="min-h-[44px] bg-amber-700 hover:bg-amber-800 text-white">Confirmar ({selected.length})</Button>
              <Button size="sm" variant="outline" onClick={() => setRejecting(selected)} data-testid="batch-reject" className="min-h-[44px] text-red-700 border-red-300">Recusar ({selected.length})</Button>
            </>
          )}
          {!terminal && (
            <Button size="sm" onClick={() => setAdding(true)} data-testid="add-registration-button" variant="outline" className="min-h-[44px]">
              <Plus className="h-4 w-4 mr-1" /> Nova inscrição
            </Button>
          )}
        </div>
      </div>

      {loading && <p className="text-stone-500">Carregando…</p>}
      {!loading && data.registrations.length === 0 && (
        <p className="text-stone-600 border border-dashed border-stone-300 rounded-lg p-6 text-center" data-testid="registrations-empty">Nenhuma inscrição encontrada.</p>
      )}

      {data.registrations.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-sm" data-testid="registrations-table">
            <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-600">
              <tr>
                <th scope="col" className="w-10 px-3 py-2"><span className="sr-only">Selecionar</span></th>
                <th scope="col" className="px-3 py-2">Inscrito</th>
                <th scope="col" className="hidden px-3 py-2 lg:table-cell">Categoria</th>
                <th scope="col" className="hidden px-3 py-2 lg:table-cell">Contato</th>
                <th scope="col" className="px-3 py-2">Situação</th>
                <th scope="col" className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {data.registrations.map((registration) => {
                const category = categoryOf(registration)
                const canSelect = !terminal && ['pending', 'waitlist', 'confirmed'].includes(registration.status)
                const canMarkImpediments = !terminal && ['pending', 'waitlist', 'confirmed'].includes(registration.status)
                return (
                  <tr key={registration.id} className="align-top hover:bg-stone-50/60" data-testid={`registration-${registration.id}`}>
                    <td className="px-3 py-3">
                      {canSelect && (
                        <input
                          type="checkbox" className="h-5 w-5 accent-amber-700" aria-label={`Selecionar ${registration.display_name}`}
                          data-testid={`select-registration-${registration.id}`} checked={selected.includes(registration.id)} onChange={() => toggle(registration.id)}
                        />
                      )}
                    </td>
                    <td className="min-w-[11rem] px-3 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-semibold text-stone-900" data-testid={`registration-name-${registration.id}`}>{registration.display_name}</p>
                        {registration.is_member && <span className="inline-flex rounded-full border border-amber-700 px-2 py-0.5 text-xs font-semibold text-amber-800" data-testid={`registration-member-${registration.id}`}>Membro LAPEN</span>}
                        {registration.seed && <span className="inline-flex rounded-full bg-stone-800 px-2 py-0.5 text-xs font-semibold text-white" data-testid={`registration-seed-${registration.id}`}>CC{registration.seed}</span>}
                      </div>
                      <p className="text-stone-700">{registration.full_name}</p>
                      <div className="mt-1 space-y-0.5 text-xs text-stone-600 lg:hidden" data-testid={`registration-compact-${registration.id}`}>
                        <p>{category?.name}{registration.also_in?.length > 0 ? ` · também em ${registration.also_in.map((o) => o.category_name).join(', ')}` : ''}</p>
                        <p className="break-all">{registration.email}</p>
                        <p>{registration.phone}</p>
                      </div>
                      {registration.notes && <p className="mt-1 text-xs text-stone-500">“{registration.notes}”</p>}
                      {registration.rejection_reason && <p className="mt-1 text-xs text-red-700">Recusada: {registration.rejection_reason}</p>}
                    </td>
                    <td className="hidden min-w-[8rem] px-3 py-3 text-stone-800 lg:table-cell">
                      {category?.name}
                      {registration.also_in?.length > 0 && (
                        <p className="mt-1 text-xs text-stone-600" data-testid={`registration-also-${registration.id}`}>Também em: {registration.also_in.map((o) => o.category_name).join(', ')}</p>
                      )}
                    </td>
                    <td className="hidden min-w-[11rem] px-3 py-3 text-xs text-stone-600 lg:table-cell">
                      <p className="break-all">{registration.email}</p>
                      <p className="mt-0.5">{registration.phone}</p>
                    </td>
                    <td className="px-3 py-3"><StatusBadge info={REGISTRATION_STATUS[registration.status]} testId={`registration-status-${registration.id}`} /></td>
                    <td className="px-3 py-3">
                      <div className="flex min-w-[13rem] flex-wrap justify-end gap-1.5">
                        <a
                          href={`https://wa.me/55${registration.phone}`} target="_blank" rel="noreferrer" data-testid={`whatsapp-${registration.id}`} aria-label={`WhatsApp de ${registration.display_name}`}
                          className="inline-flex min-h-[40px] items-center gap-1 rounded-md border border-input px-3 text-sm font-medium hover:bg-accent"
                        >
                          <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp
                        </a>
                        {actionsFor(registration).map((action) => (
                          <Button
                            key={action.key} size="sm" variant={action.primary ? 'default' : 'outline'} onClick={action.run} data-testid={`${action.key}-registration-${registration.id}`}
                            className={`min-h-[40px] ${action.primary ? 'bg-amber-700 text-white hover:bg-amber-800' : ''}`}
                          >
                            {action.label}
                          </Button>
                        ))}
                        {canMarkImpediments && (
                          <Button size="sm" variant="outline" onClick={() => setImpeding(registration)} data-testid={`unavailability-registration-${registration.id}`} className="min-h-[40px]">
                            <CalendarOff className="mr-1 h-4 w-4" aria-hidden="true" />Impedimentos{registration.unavailability_count ? ` (${registration.unavailability_count})` : ''}
                          </Button>
                        )}
                        {!terminal && <Button size="sm" variant="outline" onClick={() => setEditing(registration)} data-testid={`edit-registration-${registration.id}`} className="min-h-[40px]">Editar</Button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && <EditDialog registration={editing} categories={categories} tournament={tournament} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh() }} />}
      {impeding && <UnavailabilityDialog tournament={tournament} registration={impeding} onClose={() => setImpeding(null)} onSaved={() => { setImpeding(null); load() }} />}
      {adding && <AddDialog categories={categories} tournament={tournament} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); refresh() }} />}
      {rejecting && <RejectDialog count={rejecting.length} onCancel={() => setRejecting(null)} onConfirm={rejectConfirmed} />}
    </div>
  )
}
