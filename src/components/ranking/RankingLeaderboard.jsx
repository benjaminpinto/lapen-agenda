import {useEffect, useState} from 'react'
import {Card, CardContent} from '@/components/ui/card'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Crown} from 'lucide-react'
import {useAuth} from '@/contexts/AuthContext'
import RankingMatches from './RankingMatches'
import PointsHistory from './PointsHistory'

const GROUPS = [
  {key: 'elite', label: 'Elite'},
  {key: 'challenger', label: 'Challenger'},
  {key: 'nextgen', label: 'Next Gen'},
]

const RankingLeaderboard = () => {
  const [leaderboard, setLeaderboard] = useState({ elite: [], challenger: [], nextgen: [] })
  const [loading, setLoading] = useState(true)
  const [seasons, setSeasons] = useState([])
  const [selectedSeason, setSelectedSeason] = useState(null)
  const [selectedParticipant, setSelectedParticipant] = useState(null)
  const [showPointsHistory, setShowPointsHistory] = useState(false)
  const [group, setGroup] = useState(null)
  const { user } = useAuth()

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
        if (active) {
          setSelectedSeason(active.id)
        } else {
          setLoading(false)
        }
      } else {
        setLoading(false)
      }
    } catch (error) {
      console.error('Erro ao carregar temporadas:', error)
      setLoading(false)
    }
  }

  const fetchLeaderboard = async () => {
    setLoading(true)
    try {
      const [eliteResponse, challengerResponse, nextgenResponse] = await Promise.all([
        fetch(`/api/ranking/leaderboard/${selectedSeason}?group=elite`),
        fetch(`/api/ranking/leaderboard/${selectedSeason}?group=challenger`),
        fetch(`/api/ranking/leaderboard/${selectedSeason}?group=nextgen`)
      ])

      if (eliteResponse.ok && challengerResponse.ok && nextgenResponse.ok) {
        const elite = await eliteResponse.json()
        const challenger = await challengerResponse.json()
        const nextgen = await nextgenResponse.json()
        setLeaderboard({ elite, challenger, nextgen })
      }
    } catch (error) {
      console.error('Erro ao carregar ranking:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-48 rounded-lg bg-muted animate-pulse" />
        <div className="h-96 rounded-2xl bg-muted/60 animate-pulse" />
      </div>
    )
  }

  if (seasons.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <p className="text-lg font-medium mb-2">Nenhuma temporada disponível</p>
            <p className="text-sm">Entre em contato com o administrador para criar uma temporada.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const currentSeason = seasons.find(s => s.id === selectedSeason)
  const getSeasonLabel = (season) => {
    return season.description ? `${season.year} - ${season.description}` : season.year
  }

  // Phones show one group at a time, opening on the signed-in player's own group.
  const myGroup = GROUPS.find(g => leaderboard[g.key].some(p => p.user_id === user?.id))?.key
  const activeGroup = group || myGroup || 'elite'
  const openHistory = (player) => {
    setSelectedParticipant(player.id)
    setShowPointsHistory(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Ranking LAPEN</h1>
          <p className="text-sm text-muted-foreground">Toque num jogador para ver o histórico de pontos</p>
        </div>
        <Select value={selectedSeason?.toString()} onValueChange={(v) => setSelectedSeason(parseInt(v))}>
          <SelectTrigger className="w-full sm:w-auto sm:min-w-[220px] h-10 rounded-full bg-card" data-testid="ranking-season-select">
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

      <div className="lg:hidden grid grid-cols-3 p-1 rounded-full bg-muted text-sm font-semibold" role="tablist">
        {GROUPS.map(g => (
          <button key={g.key} type="button" role="tab" aria-selected={activeGroup === g.key}
                  onClick={() => setGroup(g.key)}
                  className={`h-10 rounded-full transition ${activeGroup === g.key ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
                  data-testid={`ranking-group-${g.key}`}>
            {g.label}
            {myGroup === g.key && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {GROUPS.map(g => (
          <div key={g.key} className={activeGroup === g.key ? '' : 'hidden lg:block'}>
            <GroupBoard group={g} players={leaderboard[g.key]} userId={user?.id} onSelect={openHistory} />
          </div>
        ))}
      </div>

      <RankingMatches seasonId={selectedSeason} activeGroup={activeGroup} />

      <PointsHistory
        participantId={selectedParticipant}
        open={showPointsHistory}
        onClose={() => setShowPointsHistory(false)}
      />
    </div>
  )
}

const points = (player) => (player.total_points || 0) + (player.temp_points || 0)

const GroupBoard = ({ group, players, userId, onSelect }) => {
  if (players.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
        Nenhum jogador no grupo {group.label}
      </div>
    )
  }
  const podium = players.slice(0, 3)
  return (
    <section className="rounded-2xl border bg-card shadow-sm overflow-hidden" data-testid={`ranking-board-${group.key}`}>
      <div className="px-4 pt-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">{group.label}</h2>
        <span className="text-xs font-semibold text-muted-foreground">{players.length} jogadores</span>
      </div>

      {/* Podium: 2nd, 1st, 3rd */}
      <div className="grid grid-cols-3 items-end gap-2 px-4 pt-4">
        {[podium[1], podium[0], podium[2]].map((player, i) => player ? (
          <PodiumStep key={player.user_id} player={player} place={[2, 1, 3][i]}
                      isMe={player.user_id === userId} onSelect={onSelect} />
        ) : <div key={i} />)}
      </div>

      <ol className="divide-y border-t">
        {players.slice(3).map(player => {
          const isMe = player.user_id === userId
          return (
            <li key={player.user_id}>
              <button type="button" onClick={() => onSelect(player)}
                      className={`w-full min-h-[56px] flex items-center justify-start gap-3 px-4 py-2 text-left transition active:bg-muted ${isMe ? 'bg-accent' : ''}`}
                      data-testid={`ranking-row-${player.user_id}`}>
                <span className="w-8 shrink-0 text-sm font-bold tabular-nums text-muted-foreground">{player.position}º</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold truncate">
                    {player.short_name || player.name}
                    {isMe && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-primary">Você</span>}
                  </span>
                  <span className="block text-xs text-muted-foreground tabular-nums">{player.wins || 0}V · {player.losses || 0}D</span>
                </span>
                <span className="text-right shrink-0">
                  <span className="block text-base font-bold tabular-nums">{points(player)}</span>
                  {(player.temp_points || 0) > 0 && (
                    <span className="block text-[10px] text-muted-foreground tabular-nums">+{player.temp_points} temp</span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

const PODIUM_STYLE = {
  1: { height: 'h-24', bar: 'bg-gradient-to-b from-amber-400 to-amber-500 text-amber-950' },
  2: { height: 'h-16', bar: 'bg-gradient-to-b from-stone-300 to-stone-400 text-stone-800' },
  3: { height: 'h-12', bar: 'bg-gradient-to-b from-orange-300 to-orange-400 text-orange-950' },
}

const PodiumStep = ({ player, place, isMe, onSelect }) => (
  <button type="button" onClick={() => onSelect(player)}
          className="min-w-0 min-h-0 flex flex-col items-center justify-end text-center"
          data-testid={`ranking-podium-${place}`}>
    {place === 1 && <Crown className="h-5 w-5 text-amber-500 mb-0.5" />}
    <span className={`font-bold leading-tight truncate w-full ${place === 1 ? 'text-base' : 'text-sm'} ${isMe ? 'text-primary' : ''}`}>
      {player.short_name || player.name}
    </span>
    <span className="text-xs text-muted-foreground tabular-nums">{points(player)} pts</span>
    <span className="text-[10px] text-muted-foreground tabular-nums">{player.wins || 0}V · {player.losses || 0}D</span>
    <span className={`mt-1.5 w-full rounded-t-xl ${PODIUM_STYLE[place].height} ${PODIUM_STYLE[place].bar} flex justify-center pt-1.5`}>
      <span className="font-display text-2xl font-extrabold tabular-nums">{player.position}º</span>
    </span>
  </button>
)

export default RankingLeaderboard
