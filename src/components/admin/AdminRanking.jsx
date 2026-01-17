import {useEffect, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Badge} from '@/components/ui/badge'
import {ArrowLeft, Calendar, Plus, RefreshCw, Settings, Users} from 'lucide-react'
import {useToast} from '@/contexts/ToastContext'
import {fetchWithAuth} from "../../utils/fetchWithAuth.js";

const AdminRanking = () => {
  const navigate = useNavigate()
  const [seasons, setSeasons] = useState([])
  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newSeason, setNewSeason] = useState({
    year: new Date().getFullYear(),
    start_date: '',
    end_date: '',
    description: ''
  })
  const { toast } = useToast()

  useEffect(() => {
    fetchSeasons()
  }, [])

  const fetchSeasons = async () => {
    try {
      const response = await fetchWithAuth('/api/ranking/seasons')
      if (response.ok) {
        const data = await response.json()
        setSeasons(data)
      }
    } catch (error) {
      console.error('Erro ao carregar temporadas:', error)
    } finally {
      setLoading(false)
    }
  }

  const openSeason = async (seasonId) => {
    try {
      const response = await fetchWithAuth(`/api/ranking/seasons/${seasonId}/open`, {
        method: 'PUT'
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast({ title: 'Temporada aberta com sucesso' })
        fetchSeasons()
      } else {
        toast({ title: data.error || 'Erro ao abrir temporada', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Erro ao abrir temporada', variant: 'destructive' })
    }
  }

  const closeSeason = async (seasonId) => {
    try {
      const response = await fetchWithAuth(`/api/ranking/seasons/${seasonId}/close`, {
        method: 'PUT'
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast({ title: 'Temporada finalizada com sucesso' })
        fetchSeasons()
      } else {
        toast({ title: data.error, variant: 'destructive' })
      }
    } catch (error) {
      console.error('Error closing season:', error)
      toast({ title: 'Erro ao finalizar temporada', variant: 'destructive' })
    }
  }

  const createSeason = async () => {
    try {
      const response = await fetchWithAuth('/api/ranking/seasons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSeason)
      })

      if (response.ok) {
        toast({ title: 'Temporada criada com sucesso' })
        setShowCreateForm(false)
        setNewSeason({
          year: new Date().getFullYear() + 1,
          start_date: '',
          end_date: '',
          description: ''
        })
        fetchSeasons()
      } else {
        const error = await response.json()
        toast({ title: error.error || 'Erro ao criar temporada', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Erro ao criar temporada', variant: 'destructive' })
    }
  }

  const recalculateRanking = async (seasonId) => {
    setRecalculating(seasonId)
    try {
      const response = await fetchWithAuth(`/api/ranking/seasons/${seasonId}/recalculate`, {
        method: 'POST'
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast({ title: 'Ranking recalculado com sucesso' })
      } else {
        toast({ title: data.error || 'Erro ao recalcular ranking', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Erro ao recalcular ranking', variant: 'destructive' })
    } finally {
      setRecalculating(null)
    }
  }

  const getStatusBadge = (status) => {
    const variants = {
      draft: 'secondary',
      active: 'default',
      finished: 'outline'
    }
    const labels = {
      draft: 'Rascunho',
      active: 'Ativa',
      finished: 'Finalizada'
    }
    return (
      <Badge variant={variants[status]}>
        {labels[status]}
      </Badge>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <Button variant="outline" onClick={() => navigate('/admin/dashboard')} className="w-full sm:w-auto">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar ao Dashboard
      </Button>
      <div className="flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center">
        <h1 className="text-xl sm:text-2xl font-bold">Gerenciar Ranking</h1>
        <Button onClick={() => setShowCreateForm(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Nova Temporada
        </Button>
      </div>

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Criar Nova Temporada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="year">Ano</Label>
                <Input
                  id="year"
                  type="number"
                  value={newSeason.year}
                  onChange={(e) => setNewSeason({...newSeason, year: parseInt(e.target.value)})}
                />
              </div>
              <div>
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Input
                  id="description"
                  type="text"
                  placeholder="Ex: Finals, Qualificatórias"
                  value={newSeason.description}
                  onChange={(e) => setNewSeason({...newSeason, description: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="start_date">Data Início</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={newSeason.start_date}
                  onChange={(e) => setNewSeason({...newSeason, start_date: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="end_date">Data Fim</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={newSeason.end_date}
                  onChange={(e) => setNewSeason({...newSeason, end_date: e.target.value})}
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <Button onClick={createSeason}>Criar</Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {seasons.map((season) => (
          <Card key={season.id}>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold">
                    Temporada {season.year}{season.description ? ` - ${season.description}` : ''}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {season.start_date.split('T')[0].split('-').reverse().join('/')} - {' '}
                    {season.end_date.split('T')[0].split('-').reverse().join('/')}
                  </p>
                  <div className="mt-2">
                    {getStatusBadge(season.status)}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  {season.status === 'draft' && (
                    <Button size="sm" onClick={() => openSeason(season.id)} className="w-full sm:w-auto">
                      Abrir Temporada
                    </Button>
                  )}
                  {season.status === 'active' && (
                    <>
                      <Button size="sm" variant="destructive" onClick={() => closeSeason(season.id)} className="w-full sm:w-auto">
                        Finalizar Temporada
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => recalculateRanking(season.id)} 
                        disabled={recalculating === season.id}
                        className="w-full sm:w-auto"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${recalculating === season.id ? 'animate-spin' : ''}`} />
                        {recalculating === season.id ? 'Recalculando...' : 'Recalcular Ranking'}
                      </Button>
                    </>
                  )}
                  <Button variant="outline" size="sm" onClick={() => navigate(`/admin/ranking/config/${season.id}`)} className="w-full sm:w-auto">
                    <Settings className="h-4 w-4 mr-2" />
                    Configurar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/admin/ranking/participants/${season.id}`)} className="w-full sm:w-auto">
                    <Users className="h-4 w-4 mr-2" />
                    Participantes
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/admin/ranking/rounds/${season.id}`)} className="w-full sm:w-auto">
                    <Calendar className="h-4 w-4 mr-2" />
                    Rodadas
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {seasons.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-gray-500">Nenhuma temporada encontrada</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default AdminRanking