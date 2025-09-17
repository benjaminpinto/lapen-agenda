import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Calendar, 
  Users, 
  MapPin, 
  Clock, 
  Trophy,
  TrendingUp,
  Settings
} from 'lucide-react'

const AdminDashboard = () => {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch('/api/admin/dashboard', {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Carregando estatísticas...</div>
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Painel Administrativo
        </h1>
        <p className="text-gray-600">
          Gerencie quadras, jogadores e agendamentos
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Link to="/admin/courts">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="text-center pb-2">
              <MapPin className="h-8 w-8 text-green-600 mx-auto" />
              <CardTitle className="text-lg">Quadras</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <Button variant="ghost" size="sm">Gerenciar</Button>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/players">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="text-center pb-2">
              <Users className="h-8 w-8 text-blue-600 mx-auto" />
              <CardTitle className="text-lg">Jogadores</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <Button variant="ghost" size="sm">Gerenciar</Button>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/holidays">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="text-center pb-2">
              <Calendar className="h-8 w-8 text-red-600 mx-auto" />
              <CardTitle className="text-lg">Feriados</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <Button variant="ghost" size="sm">Gerenciar</Button>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/recurring">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="text-center pb-2">
              <Clock className="h-8 w-8 text-purple-600 mx-auto" />
              <CardTitle className="text-lg">Agenda Fixa</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <Button variant="ghost" size="sm">Gerenciar</Button>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Statistics */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-green-600" />
              Quadra Mais Agendada
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.most_booked_court ? (
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {stats.most_booked_court.name}
                </p>
                <p className="text-gray-600">
                  {stats.most_booked_court.bookings} agendamentos este mês
                </p>
              </div>
            ) : (
              <p className="text-gray-500">Nenhum agendamento este mês</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Trophy className="h-5 w-5 mr-2 text-yellow-600" />
              Tipos de Partida
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.game_stats && stats.game_stats.length > 0 ? (
              <div className="space-y-2">
                {stats.game_stats.map((stat, index) => (
                  <div key={index} className="flex justify-between">
                    <span>{stat.match_type}</span>
                    <span className="font-semibold">{stat.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">Nenhuma partida este mês</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2 text-blue-600" />
              Top Jogadores
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.top_players && stats.top_players.length > 0 ? (
              <div className="space-y-2">
                {stats.top_players.slice(0, 5).map((player, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span>{player.player_name}</span>
                    <span className="font-semibold">{player.games}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">Nenhum jogador este mês</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default AdminDashboard

