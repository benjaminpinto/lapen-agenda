import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Download, TrendingUp, Users, Wallet, Trophy, Calendar, CheckCircle, XCircle, Clock, DollarSign, Target, Activity } from 'lucide-react'

const AdminReports = () => {
    const [reports, setReports] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchReports()
    }, [])

    const fetchReports = async () => {
        try {
            const response = await fetch('/api/admin/matches/reports', {
                credentials: 'include'
            })
            if (response.ok) {
                const data = await response.json()
                setReports(data)
            }
        } catch (error) {
            console.error('Error fetching reports:', error)
        } finally {
            setLoading(false)
        }
    }

    const exportReport = () => {
        if (!reports) return
        
        const data = {
            generated_at: new Date().toISOString(),
            match_statistics: reports.match_statistics,
            bet_statistics: reports.bet_statistics
        }
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `betting-report-${new Date().toISOString().split('T')[0]}.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    if (loading) {
        return <div className="text-center py-8">Carregando relatórios...</div>
    }

    if (!reports) {
        return <div className="text-center py-8">Erro ao carregar relatórios</div>
    }

    const { match_statistics, bet_statistics } = reports

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-6">
                <Link to="/admin/matches">
                    <Button variant="outline" size="sm" className="mb-4">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Voltar
                    </Button>
                </Link>

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Relatórios de Apostas</h1>
                        <p className="text-gray-600">Estatísticas e análises financeiras</p>
                    </div>
                    <Button onClick={exportReport} variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Exportar
                    </Button>
                </div>
            </div>

            {/* Match Statistics */}
            <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">Estatísticas de Partidas</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {Object.entries(match_statistics).map(([status, stats]) => {
                        const statusLabels = {
                            upcoming: 'Agendadas',
                            finished: 'Finalizadas',
                            cancelled: 'Canceladas',
                            live: 'Ao Vivo'
                        }
                        const statusIcons = {
                            upcoming: Calendar,
                            finished: CheckCircle,
                            cancelled: XCircle,
                            live: Clock
                        }
                        const statusColors = {
                            upcoming: 'text-blue-600',
                            finished: 'text-green-600',
                            cancelled: 'text-red-600',
                            live: 'text-orange-600'
                        }
                        const IconComponent = statusIcons[status] || Trophy
                        return (
                            <Card key={status}>
                                <CardContent className="p-4 text-center">
                                    <IconComponent className={`h-8 w-8 mx-auto ${statusColors[status] || 'text-blue-600'} mb-2`} />
                                    <div className="text-sm text-gray-500">{statusLabels[status] || status}</div>
                                    <div className="font-bold text-lg">{stats.count}</div>
                                    <div className="text-sm text-gray-600">
                                        R$ {stats.total_pool.toFixed(2)}
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            </div>

            {/* Bet Statistics */}
            <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">Estatísticas de Apostas</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {Object.entries(bet_statistics).map(([status, stats]) => {
                        const statusLabels = {
                            active: 'Ativas',
                            won: 'Ganhas',
                            lost: 'Perdidas',
                            refunded: 'Reembolsadas'
                        }
                        const betIcons = {
                            active: Clock,
                            won: Trophy,
                            lost: XCircle,
                            refunded: DollarSign
                        }
                        const betColors = {
                            active: 'text-blue-600',
                            won: 'text-yellow-600',
                            lost: 'text-red-600',
                            refunded: 'text-gray-600'
                        }
                        const BetIconComponent = betIcons[status] || Wallet
                        return (
                            <Card key={status}>
                                <CardContent className="p-4 text-center">
                                    <BetIconComponent className={`h-8 w-8 mx-auto ${betColors[status] || 'text-green-600'} mb-2`} />
                                    <div className="text-sm text-gray-500">{statusLabels[status] || status}</div>
                                    <div className="font-bold text-lg">{stats.count}</div>
                                    <div className="text-sm text-gray-600">
                                        R$ {stats.total_amount.toFixed(2)}
                                    </div>
                                    {status === 'won' && stats.total_returns > 0 && (
                                        <div className="text-xs text-green-600">
                                            Retorno: R$ {stats.total_returns.toFixed(2)}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <DollarSign className="h-5 w-5 mr-2" />
                            Resumo Financeiro
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span>Total Apostado (Finalizadas):</span>
                                <span className="font-semibold">
                                    R$ {((bet_statistics.won?.total_amount || 0) + (bet_statistics.lost?.total_amount || 0)).toFixed(2)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>Total Pago aos Vencedores:</span>
                                <span className="font-semibold text-green-600">
                                    R$ {(bet_statistics.won?.total_returns || 0).toFixed(2)}
                                </span>
                            </div>
                            <div className="flex justify-between border-t pt-2">
                                <span>Receita da Casa (20%):</span>
                                <span className="font-semibold text-blue-600">
                                    R$ {(((bet_statistics.won?.total_amount || 0) + (bet_statistics.lost?.total_amount || 0)) * 0.2).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <Activity className="h-5 w-5 mr-2" />
                            Atividade de Usuários
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span>Apostas Finalizadas:</span>
                                <span className="font-semibold">
                                    {(bet_statistics.won?.count || 0) + (bet_statistics.lost?.count || 0)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>Apostas Ativas:</span>
                                <span className="font-semibold text-blue-600">
                                    {bet_statistics.active?.count || 0}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>Taxa de Vitória:</span>
                                <span className="font-semibold text-green-600">
                                    {bet_statistics.won && bet_statistics.lost ? 
                                        ((bet_statistics.won.count / (bet_statistics.won.count + bet_statistics.lost.count)) * 100).toFixed(1) + '%' 
                                        : '0%'}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

export default AdminReports