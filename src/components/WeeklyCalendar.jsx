import {useEffect, useState} from 'react'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {ChevronLeft, ChevronRight, Clock, GraduationCap, Trophy, Users} from 'lucide-react'

const WeeklyCalendar = ({weekSchedules, fetchWeekSchedules}) => {
    const [currentWeek, setCurrentWeek] = useState(new Date())

    useEffect(() => {
        fetchWeekSchedules(currentWeek.toISOString().split('T')[0])
    }, [currentWeek, fetchWeekSchedules])

    const getWeekDays = (date) => {
        const week = []
        const startOfWeek = new Date(date)
        const day = startOfWeek.getDay()
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1) // Monday as first day
        startOfWeek.setDate(diff)

        for (let i = 0; i < 7; i++) {
            const day = new Date(startOfWeek)
            day.setDate(startOfWeek.getDate() + i)
            week.push(day)
        }
        return week
    }

    const formatWeekRange = (weekDays) => {
        const start = weekDays[0]
        const end = weekDays[6]
        return `${start.getDate()}/${start.getMonth() + 1} - ${end.getDate()}/${end.getMonth() + 1}/${end.getFullYear()}`
    }

    const getSchedulesForDay = (date) => {
        const dateStr = date.toISOString().split('T')[0]
        return weekSchedules.filter(schedule => schedule.date === dateStr)
    }

    const navigateWeek = (direction) => {
        const newDate = new Date(currentWeek)
        newDate.setDate(currentWeek.getDate() + (direction * 7))
        setCurrentWeek(newDate)
    }

    const weekDays = getWeekDays(currentWeek)
    const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Semana de {formatWeekRange(weekDays)}</h2>
                <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => navigateWeek(-1)}>
                        <ChevronLeft className="h-4 w-4"/>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentWeek(new Date())}>
                        Hoje
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => navigateWeek(1)}>
                        <ChevronRight className="h-4 w-4"/>
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day, index) => {
                    const daySchedules = getSchedulesForDay(day)
                    const isToday = day.toDateString() === new Date().toDateString()

                    return (
                        <Card key={day.toISOString()}
                              className={`min-h-[200px] ${isToday ? 'ring-2 ring-blue-500' : ''}`}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-center">
                                    <div className={`font-medium ${isToday ? 'text-blue-600' : ''}`}>
                                        {dayNames[index]}
                                    </div>
                                    <div className={`text-lg ${isToday ? 'text-blue-600 font-bold' : ''}`}>
                                        {day.getDate()}
                                    </div>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="space-y-2">
                                    {daySchedules.length === 0 ? (
                                        <p className="text-xs text-gray-400 text-center">Sem jogos</p>
                                    ) : (
                                        (() => {
                                            const courtGroups = daySchedules.reduce((groups, schedule) => {
                                                const court = schedule.court_name
                                                if (!groups[court]) groups[court] = []
                                                groups[court].push(schedule)
                                                return groups
                                            }, {})

                                            return Object.entries(courtGroups).map(([courtName, courtSchedules]) => (
                                                <div key={courtName} className="border-l-4 border-green-500 pl-2 mb-2">
                                                    <div
                                                        className="text-xs font-semibold text-green-700 mb-1 flex items-center">
                                                        <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                                                        {courtName}
                                                    </div>
                                                    <div className="space-y-1">
                                                        {courtSchedules.map((schedule) => (
                                                            <div key={schedule.id}
                                                                 className="p-2 bg-gradient-to-r from-gray-50 to-gray-100 rounded text-xs border-l-2 border-gray-300">
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <div className="flex items-center">
                                                                        <Clock className="h-3 w-3 mr-1 text-gray-500"/>
                                                                        <span
                                                                            className="font-medium">{schedule.start_time}</span>
                                                                    </div>
                                                                    <div
                                                                        className={`inline-flex items-center rounded-full px-1 py-0 text-xs border-2 transition-all duration-200 cursor-pointer ${
                                                                            schedule.match_type === 'Liga' ? 'bg-yellow-200 text-yellow-800 border-yellow-300 hover:border-yellow-600' :
                                                                            schedule.match_type === 'Aula' ? 'bg-purple-200 text-purple-800 border-purple-300 hover:border-purple-600' :
                                                                            'bg-blue-200 text-blue-800 border-blue-300 hover:border-blue-600'
                                                                        }`}
                                                                        title={
                                                                            schedule.match_type === 'Liga' ? 'Partida oficial da liga' :
                                                                            schedule.match_type === 'Aula' ? 'Aula de tênis' :
                                                                            'Partida amistosa entre jogadores'
                                                                        }
                                                                    >
                                                                        {schedule.match_type === 'Liga' ?
                                                                            <Trophy className="h-2 w-2"/> :
                                                                            schedule.match_type === 'Aula' ?
                                                                            <GraduationCap className="h-2 w-2"/> :
                                                                            <Users className="h-2 w-2"/>
                                                                        }
                                                                    </div>
                                                                </div>
                                                                <div className="text-gray-800 font-medium">
                                                                    {schedule.player1_name.split(' ')[0]} vs {schedule.player2_name.split(' ')[0]}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))
                                        })()
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}

export default WeeklyCalendar