import {useEffect, useState} from 'react'
import {useNavigate, useSearchParams} from 'react-router-dom'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs'
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Textarea} from '@/components/ui/textarea'
import {Calendar, Clock, Edit, List, MapPin, Share2, Trash2} from 'lucide-react'
import {useToast} from '@/contexts/ToastContext'
import CourtAvailability from './agenda/CourtAvailability'
import useScheduleActions from './agenda/useScheduleActions'
import MonthSelector from './ui/MonthSelector'
import MatchTypeBadge from './ui/MatchTypeBadge'
import {fetchWithAuth} from '@/utils/fetchWithAuth'
import {getCurrentMonth, getCurrentYear, getLocalDateString} from '@/utils/dateUtils'

const ScheduleView = () => {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const [schedules, setSchedules] = useState([])
    const [agendaVersion, setAgendaVersion] = useState(0)
    const [loading, setLoading] = useState(true)
    // After booking, `?share=true` shares the month list as WhatsApp text, so open on the list.
    const [viewType, setViewType] = useState(searchParams.get('share') === 'true' ? 'list' : 'weekly')
    const [whatsappMessage, setWhatsappMessage] = useState('')
    const [showWhatsappDialog, setShowWhatsappDialog] = useState(false)
    const [stats, setStats] = useState({})
    const [hidePastDates, setHidePastDates] = useState(true)
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
    const [selectedYear, setSelectedYear] = useState(getCurrentYear())

    const { toast } = useToast()
    const { handleEdit, handleDeleteClick, handleMove, dialogs } = useScheduleActions(() => {
        fetchSchedules()
        setAgendaVersion(v => v + 1)
    })

    useEffect(() => {
        fetchSchedules()
        fetchStats()

        // Check if we should show WhatsApp sharing immediately
        if (searchParams.get('share') === 'true') {
            setTimeout(() => {
                handleWhatsappShare()
            }, 1000)
        }
    }, [searchParams, selectedMonth, selectedYear])

    const fetchSchedules = async () => {
        try {
            const response = await fetchWithAuth(`/api/public/schedules/month?year=${selectedYear}&month=${selectedMonth}`)
            if (response.ok) {
                const data = await response.json()
                setSchedules(data)
            }
        } catch (error) {
            console.error('Error fetching schedules:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchStats = async () => {
        try {
            const response = await fetchWithAuth('/api/public/dashboard-stats')
            if (response.ok) {
                const data = await response.json()
                setStats(data)
            }
        } catch (error) {
            console.error('Error fetching stats:', error)
            setStats({})
        }
    }

    const handleWhatsappShare = async () => {
        if (viewType === 'weekly') {
            await captureWeeklyCalendar()
        } else {
            try {
                const response = await fetchWithAuth(`/api/public/whatsapp-message?year=${selectedYear}&month=${selectedMonth}`)
                if (response.ok) {
                    const data = await response.json()
                    setWhatsappMessage(data.message)
                    setShowWhatsappDialog(true)
                }
            } catch (error) {
                console.error('Error generating WhatsApp message:', error)
            }
        }
    }

    const captureWeeklyCalendar = async () => {
        try {
            const html2canvas = (await import('html2canvas')).default
            const element = document.querySelector('[data-weekly-calendar]')
            if (element) {
                const canvas = await html2canvas(element, {
                    backgroundColor: '#ffffff',
                    scale: 2
                })
                canvas.toBlob((blob) => {
                    if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], 'agenda-semanal.png', { type: 'image/png' })] })) {
                        navigator.share({
                            title: 'Agenda Semanal LAPEN',
                            text: 'Confira a agenda semanal das quadras de tênis',
                            files: [new File([blob], 'agenda-semanal.png', { type: 'image/png' })]
                        })
                    } else {
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = 'agenda-semanal.png'
                        a.click()
                        URL.revokeObjectURL(url)
                        toast({
                            title: "Screenshot salva",
                            description: "A imagem da agenda semanal foi baixada"
                        })
                    }
                }, 'image/png')
            }
        } catch (error) {
            console.error('Error capturing screenshot:', error)
            toast({
                title: "Erro",
                description: "Erro ao capturar screenshot",
                variant: "destructive"
            })
        }
    }

    const shareOnWhatsapp = () => {
        const encodedMessage = encodeURIComponent(whatsappMessage.replace('[APP_URL]', window.location.origin))
        const whatsappUrl = `whatsapp://send?text=${encodedMessage}`
        window.open(whatsappUrl, '_blank')
    }

    const formatDate = (dateStr) => {
        const date = new Date(dateStr + 'T00:00:00')
        const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
        const weekday = weekdays[date.getDay()]
        const day = date.getDate()
        const month = date.getMonth() + 1
        return `${weekday}, ${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}`
    }

    const groupSchedulesByDate = (schedules) => {
        const grouped = {}
        schedules.forEach(schedule => {
            if (!grouped[schedule.date]) {
                grouped[schedule.date] = []
            }
            grouped[schedule.date].push(schedule)
        })
        return grouped
    }



    if (loading) {
        return <div className="text-center py-8">Carregando agenda...</div>
    }

    const groupedSchedules = groupSchedulesByDate(schedules)

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex items-end justify-between gap-3 mb-4 sm:mb-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold">
                        Agenda das Quadras
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Toque num horário livre para agendar
                    </p>
                </div>

                <div className="flex gap-2 shrink-0">
                    <Button onClick={() => navigate('/schedule')} className="rounded-full" data-testid="schedule-button">
                        <Calendar className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Agendar</span>
                    </Button>
                    <Button onClick={handleWhatsappShare} size="icon" variant="outline" className="rounded-full" title="Compartilhar no WhatsApp" data-testid="share-button">
                        <Share2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <Tabs value={viewType} onValueChange={setViewType} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="weekly" className="flex items-center text-sm" data-testid="tab-courts">
                        <Calendar className="h-4 w-4 mr-2" />
                        Quadras
                    </TabsTrigger>
                    <TabsTrigger value="list" className="flex items-center text-sm" data-testid="tab-list">
                        <List className="h-4 w-4 mr-2" />
                        Lista do mês
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="list" className="mt-6">
                    <MonthSelector
                        selectedMonth={selectedMonth}
                        selectedYear={selectedYear}
                        onMonthChange={(month, year) => {
                            setSelectedMonth(month)
                            setSelectedYear(year)
                        }}
                    />
                    {(() => {
                        const today = getLocalDateString()
                        const futureSchedules = {}
                        const pastSchedules = {}

                        Object.entries(groupedSchedules).forEach(([date, daySchedules]) => {
                            if (date >= today) {
                                futureSchedules[date] = daySchedules
                            } else {
                                pastSchedules[date] = daySchedules
                            }
                        })

                        const hasFutureSchedules = Object.keys(futureSchedules).length > 0
                        const hasPastSchedules = Object.keys(pastSchedules).length > 0

                        return (
                            <div className="space-y-6">
                                {!hasFutureSchedules && !hasPastSchedules ? (
                                    <Card>
                                        <CardContent className="text-center py-8">
                                            <p className="text-muted-foreground">Nenhum agendamento encontrado para este mês</p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <>
                                        {Object.entries(futureSchedules).map(([date, daySchedules]) => (
                                            <Card key={date}>
                                                <CardHeader>
                                                    <CardTitle className="flex items-center">
                                                        <Calendar className="h-5 w-5 mr-2 text-primary" />
                                                        {formatDate(date)}
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="space-y-3">
                                                        {daySchedules.map((schedule) => (
                                                            <div key={schedule.id}
                                                                className="border rounded-lg p-3 sm:p-4">
                                                                {/* Mobile Layout */}
                                                                <div className="block sm:hidden space-y-2">
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center space-x-2">
                                                                            <MapPin className="h-4 w-4 text-primary" />
                                                                            <span className="font-medium text-sm">{schedule.court_name}</span>
                                                                        </div>
                                                                        <div className="flex items-center space-x-1">
                                                                            <Clock className="h-3 w-3 text-muted-foreground" />
                                                                            <span className="text-sm">{schedule.start_time}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="text-sm">
                                                                            <span className="font-medium">{schedule.player1_name}</span>
                                                                            <span className="mx-1">x</span>
                                                                            <span className="font-medium">{schedule.player2_name}</span>
                                                                        </div>
                                                                        <MatchTypeBadge matchType={schedule.match_type} size="sm" />
                                                                    </div>
                                                                    <div className="flex justify-end space-x-1">
                                                                        {schedule.match_type !== 'Liga' && (
                                                                            <Button variant="ghost" size="sm"
                                                                                onClick={() => handleEdit(schedule)}>
                                                                                <Edit className="h-4 w-4" />
                                                                            </Button>
                                                                        )}
                                                                        <Button variant="ghost" size="sm"
                                                                            onClick={() => handleDeleteClick(schedule)}>
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </div>

                                                                {/* Desktop Layout */}
                                                                <div className="hidden sm:flex items-center justify-between">
                                                                    <div className="flex items-center space-x-4">
                                                                        <div className="flex items-center">
                                                                            <MapPin className="h-4 w-4 mr-1 text-primary" />
                                                                            <span className="font-medium">{schedule.court_name}</span>
                                                                        </div>
                                                                        <div className="flex items-center">
                                                                            <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
                                                                            <span>{schedule.start_time}</span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="font-medium">{schedule.player1_name}</span>
                                                                            <span className="mx-2">x</span>
                                                                            <span className="font-medium">{schedule.player2_name}</span>
                                                                        </div>
                                                                        <MatchTypeBadge matchType={schedule.match_type} />
                                                                    </div>
                                                                    <div className="flex space-x-2">
                                                                        {schedule.match_type !== 'Liga' && (
                                                                            <Button variant="ghost" size="sm"
                                                                                onClick={() => handleEdit(schedule)}>
                                                                                <Edit className="h-4 w-4" />
                                                                            </Button>
                                                                        )}
                                                                        <Button variant="ghost" size="sm"
                                                                            onClick={() => handleDeleteClick(schedule)}>
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}

                                        {hasPastSchedules && (
                                            <div className="mt-6">
                                                <div className="mb-4">
                                                    <label className="flex items-center space-x-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={hidePastDates}
                                                            onChange={(e) => setHidePastDates(e.target.checked)}
                                                            className="rounded border-input text-primary focus:ring-primary"
                                                            data-testid="hide-past-dates-checkbox"
                                                        />
                                                        <span className="text-sm text-muted-foreground">Ocultar jogos passados do mês corrente</span>
                                                    </label>
                                                </div>
                                                {!hidePastDates && (
                                                    <Card className="border-border">
                                                        <CardHeader className="bg-muted/30">
                                                            <CardTitle className="text-muted-foreground text-sm">
                                                                Agendamentos Passados
                                                            </CardTitle>
                                                        </CardHeader>
                                                        <CardContent className="pt-4">
                                                            <div className="space-y-4">
                                                                {Object.entries(pastSchedules).reverse().map(([date, daySchedules]) => (
                                                                    <div key={date} className="border-l-4 border-gray-300 pl-4">
                                                                        <h4 className="font-medium text-muted-foreground mb-2">{formatDate(date)}</h4>
                                                                        <div className="space-y-2">
                                                                            {daySchedules.map((schedule) => (
                                                                                <div key={schedule.id} className="flex items-center space-x-4 p-2 bg-muted/50 rounded text-sm opacity-75">
                                                                                    <span className="font-medium">{schedule.court_name}</span>
                                                                                    <span>{schedule.start_time}</span>
                                                                                    <span>{schedule.player1_name} x {schedule.player2_name}</span>
                                                                                    <span className="text-xs px-2 py-1 bg-muted rounded border border-border">{schedule.match_type}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )
                    })()}
                </TabsContent>

                <TabsContent value="weekly" className="mt-4">
                    <CourtAvailability onEdit={handleEdit} onDelete={handleDeleteClick} onMove={handleMove} refreshKey={agendaVersion} />
                </TabsContent>


            </Tabs>

            {dialogs}

            {/* WhatsApp Share Dialog */}
            <Dialog open={showWhatsappDialog} onOpenChange={setShowWhatsappDialog}>
                <DialogContent className="max-w-2xl mx-4 sm:mx-auto">
                    <DialogHeader>
                        <DialogTitle>Compartilhar no WhatsApp</DialogTitle>
                        <DialogDescription>
                            Mensagem gerada automaticamente com os agendamentos do mês
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <Textarea
                            value={whatsappMessage.replace('[APP_URL]', window.location.origin)}
                            readOnly
                            rows={15}
                            className="font-mono text-sm"
                        />

                        <div className="flex justify-end space-x-2">
                            <Button variant="outline" onClick={() => setShowWhatsappDialog(false)}>
                                Fechar
                            </Button>
                            <Button onClick={shareOnWhatsapp} className="bg-green-600 hover:bg-green-700">
                                <Share2 className="h-4 w-4 mr-2" />
                                Compartilhar no WhatsApp
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    )
}

export default ScheduleView
