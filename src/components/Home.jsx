import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, CalendarDays, Clock, Trophy, DollarSign, MapPin, Users, RotateCcw } from 'lucide-react'
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
      const sevenDaysLater = new Date(now)
      sevenDaysLater.setDate(now.getDate() + 7)
      
      const startDate = now.toISOString().split('T')[0]
      const endDate = sevenDaysLater.toISOString().split('T')[0]
      
      const response = await fetch(`/api/public/schedules/month?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
      if (response.ok) {
        const data = await response.json()
        const upcoming = data
          .filter(schedule => {
            const scheduleDateTime = new Date(`${schedule.date}T${schedule.start_time}`)
            return scheduleDateTime >= now && schedule.date <= endDate
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
            <Button size="lg" className="w-full sm:w-auto">
              <Calendar className="h-5 w-5 mr-2" />
              Fazer Agendamento
            </Button>
          </Link>
          <Link to="/view">
            <Button variant="outline" size="lg" className="w-full sm:w-auto">
              <CalendarDays className="h-5 w-5 mr-2" />
              Ver Agenda
            </Button>
          </Link>
          <Link to="/betting">
            <Button variant="outline" size="lg" className="w-full sm:w-auto bg-gradient-to-r from-amber-50 to-yellow-50 hover:from-amber-100 hover:to-yellow-100 border-amber-300 text-amber-900">
              <Trophy className="h-5 w-5 mr-2" />
              Apostar
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <Card className="p-3">
          <div className="text-center">
            <Calendar className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <h3 className="font-semibold text-sm mb-1">Agendamento Fácil</h3>
            <p className="text-xs text-gray-600">Rápido e intuitivo</p>
          </div>
        </Card>

        <Card className="p-3">
          <div className="text-center">
            <Clock className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <h3 className="font-semibold text-sm mb-1">Horários Flexíveis</h3>
            <p className="text-xs text-gray-600">07:30 às 22:30</p>
          </div>
        </Card>

        <Card className="p-3">
          <div className="text-center">
            <Trophy className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
            <h3 className="font-semibold text-sm mb-1">Liga e Amistosos</h3>
            <p className="text-xs text-gray-600">Organize partidas</p>
          </div>
        </Card>

        <Card className="p-3">
          <div className="text-center">
            <DollarSign className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <h3 className="font-semibold text-sm mb-1">Apostas Esportivas</h3>
            <p className="text-xs text-gray-600">Aposte e acompanhe</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 sm:mb-12">
        {/* Upcoming Matches */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Trophy className="h-5 w-5 mr-2 text-blue-600" />
              Próximas Partidas
            </CardTitle>
            <CardDescription>Jogos agendados para os próximos dias</CardDescription>
          </CardHeader>
          <CardContent>
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
                    <div key={date} className="border rounded-lg p-3 bg-blue-50 border-blue-200">
                      <div className="flex items-center space-x-2 mb-2">
                        <Calendar className="h-4 w-4 text-blue-600" />
                        <span className="font-semibold text-sm">{formatDate(date)}</span>
                      </div>
                      <div className="space-y-2">
                        {Object.entries(courtGroups).map(([courtName, courtMatches]) => (
                          <div key={courtName} className="border-l-4 border-green-500 pl-2">
                            <div className="text-xs font-semibold text-green-700 mb-1 flex items-center">
                              <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <RotateCcw className="h-5 w-5 mr-2 text-orange-600" />
              Aulas e Eventos Recorrentes
            </CardTitle>
            <CardDescription>Horários fixos semanais</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(recurringSchedules).length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Nenhum evento recorrente</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(recurringSchedules).map(([dayOfWeek, schedules]) => (
                  <div key={dayOfWeek} className="border rounded-lg p-3 bg-orange-50 border-orange-200">
                    <div className="flex items-center space-x-2 mb-2">
                      <Clock className="h-4 w-4 text-orange-600" />
                      <span className="font-semibold text-sm">{getDayName(parseInt(dayOfWeek))}</span>
                    </div>
                    <div className="space-y-1">
                      {schedules.map((schedule) => (
                        <div key={schedule.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2">
                            <MapPin className="h-3 w-3 text-green-600" />
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

      <Card>
        <CardHeader>
          <CardTitle>Como funciona?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="bg-green-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                <span className="text-green-600 font-bold">1</span>
              </div>
              <h3 className="font-semibold mb-2">Escolha a Quadra</h3>
              <p className="text-gray-600">Selecione entre quadras de saibro ou rápida</p>
            </div>
            
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                <span className="text-blue-600 font-bold">2</span>
              </div>
              <h3 className="font-semibold mb-2">Defina Data e Horário</h3>
              <p className="text-gray-600">Veja os horários disponíveis em tempo real</p>
            </div>
            
            <div className="text-center">
              <div className="bg-purple-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                <span className="text-purple-600 font-bold">3</span>
              </div>
              <h3 className="font-semibold mb-2">Confirme o Agendamento</h3>
              <p className="text-gray-600">Adicione os jogadores e confirme</p>
            </div>
            
            <div className="text-center">
              <div className="bg-amber-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                <span className="text-amber-600 font-bold">4</span>
              </div>
              <h3 className="font-semibold mb-2">Aposte nas Partidas</h3>
              <p className="text-gray-600">Faça suas apostas nos jogos agendados</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Home

