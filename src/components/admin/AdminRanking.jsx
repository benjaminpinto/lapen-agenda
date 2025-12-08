import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, Settings, Users, Calendar, ArrowLeft } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'

const AdminRanking = () => {
  const navigate = useNavigate()
  const [seasons, setSeasons] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newSeason, setNewSeason] = useState({
    year: new Date().getFullYear(),
    start_date: '',
    end_date: ''
  })
  const { showToast } = useToast()

  useEffect(() => {
    fetchSeasons()
  }, [])

  const fetchSeasons = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch('/api/ranking/seasons', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
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

  const createSeason = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch('/api/ranking/seasons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newSeason)
      })

      if (response.ok) {
        showToast('Temporada criada com sucesso', 'success')
        setShowCreateForm(false)
        setNewSeason({
          year: new Date().getFullYear() + 1,
          start_date: '',
          end_date: ''
        })
        fetchSeasons()
      } else {
        const error = await response.json()
        showToast(error.error || 'Erro ao criar temporada', 'error')
      }
    } catch (error) {
      showToast('Erro ao criar temporada', 'error')
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
    <div className="space-y-6">
      <Button variant="outline" onClick={() => navigate('/admin/dashboard')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar ao Dashboard
      </Button>
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Gerenciar Ranking</h1>
        <Button onClick={() => setShowCreateForm(true)}>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold">Temporada {season.year}</h3>
                  <p className="text-sm text-gray-600">
                    {new Date(season.start_date).toLocaleDateString('pt-BR')} - {' '}
                    {new Date(season.end_date).toLocaleDateString('pt-BR')}
                  </p>
                  <div className="mt-2">
                    {getStatusBadge(season.status)}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={() => navigate(`/admin/ranking/config/${season.year}`)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Configurar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/admin/ranking/participants/${season.year}`)}>
                    <Users className="h-4 w-4 mr-2" />
                    Participantes
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/admin/ranking/rounds/${season.year}`)}>
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