import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, Wallet, Users, CheckCircle } from 'lucide-react'

const FinishedMatchCard = ({ match, onClick, showWinner = false }) => {
  const [details, setDetails] = useState(null)

  useEffect(() => {
    if (match.match_id) {
      fetchMatchDetails(match.match_id).then(setDetails)
    }
  }, [match.match_id])

  const fetchMatchDetails = async (matchId) => {
    try {
      const response = await fetch(`/api/betting/match/${matchId}/bets`)
      const data = await response.json()
      
      // For finished matches, get winner info
      if (data.match?.status === 'finished') {
        const resultResponse = await fetch(`/api/admin/matches/${matchId}/result`, {
          credentials: 'include'
        })
        if (resultResponse.ok) {
          const resultData = await resultResponse.json()
          data.winner = resultData.winner_name
        }
      }
      
      return data
    } catch (error) {
      return null
    }
  }

  return (
    <Card className={`mb-3 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`} onClick={onClick}>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <div className="font-semibold">
                {match.player1_name} vs {match.player2_name}
              </div>
              <div className="text-sm text-gray-500">
                {new Date(match.date + 'T00:00:00').toLocaleDateString('pt-BR')} às {match.start_time}
              </div>
            </div>
          </div>

          {/* Mobile layout */}
          <div className="flex justify-end md:hidden">
            <div className="text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center font-bold">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Status:
                </span>
                <span className="ml-2">
                  {match.status === 'cancelled' ? 'Cancelada' : 'Finalizada'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center font-bold">
                  <Users className="h-3 w-3 mr-1" />
                  Apostas:
                </span>
                <span className="ml-2">{details?.betting_stats ? Object.values(details.betting_stats).reduce((sum, stat) => sum + stat.bet_count, 0) : 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center font-bold">
                  <Wallet className="h-3 w-3 mr-1" />
                  Total:
                </span>
                <span className="ml-2">R$ {Object.values(details?.betting_stats || {}).reduce((sum, stat) => sum + (stat.total_amount || 0), 0).toFixed(2)}</span>
              </div>
              {showWinner && details?.winner && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center font-bold">
                    <Trophy className="h-3 w-3 mr-1" />
                    Vencedor:
                  </span>
                  <span className="ml-2 text-yellow-600">{details.winner}</span>
                </div>
              )}
            </div>
          </div>

          {/* Desktop layout */}
          <div className="hidden md:flex items-center space-x-6">
            {showWinner && details?.winner && (
              <div className="text-center">
                <div className="text-sm text-gray-500">Vencedor</div>
                <div className="font-semibold text-yellow-600 flex items-center">
                  <Trophy className="h-4 w-4 mr-1" />
                  {details.winner}
                </div>
              </div>
            )}
            
            <div className="text-center">
              <div className="text-sm text-gray-500">Total Apostas</div>
              <div className="font-semibold flex items-center">
                <Wallet className="h-4 w-4 mr-1" />
                R$ {Object.values(details?.betting_stats || {}).reduce((sum, stat) => sum + (stat.total_amount || 0), 0).toFixed(2)}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-sm text-gray-500">Apostadores</div>
              <div className="font-semibold flex items-center">
                <Users className="h-4 w-4 mr-1" />
                {details?.betting_stats ? Object.values(details.betting_stats).reduce((sum, stat) => sum + stat.bet_count, 0) : 0}
              </div>
            </div>
            
            <Badge className={match.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
              {match.status === 'cancelled' ? 'Cancelada' : 'Finalizada'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default FinishedMatchCard