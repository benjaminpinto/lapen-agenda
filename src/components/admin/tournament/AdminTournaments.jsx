import {useEffect, useState} from 'react'
import {Link, useNavigate} from 'react-router-dom'
import {Card, CardContent} from '@/components/ui/card'
import {Button} from '@/components/ui/button'
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Plus, Trophy} from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import {useToast} from '@/contexts/ToastContext'
import TournamentForm from './TournamentForm'
import DesktopNotice from './DesktopNotice'
import StatusBadge from './StatusBadge'
import {ADMIN_API, errorMessage, request} from './tournamentApi'
import {formatDate, TOURNAMENT_STATUS} from './labels'

export default function AdminTournaments() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const load = async () => {
    const result = await request('GET', ADMIN_API)
    if (result.ok) setTournaments(result.data.tournaments)
    else toast({ title: errorMessage(result, 'Erro ao carregar torneios'), variant: 'destructive' })
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const create = async (payload) => {
    const result = await request('POST', ADMIN_API, payload)
    if (!result.ok) {
      toast({ title: errorMessage(result, 'Erro ao criar torneio'), variant: 'destructive' })
      return false
    }
    toast({ title: 'Torneio criado' })
    setCreating(false)
    navigate(`/admin/tournaments/${result.data.tournament.id}`)
    return true
  }

  return (
    <div className="max-w-6xl mx-auto" data-testid="admin-tournaments">
      <BackButton to="/admin/dashboard" label="Painel" />
      <DesktopNotice />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 flex items-center gap-2">
            <Trophy className="h-7 w-7 text-amber-700" /> Torneios
          </h1>
          <p className="text-stone-600 text-sm">Só um torneio pode estar ativo por vez.</p>
        </div>
        <Button onClick={() => setCreating(true)} data-testid="new-tournament-button" className="bg-amber-700 hover:bg-amber-800 text-white min-h-[44px]">
          <Plus className="h-4 w-4 mr-2" /> Novo torneio
        </Button>
      </div>

      {loading && <p className="text-stone-500" data-testid="tournaments-loading">Carregando…</p>}
      {!loading && tournaments.length === 0 && (
        <Card><CardContent className="py-10 text-center text-stone-600" data-testid="tournaments-empty">
          Nenhum torneio ainda. Crie o primeiro com o botão acima.
        </CardContent></Card>
      )}

      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tournaments.map((tournament) => (
          <li key={tournament.id}>
            <Link to={`/admin/tournaments/${tournament.id}`} data-testid={`tournament-card-${tournament.slug}`} className="block h-full">
              <Card className="h-full hover:shadow-md transition-shadow">
                <CardContent className="flex h-full flex-col justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-stone-900 truncate">{tournament.name}</p>
                    <p className="text-sm text-stone-600">
                      {formatDate(tournament.start_date)} a {formatDate(tournament.end_date)}
                      {tournament.location ? ` · ${tournament.location}` : ''}
                    </p>
                    <p className="text-xs text-stone-500">{tournament.categories_count} categoria(s)</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {tournament.pending_registrations > 0 && (
                      <span data-testid={`pending-badge-${tournament.slug}`} className="inline-flex rounded-full bg-orange-600 text-white px-2.5 py-0.5 text-xs font-semibold">
                        {tournament.pending_registrations} pendente(s)
                      </span>
                    )}
                    <StatusBadge info={TOURNAMENT_STATUS[tournament.status]} testId={`tournament-status-${tournament.slug}`} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="w-full max-w-2xl" data-testid="create-tournament-dialog">
          <DialogHeader>
            <DialogTitle>Novo torneio</DialogTitle>
            <DialogDescription>Ele nasce como rascunho. Cadastre as categorias e abra as inscrições depois.</DialogDescription>
          </DialogHeader>
          <TournamentForm onSubmit={create} submitLabel="Criar torneio" />
        </DialogContent>
      </Dialog>
    </div>
  )
}
