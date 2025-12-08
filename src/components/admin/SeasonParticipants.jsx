import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/contexts/ToastContext'
import { ArrowLeft, UserX, UserCheck } from 'lucide-react'

const SeasonParticipants = () => {
  const navigate = useNavigate()
  const { year } = useParams()
  const [participants, setParticipants] = useState([])
  const [availableUsers, setAvailableUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchData()
  }, [year])

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const [participantsRes, usersRes] = await Promise.all([
        fetch(`/api/ranking/seasons/${year}/all-participants`, {
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

  const addParticipant = async (userId) => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/ranking/seasons/${year}/participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: userId })
      })

      if (response.ok) {
        toast({ title: 'Participante adicionado', variant: 'default' })
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
      const response = await fetch(`/api/ranking/seasons/${year}/participants/${userId}/toggle`, {
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

  if (loading) return <div>Carregando...</div>

  const participantIds = participants.map(p => p.user_id)
  const nonParticipants = availableUsers.filter(u => !participantIds.includes(u.id))

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => navigate('/admin/ranking')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar
      </Button>
      <h1 className="text-2xl font-bold">Participantes {year}</h1>
      
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
                    <Badge className="ml-2">{p.total_points + p.temp_points} pts</Badge>
                    {!p.is_active && <Badge variant="secondary">Inativo</Badge>}
                  </div>
                  <Button 
                    size="sm" 
                    variant={p.is_active ? "outline" : "default"}
                    onClick={() => toggleParticipant(p.user_id, p.is_active)}
                  >
                    {p.is_active ? <UserX className="h-4 w-4 mr-1" /> : <UserCheck className="h-4 w-4 mr-1" />}
                    {p.is_active ? 'Desativar' : 'Ativar'}
                  </Button>
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
                  <Button size="sm" onClick={() => addParticipant(user.id)}>
                    Adicionar
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default SeasonParticipants