import {useEffect, useState} from 'react'
import {Link, useParams} from 'react-router-dom'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {ArrowLeft, Crown, Trophy, Users, Wallet, CheckCircle, XCircle, Clock} from 'lucide-react'

const MatchReport = () => {
    const {matchId} = useParams()
    const [report, setReport] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchMatchReport()
    }, [matchId])

    const fetchMatchReport = async () => {
        try {
            const response = await fetch(`/api/admin/matches/${matchId}/report`, {
                credentials: 'include'
            })
            if (response.ok) {
                const data = await response.json()
                setReport(data)
            }
        } catch (error) {
            console.error('Error fetching match report:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return <div className="text-center py-8">Carregando relatório...</div>
    }

    if (!report) {
        return <div className="text-center py-8">Relatório não encontrado</div>
    }

    const {match, bets, summary} = report

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-6">
                <Link to="/admin/matches">
                    <Button variant="outline" size="sm" className="mb-4">
                        <ArrowLeft className="h-4 w-4 mr-2"/>
                        Voltar
                    </Button>
                </Link>

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Relatório da Partida</h1>
                        <p className="text-gray-600">
                            {match.player1_name} vs {match.player2_name} - {new Date(match.date).toLocaleDateString('pt-BR')}
                        </p>
                    </div>
                    <Badge variant={report.match.status === 'cancelled' ? 'destructive' : 'secondary'} className="text-lg px-4 py-2">
                        {report.match.status === 'cancelled' ? 'Cancelada' : 'Finalizada'}
                    </Badge>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <Card>
                    <CardContent className="p-4 text-center">
                        <Crown className="h-8 w-8 mx-auto text-yellow-600 mb-2"/>
                        <div className="text-sm text-gray-500">Vencedor</div>
                        <div className="font-bold text-lg">{summary.winner}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4 text-center">
                        <Wallet className="h-8 w-8 mx-auto text-green-600 mb-2"/>
                        <div className="text-sm text-gray-500">Total Apostado</div>
                        <div className="font-bold text-lg">R$ {summary.total_pool.toFixed(2)}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4 text-center">
                        <Users className="h-8 w-8 mx-auto text-blue-600 mb-2"/>
                        <div className="text-sm text-gray-500">Total Apostadores</div>
                        <div className="font-bold text-lg">{summary.total_bettors}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4 text-center">
                        <Trophy className="h-8 w-8 mx-auto text-purple-600 mb-2"/>
                        <div className="text-sm text-gray-500">Prêmio Distribuído</div>
                        <div className="font-bold text-lg">R$ {summary.total_winnings.toFixed(2)}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Betting Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Player 1 Bets */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            {match.player1_name}
                            {summary.winner === match.player1_name && <Crown className="h-5 w-5 ml-2 text-yellow-600"/>}
                        </CardTitle>
                        <CardDescription>
                            Apostas em {match.player1_name}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {bets.filter(bet => bet.player_name === match.player1_name).map(bet => (
                                <div key={bet.id} className={`p-3 rounded border ${
                                    bet.status === 'won' ? 'bg-green-50 border-green-200' : 
                                    bet.status === 'refunded' && bet.refund_status === 'failed' ? 'bg-red-50 border-red-200' :
                                    bet.status === 'refunded' ? 'bg-blue-50 border-blue-200' :
                                    'bg-red-50 border-red-200'
                                }`}>
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center space-x-2">
                                            <div>
                                                <div className="font-semibold">{bet.user_name}</div>
                                                <div className="text-sm text-gray-600">{bet.user_email}</div>
                                            </div>
                                            {bet.status === 'refunded' && bet.refund_status && (
                                                <div className="flex items-center" title={bet.refund_failure_reason || 'Reembolso enviado'}>
                                                    {bet.refund_status === 'succeeded' && <CheckCircle className="h-4 w-4 text-green-600" />}
                                                    {bet.refund_status === 'failed' && <XCircle className="h-4 w-4 text-red-600" />}
                                                    {bet.refund_status === 'pending' && <Clock className="h-4 w-4 text-yellow-600" />}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <div className="font-semibold">R$ {bet.amount.toFixed(2)}</div>
                                            {bet.status === 'won' && (
                                                <div className="text-sm text-green-600 font-medium">
                                                    Ganhou: R$ {bet.potential_return.toFixed(2)}
                                                </div>
                                            )}
                                            {bet.status === 'lost' && (
                                                <div className="text-sm text-red-600">Perdeu</div>
                                            )}
                                            {bet.status === 'refunded' && (
                                                <div className="text-sm text-blue-600">Reembolsado</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {bets.filter(bet => bet.player_name === match.player1_name).length === 0 && (
                                <div className="text-center py-4 text-gray-500">
                                    Nenhuma aposta neste jogador
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Player 2 Bets */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            {match.player2_name}
                            {summary.winner === match.player2_name && <Crown className="h-5 w-5 ml-2 text-yellow-600"/>}
                        </CardTitle>
                        <CardDescription>
                            Apostas em {match.player2_name}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {bets.filter(bet => bet.player_name === match.player2_name).map(bet => (
                                <div key={bet.id} className={`p-3 rounded border ${
                                    bet.status === 'won' ? 'bg-green-50 border-green-200' : 
                                    bet.status === 'refunded' && bet.refund_status === 'failed' ? 'bg-red-50 border-red-200' :
                                    bet.status === 'refunded' ? 'bg-blue-50 border-blue-200' :
                                    'bg-red-50 border-red-200'
                                }`}>
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center space-x-2">
                                            <div>
                                                <div className="font-semibold">{bet.user_name}</div>
                                                <div className="text-sm text-gray-600">{bet.user_email}</div>
                                            </div>
                                            {bet.status === 'refunded' && bet.refund_status && (
                                                <div className="flex items-center" title={bet.refund_failure_reason || 'Reembolso enviado'}>
                                                    {bet.refund_status === 'succeeded' && <CheckCircle className="h-4 w-4 text-green-600" />}
                                                    {bet.refund_status === 'failed' && <XCircle className="h-4 w-4 text-red-600" />}
                                                    {bet.refund_status === 'pending' && <Clock className="h-4 w-4 text-yellow-600" />}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <div className="font-semibold">R$ {bet.amount.toFixed(2)}</div>
                                            {bet.status === 'won' && (
                                                <div className="text-sm text-green-600 font-medium">
                                                    Ganhou: R$ {bet.potential_return.toFixed(2)}
                                                </div>
                                            )}
                                            {bet.status === 'lost' && (
                                                <div className="text-sm text-red-600">Perdeu</div>
                                            )}
                                            {bet.status === 'refunded' && (
                                                <div className="text-sm text-blue-600">Reembolsado</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {bets.filter(bet => bet.player_name === match.player2_name).length === 0 && (
                                <div className="text-center py-4 text-gray-500">
                                    Nenhuma aposta neste jogador
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

export default MatchReport