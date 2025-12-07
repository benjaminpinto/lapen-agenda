import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, CalendarDays, Clock, Trophy, DollarSign, MapPin, Users, RotateCcw, FileText, Mail, Instagram } from 'lucide-react'
import { useEffect, useState } from 'react'
import MatchTypeBadge from './ui/MatchTypeBadge'

const Home = () => {
  const [upcomingMatches, setUpcomingMatches] = useState([])
  const [recurringSchedules, setRecurringSchedules] = useState([])

  useEffect(() => {
    fetchUpcomingMatches()
    fetchRecurringSchedules()
  }, [])

  const fetchUpcomingMatches = async () => {
    try {
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
          .slice(0, 10)
        
        // Group by date
        const grouped = upcoming.reduce((acc, match) => {
          if (!acc[match.date]) acc[match.date] = []
          acc[match.date].push(match)
          return acc
        }, {})
        
        setUpcomingMatches(grouped)
      }
    } catch (error) {
      console.error('Error fetching upcoming matches:', error)
    }
  }

  const fetchRecurringSchedules = async () => {
    try {
      const response = await fetch('/api/admin/recurring-schedules', {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        const now = new Date()
        const active = data.filter(schedule => {
          const endDate = new Date(schedule.end_date)
          return endDate >= now
        })
        
        // Group by day of week
        const grouped = active.reduce((acc, schedule) => {
          const key = schedule.day_of_week
          if (!acc[key]) acc[key] = []
          acc[key].push(schedule)
          return acc
        }, {})
        
        setRecurringSchedules(grouped)
      }
    } catch (error) {
      console.error('Error fetching recurring schedules:', error)
    }
  }

  const formatDate = (dateStr) => {
    const d = new Date(`${dateStr}T00:00:00`)
    const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
    const day = d.getDate()
    const month = d.getMonth() + 1
    const weekday = weekdays[d.getDay()]
    return `${weekday}, ${day}/${month}`
  }

  const getDayName = (dayOfWeek) => {
    const days = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo']
    return days[dayOfWeek]
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <div className="text-center mb-8 sm:mb-12">
        <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-4">
          Bem-vindo ao Agenda LAPEN
        </h1>
        <p className="text-lg sm:text-xl text-gray-600 mb-6 sm:mb-8">
          Sistema de gestão de reservas de quadras de tênis
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/schedule">
            <Button data-testid="schedule-button" size="lg" className="w-full sm:w-auto">
              <Calendar className="h-5 w-5 mr-2" />
              Fazer Agendamento
            </Button>
          </Link>
          <Link to="/view">
            <Button data-testid="view-schedule-button" variant="outline" size="lg" className="w-full sm:w-auto">
              <CalendarDays className="h-5 w-5 mr-2" />
              Ver Agenda
            </Button>
          </Link>
          <Link to="/betting">
            <Button data-testid="betting-button" variant="outline" size="lg" className="w-full sm:w-auto bg-gradient-to-r from-amber-50 to-yellow-50 hover:from-amber-100 hover:to-yellow-100 border-amber-300 text-amber-900">
              <Trophy className="h-5 w-5 mr-2" />
              Apostar
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <Card className="p-3 bg-white border-orange-200 hover:shadow-md transition-shadow">
          <div className="text-center">
            <Calendar className="h-8 w-8 text-orange-600 mx-auto mb-2" />
            <h3 className="font-semibold text-sm mb-1 text-gray-900">Agendamento Fácil</h3>
            <p className="text-xs text-gray-600">Rápido e intuitivo</p>
          </div>
        </Card>

        <Card className="p-3 bg-white border-amber-200 hover:shadow-md transition-shadow">
          <div className="text-center">
            <Clock className="h-8 w-8 text-amber-600 mx-auto mb-2" />
            <h3 className="font-semibold text-sm mb-1 text-gray-900">Horários Flexíveis</h3>
            <p className="text-xs text-gray-600">07:30 às 22:30</p>
          </div>
        </Card>

        <Card className="p-3 bg-white border-yellow-200 hover:shadow-md transition-shadow">
          <div className="text-center">
            <Trophy className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
            <h3 className="font-semibold text-sm mb-1 text-gray-900">Liga e Amistosos</h3>
            <p className="text-xs text-gray-600">Organize partidas</p>
          </div>
        </Card>

        <Card className="p-3 bg-white border-orange-300 hover:shadow-md transition-shadow">
          <div className="text-center">
            <DollarSign className="h-8 w-8 text-orange-700 mx-auto mb-2" />
            <h3 className="font-semibold text-sm mb-1 text-gray-900">Apostas Esportivas</h3>
            <p className="text-xs text-gray-600">Aposte e acompanhe</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 sm:mb-12">
        {/* Upcoming Matches */}
        <Card className="border-orange-200">
          <CardHeader className="bg-gradient-to-r from-orange-100 to-amber-50 rounded-t-lg">
            <CardTitle className="flex items-center text-orange-800">
              <Trophy className="h-5 w-5 mr-2" />
              Próximas Partidas
            </CardTitle>
            <CardDescription className="text-orange-700">Jogos agendados para os próximos dias</CardDescription>
          </CardHeader>
          <CardContent className="pt-3">
            {Object.keys(upcomingMatches).length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Nenhuma partida agendada</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(upcomingMatches).map(([date, matches]) => {
                  const courtGroups = matches.reduce((acc, match) => {
                    if (!acc[match.court_name]) acc[match.court_name] = []
                    acc[match.court_name].push(match)
                    return acc
                  }, {})
                  
                  return (
                    <div key={date} className="border rounded-lg p-3 bg-amber-50 border-amber-200">
                      <div className="flex items-center space-x-2 mb-2">
                        <Calendar className="h-4 w-4 text-orange-600" />
                        <span className="font-semibold text-sm text-gray-900">{formatDate(date)}</span>
                      </div>
                      <div className="space-y-2">
                        {Object.entries(courtGroups).map(([courtName, courtMatches]) => (
                          <div key={courtName} className="border-l-4 border-orange-600 pl-2">
                            <div className="text-xs font-semibold text-orange-700 mb-1 flex items-center">
                              <div className="w-2 h-2 bg-orange-600 rounded-full mr-1"></div>
                              {courtName}
                            </div>
                            <div className="space-y-1">
                              {courtMatches.map((match) => (
                                <div key={match.id} className="flex items-center justify-between text-xs">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-gray-600">{match.player1_name.split(' ')[0]} vs {match.player2_name.split(' ')[0]}</span>
                                    <MatchTypeBadge matchType={match.match_type} size="xs" iconOnly />
                                  </div>
                                  <span className="font-medium text-gray-800">{match.start_time}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <Link to="/view">
              <Button variant="outline" className="w-full mt-4">
                Ver Agenda Completa
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recurring Classes */}
        <Card className="border-amber-200">
          <CardHeader className="bg-gradient-to-r from-amber-100 to-yellow-50 rounded-t-lg">
            <CardTitle className="flex items-center text-amber-800">
              <RotateCcw className="h-5 w-5 mr-2" />
              Aulas e Eventos Recorrentes
            </CardTitle>
            <CardDescription className="text-amber-700">Horários fixos semanais</CardDescription>
          </CardHeader>
          <CardContent className="pt-3">
            {Object.keys(recurringSchedules).length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Nenhum evento recorrente</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(recurringSchedules).map(([dayOfWeek, schedules]) => (
                  <div key={dayOfWeek} className="border rounded-lg p-3 bg-yellow-50 border-yellow-200">
                    <div className="flex items-center space-x-2 mb-2">
                      <Clock className="h-4 w-4 text-amber-600" />
                      <span className="font-semibold text-sm text-gray-900">{getDayName(parseInt(dayOfWeek))}</span>
                    </div>
                    <div className="space-y-1">
                      {schedules.sort((a, b) => a.start_time.localeCompare(b.start_time)).map((schedule) => (
                        <div key={schedule.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2">
                            <MapPin className="h-3 w-3 text-amber-600" />
                            <span className="text-gray-700">{schedule.court_name}</span>
                            <span className="text-gray-600">• {schedule.description}</span>
                          </div>
                          <span className="font-medium text-gray-800">{schedule.start_time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="mt-12 bg-stone-100 border-t border-stone-300 pt-8 pb-6 -mx-4 sm:-mx-6 px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Liga de Tênis de Penedo - LAPEN</h3>
            <p className="text-sm text-gray-600">Penedo Tênis Clube - PTC</p>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Contato/Suporte</h3>
            <a href="https://www.instagram.com/tennis_penedo" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 hover:text-orange-600 flex items-center">
              <Instagram className="h-4 w-4 mr-2" />
              @tennis_penedo
            </a>
            <a href="mailto:contato@keepquality.com.br" className="text-sm text-gray-600 hover:text-orange-600 flex items-center mb-2">
              <Mail className="h-4 w-4 mr-2" />
              contato@keepquality.com.br
            </a>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Documentos</h3>
            <a href="/regulamento2026.html" className="text-sm text-gray-600 hover:text-orange-600 flex items-center">
              <FileText className="h-4 w-4 mr-2" />
              Regulamento Ranking 2026
            </a>
          </div>
        </div>
        
        <div className="text-center text-sm text-gray-500 pt-4 border-t">
          © {new Date().getFullYear()} LAPEN - Todos os direitos reservados
        </div>
      </footer>
    </div>
  )
}

export default Home

