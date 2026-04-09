import {useEffect, useState} from 'react'
import {Card, CardContent} from '@/components/ui/card'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Calendar, History} from 'lucide-react'
import {useAuth} from '@/contexts/AuthContext'
import MatchResultForm from '@/components/shared/MatchResultForm'
import RecentResults from './RecentResults'
import {useToast} from '@/contexts/ToastContext'
import {fetchWithAuth} from "../../utils/fetchWithAuth.js";

const MyMatches = () => {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [showRecentResults, setShowRecentResults] = useState(false)
  const { user } = useAuth()
  const { showToast } = useToast()

  useEffect(() => {
    if (user) {
      fetchMyMatches()
    }
  }, [user])

  const fetchMyMatches = async () => {
    try {
      // This would need a new API endpoint
      const response = await fetchWithAuth(`/api/ranking/my-matches`, {
        headers: {  }
      })
      if (response.ok) {
        const data = await response.json()
        setMatches(data)
      }
    } catch (error) {
      console.error('Error fetching matches:', error)
    } finally {
      setLoading(false)
    }
  }

  const submitResult = async (result) => {
    try {
      const response = await fetchWithAuth(`/api/ranking/matches/${selectedMatch.id}/result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          
        },
        body: JSON.stringify(result)
      })

      if (response.ok) {
        showToast('Resultado registrado com sucesso', 'success')
        setSelectedMatch(null)
        fetchMyMatches()
      } else {
        const error = await response.json()
        showToast(error.error || 'Erro ao registrar resultado', 'error')
      }
    } catch (error) {
      showToast('Erro ao registrar resultado', 'error')
    }
  }

  const getStatusBadge = (status) => {
    const variants = {
      scheduled: 'default',
      completed: 'secondary',
      cancelled: 'destructive',
      wo: 'outline'
    }
    const labels = {
      scheduled: 'Agendada',
      completed: 'Finalizada',
      cancelled: 'Cancelada',
      wo: 'W.O.'
    }
    return <Badge variant={variants[status]}>{labels[status]}</Badge>
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando partidas...</div>
        </CardContent>
      </Card>
    )
  }

  if (showRecentResults) {
    return <RecentResults onBack={() => setShowRecentResults(false)} />
  }

  if (selectedMatch) {
    return (
      <MatchResultForm
        match={selectedMatch}
        onSubmit={submitResult}
        onCancel={() => setSelectedMatch(null)}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Minhas Partidas</h1>
        <Button variant="outline" size="sm" onClick={() => setShowRecentResults(true)}>
          <History className="h-4 w-4 mr-2" />
          Últimos Resultados
        </Button>
      </div>

      {matches.length > 0 ? (
        <div className="space-y-4">
          {matches.map((match) => (
            <Card key={match.id}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {match.player1_name} vs {match.player2_name}
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-600 mt-2">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>Rodada {match.round_number}</span>
                      </div>
                      <Badge variant={match.group_type === 'elite' ? 'default' : 'outline'}>
                        {match.group_type === 'elite' ? 'Elite' : 'Challenger'}
                      </Badge>
                    </div>
                    {match.score && (
                      <p className="text-sm text-gray-600 mt-1">
                        Placar: {match.score}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    {getStatusBadge(match.status)}
                    {match.status === 'scheduled' && (
                      <Button
                        size="sm"
                        className="mt-2"
                        onClick={() => setSelectedMatch(match)}
                      >
                        Registrar Resultado
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-gray-500">Nenhuma partida encontrada</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default MyMatches