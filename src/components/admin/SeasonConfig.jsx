import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/contexts/ToastContext'
import { ArrowLeft } from 'lucide-react'

const SeasonConfig = () => {
  const navigate = useNavigate()
  const { year } = useParams()
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()

  useEffect(() => {
    fetchConfig()
  }, [year])

  const fetchConfig = async () => {
    try {
      const response = await fetch(`/api/ranking/seasons/${year}/config`)
      if (response.ok) {
        const data = await response.json()
        setConfig(data)
      }
    } catch (error) {
      console.error('Error fetching config:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/ranking/seasons/${year}/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(config)
      })

      if (response.ok) {
        showToast('Configuração salva', 'success')
      } else {
        showToast('Erro ao salvar', 'error')
      }
    } catch (error) {
      showToast('Erro ao salvar', 'error')
    }
  }

  const updateConfig = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: parseInt(value) || 0 }))
  }

  if (loading) return <div>Carregando...</div>

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => navigate('/admin/ranking')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar
      </Button>
      <h1 className="text-2xl font-bold">Configuração {year}</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Pontuação</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>Vitória</Label>
            <Input value={config.win_points || 0} onChange={(e) => updateConfig('win_points', e.target.value)} />
          </div>
          <div>
            <Label>Derrota</Label>
            <Input value={config.loss_points || 0} onChange={(e) => updateConfig('loss_points', e.target.value)} />
          </div>
          <div>
            <Label>W.O. Vitória</Label>
            <Input value={config.wo_win_points || 0} onChange={(e) => updateConfig('wo_win_points', e.target.value)} />
          </div>
          <div>
            <Label>W.O. Derrota</Label>
            <Input value={config.wo_loss_points || 0} onChange={(e) => updateConfig('wo_loss_points', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Grupos</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>Corte Elite</Label>
            <Input value={config.elite_cutoff || 0} onChange={(e) => updateConfig('elite_cutoff', e.target.value)} />
          </div>
          <div>
            <Label>Partidas/Rodada</Label>
            <Input value={config.matches_per_round || 0} onChange={(e) => updateConfig('matches_per_round', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={saveConfig}>Salvar Configuração</Button>
    </div>
  )
}

export default SeasonConfig