import {useEffect, useState} from 'react'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Calendar, CheckCircle} from 'lucide-react'

const RankingMatches = ({ seasonId }) => {
  const [matches, setMatches] = useState({ elite: [], challenger: [] })
  const [filter, setFilter] = useState('scheduled')
  const [loading, setLoading] = useState(true)
  const [roundTitle, setRoundTitle] = useState('Partidas')

  useEffect(() => {
    if (seasonId) {
      fetchMatches()
    }
  }, [seasonId])

  const fetchMatches = async () => {
    try {
      const [matchesRes, leaderboardRes] = await Promise.all([
        fetch(`/api/ranking/all-open-matches`),
        fetch(`/api/ranking/leaderboard/${seasonId}`)
      ])
      
      if (matchesRes.ok && leaderboardRes.ok) {
        const data = await matchesRes.json()
        const leaderboard = await leaderboardRes.json()
        
        // Create position map
        const positionMap = {}
        leaderboard.forEach(p => {
          positionMap[p.user_id] = p.position
        })
        
        // Add positions to matches
        const enrichedData = data.map(m => ({
          ...m,
          player1_position: positionMap[m.player1_id] || '-',
          player2_position: positionMap[m.player2_id] || '-'
        }))
        
        const elite = enrichedData.filter(m => m.group_type === 'elite')
        const challenger = enrichedData.filter(m => m.group_type === 'challenger')
        setMatches({ elite, challenger })
        
        // Set round title from first match
        if (data.length > 0) {
          const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                         'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
          const match = data[0]
          const monthName = months[match.month - 1]
          setRoundTitle(`Partidas - Rodada de ${monthName}`)
        }
      }
    } catch (error) {
      console.error('Erro ao carregar partidas:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredMatches = (group) => {
    return matches[group].filter(m => m.status === filter)
  }

  const MatchCard = ({ match }) => {
    const isCompleted = match.status === 'completed'
    const isWO = isCompleted && match.score?.includes('W.O.')
    const woComment = isWO ? match.score.replace(/^W\.O\.\s*-?\s*/, '').trim() : ''
    
    return (
      <div className="p-4 border-b last:border-b-0 hover:bg-gray-50">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm text-gray-500 font-medium">[{match.player1_position}º]</span>
            <span className="font-medium">{match.player1_name}</span>
            {isCompleted && match.winner_id === match.player1_id && (
              <CheckCircle className="h-4 w-4 text-green-600" />
            )}
          </div>
          <div className="text-center">
            {isCompleted ? (
              <div className="text-xs font-mono">
                {isWO ? (
                  <div>
                    <div>W.O.</div>
                    {woComment && (
                      <div className="text-[10px] text-gray-500 mt-0.5 max-w-[120px] mx-auto">{woComment}</div>
                    )}
                  </div>
                ) : (
                  <>
                    {match.score.split(', ').map((set, i) => (
                      <div key={i}>{set.replace('-', ' - ')}</div>
                    ))}
                  </>
                )}
                <div className="border-t border-gray-300 my-1"></div>
                <div className="text-gray-600">
                  {match.points_p1 > 0 ? '+' : ''}{match.points_p1} | {match.points_p2 > 0 ? '+' : ''}{match.points_p2}
                </div>
              </div>
            ) : (
              <span className="text-2xl text-gray-400 font-bold">X</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-1 justify-end">
            {isCompleted && match.winner_id === match.player2_id && (
              <CheckCircle className="h-4 w-4 text-green-600" />
            )}
            <span className="font-medium">{match.player2_name}</span>
            <span className="text-sm text-gray-500 font-medium">[{match.player2_position}º]</span>
          </div>
        </div>
      </div>
    )
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

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">{roundTitle}</h2>
      <div className="flex justify-center gap-2">
        <Button
          variant={filter === 'scheduled' ? 'default' : 'outline'}
          onClick={() => setFilter('scheduled')}
          className="flex items-center gap-2"
        >
          <Calendar className="h-4 w-4" />
          Pendentes
        </Button>
        <Button
          variant={filter === 'completed' ? 'default' : 'outline'}
          onClick={() => setFilter('completed')}
          className="flex items-center gap-2"
        >
          <CheckCircle className="h-4 w-4" />
          Finalizadas
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Elite</span>
              <Badge variant="default">
                {filteredMatches('elite').length} partidas
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filteredMatches('elite').length > 0 ? (
              <div>
                {filteredMatches('elite').map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-gray-500">
                Nenhuma partida {filter === 'scheduled' ? 'pendente' : 'finalizada'}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Challenger</span>
              <Badge variant="outline">
                {filteredMatches('challenger').length} partidas
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filteredMatches('challenger').length > 0 ? (
              <div>
                {filteredMatches('challenger').map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-gray-500">
                Nenhuma partida {filter === 'scheduled' ? 'pendente' : 'finalizada'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default RankingMatches
