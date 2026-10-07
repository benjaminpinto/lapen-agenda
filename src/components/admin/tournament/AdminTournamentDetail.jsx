import {useCallback, useEffect, useState} from 'react'
import {useNavigate, useParams, useSearchParams} from 'react-router-dom'
import {Button} from '@/components/ui/button'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs'
import BackButton from '@/components/ui/BackButton'
import {useToast} from '@/contexts/ToastContext'
import ConfirmDialog from './ConfirmDialog'
import DesktopNotice from './DesktopNotice'
import StatusBadge from './StatusBadge'
import TournamentForm from './TournamentForm'
import CategoriesPanel from './CategoriesPanel'
import RegistrationsPanel from './RegistrationsPanel'
import DrawPanel from './DrawPanel'
import MatchesPanel from './MatchesPanel'
import SchedulePanel from './schedule/SchedulePanel'
import {ADMIN_API, errorMessage, request} from './tournamentApi'
import {formatDate, TOURNAMENT_STATUS} from './labels'

const ACTIONS = {
  draft: [{ status: 'registration_open', label: 'Abrir inscrições', primary: true }],
  registration_open: [{ status: 'registration_closed', label: 'Encerrar inscrições', primary: true }],
  registration_closed: [
    { status: 'in_progress', label: 'Iniciar torneio', primary: true },
    { status: 'registration_open', label: 'Reabrir inscrições' },
  ],
  in_progress: [{ status: 'finished', label: 'Encerrar torneio', primary: true }],
}

const TABS = [
  ['dados', 'Dados & Regulamento'],
  ['categorias', 'Categorias & Regras'],
  ['inscricoes', 'Inscrições'],
  ['sorteio', 'Sorteio'],
  ['cronograma', 'Cronograma'],
  ['partidas', 'Partidas'],
]

export default function AdminTournamentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(([key]) => key === params.get('tab')) ? params.get('tab') : 'dados'
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    const result = await request('GET', `${ADMIN_API}/${id}`)
    if (result.ok) {
      setData(result.data)
      setError(null)
    } else {
      setError(errorMessage(result, 'Torneio não encontrado'))
    }
  }, [id])

  useEffect(() => { reload() }, [reload])

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <BackButton to="/admin/tournaments" label="Torneios" />
        <p className="text-red-700" data-testid="tournament-error">{error}</p>
      </div>
    )
  }
  if (!data) return <p className="text-stone-500" data-testid="tournament-loading">Carregando…</p>

  const { tournament, categories } = data
  const terminal = ['finished', 'cancelled'].includes(tournament.status)

  const changeStatus = async (status) => {
    setBusy(true)
    const result = await request('PUT', `${ADMIN_API}/${id}/status`, { status })
    setBusy(false)
    setConfirm(null)
    if (result.ok) {
      toast({ title: `Torneio: ${TOURNAMENT_STATUS[status].label.toLowerCase()}` })
      reload()
    } else {
      toast({ title: errorMessage(result), variant: 'destructive' })
    }
  }

  const remove = async () => {
    setBusy(true)
    const result = await request('DELETE', `${ADMIN_API}/${id}`)
    setBusy(false)
    if (result.ok) {
      toast({ title: 'Torneio excluído' })
      navigate('/admin/tournaments')
    } else {
      setConfirm(null)
      toast({ title: errorMessage(result), variant: 'destructive' })
    }
  }

  const save = async (payload) => {
    const result = await request('PUT', `${ADMIN_API}/${id}`, payload)
    if (result.ok) {
      toast({ title: 'Dados salvos' })
      reload()
      return true
    }
    toast({ title: errorMessage(result), variant: 'destructive' })
    return false
  }

  const panelProps = { tournament, categories, reload }

  return (
    <div className="max-w-7xl mx-auto" data-testid="admin-tournament-detail">
      <BackButton to="/admin/tournaments" label="Torneios" />
      <DesktopNotice />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 break-words" data-testid="tournament-title">{tournament.name}</h1>
          <p className="text-sm text-stone-600">
            {formatDate(tournament.start_date)} a {formatDate(tournament.end_date)}{tournament.location ? ` · ${tournament.location}` : ''}
          </p>
          <div className="mt-2"><StatusBadge info={TOURNAMENT_STATUS[tournament.status]} testId="tournament-status" /></div>
        </div>
        <div className="flex flex-wrap gap-2" data-testid="tournament-actions">
          {(ACTIONS[tournament.status] || []).map((action) => (
            <Button
              key={action.status} onClick={() => changeStatus(action.status)} disabled={busy}
              variant={action.primary ? 'default' : 'outline'} data-testid={`action-${action.status}`}
              className={`min-h-[44px] ${action.primary ? 'bg-amber-700 hover:bg-amber-800 text-white' : ''}`}
            >
              {action.label}
            </Button>
          ))}
          {tournament.status === 'draft' && (
            <Button variant="outline" onClick={() => setConfirm('delete')} data-testid="action-delete" className="min-h-[44px] text-red-700 border-red-300">Excluir</Button>
          )}
          {!terminal && (
            <Button variant="outline" onClick={() => setConfirm('cancel')} data-testid="action-cancel" className="min-h-[44px] text-red-700 border-red-300">Cancelar torneio</Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setParams({ tab: value }, { replace: true })}>
        <div className="overflow-x-auto -mx-1 px-1 pb-1">
          <TabsList className="h-auto inline-flex min-w-max">
            {TABS.map(([key, label]) => (
              <TabsTrigger key={key} value={key} data-testid={`tab-${key}`} className="min-h-[44px] px-4">{label}</TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="dados" className="mt-4">
          <TournamentForm
            tournament={tournament} onSubmit={save} submitLabel="Salvar dados" disabled={terminal}
            readOnlyNote={terminal ? 'Torneio finalizado ou cancelado: os dados não podem mais ser alterados.' : null}
          />
        </TabsContent>
        <TabsContent value="categorias" className="mt-4"><CategoriesPanel {...panelProps} /></TabsContent>
        <TabsContent value="inscricoes" className="mt-4"><RegistrationsPanel {...panelProps} /></TabsContent>
        <TabsContent value="sorteio" className="mt-4"><DrawPanel {...panelProps} /></TabsContent>
        <TabsContent value="cronograma" className="mt-4"><SchedulePanel {...panelProps} /></TabsContent>
        <TabsContent value="partidas" className="mt-4"><MatchesPanel {...panelProps} /></TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirm === 'cancel'} destructive busy={busy}
        title="Cancelar o torneio?" description="O torneio sai do ar para o público e não pode ser reativado. Os resultados já lançados continuam nas estatísticas."
        confirmLabel="Cancelar torneio" onConfirm={() => changeStatus('cancelled')} onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'delete'} destructive busy={busy}
        title="Excluir o rascunho?" description="O rascunho e as categorias criadas serão apagados."
        confirmLabel="Excluir" onConfirm={remove} onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
