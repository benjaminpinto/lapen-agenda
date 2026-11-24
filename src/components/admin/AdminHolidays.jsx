import {useEffect, useState} from 'react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import {Card, CardContent} from '@/components/ui/card'
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Calendar, Clock, Plus, Trash2} from 'lucide-react'
import {useToast} from '@/contexts/ToastContext'
import {fetchWithAuth} from "../../utils/fetchWithAuth.js";
import {getLocalDateString} from '@/utils/dateUtils'

const AdminHolidays = () => {
    const [showPast, setShowPast] = useState(false)
    const [holidays, setHolidays] = useState([])
    const [loading, setLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [formData, setFormData] = useState({
        date: '',
        start_time: '',
        end_time: '',
        description: ''
    })
    const {toast} = useToast()

    useEffect(() => {
        fetchHolidays()
    }, [])

    const fetchHolidays = async () => {
        try {
            const response = await fetchWithAuth('/api/admin/holidays-blocks', {
                headers: {  }
            })
            if (response.ok) {
                const data = await response.json()
                setHolidays(data)
            }
        } catch (error) {
            console.error('Error fetching holidays:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        try {
            const response = await fetchWithAuth('/api/admin/holidays-blocks', {
                method: 'POST',
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
                fetchHolidays()
                resetForm()
                setIsDialogOpen(false)
            } else {
                toast({
                    title: "Erro",
                    description: data.message || "Erro ao criar bloqueio",
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

    const handleDelete = async (holidayId) => {
        try {
            const response = await fetchWithAuth(`/api/admin/holidays-blocks/${holidayId}`, {
                method: 'DELETE',
                headers: {  }
            })

            const data = await response.json()

            if (response.ok && data.success) {
                toast({
                    title: "Sucesso",
                    description: data.message
                })
                fetchHolidays()
            } else {
                toast({
                    title: "Erro",
                    description: data.message || "Erro ao remover bloqueio",
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
            date: '',
            start_time: '',
            end_time: '',
            description: ''
        })
    }

    const formatDate = (dateStr) => {
        const date = new Date(dateStr + 'T00:00:00')
        return date.toLocaleDateString('pt-BR')
    }

    const isFullDayBlock = (holiday) => {
        return !holiday.start_time && !holiday.end_time
    }

    if (loading) {
        return <div className="text-center py-8">Carregando bloqueios...</div>
    }

    // Upcoming blocks first; past ones stay one tap away.
    const today = getLocalDateString()
    const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date))
    const upcoming = sorted.filter(h => h.date >= today)
    const past = sorted.filter(h => h.date < today).reverse()
    const renderHoliday = (holiday) => (
        <Card key={holiday.id} className={holiday.date < today ? 'opacity-70' : ''}>
            <CardContent className="py-3 sm:py-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-6">
                        <div className="flex items-center">
                            <Calendar className="h-5 w-5 mr-2 text-red-600"/>
                            <span className="font-semibold">{formatDate(holiday.date)}</span>
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                            <Clock className="h-4 w-4 mr-1"/>
                            {isFullDayBlock(holiday) ? 'Dia inteiro bloqueado' : `${holiday.start_time} - ${holiday.end_time}`}
                        </div>
                        {holiday.description && (
                            <div className="text-sm text-foreground/80">
                                {holiday.description}
                            </div>
                        )}
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(holiday.id)}
                        className="shrink-0 text-red-600 hover:text-red-700"
                    >
                        <Trash2 className="h-4 w-4"/>
                    </Button>
                </div>
            </CardContent>
        </Card>
    )

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-start justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
                        Feriados e Bloqueios
                    </h1>
                    <p className="text-muted-foreground">
                        Gerencie datas e horários bloqueados para agendamentos
                    </p>
                </div>

                <Button className="shrink-0 rounded-full" onClick={() => { resetForm(); setIsDialogOpen(true) }}>
                    <Plus className="h-4 w-4 mr-2"/>
                    Novo Bloqueio
                </Button>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Criar Bloqueio</DialogTitle>
                        <DialogDescription>
                            Bloqueie uma data inteira ou apenas um período específico
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <Label htmlFor="date">Data</Label>
                            <Input
                                id="date"
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData(prev => ({...prev, date: e.target.value}))}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="start_time">Horário Início (opcional)</Label>
                                <Input
                                    id="start_time"
                                    type="time"
                                    value={formData.start_time}
                                    onChange={(e) => setFormData(prev => ({...prev, start_time: e.target.value}))}
                                />
                            </div>
                            <div>
                                <Label htmlFor="end_time">Horário Fim (opcional)</Label>
                                <Input
                                    id="end_time"
                                    type="time"
                                    value={formData.end_time}
                                    onChange={(e) => setFormData(prev => ({...prev, end_time: e.target.value}))}
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="description">Descrição</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
                                placeholder="Ex: Natal, Manutenção da quadra, etc."
                            />
                        </div>

                        <p className="text-sm text-muted-foreground">
                            <strong>Dica:</strong> Deixe os horários em branco para bloquear o dia inteiro
                        </p>

                        <div className="flex justify-end space-x-2">
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit">
                                Criar Bloqueio
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <div className="space-y-3">
                {holidays.length === 0 ? (
                    <Card>
                        <CardContent className="text-center py-8">
                            <p className="text-muted-foreground">Nenhum bloqueio cadastrado</p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {upcoming.length === 0 && (
                            <p className="rounded-2xl border border-dashed bg-card py-6 text-center text-sm text-muted-foreground">Nenhum bloqueio futuro</p>
                        )}
                        {upcoming.map(renderHoliday)}
                        {past.length > 0 && (
                            <button type="button" onClick={() => setShowPast(!showPast)}
                                    className="w-full rounded-full border bg-card py-2 text-sm font-semibold text-muted-foreground"
                                    data-testid="holidays-toggle-past">
                                {showPast ? 'Ocultar bloqueios passados' : `Mostrar ${past.length} bloqueio(s) passado(s)`}
                            </button>
                        )}
                        {showPast && past.map(renderHoliday)}
                    </>
                )}
            </div>
        </div>
    )
}

export default AdminHolidays

