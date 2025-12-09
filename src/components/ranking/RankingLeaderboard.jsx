import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trophy, Medal, Award } from 'lucide-react'
import RankingMatches from './RankingMatches'

const RankingLeaderboard = () => {
  const [leaderboard, setLeaderboard] = useState({ elite: [], challenger: [] })
  const [loading, setLoading] = useState(true)
  const [seasons, setSeasons] = useState([])
  const [selectedSeason, setSelectedSeason] = useState(null)

  useEffect(() => {
    fetchSeasons()
  }, [])

  useEffect(() => {
    if (selectedSeason) {
      fetchLeaderboard()
    }
  }, [selectedSeason])

  const fetchSeasons = async () => {
    try {
      const response = await fetch('/api/ranking/seasons')
      if (response.ok) {
        const data = await response.json()
        setSeasons(data)
        const active = data.find(s => s.status === 'active') || data[0]
        if (active) setSelectedSeason(active.id)
      }
    } catch (error) {
      console.error('Erro ao carregar temporadas:', error)
    }
  }

  const fetchLeaderboard = async () => {
    setLoading(true)
    try {
      const [eliteResponse, challengerResponse] = await Promise.all([
        fetch(`/api/ranking/leaderboard/${selectedSeason}?group=elite`),
        fetch(`/api/ranking/leaderboard/${selectedSeason}?group=challenger`)
      ])

      if (eliteResponse.ok && challengerResponse.ok) {
        const elite = await eliteResponse.json()
        const challenger = await challengerResponse.json()
        setLeaderboard({ elite, challenger })
      }
    } catch (error) {
      console.error('Erro ao carregar ranking:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPositionIcon = (position) => {
    switch (position) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />
      default:
        return null
    }
  }

  const PlayerRow = ({ player, index, group }) => {
    const totalPoints = (player.total_points || 0) + (player.temp_points || 0)
    return (
      <div className="flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-gray-50">
        <div className="flex items-center space-x-4">
          <div className="flex items-center justify-center w-8 h-8">
            {getPositionIcon(index + 1) || (
              <span className="text-sm font-medium text-gray-600">
                {index + 1}
              </span>
            )}
          </div>
          <div>
            <p className="font-medium text-gray-900">
              {player.short_name || player.name}
            </p>
            <p className="text-sm text-gray-500">
              {player.wins || 0}V - {player.losses || 0}D
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-gray-900">
            {totalPoints}
          </p>
          {(player.temp_points || 0) > 0 && (
            <Badge variant="secondary" className="text-xs">
              +{player.temp_points} temp
            </Badge>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando ranking...</div>
        </CardContent>
      </Card>
    )
  }

  const currentSeason = seasons.find(s => s.id === selectedSeason)
  const getSeasonLabel = (season) => {
    return season.description ? `${season.year} - ${season.description}` : season.year
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Ranking LAPEN</h1>
        <div className="flex items-center justify-center gap-2 mt-3">
          <span className="text-sm text-gray-500">Temporada:</span>
          <Select value={selectedSeason?.toString()} onValueChange={(v) => setSelectedSeason(parseInt(v))}>
            <SelectTrigger className="w-auto min-w-[200px] h-8 text-sm">
              <SelectValue>
                {currentSeason && getSeasonLabel(currentSeason)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {seasons.map(season => (
                <SelectItem key={season.id} value={season.id.toString()}>
                  {getSeasonLabel(season)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <span>Elite</span>
              </div>
              <Badge variant="default">{leaderboard.elite.length} jogadores</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {leaderboard.elite.length > 0 ? (
              <div>
                {leaderboard.elite.map((player, index) => (
                  <PlayerRow 
                    key={player.user_id} 
                    player={player} 
                    index={index} 
                    group="elite" 
                  />
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-gray-500">
                Nenhum jogador no grupo Elite
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Award className="h-5 w-5 text-blue-500" />
                <span>Challenger</span>
              </div>
              <Badge variant="outline">{leaderboard.challenger.length} jogadores</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {leaderboard.challenger.length > 0 ? (
              <div>
                {leaderboard.challenger.map((player, index) => (
                  <PlayerRow 
                    key={player.user_id} 
                    player={player} 
                    index={index} 
                    group="challenger" 
                  />
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-gray-500">
                Nenhum jogador no grupo Challenger
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <RankingMatches seasonId={selectedSeason} />
    </div>
  )
}

export default RankingLeaderboard