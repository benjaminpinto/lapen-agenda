import {useEffect, useRef, useState} from 'react'
import {useAuth} from '@/contexts/AuthContext'
import {useToast} from '@/contexts/ToastContext'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Dialog, DialogContent} from '@/components/ui/dialog'
import {CheckCircle, Clock, Share2, Trophy, Users, Wallet} from 'lucide-react'
import ShareableMatchCard from './ShareableMatchCard'
import FinishedMatchCard from '../shared/FinishedMatchCard'
import PaymentForm from './PaymentForm'
import html2canvas from 'html2canvas'

const BettingDashboard = () => {
    const [matches, setMatches] = useState([])
    const [selectedMatch, setSelectedMatch] = useState(null)
    const [betAmount, setBetAmount] = useState('')
    const [selectedPlayer, setSelectedPlayer] = useState('')
    const [loading, setLoading] = useState(false)
    const [clientSecret, setClientSecret] = useState(null)
    const [showPayment, setShowPayment] = useState(false)
    const {isAuthenticated, user} = useAuth()
    const {toast} = useToast()

    useEffect(() => {
        fetchMatches()
    }, [])

    const fetchMatches = async () => {
        try {
            const headers = {}
            const token = localStorage.getItem('auth_token')
            if (token) {
                headers['Authorization'] = `Bearer ${token}`
            }
            
            const response = await fetch('/api/matches/', { headers })
            const data = await response.json()
            setMatches(data.matches || [])
        } catch (error) {
            toast({
                title: "Erro",
                description: "Erro ao carregar partidas",
                variant: "destructive"
            })
        }
    }

    const fetchMatchOdds = async (matchId) => {
        try {
            const response = await fetch(`/api/betting/match/${matchId}/bets`)
            const data = await response.json()
            return data
        } catch (error) {
            return null
        }
    }

    const handlePlaceBet = async () => {
        if (!isAuthenticated) {
            toast({
                title: "Login necessário",
                description: "Faça login para apostar",
                variant: "destructive"
            })
            return
        }

        if (!selectedMatch || !selectedPlayer || !betAmount) {
            toast({
                title: "Erro",
                description: "Preencha todos os campos",
                variant: "destructive"
            })
            return
        }

        setLoading(true)

        try {
            // Check if mock mode is active
            if (import.meta.env.VITE_STRIPE_MOCK_ACTIVE === 'true') {
                // Mock payment - directly place bet without Stripe
                const betResponse = await fetch('/api/betting/place-bet', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                    },
                    body: JSON.stringify({
                        schedule_id: selectedMatch.schedule_id,
                        player_name: selectedPlayer,
                        amount: parseFloat(betAmount),
                        payment_intent_id: 'mock_pi_' + Date.now()
                    })
                })

                const betData = await betResponse.json()

                if (betResponse.ok) {
                    toast({
                        title: "Aposta realizada! [Modo Teste]",
                        description: `Aposta de R$ ${betAmount} em ${selectedPlayer}`
                    })
                    setBetAmount('')
                    setSelectedPlayer('')
                    setSelectedMatch(null)
                    fetchMatches()
                    setTimeout(() => {
                        window.location.href = '/my-bets'
                    }, 1500)
                } else {
                    throw new Error(betData.error)
                }
            } else {
                // Normal Stripe payment flow
                const paymentResponse = await fetch('/api/betting/create-payment-intent', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                    },
                    body: JSON.stringify({
                        schedule_id: selectedMatch.schedule_id,
                        player_name: selectedPlayer,
                        amount: parseFloat(betAmount)
                    })
                })

                const paymentData = await paymentResponse.json()

                if (!paymentResponse.ok) {
                    throw new Error(paymentData.error)
                }

                setClientSecret(paymentData.client_secret)
                setShowPayment(true)
            }

        } catch (error) {
            toast({
                title: "Erro",
                description: error.message,
                variant: "destructive"
            })
        } finally {
            setLoading(false)
        }
    }

    const handlePaymentSuccess = async (setPaymentLoading, currentBetAmount, currentSelectedPlayer, currentSelectedMatch) => {
        try {
            const betResponse = await fetch('/api/betting/place-bet', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({
                    schedule_id: currentSelectedMatch.schedule_id,
                    player_name: currentSelectedPlayer,
                    amount: parseFloat(currentBetAmount),
                    payment_intent_id: clientSecret.split('_secret_')[0]
                })
            })

            const betData = await betResponse.json()

            if (betResponse.ok) {
                toast({
                    title: "Aposta realizada!",
                    description: `Aposta de R$ ${currentBetAmount} em ${currentSelectedPlayer}`
                })
                setBetAmount('')
                setSelectedPlayer('')
                setSelectedMatch(null)
                setClientSecret(null)
                setShowPayment(false)
                fetchMatches()
                setTimeout(() => {
                    window.location.href = '/my-bets'
                }, 1500)
            } else {
                throw new Error(betData.error)
            }

        } catch (error) {
            toast({
                title: "Erro",
                description: error.message,
                variant: "destructive"
            })
        } finally {
            setPaymentLoading(false)
        }
    }

    const handlePaymentError = (error) => {
        toast({
            title: "Erro no pagamento",
            description: error,
            variant: "destructive"
        })
    }



    const MatchCard = ({match}) => {
        const [odds, setOdds] = useState({})
        const [stats, setStats] = useState({})
        const shareRef = useRef(null)
        const [isSharing, setIsSharing] = useState(false)
        const [showShareDialog, setShowShareDialog] = useState(false)

        useEffect(() => {
            if (match.match_id) {
                fetchMatchOdds(match.match_id).then(data => {
                    if (data) {
                        setOdds(data.odds || {})
                        setStats(data.betting_stats || {})
                    }
                })
            }
        }, [match.match_id])

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

        const handleShare = async () => {
            setIsSharing(true)

            try {
                const canvas = await html2canvas(shareRef.current, {
                    backgroundColor: '#ffffff',
                    scale: window.devicePixelRatio || 1,
                    useCORS: true,
                    allowTaint: true
                })

                if (navigator.share) {
                    try {
                        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
                        if (blob && blob.size > 0) {
                            const file = new File([blob], 'match.png', {type: 'image/png'})
                            // Try sharing with file first
                            try {
                                await navigator.share({
                                    files: [file],
                                    title: `${match.player1_name} vs ${match.player2_name}`,
                                    text: 'Confira esta partida no LAPEN Betting!'
                                })
                            } catch (fileShareError) {
                                // If file sharing fails, share text only
                                await navigator.share({
                                    title: `${match.player1_name} vs ${match.player2_name}`,
                                    text: `Confira esta partida no LAPEN Betting! ${match.player1_name} vs ${match.player2_name}`,
                                    url: window.location.href
                                })
                            }
                        } else {
                            // Share text only if blob is empty
                            await navigator.share({
                                title: `${match.player1_name} vs ${match.player2_name}`,
                                text: `Confira esta partida no LAPEN Betting! ${match.player1_name} vs ${match.player2_name}`,
                                url: window.location.href
                            })
                        }
                    } catch (shareError) {
                        console.log('Share failed, falling back to download')
                        // Fallback: download image
                        const url = canvas.toDataURL()
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `${match.player1_name}_vs_${match.player2_name}.png`
                        a.click()
                    }
                } else {
                    // Fallback: download image
                    const url = canvas.toDataURL()
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `${match.player1_name}_vs_${match.player2_name}.png`
                    a.click()
                }
            } catch (error) {
                console.error('Error sharing:', error)
                toast({
                    title: "Erro",
                    description: "Erro ao compartilhar imagem",
                    variant: "destructive"
                })
            } finally {
                setIsSharing(false)
            }
        }

        return (
            <Card className="mb-4">
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>{match.player1_name} vs {match.player2_name}</span>
                        <Trophy className="h-5 w-5 text-yellow-500"/>
                    </CardTitle>
                    <CardDescription>
                        <div className="flex items-center space-x-4 text-sm">
              <span className="flex items-center">
                <Clock className="h-4 w-4 mr-1"/>
                  {new Date(match.date + 'T00:00:00').toLocaleDateString('pt-BR')} às {match.start_time}
              </span>
                            <span className="flex items-center">
                <Wallet className="h-4 w-4 mr-1"/>
                Apostas: R$ {(Object.values(stats).reduce((sum, stat) => sum + (stat.total_amount || 0), 0)).toFixed(2)}
              </span>
                        </div>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        {stats[match.player1_name] && stats[match.player2_name] ? (
                            <>
                                <div className="text-center p-3 bg-blue-50 rounded">
                                    <div className="font-semibold">{match.player1_name}</div>
                                    <div className="text-sm text-gray-600">
                                        Odds: {odds[match.player1_name] ? `${odds[match.player1_name]}x` : 'N/A'}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        Apostas: R$ {stats[match.player1_name]?.total_amount?.toFixed(2) || '0.00'}
                                    </div>
                                </div>
                                <div className="text-center p-3 bg-green-50 rounded">
                                    <div className="font-semibold">{match.player2_name}</div>
                                    <div className="text-sm text-gray-600">
                                        Odds: {odds[match.player2_name] ? `${odds[match.player2_name]}x` : 'N/A'}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        Apostas: R$ {stats[match.player2_name]?.total_amount?.toFixed(2) || '0.00'}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="col-span-2 text-center p-4 bg-yellow-50 rounded border border-yellow-200">
                                <div className="text-sm text-yellow-700 font-medium mb-2">
                                    📊 Odds em Cálculo
                                </div>
                                <div className="text-xs text-yellow-600">
                                    As odds serão calculadas quando houver apostas para ambos os jogadores
                                </div>
                                <div className="mt-2 text-xs text-gray-500">
                                    {match.player1_name}:
                                    R$ {stats[match.player1_name]?.total_amount?.toFixed(2) || '0.00'} •
                                    {match.player2_name}:
                                    R$ {stats[match.player2_name]?.total_amount?.toFixed(2) || '0.00'}
                                </div>
                            </div>
                        )}
                    </div>

                    {match.betting_enabled && match.status === 'upcoming' && !match.user_has_bet && (
                        <div className="space-y-2">
                            <Button
                                onClick={() => {
                                    setSelectedMatch(match)
                                    // Scroll to betting form
                                    setTimeout(() => {
                                        document.querySelector('.lg\\:col-span-2')?.nextElementSibling?.scrollIntoView({
                                            behavior: 'smooth',
                                            block: 'start'
                                        })
                                    }, 100)
                                }}
                                className="w-full"
                                variant="outline"
                            >
                                Apostar nesta partida
                            </Button>

                            {isMobile ? (
                                <Button
                                    onClick={handleShare}
                                    disabled={isSharing}
                                    variant="ghost"
                                    size="sm"
                                    className="w-full"
                                >
                                    <Share2 className="h-4 w-4 mr-2"/>
                                    {isSharing ? 'Compartilhando...' : 'Compartilhar'}
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        onClick={() => setShowShareDialog(true)}
                                        variant="ghost"
                                        size="sm"
                                        className="w-full"
                                    >
                                        <Share2 className="h-4 w-4 mr-2"/>
                                        Compartilhar
                                    </Button>
                                    <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
                                        <DialogContent className="max-w-md">
                                            <ShareableMatchCard
                                                ref={shareRef}
                                                match={match}
                                                odds={odds}
                                                stats={stats}
                                            />
                                            <Button
                                                onClick={handleShare}
                                                disabled={isSharing}
                                                className="w-full mt-4"
                                            >
                                                <Share2 className="h-4 w-4 mr-2"/>
                                                {isSharing ? 'Compartilhando...' : 'Compartilhar Imagem'}
                                            </Button>
                                        </DialogContent>
                                    </Dialog>
                                </>
                            )}
                            <div style={{position: 'absolute', left: '-9999px', top: '0'}}>
                                <ShareableMatchCard
                                    ref={shareRef}
                                    match={match}
                                    odds={odds}
                                    stats={stats}
                                />
                            </div>
                        </div>
                    )}
                    
                    {match.user_has_bet && (
                        <div className="text-center p-3 bg-green-50 rounded border border-green-200">
                            <div className="text-sm text-green-700 font-medium">
                                ✅ Você já tem uma aposta nesta partida
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-8">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Tigrinho LAPEN 🐯</h1>
                    <div className="flex justify-between items-center">
                        <p className="text-gray-600">Aposte nas partidas de tênis da LAPEN</p>
                        {isAuthenticated && (
                            <Button onClick={() => window.location.href = '/my-bets'} variant="outline" size="sm">
                                Minhas Apostas
                            </Button>
                            )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Matches List */}
                <div className="lg:col-span-2">
                    {/* Available Matches */}
                    <h2 className="text-xl font-semibold mb-4">Partidas Disponíveis</h2>
                    {matches.filter(m => m.status === 'upcoming').length === 0 ? (
                        <Card className="mb-8">
                            <CardContent className="text-center py-8">
                                <Users className="h-12 w-12 mx-auto text-gray-400 mb-4"/>
                                <p className="text-gray-500">Nenhuma partida disponível para apostas</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="mb-8">
                            {matches.filter(m => m.status === 'upcoming').map(match => (
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
                        matches.filter(m => m.status === 'finished' || m.status === 'cancelled')
                            .sort((a, b) => new Date(b.date) - new Date(a.date))
                            .map(match => (
                                <FinishedMatchCard key={match.schedule_id} match={match}/>
                            ))
                    )}
                </div>

                {/* Betting Form */}
                <div>
                    <Card>
                        <CardHeader>
                            <CardTitle>Fazer Aposta</CardTitle>
                            <CardDescription>
                                {isAuthenticated ? 'Selecione uma partida para apostar' : 'Faça login para apostar'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {!isAuthenticated ? (
                                <div className="text-center py-4">
                                    <p className="text-gray-500 mb-4">Você precisa estar logado para apostar</p>
                                    <Button onClick={() => window.location.href = '/login'}>
                                        Fazer Login
                                    </Button>
                                </div>
                            ) : selectedMatch ? (
                                <div className="space-y-4">
                                    <div>
                                        <Label>Partida Selecionada</Label>
                                        <p className="text-sm font-medium">
                                            {selectedMatch.player1_name} vs {selectedMatch.player2_name}
                                        </p>
                                    </div>

                                    <div>
                                        <Label>Escolha o Jogador</Label>
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            {showPayment ? (
                                                <>
                                                    <div className={`p-2 rounded text-center text-sm font-medium border ${
                                                        selectedPlayer === selectedMatch.player1_name 
                                                            ? 'bg-slate-600 text-white border-slate-600'
                                                            : 'bg-gray-100 text-gray-500 border-gray-300'
                                                    }`}>
                                                        {selectedPlayer === selectedMatch.player1_name && "✓ "}{selectedMatch.player1_name}
                                                    </div>
                                                    <div className={`p-2 rounded text-center text-sm font-medium border ${
                                                        selectedPlayer === selectedMatch.player2_name 
                                                            ? 'bg-slate-600 text-white border-slate-600'
                                                            : 'bg-gray-100 text-gray-500 border-gray-300'
                                                    }`}>
                                                        {selectedPlayer === selectedMatch.player2_name && "✓ "}{selectedMatch.player2_name}
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <Button
                                                        variant={selectedPlayer === selectedMatch.player1_name ? "default" : "outline"}
                                                        onClick={() => setSelectedPlayer(selectedMatch.player1_name)}
                                                        size="sm"
                                                    >
                                                        {selectedMatch.player1_name}
                                                    </Button>
                                                    <Button
                                                        variant={selectedPlayer === selectedMatch.player2_name ? "default" : "outline"}
                                                        onClick={() => setSelectedPlayer(selectedMatch.player2_name)}
                                                        size="sm"
                                                    >
                                                        {selectedMatch.player2_name}
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="betAmount">Valor da Aposta (R$)</Label>
                                        <Input
                                            id="betAmount"
                                            type="number"
                                            min="1"
                                            step="0.01"
                                            value={betAmount}
                                            onChange={(e) => setBetAmount(e.target.value)}
                                            placeholder="0.00"
                                            disabled={showPayment}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        {!showPayment ? (
                                            <Button
                                                onClick={handlePlaceBet}
                                                disabled={loading || !selectedPlayer || !betAmount}
                                                className="w-full"
                                            >
                                                {loading ? 'Processando...' : 'Prosseguir para Pagamento'}
                                            </Button>
                                        ) : (
                                            <PaymentForm
                                                clientSecret={clientSecret}
                                                onSuccess={handlePaymentSuccess}
                                                onError={handlePaymentError}
                                                betAmount={betAmount}
                                                selectedPlayer={selectedPlayer}
                                                selectedMatch={selectedMatch}
                                            />
                                        )}
                                        <Button
                                            onClick={() => {
                                                setSelectedMatch(null)
                                                setBetAmount('')
                                                setSelectedPlayer('')
                                                setClientSecret(null)
                                                setShowPayment(false)
                                            }}
                                            variant="outline"
                                            className="w-full"
                                        >
                                            {showPayment ? 'Cancelar Pagamento' : 'Cancelar'}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-gray-500 text-center py-4">
                                    Selecione uma partida para começar
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
)
}

export default BettingDashboard