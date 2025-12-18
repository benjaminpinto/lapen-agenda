import {useEffect, useState} from 'react'
import {useNavigate, useParams} from 'react-router-dom'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {useToast} from '@/contexts/ToastContext'
import {ArrowLeft, Plus, Trash2} from 'lucide-react'
import {fetchWithAuth} from "../../utils/fetchWithAuth.js";

const SeasonConfig = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const [config, setConfig] = useState({})
  const [tempRules, setTempRules] = useState([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchConfig()
    fetchTempRules()
  }, [id])

  const fetchConfig = async () => {
    try {
      const response = await fetchWithAuth(`/api/ranking/seasons/${id}/config`)
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

  const fetchTempRules = async () => {
    try {
      const response = await fetchWithAuth(`/api/ranking/seasons/${id}/temp-points-rules`)
      if (response.ok) {
        const data = await response.json()
        setTempRules(data)
      }
    } catch (error) {
      console.error('Error fetching temp rules:', error)
    }
  }

  const saveConfig = async () => {
    try {
      const response = await fetchWithAuth(`/api/ranking/seasons/${id}/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config)
      })

      if (response.ok) {
        toast({ title: 'Configuração salva' })
      } else {
        toast({ title: 'Erro ao salvar', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Erro ao salvar', variant: 'destructive' })
    }
  }

  const updateConfig = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: parseInt(value) || 0 }))
  }

  const addTempRule = () => {
    setTempRules([...tempRules, { position_min: 1, position_max: 1, points: 0, label: '' }])
  }

  const updateTempRule = (index, field, value) => {
    const updated = [...tempRules]
    updated[index][field] = field === 'label' ? value : parseInt(value) || 0
    setTempRules(updated)
  }

  const removeTempRule = (index) => {
    setTempRules(tempRules.filter((_, i) => i !== index))
  }

  const saveTempRules = async () => {
    try {
      await fetchWithAuth(`/api/ranking/seasons/${id}/temp-points-rules`, {
        method: 'DELETE',
      })
      const response = await fetchWithAuth(`/api/ranking/seasons/${id}/temp-points-rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rules: tempRules })
      })
      if (response.ok) {
        toast({ title: 'Regras salvas' })
        fetchTempRules()
      } else {
        toast({ title: 'Erro ao salvar regras', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Erro ao salvar regras', variant: 'destructive' })
    }
  }

  if (loading) return <div>Carregando...</div>

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => navigate('/admin/ranking')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar
      </Button>
      <h1 className="text-2xl font-bold">Configuração da Temporada</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Pontuação Base</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>Vitória</Label>
            <Input type="number" value={config.win_points || 0} onChange={(e) => updateConfig('win_points', e.target.value)} />
          </div>
          <div>
            <Label>Derrota</Label>
            <Input type="number" value={config.loss_points || 0} onChange={(e) => updateConfig('loss_points', e.target.value)} />
          </div>
          <div>
            <Label>W.O. Vitória</Label>
            <Input type="number" value={config.wo_win_points || 0} onChange={(e) => updateConfig('wo_win_points', e.target.value)} />
          </div>
          <div>
            <Label>W.O. Derrota</Label>
            <Input type="number" value={config.wo_loss_points || 0} onChange={(e) => updateConfig('wo_loss_points', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pontuação por Sets</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>Set Ganho</Label>
            <Input type="number" value={config.set_win_points || 0} onChange={(e) => updateConfig('set_win_points', e.target.value)} />
          </div>
          <div>
            <Label>Set Perdido</Label>
            <Input type="number" value={config.set_loss_points || 0} onChange={(e) => updateConfig('set_loss_points', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pontuação por Games</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>Game Ganho</Label>
            <Input type="number" value={config.game_win_points || 0} onChange={(e) => updateConfig('game_win_points', e.target.value)} />
          </div>
          <div>
            <Label>Game Perdido</Label>
            <Input type="number" value={config.game_loss_points || 0} onChange={(e) => updateConfig('game_loss_points', e.target.value)} />
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

      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Pontos Temporários (Jan-Fev)</span>
            <Button size="sm" onClick={addTempRule}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tempRules.map((rule, i) => (
            <div key={i} className="grid grid-cols-5 gap-2 items-end">
              <div>
                <Label className="text-xs">Posição Min</Label>
                <Input type="number" value={rule.position_min} onChange={(e) => updateTempRule(i, 'position_min', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Posição Max</Label>
                <Input type="number" value={rule.position_max} onChange={(e) => updateTempRule(i, 'position_max', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Pontos</Label>
                <Input type="number" value={rule.points} onChange={(e) => updateTempRule(i, 'points', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Label</Label>
                <Input value={rule.label || ''} onChange={(e) => updateTempRule(i, 'label', e.target.value)} placeholder="Ex: 1º lugar" />
              </div>
              <Button size="sm" variant="destructive" onClick={() => removeTempRule(i)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {tempRules.length === 0 && (
            <p className="text-sm text-gray-500">Nenhuma regra configurada</p>
          )}
          <Button onClick={saveTempRules} className="mt-2">Salvar Regras</Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default SeasonConfig