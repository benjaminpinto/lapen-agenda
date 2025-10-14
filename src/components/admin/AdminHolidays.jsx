import {useEffect, useState} from 'react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import {Card, CardContent} from '@/components/ui/card'
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {ArrowLeft, Calendar, Clock, Plus, Trash2} from 'lucide-react'
import {useToast} from '@/components/hooks/use-toast'
import {Link} from 'react-router-dom'

const AdminHolidays = () => {
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
            const response = await fetch('/api/admin/holidays-blocks', {
                credentials: 'include'
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
            const response = await fetch('/api/admin/holidays-blocks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
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
            const response = await fetch(`/api/admin/holidays-blocks/${holidayId}`, {
                method: 'DELETE',
                credentials: 'include'
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

    return (
        <div className="max-w-4xl mx-auto">
            <Link to="/admin/dashboard">
                <Button variant="outline" size="sm" className="mb-4">
                    <ArrowLeft className="h-4 w-4 mr-2"/>
                    Voltar ao Dashboard
                </Button>
            </Link>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Feriados e Bloqueios
                    </h1>
                    <p className="text-gray-600">
                        Gerencie datas e horários bloqueados para agendamentos
                    </p>
                </div>

                <Button onClick={() => {
                    resetForm();
                    setIsDialogOpen(true)
                }}>
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

                        <p className="text-sm text-gray-600">
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
                            <p className="text-gray-500">Nenhum bloqueio cadastrado</p>
                        </CardContent>
                    </Card>
                ) : (
                    holidays
                        .sort((a, b) => new Date(a.date) - new Date(b.date))
                        .map((holiday) => (
                            <Card key={holiday.id}>
                                <CardContent className="py-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-6">
                                            <div className="flex items-center">
                                                <Calendar className="h-5 w-5 mr-2 text-red-600"/>
                                                <span className="font-semibold">{formatDate(holiday.date)}</span>
                                            </div>
                                            <div className="flex items-center text-sm text-gray-600">
                                                <Clock className="h-4 w-4 mr-1"/>
                                                {isFullDayBlock(holiday) ? 'Dia inteiro bloqueado' : `${holiday.start_time} - ${holiday.end_time}`}
                                            </div>
                                            {holiday.description && (
                                                <div className="text-sm text-gray-700">
                                                    {holiday.description}
                                                </div>
                                            )}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(holiday.id)}
                                            className="text-red-600 hover:text-red-700"
                                        >
                                            <Trash2 className="h-4 w-4"/>
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                )}
            </div>
        </div>
    )
}

export default AdminHolidays

