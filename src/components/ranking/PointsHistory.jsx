import {useEffect, useState} from 'react'
import {Dialog, DialogContent, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Badge} from '@/components/ui/badge'
import {Award, TrendingDown, TrendingUp} from 'lucide-react'

const PointsHistory = ({participantId, open, onClose}) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (open && participantId) {
      fetchHistory()
    }
  }, [open, participantId])

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/ranking/participants/${participantId}/points-history`)
      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error)
    } finally {
      setLoading(false)
    }
  }

  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {data && `Extrato de Pontos - ${data.participant.name}`}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">Carregando...</div>
        ) : data ? (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total de Pontos</span>
                <span className="text-2xl font-bold">{data.participant.final_total}</span>
              </div>
              {data.participant.temp_points > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  ({data.participant.total_points} pontos + {data.participant.temp_points} temporários)
                </div>
              )}
            </div>

            <div className="space-y-2">
              {data.history.map((item, index) => (
                <div key={index} className="border rounded-lg p-3 hover:bg-gray-50">
                  {item.type === 'temp_points' ? (
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-medium">{item.description}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-amber-600">+{item.points}</span>
                        <span className="text-xs text-gray-500 w-16 text-right">= {item.running_total}</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={item.group_type === 'elite' ? 'default' : item.group_type === 'challenger' ? 'outline' : 'secondary'} className="text-xs">
                              {item.group_type === 'elite' ? 'Elite' : item.group_type === 'challenger' ? 'Challenger' : 'Next Gen'}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              Rodada {item.round_number} - {months[item.month - 1]}
                            </span>
                          </div>
                          <div className="text-sm font-medium">
                            vs {item.opponent}
                          </div>
                          <div className="text-xs text-gray-600">
                            {item.score} {item.wo_type !== 'none' && '(W.O.)'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.points >= 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          )}
                          <span className={`text-sm font-bold ${item.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {item.points >= 0 ? '+' : ''}{item.points}
                          </span>
                          <span className="text-xs text-gray-500 w-16 text-right">= {item.running_total}</span>
                        </div>
                      </div>
                      <Badge variant={item.result === 'Vitória' ? 'default' : 'destructive'} className="text-xs">
                        {item.result}
                      </Badge>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">Erro ao carregar histórico</div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default PointsHistory
