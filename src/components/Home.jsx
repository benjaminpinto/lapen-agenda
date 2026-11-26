import {Link} from 'react-router-dom'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {Badge} from '@/components/ui/badge'
import {
  Award,
  BarChart3,
  Calendar,
  CalendarDays,
  Clock,
  FileText,
  Flame,
  Instagram,
  Mail,
  Swords,
  TrendingUp,
  Trophy
} from 'lucide-react'
import {useEffect, useState} from 'react'
import CourtAvailability from './agenda/CourtAvailability'
import useScheduleActions from './agenda/useScheduleActions'
import {useAuth} from '@/contexts/AuthContext'

const Home = () => {
  const { user } = useAuth()
  const [rankings, setRankings] = useState({ elite: [], challenger: [] })
  const [onFire, setOnFire] = useState({ elite: [], challenger: [] })
  const [loading, setLoading] = useState(true)
  // Same edit/delete as the agenda page, from the court grid's slot sheet
  const [agendaVersion, setAgendaVersion] = useState(0)
  const { handleEdit, handleDeleteClick, handleMove, dialogs } = useScheduleActions(() => setAgendaVersion(v => v + 1))

  useEffect(() => {
    const fetchData = async () => {
      try {
        await Promise.all([
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

  const greeting = user?.short_name || user?.name?.split(' ')[0]

  return (
    <div className="space-y-8 animate-up">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-[#2a1810] text-white p-5 sm:p-8 shadow-xl">
        <CourtLines className="absolute -right-10 -top-6 h-[130%] text-white/[0.09] rotate-12 pointer-events-none" />
        <div className="absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-[#c2410c]/50 blur-3xl" />
        <div className="relative">
          <p className="text-[11px] uppercase tracking-[0.2em] text-orange-200/80 font-semibold">Liga Penedense de Tênis</p>
          <h1 className="mt-1 text-3xl sm:text-5xl font-extrabold leading-[1.05]">
            {greeting ? <>Olá, {greeting}.<br/><span className="text-orange-300">Bora pro play?</span></> : <>Bora pro <span className="text-orange-300">play?</span></>}
          </h1>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:gap-3">
            <Link to="/schedule" data-testid="schedule-button">
              <Button size="lg" className="w-full px-4 rounded-full bg-[#ea580c] hover:bg-[#c2410c] text-white font-bold shadow-lg shadow-black/20">
                <Calendar className="mr-2 h-5 w-5" />
                Agendar
              </Button>
            </Link>
            <Link to="/view" data-testid="view-schedule-button">
              <Button size="lg" variant="outline" className="w-full px-4 rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-white border-white/25 font-semibold">
                <CalendarDays className="mr-2 h-5 w-5" />
                Ver agenda
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Courts today */}
          <section>
            <SectionTitle icon={<Clock className="h-5 w-5" />} title="Quadras" hint="Toque num horário livre para agendar" />
            <CourtAvailability compact onEdit={handleEdit} onDelete={handleDeleteClick} onMove={handleMove} refreshKey={agendaVersion} />
            {dialogs}
          </section>

          {/* Quick access */}
          <section>
            <SectionTitle icon={<TrendingUp className="h-5 w-5" />} title="Acesso rápido" />
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              <QuickActionCard to="/ranking" icon={<Award className="h-5 w-5" />} title="Ranking" />
              <QuickActionCard to="/tournaments" testId="home-quick-tournaments" icon={<Trophy className="h-5 w-5" />} title="Torneios" />
              <QuickActionCard to="/statistics" icon={<BarChart3 className="h-5 w-5" />} title="Números" />
              <QuickActionCard to="/challenges" testId="home-quick-challenges" icon={<Swords className="h-5 w-5" />} title="Desafios" />
            </div>
          </section>

          {/* Top 3 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TopCard title="Top 3 Elite" icon={<Trophy className="h-5 w-5" />} players={rankings.elite} accent="bg-[#c2410c]" />
            <TopCard title="Top 3 Challenger" icon={<Award className="h-5 w-5" />} players={rankings.challenger} accent="bg-[#b45309]" />
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center text-lg">
                <Flame className="mr-2 h-5 w-5 fill-orange-500 text-orange-600" />
                Player on Fire
              </CardTitle>
              <CardDescription>Maior sequência de vitórias atual</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                {onFire.elite && onFire.elite.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-semibold uppercase text-muted-foreground mb-1 tracking-[0.14em]">Elite</h4>
                    {onFire.elite.slice(0, 3).map((player, idx) => (
                      <FireRow key={player.user_id} player={player} index={idx} />
                    ))}
                  </div>
                )}

                {onFire.challenger && onFire.challenger.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-semibold uppercase text-muted-foreground mb-1 tracking-[0.14em]">Challenger</h4>
                    {onFire.challenger.slice(0, 3).map((player, idx) => (
                      <FireRow key={player.user_id} player={player} index={idx} />
                    ))}
                  </div>
                )}

                {(!onFire.elite?.length && !onFire.challenger?.length) && (
                  <p className="text-sm text-muted-foreground text-center py-4">Ainda sem sequências de vitórias.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Institutional links */}
          <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-muted-foreground">
            <a href="https://www.instagram.com/tennis_penedo" target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 rounded-2xl border bg-card py-3 hover:text-primary">
              <Instagram className="h-5 w-5" />
              Instagram
            </a>
            <a href="mailto:contato@keepquality.com.br" className="flex flex-col items-center gap-1 rounded-2xl border bg-card py-3 hover:text-primary">
              <Mail className="h-5 w-5" />
              Suporte
            </a>
            <a href="/regulamento2026.html" target="_blank" className="flex flex-col items-center gap-1 rounded-2xl border bg-card py-3 hover:text-primary">
              <FileText className="h-5 w-5" />
              Regulamento
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

const SectionTitle = ({ icon, title, hint }) => (
  <div className="flex items-end justify-between mb-3">
    <h2 className="text-xl font-bold flex items-center gap-2">
      <span className="text-primary">{icon}</span>
      {title}
    </h2>
    {hint && <span className="text-xs text-muted-foreground hidden sm:inline">{hint}</span>}
  </div>
)

// Top-down tennis court in chalk lines, used as the hero's texture.
const CourtLines = ({ className }) => (
  <svg viewBox="0 0 120 260" fill="none" stroke="currentColor" strokeWidth="2.5" className={className} aria-hidden="true">
    <rect x="4" y="4" width="112" height="252" />
    <line x1="18" y1="4" x2="18" y2="256" />
    <line x1="102" y1="4" x2="102" y2="256" />
    <line x1="18" y1="70" x2="102" y2="70" />
    <line x1="18" y1="190" x2="102" y2="190" />
    <line x1="60" y1="70" x2="60" y2="190" />
    <line x1="0" y1="130" x2="120" y2="130" strokeWidth="4" />
  </svg>
)

const TopCard = ({ title, icon, players, accent }) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-lg flex items-center gap-2">
        <span className={`h-8 w-8 rounded-full grid place-items-center text-white ${accent}`}>{icon}</span>
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="pt-2">
      {players.length > 0 ? (
        <div className="space-y-1">
          {players.map((player, idx) => (
            <RankingRow key={player.user_id} player={player} index={idx} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">Ranking em atualização...</p>
      )}
    </CardContent>
  </Card>
)

const QuickActionCard = ({ to, icon, title, testId }) => (
  <Link to={to} data-testid={testId} className="block">
    <div className="h-full py-3 rounded-2xl border bg-card flex flex-col items-center text-center justify-center gap-1.5 transition active:scale-95 hover:border-primary/40">
      <span className="h-10 w-10 rounded-full bg-accent text-accent-foreground grid place-items-center">
        {icon}
      </span>
      <span className="font-semibold text-xs sm:text-sm">{title}</span>
    </div>
  </Link>
)

const RankingRow = ({ player, index }) => {
  const isFirst = index === 0;
  return (
    <div className={`flex items-center justify-between p-2 rounded-xl ${isFirst ? 'bg-accent' : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm 
          ${isFirst ? 'bg-amber-400 text-amber-950' :
            index === 1 ? 'bg-stone-200 text-stone-700' :
              index === 2 ? 'bg-orange-200 text-orange-900' : 'bg-transparent text-muted-foreground'}`}>
          {index + 1}
        </div>
        <div className="flex flex-col">
          <span className="font-medium text-sm">{player.short_name}</span>
          <span className="text-xs text-muted-foreground">{player.wins}V - {player.losses}D</span>
        </div>
      </div>
      <div className="font-bold text-sm tabular-nums">
        {(player.total_points + (player.temp_points || 0))} pts
      </div>
    </div>
  )
}

const FireRow = ({ player, index }) => (
  <div className="flex items-center justify-between py-2 border-b last:border-0 border-dashed">
    <div className="flex items-center gap-2">
      <div className="text-sm font-medium">{player.name}</div>
    </div>
    <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-none">
      {player.streak} 🔥
    </Badge>
  </div>
)

export default Home
