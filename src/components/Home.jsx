import {Link, useNavigate} from 'react-router-dom'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {Badge} from '@/components/ui/badge'
import {
  ArrowRight,
  Award,
  BarChart3,
  Calendar,
  CalendarDays,
  Clock,
  FileText,
  Flame,
  Instagram,
  Mail,
  MapPin,
  Swords,
  TrendingUp,
  Trophy,
  Users
} from 'lucide-react'
import {useEffect, useState} from 'react'
import MatchTypeBadge from './ui/MatchTypeBadge'
import {useAuth} from '@/contexts/AuthContext'

const Home = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [upcomingMatches, setUpcomingMatches] = useState([])
  const [rankings, setRankings] = useState({ elite: [], challenger: [] })
  const [onFire, setOnFire] = useState({ elite: [], challenger: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        await Promise.all([
          fetchUpcomingMatches(),
          fetchRankings(),
          fetchOnFire()
        ])
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const fetchUpcomingMatches = async () => {
    const now = new Date()
    const response = await fetch(`/api/public/schedules/month?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
    if (response.ok) {
      const data = await response.json()
      const upcoming = data
        .filter(schedule => {
          const scheduleDateTime = new Date(`${schedule.date}T${schedule.start_time}`)
          return scheduleDateTime >= now
        })
        .sort((a, b) => {
          const dateA = new Date(`${a.date}T${a.start_time}`)
          const dateB = new Date(`${b.date}T${b.start_time}`)
          return dateA - dateB
        })
        .slice(0, 10) // Get next 10 matches
      setUpcomingMatches(upcoming)
    }
  }

  const fetchRankings = async () => {
    // Determine active season first - this is a bit hacky without a direct "active season" endpoint for public
    // but we can try to get it from seasons list or just default to logic
    const seasonsResp = await fetch('/api/ranking/seasons')
    if (seasonsResp.ok) {
      const seasons = await seasonsResp.json()
      const active = seasons.find(s => s.status === 'active')
      if (active) {
        const [eliteResp, challengerResp] = await Promise.all([
          fetch(`/api/ranking/leaderboard/${active.id}?group=elite`),
          fetch(`/api/ranking/leaderboard/${active.id}?group=challenger`)
        ])
        if (eliteResp.ok && challengerResp.ok) {
          const elite = await eliteResp.json()
          const challenger = await challengerResp.json()
          setRankings({
            elite: elite.slice(0, 3), // Top 3
            challenger: challenger.slice(0, 3) // Top 3
          })
        }
      }
    }
  }

  const fetchOnFire = async () => {
    const response = await fetch('/api/ranking/player-on-fire')
    if (response.ok) {
      const data = await response.json()
      setOnFire(data)
    }
  }

  const formatDate = (dateStr) => {
    const d = new Date(`${dateStr}T00:00:00`)
    const day = d.getDate().toString().padStart(2, '0')
    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    return `${day}/${month}`
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-orange-600 dark:from-primary/80 dark:to-orange-900/80 text-white shadow-xl p-6 sm:p-10 mb-8">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-yellow-400/20 rounded-full blur-2xl"></div>

        <div className="relative z-10">
          <h1 className="text-3xl sm:text-5xl font-bold mb-4">
            Bora pro Play? 🎾
          </h1>
          <p className="text-lg sm:text-xl text-orange-50 mb-8 max-w-2xl">
            Gerencie seus jogos, acompanhe o ranking e participe da liga mais disputada de Penedo.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link to="/schedule">
              <Button size="lg" className="bg-white text-orange-600 hover:bg-orange-50 border-none shadow-lg font-semibold">
                <Calendar className="mr-2 h-5 w-5" />
                Agendar Jogo
              </Button>
            </Link>
            <Link to="/view">
              <Button size="lg" variant="outline" className="bg-orange-700/30 text-white hover:bg-orange-700/50 border-white/30 backdrop-blur-sm">
                <CalendarDays className="mr-2 h-5 w-5" />
                Ver Agenda
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Quick Actions Grid */}
      <h2 className="text-xl font-semibold mb-4 flex items-center">
        <TrendingUp className="mr-2 h-5 w-5 text-primary" />
        Acesso Rápido
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <QuickActionCard
          to="/view"
          icon={<Users className="h-6 w-6 text-purple-600" />}
          title="Partidas"
          description="Jogos da semana"
          color="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-900/50"
        />
        <QuickActionCard
          to="/ranking"
          icon={<Award className="h-6 w-6 text-yellow-600" />}
          title="Ranking"
          description="Elite & Challenger"
          color="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-900/50"
        />
        <QuickActionCard
          to="/statistics"
          icon={<BarChart3 className="h-6 w-6 text-blue-600" />}
          title="Estatísticas"
          description="Análise detalhada"
          color="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/50"
        />
        <QuickActionCard
          to="/challenges"
          icon={<Swords className="h-6 w-6 text-green-600" />}
          title="Desafios"
          description="Crie disputas"
          color="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column: Next Schedules (Scrollable) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center">
              <Clock className="mr-2 h-5 w-5 text-primary" />
              Próximos Jogos
            </h2>
            <Link to="/view" className="text-sm text-primary hover:underline flex items-center">
              Ver todos <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </div>

          <div className="relative">
            <div className="flex overflow-x-auto pb-4 gap-4 snap-x hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {upcomingMatches.length > 0 ? (
                upcomingMatches.map((match) => (
                  <div key={match.id} className="min-w-[260px] snap-center">
                    <Card className="h-full hover:shadow-md transition-shadow border-l-4 border-l-primary">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <Badge variant="outline" className="bg-background/50">
                            {formatDate(match.date)} • {match.start_time}
                          </Badge>
                          <MatchTypeBadge matchType={match.match_type} size="xs" iconOnly />
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="font-semibold text-sm truncate max-w-[100px]">{match.player1_name.split(' ')[0]}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">vs</span>
                            <div className="flex flex-col items-end">
                              <span className="font-semibold text-sm truncate max-w-[100px]">{match.player2_name.split(' ')[0]}</span>
                            </div>
                          </div>
                          <div className="flex items-center text-xs text-muted-foreground mt-2 pt-2 border-t">
                            <MapPin className="h-3 w-3 mr-1" />
                            {match.court_name}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))
              ) : (
                <div className="w-full text-center py-8 bg-muted/30 rounded-lg text-muted-foreground">
                  Nenhum jogo agendado para hoje.
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            {/* Top Elite */}
            <Card className="border-yellow-200 dark:border-yellow-900/50">
              <CardHeader className="bg-gradient-to-r from-yellow-50 to-transparent dark:from-yellow-900/10 pb-2">
                <CardTitle className="text-lg flex items-center text-yellow-700 dark:text-yellow-500">
                  <Trophy className="mr-2 h-5 w-5" />
                  Top 3 Elite
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {rankings.elite.length > 0 ? (
                  <div className="space-y-4">
                    {rankings.elite.map((player, idx) => (
                      <RankingRow key={player.user_id} player={player} index={idx} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">Ranking em atualização...</p>
                )}
              </CardContent>
            </Card>

            {/* Top Challenger */}
            <Card className="border-blue-200 dark:border-blue-900/50">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/10 pb-2">
                <CardTitle className="text-lg flex items-center text-blue-700 dark:text-blue-500">
                  <Award className="mr-2 h-5 w-5" />
                  Top 3 Challenger
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {rankings.challenger.length > 0 ? (
                  <div className="space-y-4">
                    {rankings.challenger.map((player, idx) => (
                      <RankingRow key={player.user_id} player={player} index={idx} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">Ranking em atualização...</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Column: Player on Fire & Sidebar Widgets */}
        <div className="space-y-6">
          {/* Player on Fire */}
          <Card className="bg-gradient-to-b from-orange-50 to-white dark:from-orange-950/30 dark:to-background border-orange-200 dark:border-orange-900/50 overflow-hidden relative">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-orange-500/10 rounded-full blur-xl"></div>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center text-orange-600">
                <Flame className="mr-2 h-6 w-6 fill-orange-500 animate-pulse" />
                Player on Fire
              </CardTitle>
              <CardDescription>Maior sequência de vitórias atual</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {onFire.elite && onFire.elite.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 tracking-wider">Elite</h4>
                    {onFire.elite.slice(0, 3).map((player, idx) => (
                      <FireRow key={player.user_id} player={player} index={idx} />
                    ))}
                  </div>
                )}

                {onFire.challenger && onFire.challenger.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 tracking-wider">Challenger</h4>
                    {onFire.challenger.slice(0, 3).map((player, idx) => (
                      <FireRow key={player.user_id} player={player} index={idx} />
                    ))}
                  </div>
                )}

                {(!onFire.elite?.length && !onFire.challenger?.length) && (
                  <p className="text-sm text-gray-500 text-center py-4">Ainda sem sequências de vitórias.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Institutional / Footer Links */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center space-x-3 text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer" onClick={() => window.open('https://www.instagram.com/tennis_penedo', '_blank')}>
                <Instagram className="h-5 w-5" />
                <span>@tennis_penedo</span>
              </div>
              <div className="flex items-center space-x-3 text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                <Mail className="h-5 w-5" />
                <a href="mailto:contato@keepquality.com.br">Suporte</a>
              </div>
              <div className="flex items-center space-x-3 text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                <FileText className="h-5 w-5" />
                <a href="/regulamento2026.html" target="_blank">Regulamento Ranking</a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

const QuickActionCard = ({ to, icon, title, description, color }) => (
  <Link to={to} className="block">
    <div className={`h-full p-4 rounded-xl border transition-all duration-300 hover:scale-105 hover:shadow-md ${color} flex flex-col items-center text-center justify-center gap-2`}>
      <div className="p-2 bg-white dark:bg-black/20 rounded-full shadow-sm">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base">{title}</h3>
        <p className="text-xs text-muted-foreground hidden sm:block">{description}</p>
      </div>
    </div>
  </Link>
)

const RankingRow = ({ player, index }) => {
  const isFirst = index === 0;
  return (
    <div className={`flex items-center justify-between p-2 rounded-lg ${isFirst ? 'bg-gradient-to-r from-yellow-50/50 to-transparent dark:to-transparent border border-yellow-100 dark:border-yellow-900/30' : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm 
          ${isFirst ? 'bg-yellow-100 text-yellow-700' :
            index === 1 ? 'bg-gray-100 text-gray-700' :
              index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-transparent text-gray-500'}`}>
          {index + 1}
        </div>
        <div className="flex flex-col">
          <span className="font-medium text-sm">{player.short_name}</span>
          <span className="text-xs text-muted-foreground">{player.wins}V - {player.losses}D</span>
        </div>
      </div>
      <div className="font-bold text-sm">
        {(player.total_points + (player.temp_points || 0))} pts
      </div>
    </div>
  )
}

const FireRow = ({ player, index }) => (
  <div className="flex items-center justify-between py-2 border-b last:border-0 border-dashed border-orange-200 dark:border-orange-900/30">
    <div className="flex items-center gap-2">
      <div className="text-sm font-medium">{player.name}</div>
    </div>
    <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-none">
      {player.streak} 🔥
    </Badge>
  </div>
)

export default Home
