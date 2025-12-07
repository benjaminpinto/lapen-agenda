import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Trophy, Medal, Award } from 'lucide-react'

const RankingLeaderboard = () => {
  const [leaderboard, setLeaderboard] = useState({ elite: [], challenger: [] })
  const [loading, setLoading] = useState(true)
  const [currentYear] = useState(new Date().getFullYear())

  useEffect(() => {
    fetchLeaderboard()
  }, [])

  const fetchLeaderboard = async () => {
    try {
      const [eliteResponse, challengerResponse] = await Promise.all([
        fetch(`/api/ranking/leaderboard/${currentYear}?group=elite`),
        fetch(`/api/ranking/leaderboard/${currentYear}?group=challenger`)
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

  const PlayerRow = ({ player, index, group }) => (
    <div className="flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-gray-50">
      <div className="flex items-center space-x-4">
        <div className="flex items-center justify-center w-8 h-8">
          {getPositionIcon(player.position) || (
            <span className="text-sm font-medium text-gray-600">
              {player.position}
            </span>
          )}
        </div>
        <div>
          <p className="font-medium text-gray-900">
            {player.short_name || player.name}
          </p>
          <p className="text-sm text-gray-500">
            {player.wins}V - {player.losses}D
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-lg font-bold text-gray-900">
          {player.total_points + player.temp_points}
        </p>
        <div className="flex space-x-1">
          {player.temp_points > 0 && (
            <Badge variant="secondary" className="text-xs">
              +{player.temp_points} temp
            </Badge>
          )}
          <Badge variant={group === 'elite' ? 'default' : 'outline'} className="text-xs">
            {group === 'elite' ? 'Elite' : 'Challenger'}
          </Badge>
        </div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando ranking...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Ranking LAPEN {currentYear}</h1>
        <p className="text-gray-600 mt-2">Sistema de pontuação anual</p>
      </div>

      <Tabs defaultValue="elite" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="elite">Elite ({leaderboard.elite.length})</TabsTrigger>
          <TabsTrigger value="challenger">Challenger ({leaderboard.challenger.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="elite">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <span>Grupo Elite</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {leaderboard.elite.length > 0 ? (
                leaderboard.elite.map((player, index) => (
                  <PlayerRow 
                    key={player.user_id} 
                    player={player} 
                    index={index} 
                    group="elite" 
                  />
                ))
              ) : (
                <div className="p-6 text-center text-gray-500">
                  Nenhum jogador no grupo Elite
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="challenger">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Award className="h-5 w-5 text-blue-500" />
                <span>Grupo Challenger</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {leaderboard.challenger.length > 0 ? (
                leaderboard.challenger.map((player, index) => (
                  <PlayerRow 
                    key={player.user_id} 
                    player={player} 
                    index={index} 
                    group="challenger" 
                  />
                ))
              ) : (
                <div className="p-6 text-center text-gray-500">
                  Nenhum jogador no grupo Challenger
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default RankingLeaderboard