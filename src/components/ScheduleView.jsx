import {useEffect, useState} from 'react'
import {useSearchParams} from 'react-router-dom'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs'
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Textarea} from '@/components/ui/textarea'
import {BarChart3, Calendar, Clock, Edit, GraduationCap, List, MapPin, Share2, Trash2, Trophy, Users} from 'lucide-react'
import {useToast} from '@/components/hooks/use-toast.js'
import WeeklyCalendar from './WeeklyCalendar'

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
    const [stats, setStats] = useState({})
    const [hidePastDates, setHidePastDates] = useState(true)
    const [formData, setFormData] = useState({
        player1_name: '',
        player2_name: '',
        match_type: ''
    })

    const {toast} = useToast()

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
    }, [searchParams])

    useEffect(() => {
        if (viewType === 'weekly') {
            fetchWeekSchedules()
        }
    }, [viewType])

    const fetchSchedules = async () => {
        try {
            const response = await fetch('/api/public/schedules/month')
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
            const response = await fetch(url)
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
            const response = await fetch('/api/public/players')
            if (response.ok) {
                const data = await response.json()
                setPlayers(data)
            }
        } catch (error) {
            console.error('Error fetching players:', error)
        }
    }

    const fetchStats = async () => {
        try {
            const response = await fetch('/api/public/dashboard-stats')
            if (response.ok) {
                const data = await response.json()
                setStats(data)
            }
        } catch (error) {
            console.error('Error fetching stats:', error)
            setStats({})
        }
    }

    const handleEdit = (schedule) => {
        setEditingSchedule(schedule)
        setFormData({
            player1_name: schedule.player1_name,
            player2_name: schedule.player2_name,
            match_type: schedule.match_type
        })
        setIsEditDialogOpen(true)
    }

    const handleUpdate = async (e) => {
        e.preventDefault()

        try {
            const response = await fetch(`/api/public/schedules/${editingSchedule.id}`, {
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

    const handleDelete = async (scheduleId) => {
        if (!confirm('Tem certeza que deseja excluir este agendamento?')) {
            return
        }

        try {
            const response = await fetch(`/api/public/schedules/${scheduleId}`, {
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

    const handleWhatsappShare = async () => {
        if (viewType === 'weekly') {
            await captureWeeklyCalendar()
        } else {
            try {
                const response = await fetch('/api/public/whatsapp-message')
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

    const getMatchTypeColor = (matchType) => {
        if (matchType === 'Liga') return 'bg-yellow-100 !text-black'
        if (matchType === 'Aula') return 'bg-purple-100 !text-black'
        return 'bg-green-100 !text-black'
    }

    const getMatchTypeIcon = (matchType) => {
        if (matchType === 'Liga') return <Trophy className="h-4 w-4 text-black"/>
        if (matchType === 'Aula') return <GraduationCap className="h-4 w-4 text-black"/>
        return <Users className="h-4 w-4 text-black"/>
    }

    if (loading) {
        return <div className="text-center py-8">Carregando agenda...</div>
    }

    const groupedSchedules = groupSchedulesByDate(schedules)

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Agenda de Quadras
                    </h1>
                    <p className="text-gray-600">
                        Visualize e gerencie os agendamentos
                    </p>
                </div>

                <Button onClick={handleWhatsappShare}>
                    <Share2 className="h-4 w-4 mr-2"/>
                    Compartilhar no WhatsApp
                </Button>
            </div>

            <Tabs value={viewType} onValueChange={setViewType} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="list" className="flex items-center">
                        <List className="h-4 w-4 mr-2"/>
                        Lista
                    </TabsTrigger>
                    <TabsTrigger value="weekly" className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2"/>
                        Calendário Semanal
                    </TabsTrigger>
                    <TabsTrigger value="stats" className="flex items-center">
                        <BarChart3 className="h-4 w-4 mr-2"/>
                        Estatísticas
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="list" className="mt-6">
                    {(() => {
                        const today = new Date().toISOString().split('T')[0]
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
                                            <p className="text-gray-500">Nenhum agendamento encontrado para este mês</p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <>
                                        {Object.entries(futureSchedules).map(([date, daySchedules]) => (
                                            <Card key={date}>
                                                <CardHeader>
                                                    <CardTitle className="flex items-center">
                                                        <Calendar className="h-5 w-5 mr-2 text-blue-600"/>
                                                        {formatDate(date)}
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="space-y-3">
                                                        {daySchedules.map((schedule) => (
                                                            <div key={schedule.id}
                                                                 className="flex items-center justify-between p-4 border rounded-lg">
                                                                <div className="flex items-center space-x-4">
                                                                    <div className="flex items-center">
                                                                        <MapPin className="h-4 w-4 mr-1 text-green-600"/>
                                                                        <span className="font-medium">{schedule.court_name}</span>
                                                                    </div>
                                                                    <div className="flex items-center">
                                                                        <Clock className="h-4 w-4 mr-1 text-gray-500"/>
                                                                        <span>{schedule.start_time}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="font-medium">{schedule.player1_name}</span>
                                                                        <span className="mx-2">x</span>
                                                                        <span className="font-medium">{schedule.player2_name}</span>
                                                                    </div>
                                                                    <div
                                                                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border-2 transition-all duration-200 cursor-pointer ${
                                                                            schedule.match_type === 'Liga' ? 'bg-yellow-100 text-black border-yellow-300 hover:border-yellow-600' :
                                                                            schedule.match_type === 'Aula' ? 'bg-purple-100 text-black border-purple-300 hover:border-purple-600' :
                                                                            'bg-green-100 text-black border-green-300 hover:border-green-600'
                                                                        }`}
                                                                        title={
                                                                            schedule.match_type === 'Liga' ? 'Partida oficial da liga' :
                                                                            schedule.match_type === 'Aula' ? 'Aula de tênis' :
                                                                            'Partida amistosa entre jogadores'
                                                                        }
                                                                    >
                                                                        <div className="flex items-center">
                                                                            {getMatchTypeIcon(schedule.match_type)}
                                                                            <span className="ml-1">{schedule.match_type}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex space-x-2">
                                                                    <Button variant="ghost" size="sm"
                                                                            onClick={() => handleEdit(schedule)}>
                                                                        <Edit className="h-4 w-4"/>
                                                                    </Button>
                                                                    <Button variant="ghost" size="sm"
                                                                            onClick={() => handleDelete(schedule.id)}>
                                                                        <Trash2 className="h-4 w-4"/>
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                        
                                        {hasPastSchedules && (
                                            <div className="mt-6">
                                                <div className="mb-4 flex items-center justify-between">
                                                    <label className="flex items-center space-x-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={hidePastDates}
                                                            onChange={(e) => setHidePastDates(e.target.checked)}
                                                            className="rounded border-gray-300"
                                                        />
                                                        <span className="text-sm text-gray-600">Ocultar datas passadas</span>
                                                    </label>
                                                </div>
                                                {!hidePastDates && (
                                                    <Card className="border-gray-300">
                                                <CardHeader className="bg-gray-50">
                                                    <CardTitle className="text-gray-600 text-sm">
                                                        Agendamentos Passados
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent className="pt-4">
                                                    <div className="space-y-4">
                                                        {Object.entries(pastSchedules).reverse().map(([date, daySchedules]) => (
                                                            <div key={date} className="border-l-4 border-gray-300 pl-4">
                                                                <h4 className="font-medium text-gray-600 mb-2">{formatDate(date)}</h4>
                                                                <div className="space-y-2">
                                                                    {daySchedules.map((schedule) => (
                                                                        <div key={schedule.id} className="flex items-center space-x-4 p-2 bg-gray-50 rounded text-sm opacity-75">
                                                                            <span className="font-medium">{schedule.court_name}</span>
                                                                            <span>{schedule.start_time}</span>
                                                                            <span>{schedule.player1_name} x {schedule.player2_name}</span>
                                                                            <span className="text-xs px-2 py-1 bg-gray-200 rounded">{schedule.match_type}</span>
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
                        <WeeklyCalendar weekSchedules={weekSchedules} fetchWeekSchedules={fetchWeekSchedules}/>
                    </div>
                </TabsContent>

                <TabsContent value="stats" className="mt-6">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Quadra Mais Agendada</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">
                                    {stats.mostBookedCourt?.name || 'N/A'}
                                </div>
                                <p className="text-sm text-gray-500">
                                    {stats.mostBookedCourt?.bookings || 0} agendamentos este mês
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Jogos por Tipo</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {stats.gameStats?.map((stat) => (
                                        <div key={stat.match_type} className="flex justify-between">
                                            <span>{stat.match_type}</span>
                                            <span className="font-semibold">{stat.count}</span>
                                        </div>
                                    )) || <p className="text-gray-500">Nenhum dado disponível</p>}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Jogadores Mais Assíduos</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {stats.topPlayers?.slice(0, 5).map((player, index) => (
                                        <div key={player.player_name} className="flex justify-between">
                                            <span className="text-sm">{index + 1}. {player.player_name}</span>
                                            <span className="font-semibold text-sm">{player.games} jogos</span>
                                        </div>
                                    )) || <p className="text-gray-500">Nenhum dado disponível</p>}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Editar Agendamento</DialogTitle>
                        <DialogDescription>
                            Altere os jogadores ou tipo de partida
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleUpdate} className="space-y-4">
                        <div>
                            <Label htmlFor="edit-player1">Jogador 1</Label>
                            <Input
                                id="edit-player1"
                                value={formData.player1_name}
                                onChange={(e) => setFormData(prev => ({...prev, player1_name: e.target.value}))}
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="edit-player2">Jogador 2</Label>
                            <Input
                                id="edit-player2"
                                value={formData.player2_name}
                                onChange={(e) => setFormData(prev => ({...prev, player2_name: e.target.value}))}
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="edit-match-type">Tipo de Partida</Label>
                            <Select value={formData.match_type}
                                    onValueChange={(value) => setFormData(prev => ({...prev, match_type: value}))}>
                                <SelectTrigger>
                                    <SelectValue/>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Amistoso">Amistoso</SelectItem>
                                    <SelectItem value="Liga">Liga</SelectItem>
                                    <SelectItem value="Aula">Aula</SelectItem>
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

            {/* WhatsApp Share Dialog */}
            <Dialog open={showWhatsappDialog} onOpenChange={setShowWhatsappDialog}>
                <DialogContent className="max-w-2xl">
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
                                <Share2 className="h-4 w-4 mr-2"/>
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

