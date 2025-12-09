import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import BackButton from '@/components/ui/BackButton'
import { CheckCircle, User, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const RecentResults = ({ onBack }) => {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRecentResults()
  }, [])

  const fetchRecentResults = async () => {
    try {
      const [rankingRes, statsRes] = await Promise.all([
        fetch('/api/ranking/recent-results?limit=30'),
        fetch('/api/statistics/recent-results?limit=30')
      ])
      
      const rankingData = rankingRes.ok ? await rankingRes.json() : []
      const statsData = statsRes.ok ? await statsRes.json() : []
      
      const combined = [
        ...rankingData.map(r => ({ ...r, source: 'ranking' })),
        ...statsData.map(r => ({ ...r, source: 'statistics' }))
      ].sort((a, b) => {
        const dateA = new Date(a.played_at || a.created_at)
        const dateB = new Date(b.played_at || b.created_at)
        return dateB - dateA
      })
      
      setResults(combined)
    } catch (error) {
      console.error('Erro ao carregar resultados:', error)
    } finally {
      setLoading(false)
    }
  }

  const ResultCard = ({ result }) => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const date = result.played_at || result.created_at
    const timeAgo = date ? formatDistanceToNow(new Date(date), { 
      addSuffix: true, 
      locale: ptBR 
    }) : 'Data não disponível'
    
    const isRanking = result.source === 'ranking'

    return (
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              {isRanking ? (
                <>
                  <Badge variant={result.group_type === 'elite' ? 'default' : 'outline'}>
                    {result.group_type === 'elite' ? 'Elite' : 'Challenger'}
                  </Badge>
                  <span className="text-sm text-gray-500">
                    Rodada {result.round_number} - {months[result.month - 1]}
                  </span>
                </>
              ) : (
                <>
                  <Badge variant="secondary">{result.match_type}</Badge>
                  <span className="text-sm text-gray-500">
                    {new Date(result.match_date).toLocaleDateString('pt-BR')}
                  </span>
                </>
              )}
            </div>
            {isRanking && result.wo_type !== 'none' && (
              <Badge variant="destructive">W.O.</Badge>
            )}
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 flex-1">
              <span className="font-medium">{result.player1_name}</span>
              {result.winner_name === result.player1_name && (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
            </div>
            <div className="text-center px-4">
              {isRanking && result.wo_type !== 'none' ? (
                <span className="text-sm text-gray-500">W.O.</span>
              ) : (
                <div className="text-xs font-mono">
                  {isRanking ? (
                    result.score.split(', ').map((set, i) => (
                      <div key={i}>{set.replace('-', ' - ')}</div>
                    ))
                  ) : (
                    <div>{result.player1_sets} - {result.player2_sets}</div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-1 justify-end">
              {result.winner_name === result.player2_name && (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
              <span className="font-medium">{result.player2_name}</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>Adicionado por: {result.added_by_name || 'Sistema'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{timeAgo}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando resultados...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div onClick={onBack}>
          <BackButton to="#" label="Voltar" />
        </div>
        <h1 className="text-2xl font-bold">Resultados Recentes</h1>
      </div>

      {results.length > 0 ? (
        <div>
          {results.map((result) => (
            <ResultCard key={result.id} result={result} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-gray-500">Nenhum resultado encontrado</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default RecentResults
