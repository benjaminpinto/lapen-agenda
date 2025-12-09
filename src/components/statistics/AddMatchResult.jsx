import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import BackButton from '@/components/ui/BackButton'
import MatchResultForm from '@/components/shared/MatchResultForm'
import { Calendar, Clock } from 'lucide-react'

export default function AddMatchResult() {
  const [pastMatches, setPastMatches] = useState([])
  const [userMatches, setUserMatches] = useState([])
  const [otherMatches, setOtherMatches] = useState([])
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const { user } = useAuth()
  const token = localStorage.getItem('auth_token')

  useEffect(() => {
    fetchPastMatches()
  }, [])

  const fetchPastMatches = async () => {
    try {
      const response = await fetch('/api/statistics/past-matches')
      const data = await response.json()
      const matches = data.matches || []
      
      if (user?.short_name || user?.name) {
        const userName = user.short_name || user.name
        const myMatches = matches.filter(m => 
          m.player1_name === userName || m.player2_name === userName
        )
        const others = matches.filter(m => 
          m.player1_name !== userName && m.player2_name !== userName
        )
        setUserMatches(myMatches)
        setOtherMatches(others)
      } else {
        setOtherMatches(matches)
      }
      
      setPastMatches(matches)
    } catch (error) {
      console.error('Error fetching past matches:', error)
    }
  }

  const selectMatch = (match) => {
    setSelectedMatch(match)
  }

  const handleFormSubmit = async ({ score, winner_name }) => {
    const scoreParts = score.split(', ').map(s => s.split('-').map(Number))
    let player1Sets = 0, player2Sets = 0, player1Games = 0, player2Games = 0
    
    scoreParts.forEach(([g1, g2]) => {
      player1Games += g1
      player2Games += g2
      if (g1 > g2) player1Sets++
      else if (g2 > g1) player2Sets++
    })

    setLoading(true)
    try {
      const response = await fetch('/api/statistics/match-result', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          schedule_id: selectedMatch.match_type === 'Ranking' ? null : selectedMatch.id,
          ranking_match_id: selectedMatch.match_type === 'Ranking' ? selectedMatch.id : null,
          winner_name: winner_name,
          player1_sets: player1Sets,
          player2_sets: player2Sets,
          player1_games: player1Games,
          player2_games: player2Games,
          score: score
        })
      })

      if (response.ok) {
        toast({ title: 'Resultado adicionado com sucesso' })
        setSelectedMatch(null)
        fetchPastMatches()
      } else {
        const error = await response.json()
        toast({ title: error.error || 'Erro ao adicionar resultado', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Erro ao adicionar resultado', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6" data-testid="add-match-result-page">
      <BackButton to="/statistics" label="Voltar para Estatísticas" />
      <h1 className="text-3xl font-bold">Adicionar Resultado</h1>

      {!selectedMatch ? (
        <>
          {userMatches.length > 0 && (
            <Card data-testid="user-matches-card">
              <CardHeader>
                <CardTitle>Minhas Partidas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {userMatches.map(match => (
                    <div
                      key={match.id}
                      onClick={() => selectMatch(match)}
                      className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition"
                      data-testid={`match-${match.id}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">
                            {match.player1_name} vs {match.player2_name}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {match.match_type}
                          </div>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(match.date).toLocaleDateString('pt-BR')}
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" />
                            {match.start_time}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {otherMatches.length > 0 && (
            <Card data-testid="other-matches-card">
              <CardHeader>
                <CardTitle>Outras Partidas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {otherMatches.map(match => (
                    <div
                      key={match.id}
                      onClick={() => selectMatch(match)}
                      className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition"
                      data-testid={`match-${match.id}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">
                            {match.player1_name} vs {match.player2_name}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {match.match_type}
                          </div>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(match.date).toLocaleDateString('pt-BR')}
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" />
                            {match.start_time}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {pastMatches.length === 0 && (
            <Card>
              <CardContent className="text-center py-8 text-muted-foreground">
                Nenhuma partida passada sem resultado
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card data-testid="add-result-form">
          <CardHeader>
            <CardTitle>Registrar Resultado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="font-medium">
                {selectedMatch.player1_name} vs {selectedMatch.player2_name}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {new Date(selectedMatch.date).toLocaleDateString('pt-BR')} • {selectedMatch.start_time} • {selectedMatch.match_type}
              </div>
            </div>

            <MatchResultForm
              match={selectedMatch}
              onSubmit={handleFormSubmit}
              onCancel={() => setSelectedMatch(null)}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
