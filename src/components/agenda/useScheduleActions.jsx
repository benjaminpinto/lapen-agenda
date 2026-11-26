import {useEffect, useState} from 'react'
import {Button} from '@/components/ui/button'
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
import {useToast} from '@/contexts/ToastContext'
import {useAuth} from '@/contexts/AuthContext'
import {fetchWithAuth} from '@/utils/fetchWithAuth'

/**
 * Edit and delete a booking, with the same checks everywhere it is offered (agenda and Home):
 * login required, no changes while bets are active, confirmation before deleting.
 * Returns the two handlers plus the dialogs to render; `onChanged` runs after a successful edit or delete.
 */
export default function useScheduleActions(onChanged) {
    const [editingSchedule, setEditingSchedule] = useState(null)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [players, setPlayers] = useState([])
    const [editPlayer1Suggestions, setEditPlayer1Suggestions] = useState([])
    const [editPlayer2Suggestions, setEditPlayer2Suggestions] = useState([])
    const [showEditPlayer1Suggestions, setShowEditPlayer1Suggestions] = useState(false)
    const [showEditPlayer2Suggestions, setShowEditPlayer2Suggestions] = useState(false)
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
        fetchPlayers()
    }, [])

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
                onChanged?.()
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

    // Drag and drop on the court grid: same booking, new court/date/time. Resolves true when it moved.
    const handleMove = async (schedule, where, label) => {
        try {
            const response = await fetchWithAuth(`/api/public/schedules/${schedule.id}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    player1_name: schedule.player1_name,
                    player2_name: schedule.player2_name,
                    match_type: schedule.match_type,
                    ...where
                }),
            })
            const data = await response.json()
            if (response.ok && data.success) {
                toast({title: 'Jogo movido', description: label})
                onChanged?.()
                return true
            }
            toast({title: 'Não foi possível mover', description: data.error || 'Erro ao mover agendamento', variant: 'destructive'})
        } catch (error) {
            toast({title: 'Erro', description: 'Erro ao conectar com o servidor', variant: 'destructive'})
        }
        return false
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
                onChanged?.()
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
                onChanged?.()
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

    const dialogs = (
        <>
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
        </>
    )

    // Moving needs a logged-in member; logged-out visitors just tap the cards
    return {handleEdit, handleDeleteClick, handleMove: isAuthenticated ? handleMove : undefined, dialogs}
}
