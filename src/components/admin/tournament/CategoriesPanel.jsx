import {useState} from 'react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Pencil, Plus, Trash2} from 'lucide-react'
import {useToast} from '@/contexts/ToastContext'
import ConfirmDialog from './ConfirmDialog'
import {ADMIN_API, errorMessage, request} from './tournamentApi'
import {CATEGORY_STATUS, DRAW_FORMATS} from './labels'

const blank = {
  name: '', draw_format: 'knockout', min_entries: 4, max_entries: '', group_target_size: 4, qualifiers_per_group: 2,
  num_seeds: 0, wo_tolerance_min: 15, min_rest_min: 60,
}

const selectClass = 'h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm'

function CategoryDialog({ tournament, category, onClose, onSaved }) {
  const { toast } = useToast()
  const editing = Boolean(category)
  const locked = editing && category.status !== 'awaiting_draw'
  const [form, setForm] = useState(editing ? { ...blank, ...Object.fromEntries(Object.entries(category).map(([k, v]) => [k, v ?? ''])) } : blank)
  const [saving, setSaving] = useState(false)
  const grouped = form.draw_format === 'groups_knockout'
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    const number = (value) => (value === '' || value === null ? null : Number(value))
    const payload = {
      name: form.name, draw_format: form.draw_format, min_entries: number(form.min_entries), max_entries: number(form.max_entries),
      num_seeds: number(form.num_seeds), wo_tolerance_min: number(form.wo_tolerance_min), min_rest_min: number(form.min_rest_min),
      ...(grouped ? { group_target_size: number(form.group_target_size), qualifiers_per_group: number(form.qualifiers_per_group) } : {}),
    }
    const result = editing
      ? await request('PUT', `${ADMIN_API}/${tournament.id}/categories/${category.id}`, payload)
      : await request('POST', `${ADMIN_API}/${tournament.id}/categories`, payload)
    setSaving(false)
    if (result.ok) {
      toast({ title: editing ? 'Categoria atualizada' : 'Categoria criada' })
      onSaved()
    } else {
      toast({ title: errorMessage(result), variant: 'destructive' })
    }
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="w-full max-w-xl" data-testid="category-dialog">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar categoria' : 'Nova categoria'}</DialogTitle>
          <DialogDescription>Cada categoria tem sua própria chave. O formato da chave e os cabeças travam depois do sorteio.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="category-name">Nome</Label>
            <Input id="category-name" data-testid="category-form-name" required value={form.name} onChange={set('name')} placeholder="Masculino 3ª Classe" />
          </div>
          <fieldset disabled={locked} className="space-y-4 min-w-0">
            {locked && <p className="text-sm text-stone-600 bg-stone-100 rounded-md p-3">O sorteio já existe: formato da chave e cabeças de chave não podem mudar.</p>}
            <div className="space-y-1.5">
              <Label htmlFor="category-format">Formato da chave</Label>
              <select id="category-format" data-testid="category-form-format" className={selectClass} value={form.draw_format} onChange={set('draw_format')}>
                {Object.entries(DRAW_FORMATS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            {grouped && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="category-group-size">Jogadores por grupo</Label>
                  <select id="category-group-size" data-testid="category-form-group-size" className={selectClass} value={form.group_target_size} onChange={set('group_target_size')}>
                    <option value="3">3</option><option value="4">4</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="category-qualifiers">Classificados por grupo</Label>
                  <select id="category-qualifiers" data-testid="category-form-qualifiers" className={selectClass} value={form.qualifiers_per_group} onChange={set('qualifiers_per_group')}>
                    <option value="1">1</option><option value="2">2</option>
                  </select>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="category-seeds">Cabeças de chave</Label>
              <Input id="category-seeds" data-testid="category-form-seeds" type="number" min="0" max="16" value={form.num_seeds} onChange={set('num_seeds')} />
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="category-min">Mínimo de inscritos</Label>
              <Input id="category-min" data-testid="category-form-min" type="number" min="2" value={form.min_entries} onChange={set('min_entries')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category-max">Máximo (vazio = sem limite)</Label>
              <Input id="category-max" data-testid="category-form-max" type="number" min="2" value={form.max_entries} onChange={set('max_entries')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category-wo">Tolerância de W.O. (min)</Label>
              <Input id="category-wo" data-testid="category-form-wo" type="number" min="0" value={form.wo_tolerance_min} onChange={set('wo_tolerance_min')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category-rest">Descanso mínimo (min)</Label>
              <Input id="category-rest" data-testid="category-form-rest" type="number" min="0" value={form.min_rest_min} onChange={set('min_rest_min')} />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} data-testid="category-form-cancel" className="min-h-[44px]">Voltar</Button>
            <Button type="submit" disabled={saving} data-testid="category-form-submit" className="min-h-[44px] bg-amber-700 hover:bg-amber-800 text-white">
              {saving ? 'Salvando…' : 'Salvar categoria'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function CategoriesPanel({ tournament, categories, reload }) {
  const { toast } = useToast()
  const [editing, setEditing] = useState(null) // null | 'new' | category
  const [removing, setRemoving] = useState(null)
  const [busy, setBusy] = useState(false)
  const locked = ['in_progress', 'finished', 'cancelled'].includes(tournament.status)

  const remove = async () => {
    setBusy(true)
    const result = await request('DELETE', `${ADMIN_API}/${tournament.id}/categories/${removing.id}`)
    setBusy(false)
    setRemoving(null)
    if (result.ok) {
      toast({ title: 'Categoria excluída' })
      reload()
    } else {
      toast({ title: errorMessage(result), variant: 'destructive' })
    }
  }

  return (
    <div data-testid="categories-panel" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-stone-600">{categories.length} categoria(s)</p>
        {!locked && (
          <Button onClick={() => setEditing('new')} data-testid="new-category-button" className="bg-amber-700 hover:bg-amber-800 text-white min-h-[44px]">
            <Plus className="h-4 w-4 mr-2" /> Nova categoria
          </Button>
        )}
      </div>

      {categories.length === 0 && <p className="text-stone-600 border border-dashed border-stone-300 rounded-lg p-6 text-center" data-testid="categories-empty">Cadastre ao menos uma categoria para abrir as inscrições.</p>}

      <ul className="grid gap-3 md:grid-cols-2">
        {categories.map((category) => (
          <li key={category.id} className="rounded-lg border border-stone-200 bg-white p-4" data-testid={`category-card-${category.id}`}>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-stone-900" data-testid={`category-name-${category.id}`}>{category.name}</p>
                <p className="text-sm text-stone-600">
                  {DRAW_FORMATS[category.draw_format]}
                  {category.draw_format === 'groups_knockout' ? ` · grupos de ${category.group_target_size}, ${category.qualifiers_per_group} classificado(s)` : ''}
                </p>
                <p className="text-xs text-stone-500">
                  {CATEGORY_STATUS[category.status]} · mín. {category.min_entries}{category.max_entries ? ` · máx. ${category.max_entries}` : ''} · {category.num_seeds} cabeça(s) de chave
                </p>
                <p className="text-xs text-stone-500" data-testid={`category-counts-${category.id}`}>
                  {category.counts.confirmed} confirmada(s) · {category.counts.pending} pendente(s) · {category.counts.waitlist} em espera
                </p>
              </div>
              {!['finished'].includes(category.status) && !['finished', 'cancelled'].includes(tournament.status) && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(category)} data-testid={`edit-category-${category.id}`} className="min-h-[44px]">
                    <Pencil className="h-4 w-4 mr-1" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setRemoving(category)} data-testid={`delete-category-${category.id}`} className="min-h-[44px] text-red-700 border-red-300">
                    <Trash2 className="h-4 w-4 mr-1" /> Excluir
                  </Button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <CategoryDialog
          tournament={tournament} category={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }}
        />
      )}
      <ConfirmDialog
        open={Boolean(removing)} destructive busy={busy} title={`Excluir "${removing?.name}"?`}
        description="Só categorias sem inscrições e sem sorteio podem ser excluídas."
        confirmLabel="Excluir categoria" onConfirm={remove} onCancel={() => setRemoving(null)}
      />
    </div>
  )
}
