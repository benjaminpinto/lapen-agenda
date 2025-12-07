import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useParams } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'

const SeasonParticipants = () => {
  const { year } = useParams()
  const [participants, setParticipants] = useState([])
  const [availableUsers, setAvailableUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()

  useEffect(() => {
    fetchData()
  }, [year])

  const fetchData = async () => {
    try {
      const [participantsRes, usersRes] = await Promise.all([
        fetch(`/api/ranking/leaderboard/${year}`),
        fetch('/api/admin/users', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
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
      const token = localStorage.getItem('adminToken')
      const response = await fetch(`/api/ranking/seasons/${year}/participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: userId })
      })

      if (response.ok) {
        showToast('Participante adicionado', 'success')
        fetchData()
      }
    } catch (error) {
      showToast('Erro ao adicionar', 'error')
    }
  }

  if (loading) return <div>Carregando...</div>

  const participantIds = participants.map(p => p.user_id)
  const nonParticipants = availableUsers.filter(u => !participantIds.includes(u.id))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Participantes {year}</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Participantes Atuais ({participants.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {participants.map((p, i) => (
              <div key={p.user_id} className="flex justify-between items-center p-2 border rounded">
                <div>
                  <span className="font-medium">{i + 1}. {p.name}</span>
                  <Badge className="ml-2">{p.total_points + p.temp_points} pts</Badge>
                </div>
              </div>
            ))}
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