import {useEffect, useState} from 'react'
import {useSearchParams} from 'react-router-dom'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs'
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Textarea} from '@/components/ui/textarea'
import {Calendar, Clock, Edit, List, MapPin, Share2, Trash2} from 'lucide-react'
import {useToast} from '@/contexts/ToastContext'
import {useAuth} from '@/contexts/AuthContext'
import WeeklyCalendar from './WeeklyCalendar'
import MonthSelector from './ui/MonthSelector'
import MatchTypeBadge from './ui/MatchTypeBadge'
import {fetchWithAuth} from '@/utils/fetchWithAuth'
import {getCurrentMonth, getCurrentYear, getLocalDateString} from '@/utils/dateUtils'

const ScheduleView = () => {
    const [searchParams] = useSearchParams()
    const [schedules, setSchedules] = useState([])
    const [weekSchedules, setWeekSchedules] = useState([])
    const [loading, setLoading] = useState(true)
    const [viewType, setViewType] = useState('list')
    const [editingSchedule, setEditingSchedule] = useState(null)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [whatsappMessage, setWhatsappMessage] = useState('')
    const [showWhatsappDialog, setShowWhatsappDialog] = useState(false)
    const [players, setPlayers] = useState([])
    const [editPlayer1Suggestions, setEditPlayer1Suggestions] = useState([])
    const [editPlayer2Suggestions, setEditPlayer2Suggestions] = useState([])
    const [showEditPlayer1Suggestions, setShowEditPlayer1Suggestions] = useState(false)
    const [showEditPlayer2Suggestions, setShowEditPlayer2Suggestions] = useState(false)
    const [stats, setStats] = useState({})
    const [hidePastDates, setHidePastDates] = useState(true)
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
    const [selectedYear, setSelectedYear] = useState(getCurrentYear())
    const [deletingSchedule, setDeletingSchedule] = useState(null)
    const [showBetsWarning, setShowBetsWarning] = useState(false)
    const [isFinishedMatch, setIsFinishedMatch] = useState(false)
    const [showAuthRequired, setShowAuthRequired] = useState(false)
    const [formData, setFormData] = useState({
        player1_name: '',
        player2_name: '',
        match_type: ''
    })

    const { toast } = useToast()
    const { isAuthenticated } = useAuth()

    useEffect(() => {
        fetchSchedules()
        fetchPlayers()
        fetchStats()

        // Check if we should show WhatsApp sharing immediately
        if (searchParams.get('share') === 'true') {
            setTimeout(() => {
                handleWhatsappShare()
            }, 1000)
        }
    }, [searchParams, selectedMonth, selectedYear])

    useEffect(() => {
        if (viewType === 'weekly') {
            fetchWeekSchedules()
        }
    }, [viewType])

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

    const fetchWeekSchedules = async (date = null) => {
        try {
            const url = date
                ? `/api/public/schedules/week?date=${date}`
                : '/api/public/schedules/week'
            const response = await fetchWithAuth(url)
            if (response.ok) {
                const data = await response.json()
                setWeekSchedules(data)
            }
        } catch (error) {
            console.error('Error fetching week schedules:', error)
        }
    }

    const fetchPlayers = async () => {
        try {
            const response = await fetchWithAuth('/api/public/users/short-names')
            if (response.ok) {
                const data = await response.json()
                setPlayers(data)
            }
        } catch (error) {
            console.error('Error fetching players:', error)
        }
    }

    const normalizeString = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

    const handleEditPlayerInput = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        if (value.length > 0) {
            const normalized = normalizeString(value)
            const suggestions = players
                .filter(p => normalizeString(p.short_name).includes(normalized) || normalizeString(p.name).includes(normalized))
                .map(p => p.short_name)
                .slice(0, 5)
            if (field === 'player1_name') {
                setEditPlayer1Suggestions(suggestions)
                setShowEditPlayer1Suggestions(true)
            } else {
                setEditPlayer2Suggestions(suggestions)
                setShowEditPlayer2Suggestions(true)
            }
        } else {
            field === 'player1_name' ? setShowEditPlayer1Suggestions(false) : setShowEditPlayer2Suggestions(false)
        }
    }

    const selectEditSuggestion = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        field === 'player1_name' ? setShowEditPlayer1Suggestions(false) : setShowEditPlayer2Suggestions(false)
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

    const handleEdit = async (schedule) => {
        if (!isAuthenticated) {
            setShowAuthRequired(true)
            return
        }
        const hasBets = await checkActiveBets(schedule.id)
        if (hasBets) {
            setShowBetsWarning(true)
            return
        }
        if (schedule.match_type === 'Liga') {
            toast({
                title: "Edição indisponível",
                description: "Partidas da Liga devem ser gerenciadas pelo fluxo da Liga.",
                variant: "destructive"
            })
            return
        }
        setEditingSchedule(schedule)
        setFormData({
            player1_name: schedule.player1_name,
            player2_name: schedule.player2_name,
            match_type: schedule.match_type
        })
        setIsEditDialogOpen(true)
    }

    const checkActiveBets = async (scheduleId) => {
        try {
            const response = await fetchWithAuth(`/api/public/schedules/${scheduleId}/has-bets`)
            if (response.ok) {
                const data = await response.json()
                setIsFinishedMatch(data.is_finished || false)
                return data.has_bets
            }
        } catch (error) {
            console.error('Error checking bets:', error)
        }
        setIsFinishedMatch(false)
        return false
    }

    const handleUpdate = async (e) => {
        e.preventDefault()

        try {
            const response = await fetchWithAuth(`/api/public/schedules/${editingSchedule.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            })

            const data = await response.json()

            if (response.ok && data.success) {
                toast({
                    title: "Sucesso",
                    description: data.message
                })
                fetchSchedules()
                setIsEditDialogOpen(false)
            } else {
                toast({
                    title: "Erro",
                    description: data.error || "Erro ao atualizar agendamento",
                    variant: "destructive"
                })
            }
        } catch (error) {
            toast({
                title: "Erro",
                description: "Erro ao conectar com o servidor",
                variant: "destructive"
            })
        }
    }

    const handleDeleteClick = async (schedule) => {
        if (!isAuthenticated) {
            setShowAuthRequired(true)
            return
        }
        const hasBets = await checkActiveBets(schedule.id)
        if (hasBets) {
            if (isFinishedMatch) {
                // Proceed with soft delete for finished matches
                await performDelete(schedule.id)
            } else {
                setShowBetsWarning(true)
            }
            return
        }
        setDeletingSchedule(schedule)
    }

    const performDelete = async (scheduleId) => {
        try {
            const response = await fetchWithAuth(`/api/public/schedules/${scheduleId}`, {
                method: 'DELETE'
            })

            const data = await response.json()

            if (response.ok && data.success) {
                toast({
                    title: "Sucesso",
                    description: data.message
                })
                fetchSchedules()
            } else {
                toast({
                    title: "Erro",
                    description: data.error || "Erro ao excluir agendamento",
                    variant: "destructive"
                })
            }
        } catch (error) {
            toast({
                title: "Erro",
                description: "Erro ao conectar com o servidor",
                variant: "destructive"
            })
        }
    }

    const handleDelete = async () => {
        if (!deletingSchedule) return

        try {
            const scheduleId = deletingSchedule.id
            const response = await fetchWithAuth(`/api/public/schedules/${scheduleId}`, {
                method: 'DELETE'
            })

            const data = await response.json()

            if (response.ok && data.success) {
                toast({
                    title: "Sucesso",
                    description: data.message
                })
                setDeletingSchedule(null)
                fetchSchedules()
            } else {
                toast({
                    title: "Erro",
                    description: data.error || "Erro ao excluir agendamento",
                    variant: "destructive"
                })
            }
        } catch (error) {
            toast({
                title: "Erro",
                description: "Erro ao conectar com o servidor",
                variant: "destructive"
            })
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 space-y-4 sm:space-y-0">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                        Agenda das Quadras
                    </h1>
                    <p className="text-muted-foreground text-sm sm:text-base">
                        Visualize e gerencie os agendamentos
                    </p>
                </div>

                <div className="flex gap-2">
                    <Button onClick={() => window.location.href = '/schedule'} variant="outline" className="w-full sm:w-auto">
                        <Calendar className="h-4 w-4 mr-2" />
                        Agendar
                    </Button>
                    <Button onClick={handleWhatsappShare} size="icon" title="Compartilhar no WhatsApp">
                        <Share2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <Tabs value={viewType} onValueChange={setViewType} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="list" className="flex items-center text-xs sm:text-sm">
                        <List className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Lista</span>
                        <span className="sm:hidden">Lista</span>
                    </TabsTrigger>
                    <TabsTrigger value="weekly" className="flex items-center text-xs sm:text-sm">
                        <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Calendário Semanal</span>
                        <span className="sm:hidden">Semanal</span>
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
                                                                            <MapPin className="h-4 w-4 text-green-600" />
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
                                                                            <MapPin className="h-4 w-4 mr-1 text-green-600 dark:text-green-500" />
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

                <TabsContent value="weekly" className="mt-6">
                    <div data-weekly-calendar>
                        <WeeklyCalendar weekSchedules={weekSchedules} fetchWeekSchedules={fetchWeekSchedules} />
                    </div>
                </TabsContent>


            </Tabs>

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="w-[calc(100vw-2rem)] max-w-xl sm:mx-auto">
                    <DialogHeader>
                        <DialogTitle>Editar Agendamento</DialogTitle>
                        <DialogDescription>
                            Altere os jogadores ou tipo de partida
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleUpdate} className="space-y-4">
                        <div className="relative">
                            <Label htmlFor="edit-player1">Jogador 1</Label>
                            <Input
                                id="edit-player1"
                                value={formData.player1_name}
                                onChange={(e) => handleEditPlayerInput('player1_name', e.target.value)}
                                onFocus={() => formData.player1_name && setShowEditPlayer1Suggestions(true)}
                                onBlur={() => setTimeout(() => setShowEditPlayer1Suggestions(false), 200)}
                                autoComplete="off"
                                required
                            />
                            {showEditPlayer1Suggestions && editPlayer1Suggestions.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                                    {editPlayer1Suggestions.map((s, i) => (
                                        <div key={i} className="px-4 py-3 hover:bg-gray-100 cursor-pointer"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => selectEditSuggestion('player1_name', s)}>{s}</div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="relative">
                            <Label htmlFor="edit-player2">Jogador 2</Label>
                            <Input
                                id="edit-player2"
                                value={formData.player2_name}
                                onChange={(e) => handleEditPlayerInput('player2_name', e.target.value)}
                                onFocus={() => formData.player2_name && setShowEditPlayer2Suggestions(true)}
                                onBlur={() => setTimeout(() => setShowEditPlayer2Suggestions(false), 200)}
                                autoComplete="off"
                                required
                            />
                            {showEditPlayer2Suggestions && editPlayer2Suggestions.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                                    {editPlayer2Suggestions.map((s, i) => (
                                        <div key={i} className="px-4 py-3 hover:bg-gray-100 cursor-pointer"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => selectEditSuggestion('player2_name', s)}>{s}</div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="edit-match-type">Tipo de Partida</Label>
                            <Select value={formData.match_type}
                                onValueChange={(value) => setFormData(prev => ({ ...prev, match_type: value }))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Amistoso">Amistoso</SelectItem>
                                    <SelectItem value="Aula">Aula</SelectItem>
                                    <SelectItem value="Torneio">Torneio</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex justify-end space-x-2">
                            <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit">
                                Salvar
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deletingSchedule} onOpenChange={(open) => !open && setDeletingSchedule(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Agendamento</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir este agendamento?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                            Excluir
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

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

            {/* Active Bets Warning Dialog */}
            <AlertDialog open={showBetsWarning} onOpenChange={setShowBetsWarning}>
                <AlertDialogContent className="max-w-md mx-4 sm:mx-auto">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {isFinishedMatch ? 'Partida Finalizada' : 'Apostas Ativas Encontradas'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {isFinishedMatch ? (
                                'Esta partida teve apostas ativas e já foi finalizada. Não é possível editar.'
                            ) : (
                                <>
                                    Este agendamento possui apostas ativas e não pode ser editado ou excluído.
                                    <br /><br />
                                    Para modificar este agendamento, entre em contato com um administrador para cancelar as apostas primeiro.
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Entendi</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Authentication Required Dialog */}
            <AlertDialog open={showAuthRequired} onOpenChange={setShowAuthRequired}>
                <AlertDialogContent className="max-w-md mx-4 sm:mx-auto">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Login Necessário</AlertDialogTitle>
                        <AlertDialogDescription>
                            Para editar ou excluir agendamentos, você precisa ser um membro da LAPEN autenticado. Por favor, faça login para continuar.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Fechar</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

export default ScheduleView
