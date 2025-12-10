import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/contexts/ToastContext'
import { ArrowLeft, UserX, UserCheck, Clock, Edit2 } from 'lucide-react'

const SeasonParticipants = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const [participants, setParticipants] = useState([])
  const [availableUsers, setAvailableUsers] = useState([])
  const [tempRules, setTempRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingTemp, setEditingTemp] = useState(null)
  const [tempValue, setTempValue] = useState(0)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [prevPosition, setPrevPosition] = useState('')
  const [showExpireDialog, setShowExpireDialog] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchData()
    fetchTempRules()
  }, [id])

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const [participantsRes, usersRes] = await Promise.all([
        fetch(`/api/ranking/seasons/${id}/all-participants`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/admin/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ])

      if (participantsRes.ok) {
        const data = await participantsRes.json()
        setParticipants(data)
      }

      if (usersRes.ok) {
        const users = await usersRes.json()
        setAvailableUsers(users.filter(u => u.lapen_approved))
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTempRules = async () => {
    try {
      const response = await fetch(`/api/ranking/seasons/${id}/temp-points-rules`)
      if (response.ok) {
        const data = await response.json()
        setTempRules(data)
      }
    } catch (error) {
      console.error('Error fetching temp rules:', error)
    }
  }

  const openAddDialog = (user) => {
    setSelectedUser(user)
    setPrevPosition('')
    setShowAddDialog(true)
  }

  const addParticipant = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/ranking/seasons/${id}/participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          user_id: selectedUser.id, 
          previous_position: prevPosition ? parseInt(prevPosition) : null 
        })
      })

      if (response.ok) {
        toast({ title: 'Participante adicionado', variant: 'default' })
        setShowAddDialog(false)
        await fetchData()
      } else {
        const error = await response.json()
        toast({ title: error.error || 'Erro ao adicionar', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Erro ao adicionar', variant: 'destructive' })
    }
  }

  const toggleParticipant = async (userId, isActive) => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/ranking/seasons/${id}/participants/${userId}/toggle`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        toast({ title: isActive ? 'Participante desativado' : 'Participante ativado', variant: 'default' })
        await fetchData()
      } else {
        const error = await response.json()
        toast({ title: error.error || 'Erro ao atualizar', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' })
    }
  }

  const expireAllTempPoints = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/ranking/seasons/${id}/expire-temp-points`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        toast({ title: 'Pontos temporários expirados', variant: 'default' })
        setShowExpireDialog(false)
        await fetchData()
      } else {
        toast({ title: 'Erro ao expirar pontos', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Erro ao expirar pontos', variant: 'destructive' })
    }
  }

  const updateTempPoints = async (userId) => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/ranking/seasons/${id}/participants/${userId}/temp-points`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ temp_points: tempValue })
      })

      if (response.ok) {
        toast({ title: 'Pontos atualizados', variant: 'default' })
        setEditingTemp(null)
        await fetchData()
      } else {
        toast({ title: 'Erro ao atualizar', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' })
    }
  }

  if (loading) return <div>Carregando...</div>

  const participantIds = participants.map(p => p.user_id)
  const nonParticipants = availableUsers.filter(u => !participantIds.includes(u.id))

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => navigate('/admin/ranking')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar
      </Button>
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Participantes da Temporada</h1>
        <Button variant="outline" onClick={() => setShowExpireDialog(true)}>
          <Clock className="h-4 w-4 mr-2" />
          Expirar Pontos Temp.
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Participantes Atuais ({participants.filter(p => p.is_active).length} ativos, {participants.filter(p => !p.is_active).length} inativos)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {participants.map((p, i) => {
              const activeIndex = participants.filter((x, idx) => idx < i && x.is_active).length + 1
              return (
                <div key={p.user_id} className="flex justify-between items-center p-2 border rounded">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.is_active ? `${activeIndex}.` : '—'} {p.name}</span>
                    <Badge className="ml-2">{p.total_points} pts</Badge>
                    {p.temp_points > 0 && <Badge variant="secondary">+{p.temp_points} temp</Badge>}
                    {!p.is_active && <Badge variant="secondary">Inativo</Badge>}
                  </div>
                  <div className="flex gap-2">
                    {editingTemp === p.user_id ? (
                      <div className="flex gap-1 items-center">
                        <Input 
                          type="number" 
                          value={tempValue} 
                          onChange={(e) => setTempValue(parseInt(e.target.value) || 0)}
                          className="w-20 h-8"
                        />
                        <Button size="sm" onClick={() => updateTempPoints(p.user_id)}>OK</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingTemp(null)}>X</Button>
                      </div>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => { setEditingTemp(p.user_id); setTempValue(p.temp_points) }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant={p.is_active ? "outline" : "default"}
                      onClick={() => toggleParticipant(p.user_id, p.is_active)}
                    >
                      {p.is_active ? <UserX className="h-4 w-4 mr-1" /> : <UserCheck className="h-4 w-4 mr-1" />}
                      {p.is_active ? 'Desativar' : 'Ativar'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {nonParticipants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Adicionar Participantes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {nonParticipants.map(user => (
                <div key={user.id} className="flex justify-between items-center p-2 border rounded">
                  <span>{user.name}</span>
                  <Button size="sm" onClick={() => openAddDialog(user)}>
                    Adicionar
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar {selectedUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="prev-position">Posição Anterior (opcional)</Label>
              <Input
                id="prev-position"
                type="number"
                placeholder="Deixe vazio se novo jogador"
                value={prevPosition}
                onChange={(e) => setPrevPosition(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
            <Button onClick={addParticipant}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showExpireDialog} onOpenChange={setShowExpireDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Expirar Pontos Temporários</DialogTitle>
          </DialogHeader>
          <p>Remover pontos temporários de todos os participantes?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExpireDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={expireAllTempPoints}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SeasonParticipants