import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/hooks/use-toast'
import { Trophy, TrendingUp, Target, Award, ChevronDown, ChevronUp, Users, Flame, BarChart3, History, Skull, Heart } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import RecentResults from '../ranking/RecentResults'

export default function Statistics() {
  const [players, setPlayers] = useState([])
  const [opponents, setOpponents] = useState([])
  const [player1, setPlayer1] = useState('')
  const [player2, setPlayer2] = useState('')
  const [matchType, setMatchType] = useState('')
  const [stats, setStats] = useState(null)
  const [generalStats, setGeneralStats] = useState(null)
  const [seasons, setSeasons] = useState([])
  const [selectedSeason, setSelectedSeason] = useState('')
  const [loading, setLoading] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(true)
  const [showRecentResults, setShowRecentResults] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    setPlayer1('')
    setPlayer2('')
    setMatchType('')
    setStats(null)
    setIsFilterOpen(true)
    fetchPlayers()
    fetchSeasons()
    fetchGeneralStats()
  }, [])

  useEffect(() => {
    fetchGeneralStats()
  }, [selectedSeason])

  const fetchPlayers = async () => {
    try {
      const response = await fetch('/api/statistics/players')
      const data = await response.json()
      setPlayers(data.players || [])
    } catch (error) {
      console.error('Error fetching players:', error)
    }
  }

  const fetchSeasons = async () => {
    try {
      const response = await fetch('/api/ranking/seasons')
      const data = await response.json()
      setSeasons(data)
    } catch (error) {
      console.error('Error fetching seasons:', error)
    }
  }

  const getSeasonLabel = (season) => {
    return season.description ? `${season.year} - ${season.description}` : season.year.toString()
  }

  const fetchGeneralStats = async () => {
    try {
      const url = selectedSeason 
        ? `/api/statistics/general?season=${selectedSeason}`
        : '/api/statistics/general'
      const response = await fetch(url)
      const data = await response.json()
      setGeneralStats(data)
    } catch (error) {
      console.error('Error fetching general stats:', error)
    }
  }

  const getSelectedSeasonLabel = () => {
    if (!selectedSeason) return 'Todas as temporadas'
    if (selectedSeason === 'amistosos') return 'Amistosos'
    const season = seasons.find(s => s.id.toString() === selectedSeason)
    return season ? getSeasonLabel(season) : selectedSeason
  }

  const fetchOpponents = async (playerName) => {
    try {
      const response = await fetch(`/api/statistics/opponents/${encodeURIComponent(playerName)}`)
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

      const response = await fetch(`/api/statistics/player?${params}`)
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

  const calculateAdditionalStats = (stats) => {
    if (!stats || !stats.matches || stats.matches.length === 0) return null

    const matches = stats.matches
    let currentStreak = 0
    let maxWinStreak = 0
    let maxLossStreak = 0
    let currentStreakType = null

    const sortedMatches = [...matches].sort((a, b) => new Date(b.match_date) - new Date(a.match_date))
    
    sortedMatches.forEach(match => {
      const isWin = match.winner_name === player1
      if (currentStreakType === null) {
        currentStreakType = isWin ? 'win' : 'loss'
        currentStreak = 1
      } else if ((currentStreakType === 'win' && isWin) || (currentStreakType === 'loss' && !isWin)) {
        currentStreak++
      } else {
        if (currentStreakType === 'win') maxWinStreak = Math.max(maxWinStreak, currentStreak)
        else maxLossStreak = Math.max(maxLossStreak, currentStreak)
        currentStreakType = isWin ? 'win' : 'loss'
        currentStreak = 1
      }
    })
    
    if (currentStreakType === 'win') maxWinStreak = Math.max(maxWinStreak, currentStreak)
    else maxLossStreak = Math.max(maxLossStreak, currentStreak)

    const totalSets = stats.sets_won + stats.sets_lost
    const avgGamesPerSet = totalSets > 0 ? ((stats.games_won + stats.games_lost) / totalSets).toFixed(1) : 0

    const tiebreaks = matches.filter(m => {
      const p1Games = m.player1_name === player1 ? m.player1_games : m.player2_games
      const p2Games = m.player1_name === player1 ? m.player2_games : m.player1_games
      const p1Sets = m.player1_name === player1 ? m.player1_sets : m.player2_sets
      const p2Sets = m.player1_name === player1 ? m.player2_sets : m.player1_sets
      return Math.abs(p1Sets - p2Sets) === 1 && Math.abs(p1Games - p2Games) <= 2
    }).length

    // Calculate best/worst opponents
    const opponentStats = {}
    matches.forEach(m => {
      const opponent = m.player1_name === player1 ? m.player2_name : m.player1_name
      if (!opponentStats[opponent]) opponentStats[opponent] = { wins: 0, losses: 0 }
      if (m.winner_name === player1) opponentStats[opponent].wins++
      else opponentStats[opponent].losses++
    })

    let bestOpponent = null
    let worstOpponent = null
    let maxWins = 0
    let maxLosses = 0

    Object.entries(opponentStats).forEach(([opponent, record]) => {
      if (record.wins > maxWins) {
        maxWins = record.wins
        bestOpponent = { name: opponent, wins: record.wins, losses: record.losses }
      }
      if (record.losses > maxLosses) {
        maxLosses = record.losses
        worstOpponent = { name: opponent, wins: record.wins, losses: record.losses }
      }
    })

    return {
      maxWinStreak,
      maxLossStreak,
      currentStreak,
      currentStreakType,
      avgGamesPerSet,
      tiebreaks,
      bestOpponent,
      worstOpponent
    }
  }

  if (showRecentResults) {
    return <RecentResults onBack={() => setShowRecentResults(false)} />
  }

  return (
    <div className="space-y-6" data-testid="statistics-page">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Estatísticas</h1>
        <div className="flex gap-2">
          <Button onClick={() => setShowRecentResults(true)} variant="outline" size="sm">
            <History className="h-4 w-4 mr-2" />
            Últimos Resultados
          </Button>
          <Button onClick={() => window.location.href = '/statistics/add-result'} variant="outline" data-testid="add-result-link">
            Adicionar Resultado
          </Button>
        </div>
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
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={fetchStatistics} disabled={loading} data-testid="fetch-stats-btn">
            {loading ? 'Carregando...' : 'Buscar Estatísticas'}
          </Button>
        </CardContent>}
      </Card>

      {!stats && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filtrar por Temporada</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedSeason} onValueChange={setSelectedSeason}>
              <SelectTrigger data-testid="season-select" className="w-full md:w-64">
                <SelectValue placeholder="Todas as temporadas">
                  {getSelectedSeasonLabel()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas as temporadas</SelectItem>
                <SelectItem value="amistosos">Amistosos</SelectItem>
                {seasons.map(s => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    {getSeasonLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {!stats && generalStats && generalStats.total_matches > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card data-testid="general-stats-card">
              <CardHeader>
                <CardTitle>Estatísticas Gerais</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-brown-600">{generalStats.total_matches}</div>
                    <div className="text-xs text-muted-foreground mt-1">Partidas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-brown-500">{generalStats.total_players}</div>
                    <div className="text-xs text-muted-foreground mt-1">Jogadores</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-brown-400">{generalStats.total_sets}</div>
                    <div className="text-xs text-muted-foreground mt-1">Sets</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-orange-600">{generalStats.total_games}</div>
                    <div className="text-xs text-muted-foreground mt-1">Games</div>
                  </div>
                  <div className="text-center col-span-2 md:col-span-1">
                    <div className="text-3xl font-bold text-amber-500">{generalStats.super_tiebreaks}</div>
                    <div className="text-xs text-muted-foreground mt-1">Super Tiebreaks</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="match-types-chart-card">
              <CardHeader>
                <CardTitle>Distribuição por Tipo</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <defs>
                      {['#78350f', '#ea580c', '#f59e0b', '#fbbf24'].map((color, i) => (
                        <linearGradient key={i} id={`gradient${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                          <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                        </linearGradient>
                      ))}
                    </defs>
                    <Pie
                      data={Object.entries(generalStats.match_types).map(([name, value]) => ({ name, value }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {Object.keys(generalStats.match_types).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={`url(#gradient${index % 4})`} stroke="#fff" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <Card data-testid="top-players-card">
              <CardHeader>
                <CardTitle>Top 5 - Número de Vitórias na Temporada</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {generalStats.top_players.map((player, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 border rounded" data-testid={`top-player-${idx}`}>
                      <div className="flex items-center gap-2">
                        <div className="text-lg font-bold text-muted-foreground">#{idx + 1}</div>
                        <div>
                          <div className="font-medium">{player.name}</div>
                          <div className="text-xs text-muted-foreground">{player.matches} partidas</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">{player.wins} vitórias</div>
                        <div className="text-xs text-muted-foreground">{player.win_rate.toFixed(1)}% aproveitamento</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="top-streaks-card">
              <CardHeader>
                <CardTitle>Top 5 - Sequência de Vitórias</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {generalStats.top_streaks.map((player, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 border rounded" data-testid={`top-streak-${idx}`}>
                      <div className="flex items-center gap-2">
                        <div className="text-lg font-bold text-muted-foreground">#{idx + 1}</div>
                        <div>
                          <div className="font-medium">{player.name}</div>
                          <div className="text-xs text-muted-foreground">Máximo: {player.max_streak} vitórias</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-orange-600">{player.current_streak} 🔥</div>
                        <div className="text-xs text-muted-foreground">sequência atual</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

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

          {(() => {
            const additionalStats = calculateAdditionalStats(stats)
            return additionalStats && (
              <>
                {!player2 && (additionalStats.bestOpponent || additionalStats.worstOpponent) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {additionalStats.bestOpponent && (
                      <Card data-testid="best-opponent-card" className="bg-green-50">
                        <CardContent className="pt-4 pb-3">
                          <div className="flex items-center gap-3">
                            <Skull className="h-5 w-5 text-green-600 flex-shrink-0" />
                            <div className="flex-1">
                              <div className="text-xs font-semibold text-green-700">Carrasco do(a)</div>
                              <div className="text-lg font-bold">{additionalStats.bestOpponent.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {additionalStats.bestOpponent.wins}V - {additionalStats.bestOpponent.losses}D
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    {additionalStats.worstOpponent && (
                      <Card data-testid="worst-opponent-card" className="bg-red-50">
                        <CardContent className="pt-4 pb-3">
                          <div className="flex items-center gap-3">
                            <Heart className="h-5 w-5 text-red-600 flex-shrink-0" />
                            <div className="flex-1">
                              <div className="text-xs font-semibold text-red-700">Freguês do(a)</div>
                              <div className="text-lg font-bold">{additionalStats.worstOpponent.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {additionalStats.worstOpponent.wins}V - {additionalStats.worstOpponent.losses}D
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
                <Card data-testid="additional-stats-card">
                  <CardHeader>
                    <CardTitle>Estatísticas Adicionais</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="text-center p-3 border rounded">
                      <Flame className="h-5 w-5 mx-auto mb-2 text-orange-500" />
                      <div className="text-2xl font-bold text-green-600">{additionalStats.maxWinStreak}</div>
                      <div className="text-xs text-muted-foreground">Maior Sequência de Vitórias</div>
                    </div>
                    <div className="text-center p-3 border rounded">
                      <Flame className="h-5 w-5 mx-auto mb-2 text-blue-500" />
                      <div className="text-2xl font-bold text-red-600">{additionalStats.maxLossStreak}</div>
                      <div className="text-xs text-muted-foreground">Maior Sequência de Derrotas</div>
                    </div>
                    <div className="text-center p-3 border rounded">
                      <BarChart3 className="h-5 w-5 mx-auto mb-2 text-purple-500" />
                      <div className="text-2xl font-bold">{additionalStats.avgGamesPerSet}</div>
                      <div className="text-xs text-muted-foreground">Média de Games por Set</div>
                    </div>
                    <div className="text-center p-3 border rounded">
                      <Target className="h-5 w-5 mx-auto mb-2 text-yellow-500" />
                      <div className="text-2xl font-bold">{additionalStats.tiebreaks}</div>
                      <div className="text-xs text-muted-foreground">Partidas Apertadas</div>
                    </div>
                    <div className="text-center p-3 border rounded col-span-2">
                      <TrendingUp className="h-5 w-5 mx-auto mb-2 text-indigo-500" />
                      <div className="text-2xl font-bold">
                        {additionalStats.currentStreak} {additionalStats.currentStreakType === 'win' ? '🔥' : '❄️'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Sequência Atual: {additionalStats.currentStreakType === 'win' ? 'Vitórias' : 'Derrotas'}
                      </div>
                    </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )
          })()}

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
