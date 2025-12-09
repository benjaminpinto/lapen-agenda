import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/hooks/use-toast'
import { Trophy, TrendingUp, Target, Award, ChevronDown, ChevronUp } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001'

export default function Statistics() {
  const [players, setPlayers] = useState([])
  const [opponents, setOpponents] = useState([])
  const [player1, setPlayer1] = useState('')
  const [player2, setPlayer2] = useState('')
  const [matchType, setMatchType] = useState('')
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchPlayers()
  }, [])

  const fetchPlayers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/statistics/players`)
      const data = await response.json()
      setPlayers(data.players || [])
    } catch (error) {
      console.error('Error fetching players:', error)
    }
  }

  const fetchOpponents = async (playerName) => {
    try {
      const response = await fetch(`${API_URL}/api/statistics/opponents/${encodeURIComponent(playerName)}`)
      const data = await response.json()
      setOpponents(data.opponents || [])
    } catch (error) {
      console.error('Error fetching opponents:', error)
      setOpponents([])
    }
  }

  useEffect(() => {
    if (player1) {
      fetchOpponents(player1)
      setPlayer2('')
    } else {
      setOpponents([])
    }
  }, [player1])

  const fetchStatistics = async () => {
    if (!player1) {
      toast({ title: 'Selecione um jogador', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams({ player1 })
      if (player2) params.append('player2', player2)
      if (matchType) params.append('match_type', matchType)

      const response = await fetch(`${API_URL}/api/statistics/player?${params}`)
      const data = await response.json()
      setStats(data)
      setIsFilterOpen(false)
    } catch (error) {
      toast({ title: 'Erro ao buscar estatísticas', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const shareStats = () => {
    toast({ title: 'Funcionalidade em desenvolvimento', description: 'Compartilhamento de imagem será implementado em breve' })
  }

  return (
    <div className="space-y-6" data-testid="statistics-page">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Estatísticas</h1>
        <Button onClick={() => window.location.href = '/statistics/add-result'} variant="outline" data-testid="add-result-link">
          Adicionar Resultado
        </Button>
      </div>

      <Card data-testid="statistics-filters">
        <CardHeader className="cursor-pointer" onClick={() => setIsFilterOpen(!isFilterOpen)}>
          <div className="flex justify-between items-center">
            <CardTitle>Filtros</CardTitle>
            {isFilterOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </div>
        </CardHeader>
        {isFilterOpen && <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Jogador 1</label>
              <Select value={player1} onValueChange={setPlayer1}>
                <SelectTrigger data-testid="player1-select">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {players.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Jogador 2 (opcional)</label>
              <Select value={player2} onValueChange={setPlayer2}>
                <SelectTrigger data-testid="player2-select">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {opponents.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Tipo de Partida</label>
              <Select value={matchType} onValueChange={setMatchType}>
                <SelectTrigger data-testid="match-type-select">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="Ranking">Ranking</SelectItem>
                  <SelectItem value="Amistoso">Amistoso</SelectItem>
                  <SelectItem value="Liga">Liga</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={fetchStatistics} disabled={loading} data-testid="fetch-stats-btn">
            {loading ? 'Carregando...' : 'Buscar Estatísticas'}
          </Button>
        </CardContent>}
      </Card>

      {stats && !isFilterOpen && (
        <div className="text-center">
          <h2 className="text-2xl font-bold">
            {player2 ? `${player1} x ${player2}` : `Histórico - ${player1}`}
          </h2>
        </div>
      )}

      {stats && (
        <>
          {stats.head_to_head && (
            <Card data-testid="head-to-head-card">
              <CardHeader>
                <CardTitle>H2H - Confrontos Diretos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-4xl font-bold text-green-600">{stats.head_to_head.player1_wins}</div>
                    <div className="text-sm text-muted-foreground">{stats.head_to_head.player1}</div>
                  </div>
                  <div>
                    <div className="text-4xl font-bold text-blue-600">{stats.head_to_head.player2_wins}</div>
                    <div className="text-sm text-muted-foreground">{stats.head_to_head.player2}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card data-testid="total-matches-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total de Partidas</CardTitle>
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_matches}</div>
              </CardContent>
            </Card>

            <Card data-testid="wins-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Vitórias</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.wins}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.total_matches > 0 ? ((stats.wins / stats.total_matches) * 100).toFixed(1) : 0}% de aproveitamento
                </p>
              </CardContent>
            </Card>

            <Card data-testid="sets-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Sets</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.sets_won} - {stats.sets_lost}</div>
                <p className="text-xs text-muted-foreground">Ganhos - Perdidos</p>
              </CardContent>
            </Card>

            <Card data-testid="games-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Games</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.games_won} - {stats.games_lost}</div>
                <p className="text-xs text-muted-foreground">Ganhos - Perdidos</p>
              </CardContent>
            </Card>
          </div>

          <Card data-testid="matches-history-card">
            <CardHeader>
              <CardTitle>Histórico de Partidas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.matches.map((match, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 border rounded-lg" data-testid={`match-${idx}`}>
                    <div>
                      <div className="font-medium">
                        {match.player1_name} vs {match.player2_name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(match.match_date).toLocaleDateString('pt-BR')} • {match.match_type}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">
                        {match.player1_sets} - {match.player2_sets}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ({match.player1_games} - {match.player2_games} games)
                      </div>
                      <div className={`text-xs font-medium ${match.winner_name === player1 ? 'text-green-600' : 'text-red-600'}`}>
                        Vencedor: {match.winner_name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
