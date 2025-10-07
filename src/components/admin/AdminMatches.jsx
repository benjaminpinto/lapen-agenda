import {useEffect, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useToast} from '@/contexts/ToastContext'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Badge} from '@/components/ui/badge'
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger} from '@/components/ui/dialog'
import {Trophy, Users, Wallet} from 'lucide-react'

const AdminMatches = () => {
    const [matches, setMatches] = useState([])
    const [selectedMatch, setSelectedMatch] = useState(null)
    const [winner, setWinner] = useState('')
    const [score, setScore] = useState('')
    const [loading, setLoading] = useState(false)
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
    const [matchToCancel, setMatchToCancel] = useState(null)
    const {toast} = useToast()
    const navigate = useNavigate()

    useEffect(() => {
        fetchMatches()
    }, [])

    const fetchMatches = async () => {
        try {
            const response = await fetch('/api/matches/')
            const data = await response.json()
            setMatches(data.matches || [])
        } catch (error) {
            console.error('Error fetching matches:', error)
        }
    }

    const fetchMatchDetails = async (matchId) => {
        try {
            const response = await fetch(`/api/betting/match/${matchId}/bets`)
            const data = await response.json()
            
            // For finished matches, get winner info
            if (data.match?.status === 'finished') {
                const resultResponse = await fetch(`/api/admin/matches/${matchId}/result`, {
                    credentials: 'include'
                })
                if (resultResponse.ok) {
                    const resultData = await resultResponse.json()
                    data.winner = resultData.winner_name
                }
            }
            
            return data
        } catch (error) {
            return null
        }
    }

    const handleFinishMatch = async () => {
        if (!selectedMatch || !winner) return

        setLoading(true)
        try {
            const response = await fetch(`/api/admin/matches/${selectedMatch.match_id}/finish`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    winner_name: winner,
                    score: score
                })
            })

            if (response.ok) {
                toast({
                    title: "Sucesso",
                    description: "Partida finalizada e apostas liquidadas!"
                })
                setSelectedMatch(null)
                setWinner('')
                setScore('')
                fetchMatches()
            } else {
                const error = await response.json()
                toast({
                    title: "Erro",
                    description: error.error,
                    variant: "destructive"
                })
            }
        } catch (error) {
            toast({
                title: "Erro",
                description: "Erro ao finalizar partida",
                variant: "destructive"
            })
        } finally {
            setLoading(false)
        }
    }

    const handleCancelMatch = async () => {
        if (!matchToCancel) return

        try {
            const response = await fetch(`/api/admin/matches/${matchToCancel.match_id}/cancel`, {
                method: 'POST',
                credentials: 'include'
            })

            if (response.ok) {
                const data = await response.json()
                toast({
                    title: "Sucesso",
                    description: `Partida cancelada. ${data.refunded_bets} apostas reembolsadas.`
                })
                fetchMatches()
            } else {
                const error = await response.json()
                toast({
                    title: "Erro",
                    description: error.error,
                    variant: "destructive"
                })
            }
        } catch (error) {
            toast({
                title: "Erro",
                description: "Erro ao cancelar partida",
                variant: "destructive"
            })
        } finally {
            setCancelDialogOpen(false)
            setMatchToCancel(null)
        }
    }

    const MatchCard = ({match}) => {
        const [details, setDetails] = useState(null)

        useEffect(() => {
            if (match.match_id) {
                fetchMatchDetails(match.match_id).then(setDetails)
            }
        }, [match.match_id])

        const getStatusBadge = (status) => {
            const statusMap = {
                upcoming: {label: 'Agendada', variant: 'secondary'},
                live: {label: 'Ao Vivo', variant: 'default'},
                finished: {label: 'Finalizada', variant: 'outline'},
                cancelled: {label: 'Cancelada', variant: 'destructive'}
            }

            const config = statusMap[status] || statusMap.upcoming
            return <Badge variant={config.variant}>{config.label}</Badge>
        }

        return (
            <Card className="mb-4">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="flex items-center space-x-2">
                                <Trophy className="h-5 w-5"/>
                                <span>{match.player1_name} vs {match.player2_name}</span>
                            </CardTitle>
                            <CardDescription>
                                {new Date(match.date).toLocaleDateString('pt-BR')} às {match.start_time}
                            </CardDescription>
                        </div>
                        {getStatusBadge(match.status)}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="text-center">
                            <div className="text-sm text-gray-500">Total das Apostas</div>
                            <div className="font-semibold flex items-center justify-center">
                                <Wallet className="h-4 w-4 mr-1"/>
                                R$ {Object.values(details?.betting_stats || {}).reduce((sum, stat) => sum + (stat.total_amount || 0), 0).toFixed(2)}
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-sm text-gray-500">Apostas</div>
                            <div className="font-semibold flex items-center justify-center">
                                <Users className="h-4 w-4 mr-1"/>
                                {details?.betting_stats ?
                                    Object.values(details.betting_stats).reduce((sum, stat) => sum + stat.bet_count, 0) : 0}
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-sm text-gray-500">Apostas Ativas</div>
                            <div className="font-semibold">
                                {match.betting_enabled ? 'Sim' : 'Não'}
                            </div>
                        </div>
                    </div>

                    {(details?.betting_stats || match.status === 'finished') && (
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className={`text-center p-3 rounded ${
                                details?.winner === match.player1_name ? 'bg-yellow-100 border-2 border-yellow-400' : 'bg-blue-50'
                            }`}>
                                <div className="font-semibold flex items-center justify-center">
                                    {match.player1_name}
                                    {details?.winner === match.player1_name && <Trophy className="h-4 w-4 ml-1 text-yellow-600" />}
                                </div>
                                <div className="text-sm text-gray-600">
                                    R$ {details?.betting_stats?.[match.player1_name]?.total_amount?.toFixed(2) || '0.00'}
                                </div>
                            </div>
                            <div className={`text-center p-3 rounded ${
                                details?.winner === match.player2_name ? 'bg-yellow-100 border-2 border-yellow-400' : 'bg-green-50'
                            }`}>
                                <div className="font-semibold flex items-center justify-center">
                                    {match.player2_name}
                                    {details?.winner === match.player2_name && <Trophy className="h-4 w-4 ml-1 text-yellow-600" />}
                                </div>
                                <div className="text-sm text-gray-600">
                                    R$ {details?.betting_stats?.[match.player2_name]?.total_amount?.toFixed(2) || '0.00'}
                                </div>
                            </div>
                        </div>
                    )}

                    {match.status === 'upcoming' && (
                        <div className="space-y-2">
                            <Button
                                onClick={() => setSelectedMatch(match)}
                                className="w-full"
                                variant="outline"
                            >
                                Finalizar Partida
                            </Button>
                            <>
                                <Button
                                    onClick={() => {
                                        setMatchToCancel(match)
                                        setCancelDialogOpen(true)
                                    }}
                                    className="w-full"
                                    variant="destructive"
                                    size="sm"
                                >
                                    Cancelar Partida
                                </Button>
                                <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Cancelar Partida</DialogTitle>
                                            <DialogDescription>
                                                Tem certeza que deseja cancelar a partida {matchToCancel?.player1_name} vs {matchToCancel?.player2_name}?
                                                <br /><br />
                                                Todas as apostas serão automaticamente reembolsadas.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="flex space-x-2 justify-end">
                                            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
                                                Cancelar
                                            </Button>
                                            <Button variant="destructive" onClick={handleCancelMatch}>
                                                Confirmar Cancelamento
                                            </Button>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </>
                        </div>
                    )}
                </CardContent>
            </Card>
        )
    }

    const FinishedMatchCard = ({match}) => {
        const [details, setDetails] = useState(null)

        useEffect(() => {
            if (match.match_id) {
                fetchMatchDetails(match.match_id).then(setDetails)
            }
        }, [match.match_id])

        return (
            <Card className="mb-3 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/admin/matches/${match.match_id}/report`)}>
                <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div>
                                <div className="font-semibold">
                                    {match.player1_name} vs {match.player2_name}
                                </div>
                                <div className="text-sm text-gray-500">
                                    {new Date(match.date).toLocaleDateString('pt-BR')} às {match.start_time}
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center space-x-6">
                            {details?.winner && (
                                <div className="text-center">
                                    <div className="text-sm text-gray-500">Vencedor</div>
                                    <div className="font-semibold text-yellow-600 flex items-center">
                                        <Trophy className="h-4 w-4 mr-1"/>
                                        {details.winner}
                                    </div>
                                </div>
                            )}
                            
                            <div className="text-center">
                                <div className="text-sm text-gray-500">Total Apostas</div>
                                <div className="font-semibold flex items-center">
                                    <Wallet className="h-4 w-4 mr-1"/>
                                    R$ {Object.values(details?.betting_stats || {}).reduce((sum, stat) => sum + (stat.total_amount || 0), 0).toFixed(2)}
                                </div>
                            </div>
                            
                            <div className="text-center">
                                <div className="text-sm text-gray-500">Apostadores</div>
                                <div className="font-semibold flex items-center">
                                    <Users className="h-4 w-4 mr-1"/>
                                    {details?.betting_stats ? Object.values(details.betting_stats).reduce((sum, stat) => sum + stat.bet_count, 0) : 0}
                                </div>
                            </div>
                            
                            <Badge variant={match.status === 'cancelled' ? 'destructive' : 'secondary'}>
                                {match.status === 'cancelled' ? 'Cancelada' : 'Finalizada'}
                            </Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Gerenciar Partidas</h1>
                        <p className="text-gray-600">Finalize partidas e liquide apostas</p>
                    </div>
                    <Button onClick={() => navigate('/admin/reports')} variant="outline">
                        Ver Relatórios
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    {/* Open Matches */}
                    <h2 className="text-xl font-semibold mb-4">Partidas em Aberto</h2>
                    {matches.filter(m => m.status !== 'finished' && m.status !== 'cancelled').length === 0 ? (
                        <Card className="mb-8">
                            <CardContent className="text-center py-8">
                                <Trophy className="h-12 w-12 mx-auto text-gray-400 mb-4"/>
                                <p className="text-gray-500">Nenhuma partida em aberto</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="mb-8">
                            {matches.filter(m => m.status !== 'finished' && m.status !== 'cancelled').map(match => (
                                <MatchCard key={match.schedule_id} match={match}/>
                            ))}
                        </div>
                    )}
                    
                    {/* Finished Matches */}
                    <h2 className="text-xl font-semibold mb-4">Partidas Encerradas</h2>
                    {matches.filter(m => m.status === 'finished' || m.status === 'cancelled').length === 0 ? (
                        <Card>
                            <CardContent className="text-center py-8">
                                <Trophy className="h-12 w-12 mx-auto text-gray-400 mb-4"/>
                                <p className="text-gray-500">Nenhuma partida encerrada</p>
                            </CardContent>
                        </Card>
                    ) : (
                        matches.filter(m => m.status === 'finished' || m.status === 'cancelled').map(match => (
                            <FinishedMatchCard key={match.schedule_id} match={match}/>
                        ))
                    )}
                </div>

                <div>
                    <Card>
                        <CardHeader>
                            <CardTitle>Finalizar Partida</CardTitle>
                            <CardDescription>
                                {selectedMatch ? 'Defina o resultado da partida' : 'Selecione uma partida'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {selectedMatch ? (
                                <div className="space-y-4">
                                    <div>
                                        <Label>Partida Selecionada</Label>
                                        <p className="text-sm font-medium">
                                            {selectedMatch.player1_name} vs {selectedMatch.player2_name}
                                        </p>
                                    </div>

                                    <div>
                                        <Label>Vencedor</Label>
                                        <Select value={winner} onValueChange={setWinner}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione o vencedor"/>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={selectedMatch.player1_name}>
                                                    {selectedMatch.player1_name}
                                                </SelectItem>
                                                <SelectItem value={selectedMatch.player2_name}>
                                                    {selectedMatch.player2_name}
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <Label htmlFor="score">Placar (opcional)</Label>
                                        <Input
                                            id="score"
                                            value={score}
                                            onChange={(e) => setScore(e.target.value)}
                                            placeholder="Ex: 6-4, 6-2"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Button
                                            onClick={handleFinishMatch}
                                            disabled={loading || !winner}
                                            className="w-full"
                                        >
                                            {loading ? 'Processando...' : 'Finalizar e Liquidar'}
                                        </Button>
                                        <Button
                                            onClick={() => {
                                                setSelectedMatch(null)
                                                setWinner('')
                                                setScore('')
                                            }}
                                            variant="outline"
                                            className="w-full"
                                        >
                                            Cancelar
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-gray-500 text-center py-4">
                                    Selecione uma partida para finalizar
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}

export default AdminMatches