import {useEffect, useState} from 'react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import {Checkbox} from '@/components/ui/checkbox'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Card, CardContent} from '@/components/ui/card'
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Clock, MapPin, Plus, Trash2} from 'lucide-react'
import {useToast} from '@/contexts/ToastContext';
import {fetchWithAuth} from "../../utils/fetchWithAuth.js";

const AdminRecurring = () => {
    const [editingGroup, setEditingGroup] = useState(null)
    const [schedules, setSchedules] = useState([])
    const [courts, setCourts] = useState([])
    const [loading, setLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [formData, setFormData] = useState({
        court_id: '',
        days_of_week: [],
        times: [''],
        description: '',
        start_date: '',
        end_date: ''
    })
    const {toast} = useToast()

    const weekDays = [
        {value: 0, label: 'Segunda-feira'},
        {value: 1, label: 'Terça-feira'},
        {value: 2, label: 'Quarta-feira'},
        {value: 3, label: 'Quinta-feira'},
        {value: 4, label: 'Sexta-feira'},
        {value: 5, label: 'Sábado'},
        {value: 6, label: 'Domingo'}
    ]

    useEffect(() => {
        fetchSchedules()
        fetchCourts()
    }, [])

    const fetchSchedules = async () => {
        try {
            const response = await fetchWithAuth('/api/admin/recurring-schedules', {
                headers: {  }
            })
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

    const fetchCourts = async () => {
        try {
            const response = await fetchWithAuth('/api/admin/courts', {
                headers: {  }
            })
            if (response.ok) {
                const data = await response.json()
                setCourts(data.filter(court => court.active))
            }
        } catch (error) {
            console.error('Error fetching courts:', error)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        // Filter out empty times
        const validTimes = formData.times.filter(time => time.trim() !== '')

        if (validTimes.length === 0) {
            toast({
                title: "Erro",
                description: "Adicione pelo menos um horário",
                variant: "destructive"
            })
            return
        }

        try {
            const response = await fetchWithAuth('/api/admin/recurring-schedules', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    
                },
                body: JSON.stringify({
                    ...formData,
                    times: validTimes
                }),
            })

            const data = await response.json()

            if (response.ok && data.success) {
                toast({
                    title: "Sucesso",
                    description: data.message
                })
                fetchSchedules()
                resetForm()
                setIsDialogOpen(false)
            } else {
                toast({
                    title: "Erro",
                    description: data.message || "Erro ao criar agenda fixa",
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
        try {
            const response = await fetchWithAuth(`/api/admin/recurring-schedules/${scheduleId}`, {
                method: 'DELETE',
                headers: {  }
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
                    description: data.message || "Erro ao remover agenda fixa",
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

    const resetForm = () => {
        setFormData({
            court_id: '',
            days_of_week: [],
            times: [''],
            description: '',
            start_date: '',
            end_date: ''
        })
    }

    const handleDayToggle = (dayValue, checked) => {
        if (checked) {
            setFormData(prev => ({
                ...prev,
                days_of_week: [...prev.days_of_week, dayValue]
            }))
        } else {
            setFormData(prev => ({
                ...prev,
                days_of_week: prev.days_of_week.filter(day => day !== dayValue)
            }))
        }
    }

    const addTimeSlot = () => {
        setFormData(prev => ({
            ...prev,
            times: [...prev.times, '']
        }))
    }

    const removeTimeSlot = (index) => {
        setFormData(prev => ({
            ...prev,
            times: prev.times.filter((_, i) => i !== index)
        }))
    }

    const updateTimeSlot = (index, value) => {
        setFormData(prev => ({
            ...prev,
            times: prev.times.map((time, i) => i === index ? value : time)
        }))
    }

    const formatDate = (dateStr) => {
        const date = new Date(dateStr + 'T00:00:00')
        return date.toLocaleDateString('pt-BR')
    }

    const getDayName = (dayValue) => {
        return weekDays.find(day => day.value === dayValue)?.label || ''
    }

    if (loading) {
        return <div className="text-center py-8">Carregando agendas fixas...</div>
    }

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex items-start justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
                        Agenda Fixa
                    </h1>
                    <p className="text-muted-foreground">
                        Configure agendamentos recorrentes para aulas ou eventos fixos
                    </p>
                </div>

                <Button className="shrink-0 rounded-full" onClick={() => { resetForm(); setIsDialogOpen(true) }}>
                    <Plus className="h-4 w-4 mr-2"/>
                    Nova Agenda Fixa
                </Button>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Criar Agenda Fixa</DialogTitle>
                        <DialogDescription>
                            Configure um agendamento recorrente para aulas ou eventos regulares
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <Label htmlFor="court">Quadra</Label>
                            <Select value={formData.court_id}
                                    onValueChange={(value) => setFormData(prev => ({...prev, court_id: value}))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione a quadra">
                                        {formData.court_id && courts.find(court => String(court.id) === formData.court_id)?.name || "Selecione a quadra"}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {courts.map((court) => (
                                        <SelectItem key={court.id} value={court.id.toString()}>
                                            {court.name} ({court.type})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Dias da Semana</Label>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                {weekDays.map((day) => (
                                    <div key={day.value} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`day-${day.value}`}
                                            checked={formData.days_of_week.includes(day.value)}
                                            onCheckedChange={(checked) => handleDayToggle(day.value, checked)}
                                        />
                                        <Label htmlFor={`day-${day.value}`} className="text-sm">
                                            {day.label}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <Label>Horários</Label>
                            <div className="space-y-2 mt-2">
                                {formData.times.map((time, index) => (
                                    <div key={index} className="flex items-center space-x-2">
                                        <Input
                                            type="time"
                                            value={time}
                                            onChange={(e) => updateTimeSlot(index, e.target.value)}
                                            className="flex-1"
                                        />
                                        {formData.times.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => removeTimeSlot(index)}
                                            >
                                                Remover
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addTimeSlot}
                                >
                                    Adicionar Horário
                                </Button>
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="description">Descrição</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
                                placeholder="Ex: Aula Professor Alexandre"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="start_date">Data de Início</Label>
                                <Input
                                    id="start_date"
                                    type="date"
                                    value={formData.start_date}
                                    onChange={(e) => setFormData(prev => ({...prev, start_date: e.target.value}))}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="end_date">Data de Fim</Label>
                                <Input
                                    id="end_date"
                                    type="date"
                                    value={formData.end_date}
                                    onChange={(e) => setFormData(prev => ({...prev, end_date: e.target.value}))}
                                    required
                                />
                            </div>
                        </div>

                        <div className="flex justify-end space-x-2">
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit">
                                Criar Agenda Fixa
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <div className="space-y-3">
                {schedules.length === 0 ? (
                    <Card>
                        <CardContent className="text-center py-8">
                            <p className="text-muted-foreground">Nenhuma agenda fixa cadastrada</p>
                        </CardContent>
                    </Card>
                ) : (
                    groupRecurring(schedules).map((group) => (
                        <Card key={group.key} data-testid="recurring-group">
                            <CardContent className="py-4 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 font-semibold">
                                            <MapPin className="h-4 w-4 shrink-0 text-primary"/>
                                            <span className="truncate">{group.court_name}</span>
                                        </div>
                                        {group.description && <div className="text-sm text-foreground/80">{group.description}</div>}
                                        <div className="text-xs text-muted-foreground">
                                            {formatDate(group.start_date)} até {formatDate(group.end_date)}
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm" className="shrink-0 rounded-full"
                                            onClick={() => setEditingGroup(editingGroup === group.key ? null : group.key)}
                                            data-testid="recurring-group-edit">
                                        {editingGroup === group.key ? 'Concluir' : 'Editar'}
                                    </Button>
                                </div>
                                <div className="space-y-1.5">
                                    {group.days.map(({day, items}) => (
                                        <div key={day} className="flex items-start gap-2">
                                            <span className="w-16 shrink-0 pt-1 text-xs font-semibold text-muted-foreground">{getDayName(day).split("-")[0]}</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {items.map((schedule) => (
                                                    <span key={schedule.id}
                                                          className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold tabular-nums text-accent-foreground">
                                                        <Clock className="h-3 w-3"/>
                                                        {schedule.start_time}
                                                        {editingGroup === group.key && (
                                                            <button type="button" onClick={() => handleDelete(schedule.id)}
                                                                    aria-label={`Remover ${getDayName(day)} ${schedule.start_time}`}
                                                                    className="min-h-0 min-w-0 -mr-1 ml-0.5 h-5 w-5 rounded-full bg-red-600 text-white grid place-items-center"
                                                                    data-testid={`recurring-delete-${schedule.id}`}>
                                                                <Trash2 className="h-3 w-3"/>
                                                            </button>
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    )
}

// One card per court + description + period; inside it, each weekday with its start times.
function groupRecurring(schedules) {
    const groups = new Map()
    schedules.forEach(schedule => {
        const key = [schedule.court_id, schedule.description, schedule.start_date, schedule.end_date].join('|')
        if (!groups.has(key)) groups.set(key, {key, court_name: schedule.court_name, description: schedule.description,
            start_date: schedule.start_date, end_date: schedule.end_date, byDay: new Map()})
        const group = groups.get(key)
        if (!group.byDay.has(schedule.day_of_week)) group.byDay.set(schedule.day_of_week, [])
        group.byDay.get(schedule.day_of_week).push(schedule)
    })
    return [...groups.values()]
        .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.court_name.localeCompare(b.court_name))
        .map(group => ({
            ...group,
            days: [...group.byDay.entries()].sort(([a], [b]) => a - b)
                .map(([day, items]) => ({day, items: items.sort((a, b) => a.start_time.localeCompare(b.start_time))})),
        }))
}

export default AdminRecurring

