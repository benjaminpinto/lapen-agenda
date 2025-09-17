import {useEffect, useState} from 'react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import {Checkbox} from '@/components/ui/checkbox'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog'
import {Clock, MapPin, Plus, Trash2} from 'lucide-react'
import {useToast} from "@/components/hooks/use-toast.js";

const AdminRecurring = () => {
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
            const response = await fetch('/api/admin/recurring-schedules', {
                credentials: 'include'
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
            const response = await fetch('/api/admin/courts', {
                credentials: 'include'
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
            const response = await fetch('/api/admin/recurring-schedules', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
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
            const response = await fetch(`/api/admin/recurring-schedules/${scheduleId}`, {
                method: 'DELETE',
                credentials: 'include'
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
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Agenda Fixa
                    </h1>
                    <p className="text-gray-600">
                        Configure agendamentos recorrentes para aulas ou eventos fixos
                    </p>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={resetForm}>
                            <Plus className="h-4 w-4 mr-2"/>
                            Nova Agenda Fixa
                        </Button>
                    </DialogTrigger>
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
                                        <SelectValue placeholder="Selecione a quadra"/>
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
            </div>

            <div className="grid gap-4">
                {schedules.length === 0 ? (
                    <Card>
                        <CardContent className="text-center py-8">
                            <p className="text-gray-500">Nenhuma agenda fixa cadastrada</p>
                        </CardContent>
                    </Card>
                ) : (
                    schedules.map((schedule) => (
                        <Card key={schedule.id}>
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="flex items-center">
                                            <MapPin className="h-5 w-5 mr-2 text-green-600"/>
                                            {schedule.court_name}
                                        </CardTitle>
                                        <CardDescription className="mt-2">
                                            <div className="flex items-center mb-1">
                                                <Clock className="h-4 w-4 mr-1"/>
                                                {getDayName(schedule.day_of_week)} - {schedule.start_time}
                                            </div>
                                            <div className="text-sm">
                                                {formatDate(schedule.start_date)} até {formatDate(schedule.end_date)}
                                            </div>
                                        </CardDescription>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDelete(schedule.id)}
                                        className="text-red-600 hover:text-red-700"
                                    >
                                        <Trash2 className="h-4 w-4"/>
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-gray-600">{schedule.description}</p>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    )
}

export default AdminRecurring

