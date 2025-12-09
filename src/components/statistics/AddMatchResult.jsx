import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { Calendar, Clock } from 'lucide-react'

export default function AddMatchResult() {
  const [pastMatches, setPastMatches] = useState([])
  const [userMatches, setUserMatches] = useState([])
  const [otherMatches, setOtherMatches] = useState([])
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [winnerName, setWinnerName] = useState('')
  const [set1Player1, setSet1Player1] = useState('')
  const [set1Player2, setSet1Player2] = useState('')
  const [set2Player1, setSet2Player1] = useState('')
  const [set2Player2, setSet2Player2] = useState('')
  const [set3Player1, setSet3Player1] = useState('')
  const [set3Player2, setSet3Player2] = useState('')
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
    setWinnerName('')
    setSet1Player1('')
    setSet1Player2('')
    setSet2Player1('')
    setSet2Player2('')
    setSet3Player1('')
    setSet3Player2('')
  }

  const calculateStats = () => {
    const sets = [
      [set1Player1, set1Player2],
      [set2Player1, set2Player2],
      [set3Player1, set3Player2]
    ].filter(([p1, p2]) => p1 && p2)

    let player1Sets = 0
    let player2Sets = 0
    let player1Games = 0
    let player2Games = 0

    sets.forEach(([p1, p2]) => {
      const g1 = parseInt(p1) || 0
      const g2 = parseInt(p2) || 0
      player1Games += g1
      player2Games += g2
      if (g1 > g2) player1Sets++
      else if (g2 > g1) player2Sets++
    })

    return { player1Sets, player2Sets, player1Games, player2Games }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!selectedMatch || !winnerName) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' })
      return
    }

    if (!set1Player1 || !set1Player2 || !set2Player1 || !set2Player2) {
      toast({ title: 'Preencha os resultados dos 2 primeiros sets', variant: 'destructive' })
      return
    }

    const stats = calculateStats()

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
          winner_name: winnerName,
          player1_sets: stats.player1Sets,
          player2_sets: stats.player2Sets,
          player1_games: stats.player1Games,
          player2_games: stats.player2Games
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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-base font-semibold">Set 1</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <Label className="text-sm">{selectedMatch.player1_name}</Label>
                    <Input
                      type="number"
                      min="0"
                      value={set1Player1}
                      onChange={(e) => setSet1Player1(e.target.value)}
                      data-testid="set1-player1-input"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">{selectedMatch.player2_name}</Label>
                    <Input
                      type="number"
                      min="0"
                      value={set1Player2}
                      onChange={(e) => setSet1Player2(e.target.value)}
                      data-testid="set1-player2-input"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-base font-semibold">Set 2</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <Label className="text-sm">{selectedMatch.player1_name}</Label>
                    <Input
                      type="number"
                      min="0"
                      value={set2Player1}
                      onChange={(e) => setSet2Player1(e.target.value)}
                      data-testid="set2-player1-input"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">{selectedMatch.player2_name}</Label>
                    <Input
                      type="number"
                      min="0"
                      value={set2Player2}
                      onChange={(e) => setSet2Player2(e.target.value)}
                      data-testid="set2-player2-input"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-base font-semibold">Super Tie Break (opcional)</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <Label className="text-sm">{selectedMatch.player1_name}</Label>
                    <Input
                      type="number"
                      min="0"
                      value={set3Player1}
                      onChange={(e) => setSet3Player1(e.target.value)}
                      data-testid="set3-player1-input"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">{selectedMatch.player2_name}</Label>
                    <Input
                      type="number"
                      min="0"
                      value={set3Player2}
                      onChange={(e) => setSet3Player2(e.target.value)}
                      data-testid="set3-player2-input"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label>Vencedor</Label>
                <div className="space-y-2 mt-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="winner"
                      value={selectedMatch.player1_name}
                      checked={winnerName === selectedMatch.player1_name}
                      onChange={(e) => setWinnerName(e.target.value)}
                      data-testid="winner-player1-radio"
                    />
                    <span>{selectedMatch.player1_name}</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="winner"
                      value={selectedMatch.player2_name}
                      checked={winnerName === selectedMatch.player2_name}
                      onChange={(e) => setWinnerName(e.target.value)}
                      data-testid="winner-player2-radio"
                    />
                    <span>{selectedMatch.player2_name}</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setSelectedMatch(null)}>
                  Voltar
                </Button>
                <Button type="submit" disabled={loading} data-testid="submit-result-btn">
                  {loading ? 'Salvando...' : 'Salvar Resultado'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
