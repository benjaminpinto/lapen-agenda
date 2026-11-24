import {useEffect, useState} from 'react'
import {Card, CardContent} from '@/components/ui/card'
import {Calendar, CheckCircle} from 'lucide-react'

const RankingMatches = ({ seasonId, activeGroup }) => {
  const [matches, setMatches] = useState({ elite: [], challenger: [], nextgen: [] })
  const [filter, setFilter] = useState('scheduled')
  const [loading, setLoading] = useState(true)
  const [roundTitle, setRoundTitle] = useState('Partidas')
  const [hasOpenRound, setHasOpenRound] = useState(false)

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
        
        setHasOpenRound(data.length > 0)
        
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
        const nextgen = enrichedData.filter(m => m.group_type === 'nextgen')
        setMatches({ elite, challenger, nextgen })
        
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

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando partidas...</div>
        </CardContent>
      </Card>
    )
  }

  const emptyText = hasOpenRound
    ? `Nenhuma partida ${filter === 'scheduled' ? 'pendente' : 'finalizada'}`
    : 'Nenhuma rodada aberta'

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-bold">{roundTitle}</h2>
        <div className="grid grid-cols-2 p-1 rounded-full bg-muted text-sm font-semibold sm:w-72" role="tablist">
          {[['scheduled', 'Pendentes', Calendar], ['completed', 'Finalizadas', CheckCircle]].map(([value, label, Icon]) => (
            <button key={value} type="button" role="tab" aria-selected={filter === value}
                    onClick={() => setFilter(value)}
                    className={`h-10 rounded-full flex items-center justify-center gap-1.5 transition ${filter === value ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
                    data-testid={`ranking-matches-${value}`}>
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[['elite', 'Elite'], ['challenger', 'Challenger'], ['nextgen', 'Next Gen']].map(([group, label]) => {
          const list = filteredMatches(group)
          return (
            <section key={group}
                     className={`rounded-2xl border bg-card shadow-sm overflow-hidden ${!activeGroup || activeGroup === group ? '' : 'hidden lg:block'}`}
                     data-testid={`ranking-matches-${group}`}>
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h3 className="font-bold">{label}</h3>
                <span className="text-xs font-semibold text-muted-foreground">{list.length} partidas</span>
              </div>
              {list.length > 0
                ? <div className="divide-y">{list.map(match => <MatchCard key={match.id} match={match} />)}</div>
                : <div className="p-6 text-center text-sm text-muted-foreground">{emptyText}</div>}
            </section>
          )
        })}
      </div>
    </div>
  )
}

// One line per player, scoreboard style: position, name, sets, points won.
const MatchCard = ({ match }) => {
  const isCompleted = match.status === 'completed'
  const isWO = isCompleted && match.score?.includes('W.O.')
  const woComment = isWO ? match.score.replace(/^W\.O\.\s*-?\s*/, '').trim() : ''
  const sets = isCompleted && !isWO && match.score ? match.score.split(', ').map(set => set.split('-')) : []

  const Line = ({ side }) => {
    const name = side === 0 ? match.player1_name : match.player2_name
    const position = side === 0 ? match.player1_position : match.player2_position
    const playerId = side === 0 ? match.player1_id : match.player2_id
    const pts = side === 0 ? match.points_p1 : match.points_p2
    const won = isCompleted && match.winner_id === playerId
    return (
      <div className="flex items-center gap-2 min-h-[28px]">
        <span className="w-9 shrink-0 text-xs tabular-nums text-muted-foreground">{position}º</span>
        <span className={`flex-1 min-w-0 truncate text-sm ${won ? 'font-bold' : 'font-medium'} ${isCompleted && !won ? 'text-muted-foreground' : ''}`}>
          {name}
          {won && <CheckCircle className="inline h-3.5 w-3.5 ml-1 text-primary align-[-2px]" />}
        </span>
        {sets.map((set, i) => (
          <span key={i} className={`w-5 text-center text-sm tabular-nums ${Number(set[side]) > Number(set[1 - side]) ? 'font-bold' : 'text-muted-foreground'}`}>
            {set[side]}
          </span>
        ))}
        {isWO && <span className="text-xs font-bold text-muted-foreground">{won ? 'W.O.' : ''}</span>}
        {isCompleted && (
          <span className={`w-10 text-right text-xs font-semibold tabular-nums ${pts > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
            {pts > 0 ? '+' : ''}{pts}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="px-4 py-2.5" data-testid={`ranking-match-${match.id}`}>
      <Line side={0} />
      <Line side={1} />
      {woComment && <div className="pl-11 text-[11px] text-muted-foreground">{woComment}</div>}
    </div>
  )
}

export default RankingMatches
