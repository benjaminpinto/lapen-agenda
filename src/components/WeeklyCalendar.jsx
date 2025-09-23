import {useEffect, useState} from 'react'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {ChevronLeft, ChevronRight, Clock, GraduationCap, Medal, Trophy, Users, Ban, RotateCcw} from 'lucide-react'

const WeeklyCalendar = ({weekSchedules, fetchWeekSchedules}) => {
    const [currentWeek, setCurrentWeek] = useState(new Date())
    const [holidays, setHolidays] = useState([])
    const [recurringSchedules, setRecurringSchedules] = useState([])

    useEffect(() => {
        fetchWeekSchedules(currentWeek.toISOString().split('T')[0])
        fetchHolidays()
        fetchRecurringSchedules()
    }, [currentWeek])

    const fetchHolidays = async () => {
        try {
            const response = await fetch('/api/admin/holidays-blocks', {
                credentials: 'include'
            })
            if (response.ok) {
                const data = await response.json()
                setHolidays(data)
            }
        } catch (error) {
            console.error('Error fetching holidays:', error)
        }
    }

    const fetchRecurringSchedules = async () => {
        try {
            const response = await fetch('/api/admin/recurring-schedules', {
                credentials: 'include'
            })
            if (response.ok) {
                const data = await response.json()
                setRecurringSchedules(data)
            }
        } catch (error) {
            console.error('Error fetching recurring schedules:', error)
        }
    }

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

    const getHolidaysForDay = (date) => {
        const dateStr = date.toISOString().split('T')[0]
        return holidays.filter(holiday => holiday.date === dateStr)
    }

    const getRecurringForDay = (date) => {
        const dayOfWeek = (date.getDay() + 6) % 7 // Convert Sunday=0 to Monday=0
        const dateStr = date.toISOString().split('T')[0]
        return recurringSchedules.filter(schedule => 
            schedule.day_of_week === dayOfWeek &&
            dateStr >= schedule.start_date &&
            dateStr <= schedule.end_date
        )
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                <h2 className="text-lg sm:text-xl font-semibold text-center sm:text-left">Semana de {formatWeekRange(weekDays)}</h2>
                <div className="flex space-x-2 justify-center sm:justify-end">
                    <Button variant="outline" size="sm" onClick={() => navigateWeek(-1)}>
                        <ChevronLeft className="h-4 w-4"/>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentWeek(new Date())}>
                        <span className="hidden sm:inline">Hoje</span>
                        <span className="sm:hidden">•</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => navigateWeek(1)}>
                        <ChevronRight className="h-4 w-4"/>
                    </Button>
                </div>
            </div>

            {/* Mobile: Show days in a vertical list */}
            <div className="block sm:hidden space-y-3">
                {weekDays.map((day, index) => {
                    const daySchedules = getSchedulesForDay(day)
                    const isToday = day.toDateString() === new Date().toDateString()

                    return (
                        <Card key={day.toISOString()}
                              className={`${isToday ? 'ring-2 ring-blue-500' : ''}`}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center justify-between">
                                    <div className={`font-medium ${isToday ? 'text-blue-600' : ''}`}>
                                        {dayNames[index]}, {day.getDate()}/{day.getMonth() + 1}
                                    </div>
                                    {isToday && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">Hoje</span>}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="space-y-2">
                                    {(() => {
                                        const dayHolidays = getHolidaysForDay(day)
                                        const dayRecurring = getRecurringForDay(day)
                                        
                                        const courtGroups = daySchedules.reduce((groups, schedule) => {
                                            const court = schedule.court_name
                                            if (!groups[court]) groups[court] = { schedules: [], recurring: [] }
                                            groups[court].schedules.push(schedule)
                                            return groups
                                        }, {})
                                        
                                        dayRecurring.forEach(recurring => {
                                            const court = recurring.court_name
                                            if (!courtGroups[court]) courtGroups[court] = { schedules: [], recurring: [] }
                                            courtGroups[court].recurring.push(recurring)
                                        })
                                        
                                        const hasAnyEvents = daySchedules.length > 0 || dayHolidays.length > 0 || dayRecurring.length > 0
                                        
                                        return (
                                            <>
                                                {dayHolidays.map((holiday) => (
                                                    <div key={`holiday-${holiday.id}`} className="p-2 bg-red-100 border-l-4 border-red-500 rounded text-xs">
                                                        <div className="flex items-center mb-1">
                                                            <Ban className="h-3 w-3 mr-1 text-red-600"/>
                                                            <span className="font-medium text-red-800">
                                                                {!holiday.start_time && !holiday.end_time ? 'Bloqueado' : `${holiday.start_time} - ${holiday.end_time}`}
                                                            </span>
                                                        </div>
                                                        {holiday.description && (
                                                            <div className="text-red-700 text-xs">{holiday.description}</div>
                                                        )}
                                                    </div>
                                                ))}
                                                {!hasAnyEvents ? (
                                                    <p className="text-xs text-gray-400 text-center py-4">Sem eventos</p>
                                                ) : (
                                                    Object.entries(courtGroups).map(([courtName, courtData]) => (
                                                        <div key={courtName} className="border-l-4 border-green-500 pl-2 mb-2">
                                                            <div className="text-sm font-semibold text-green-700 mb-1 flex items-center">
                                                                <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                                                                {courtName}
                                                            </div>
                                                            <div className="space-y-1">
                                                                {courtData.recurring.map((recurring) => (
                                                                    <div key={`recurring-${recurring.id}`} className="p-2 bg-orange-100 border-l-2 border-orange-500 rounded text-xs">
                                                                        <div className="flex items-center mb-1">
                                                                            <RotateCcw className="h-3 w-3 mr-1 text-orange-600"/>
                                                                            <span className="font-medium text-orange-800">{recurring.start_time}</span>
                                                                        </div>
                                                                        <div className="text-orange-700 text-xs">{recurring.description}</div>
                                                                    </div>
                                                                ))}
                                                                {courtData.schedules.map((schedule) => (
                                                                    <div key={schedule.id} className="p-2 bg-gradient-to-r from-gray-50 to-gray-100 rounded text-sm border-l-2 border-gray-300">
                                                                        <div className="flex items-center justify-between mb-1">
                                                                            <div className="flex items-center space-x-2">
                                                                                <div
                                                                                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs border transition-all duration-200 ${
                                                                                        schedule.match_type === 'Liga' ? 'bg-yellow-200 text-yellow-800 border-yellow-300' :
                                                                                        schedule.match_type === 'Aula' ? 'bg-purple-200 text-purple-800 border-purple-300' :
                                                                                        schedule.match_type === 'Torneio' ? 'bg-orange-200 text-orange-800 border-orange-300' :
                                                                                        'bg-blue-200 text-blue-800 border-blue-300'
                                                                                    }`}
                                                                                >
                                                                                    {schedule.match_type === 'Liga' ?
                                                                                        <Trophy className="h-3 w-3 mr-1"/> :
                                                                                        schedule.match_type === 'Aula' ?
                                                                                        <GraduationCap className="h-3 w-3 mr-1"/> :
                                                                                        schedule.match_type === 'Torneio' ?
                                                                                        <Medal className="h-3 w-3 mr-1"/> :
                                                                                        <Users className="h-3 w-3 mr-1"/>
                                                                                    }
                                                                                    <span>{schedule.match_type}</span>
                                                                                </div>
                                                                                <span className="font-medium">{schedule.start_time}</span>
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
                                                )}
                                            </>
                                        )
                                    })()
                                    }
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>
            
            {/* Desktop: Show days in a 7-column grid */}
            <div className="hidden sm:grid grid-cols-7 gap-2">
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
                                    {(() => {
                                        const dayHolidays = getHolidaysForDay(day)
                                        const dayRecurring = getRecurringForDay(day)
                                        
                                        // Group schedules and recurring events by court
                                        const courtGroups = daySchedules.reduce((groups, schedule) => {
                                            const court = schedule.court_name
                                            if (!groups[court]) groups[court] = { schedules: [], recurring: [] }
                                            groups[court].schedules.push(schedule)
                                            return groups
                                        }, {})
                                        
                                        // Add recurring events to court groups
                                        dayRecurring.forEach(recurring => {
                                            const court = recurring.court_name
                                            if (!courtGroups[court]) courtGroups[court] = { schedules: [], recurring: [] }
                                            courtGroups[court].recurring.push(recurring)
                                        })
                                        
                                        const hasAnyEvents = daySchedules.length > 0 || dayHolidays.length > 0 || dayRecurring.length > 0
                                        
                                        return (
                                            <>
                                                {dayHolidays.map((holiday) => (
                                                    <div key={`holiday-${holiday.id}`} className="p-2 bg-red-100 border-l-4 border-red-500 rounded text-xs">
                                                        <div className="flex items-center mb-1">
                                                            <Ban className="h-3 w-3 mr-1 text-red-600"/>
                                                            <span className="font-medium text-red-800">
                                                                {!holiday.start_time && !holiday.end_time ? 'Bloqueado' : `${holiday.start_time} - ${holiday.end_time}`}
                                                            </span>
                                                        </div>
                                                        {holiday.description && (
                                                            <div className="text-red-700 text-xs">{holiday.description}</div>
                                                        )}
                                                    </div>
                                                ))}
                                                {!hasAnyEvents ? (
                                                    <p className="text-xs text-gray-400 text-center">Sem eventos</p>
                                                ) : (
                                                    Object.entries(courtGroups).map(([courtName, courtData]) => (
                                                        <div key={courtName} className="border-l-4 border-green-500 pl-2 mb-2">
                                                            <div className="text-xs font-semibold text-green-700 mb-1 flex items-center">
                                                                <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                                                                {courtName}
                                                            </div>
                                                            <div className="space-y-1">
                                                                {courtData.recurring.map((recurring) => (
                                                                    <div key={`recurring-${recurring.id}`} className="p-2 bg-orange-100 border-l-2 border-orange-500 rounded text-xs">
                                                                        <div className="flex items-center mb-1">
                                                                            <RotateCcw className="h-3 w-3 mr-1 text-orange-600"/>
                                                                            <span className="font-medium text-orange-800">{recurring.start_time}</span>
                                                                        </div>
                                                                        <div className="text-orange-700 text-xs">{recurring.description}</div>
                                                                    </div>
                                                                ))}
                                                                {courtData.schedules.map((schedule) => (
                                                                    <div key={schedule.id} className="p-2 bg-gradient-to-r from-gray-50 to-gray-100 rounded text-xs border-l-2 border-gray-300">
                                                                        <div className="flex items-center space-x-1 mb-1">
                                                                            <div
                                                                                className={`inline-flex items-center rounded-full px-1 py-0 text-xs border-2 transition-all duration-200 cursor-pointer ${
                                                                                    schedule.match_type === 'Liga' ? 'bg-yellow-200 text-yellow-800 border-yellow-300 hover:border-yellow-600' :
                                                                                    schedule.match_type === 'Aula' ? 'bg-purple-200 text-purple-800 border-purple-300 hover:border-purple-600' :
                                                                                    schedule.match_type === 'Torneio' ? 'bg-orange-200 text-orange-800 border-orange-300 hover:border-orange-600' :
                                                                                    'bg-blue-200 text-blue-800 border-blue-300 hover:border-blue-600'
                                                                                }`}
                                                                                title={
                                                                                    schedule.match_type === 'Liga' ? 'Partida oficial da liga' :
                                                                                    schedule.match_type === 'Aula' ? 'Aula de tênis' :
                                                                                    schedule.match_type === 'Torneio' ? 'Partida de torneio' :
                                                                                    'Partida amistosa entre jogadores'
                                                                                }
                                                                            >
                                                                                {schedule.match_type === 'Liga' ?
                                                                                    <Trophy className="h-2 w-2"/> :
                                                                                    schedule.match_type === 'Aula' ?
                                                                                    <GraduationCap className="h-2 w-2"/> :
                                                                                    schedule.match_type === 'Torneio' ?
                                                                                    <Medal className="h-2 w-2"/> :
                                                                                    <Users className="h-2 w-2"/>
                                                                                }
                                                                            </div>
                                                                            <span className="font-medium">{schedule.start_time}</span>
                                                                        </div>
                                                                        <div className="text-gray-800 font-medium">
                                                                            {schedule.player1_name.split(' ')[0]} vs {schedule.player2_name.split(' ')[0]}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </>
                                        )
                                    })()
                                    }
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