import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useParams } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'
import WOForm from './WOForm'

const SeasonRounds = () => {
  const { year } = useParams()
  const [rounds, setRounds] = useState([])
  const [matches, setMatches] = useState([])
  const [selectedRound, setSelectedRound] = useState(null)
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [newRound, setNewRound] = useState({ month: '', round_number: '' })
  const { showToast } = useToast()

  useEffect(() => {
    if (year) fetchRounds()
  }, [year])

  const fetchRounds = async () => {
    try {
      const seasonRes = await fetch(`/api/ranking/seasons/${year}`)
      if (seasonRes.ok) {
        const season = await seasonRes.json()
        const roundsRes = await fetch(`/api/ranking/rounds/${season.id}`)
        if (roundsRes.ok) {
          const data = await roundsRes.json()
          setRounds(data)
        }
      }
    } catch (error) {
      console.error('Error fetching rounds:', error)
    }
  }

  const fetchMatches = async (roundId) => {
    try {
      const response = await fetch(`/api/ranking/rounds/${roundId}/matches`)
      if (response.ok) {
        const data = await response.json()
        setMatches(data)
      }
    } catch (error) {
      console.error('Error fetching matches:', error)
    }
  }

  const createRound = async () => {
    try {
      const seasonRes = await fetch(`/api/ranking/seasons/${year}`)
      const season = await seasonRes.json()
      
      const token = localStorage.getItem('adminToken')
      const response = await fetch('/api/ranking/rounds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          season_id: season.id,
          round_number: parseInt(newRound.round_number),
          month: parseInt(newRound.month),
          year: parseInt(year)
        })
      })

      if (response.ok) {
        showToast('Rodada criada', 'success')
        setNewRound({ month: '', round_number: '' })
        fetchRounds()
      }
    } catch (error) {
      showToast('Erro ao criar rodada', 'error')
    }
  }

  const generateDraw = async (roundId) => {
    try {
      const token = localStorage.getItem('adminToken')
      const response = await fetch(`/api/ranking/rounds/${roundId}/draw`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        showToast('Sorteio realizado', 'success')
        fetchRounds()
        if (selectedRound === roundId) fetchMatches(roundId)
      }
    } catch (error) {
      showToast('Erro no sorteio', 'error')
    }
  }

  const submitWO = async (data) => {
    try {
      const token = localStorage.getItem('adminToken')
      const response = await fetch(`/api/ranking/matches/${selectedMatch.id}/wo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      })

      if (response.ok) {
        showToast('W.O. registrado', 'success')
        setSelectedMatch(null)
        fetchMatches(selectedRound)
      }
    } catch (error) {
      showToast('Erro ao registrar W.O.', 'error')
    }
  }

  const getStatusBadge = (status) => {
    const variants = { pending: 'secondary', drawn: 'default', completed: 'outline' }
    const labels = { pending: 'Pendente', drawn: 'Sorteado', completed: 'Finalizado' }
    return <Badge variant={variants[status]}>{labels[status]}</Badge>
  }

  if (selectedMatch) {
    return <WOForm match={selectedMatch} onSubmit={submitWO} onCancel={() => setSelectedMatch(null)} />
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Rodadas {year}</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Nova Rodada</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Input
            placeholder="Número"
            value={newRound.round_number}
            onChange={(e) => setNewRound(prev => ({ ...prev, round_number: e.target.value }))}
          />
          <Input
            placeholder="Mês"
            value={newRound.month}
            onChange={(e) => setNewRound(prev => ({ ...prev, month: e.target.value }))}
          />
          <Button onClick={createRound}>Criar</Button>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {rounds.map(round => (
          <Card key={round.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">Rodada {round.round_number}</h3>
                  <p className="text-sm text-gray-600">Mês {round.month}</p>
                </div>
                <div className="flex gap-2">
                  {getStatusBadge(round.status)}
                  {round.status === 'pending' && (
                    <Button size="sm" onClick={() => generateDraw(round.id)}>
                      Sortear
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => {
                    setSelectedRound(round.id)
                    fetchMatches(round.id)
                  }}>
                    Ver Partidas
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedRound && matches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Partidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {matches.map(match => (
                <div key={match.id} className="flex justify-between items-center p-2 border rounded">
                  <div>
                    <span className="font-medium">{match.player1_name} vs {match.player2_name}</span>
                    <Badge className="ml-2">{match.group_type}</Badge>
                    {match.score && <span className="ml-2 text-sm">{match.score}</span>}
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={match.status === 'completed' ? 'default' : 'secondary'}>
                      {match.status}
                    </Badge>
                    {match.status === 'scheduled' && (
                      <Button size="sm" onClick={() => setSelectedMatch(match)}>
                        W.O.
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default SeasonRounds