import {useEffect, useRef, useState} from 'react'
import {Link} from 'react-router-dom'
import {useAuth} from '@/contexts/AuthContext'
import {useToast} from '@/contexts/ToastContext'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Dialog, DialogContent} from '@/components/ui/dialog'
import {Badge} from '@/components/ui/badge'
import {CheckCircle, ChevronDown, Clock, Flame, Share2, Star, Trophy, Users, Wallet, QrCode, CreditCard} from 'lucide-react'
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
    const [paymentData, setPaymentData] = useState(null)
    const [showPayment, setShowPayment] = useState(false)
    const [activeBetsOpen, setActiveBetsOpen] = useState(false)
    const [availableMatchesOpen, setAvailableMatchesOpen] = useState(true)
    const [finishedMatchesOpen, setFinishedMatchesOpen] = useState(false)
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
            
            const response = await fetch(`/api/matches/?t=${Date.now()}`, { 
                headers,
                cache: 'no-cache'
            })
            
            if (!response.ok) {
                throw new Error('Erro ao carregar partidas')
            }
            
            const data = await response.json()
            
            // Deduplicate matches and aggregate user bets
            const matchMap = new Map()
            
            for (const match of (data.matches || [])) {
                if (!matchMap.has(match.schedule_id)) {
                    matchMap.set(match.schedule_id, {
                        ...match,
                        user_bet_players: match.user_bet_player ? [match.user_bet_player] : []
                    })
                } else {
                    // Match already exists, add this player to the bet list
                    const existing = matchMap.get(match.schedule_id)
                    if (match.user_bet_player && !existing.user_bet_players.includes(match.user_bet_player)) {
                        existing.user_bet_players.push(match.user_bet_player)
                    }
                }
            }
            
            setMatches(Array.from(matchMap.values()))
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

    const handlePlaceBet = async (paymentMethod = 'card') => {
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
            if (import.meta.env.VITE_PAYMENT_MOCK_ACTIVE === 'true') {
                // Mock payment - directly place bet
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
                        payment_intent_id: 'mock_' + paymentMethod + '_' + Date.now(),
                        payment_method: paymentMethod
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
                // Normal payment flow
                const paymentResponse = await fetch('/api/betting/create-payment-intent', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                    },
                    body: JSON.stringify({
                        schedule_id: selectedMatch.schedule_id,
                        player_name: selectedPlayer,
                        amount: parseFloat(betAmount),
                        payment_method: paymentMethod,
                        device_id: window.MP_DEVICE_SESSION_ID || ''
                    })
                })

                const paymentResult = await paymentResponse.json()

                if (!paymentResponse.ok) {
                    throw new Error(paymentResult.error)
                }

                // Stripe payment
                if (paymentResult.client_secret) {
                    setClientSecret(paymentResult.client_secret)
                }
                // Mercado Pago payment
                if (paymentResult.qr_code) {
                    setPaymentData(paymentResult)
                }
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
                    payment_intent_id: clientSecret ? clientSecret.split('_secret_')[0] : paymentData?.payment_id,
                    payment_method: paymentData?.payment_id ? 'pix' : 'card'
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
                setPaymentData(null)
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
                if (!shareRef.current) {
                    throw new Error('Elemento não encontrado')
                }

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
                    <div className="text-sm text-muted-foreground">
                        <div className="flex items-center space-x-4">
              <span className="flex items-center">
                <Clock className="h-4 w-4 mr-1"/>
                  {new Date(match.date + 'T00:00:00').toLocaleDateString('pt-BR')} às {match.start_time}
              </span>
                            <span className="flex items-center">
                <Wallet className="h-4 w-4 mr-1"/>
                Apostas: R$ {(Object.values(stats).reduce((sum, stat) => sum + (stat.total_amount || 0), 0)).toFixed(2)}
              </span>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        {stats[match.player1_name] && stats[match.player2_name] ? (
                            <>
                                <div className={`text-center p-3 rounded relative ${
                                    match.user_bet_players?.includes(match.player1_name)
                                        ? 'bg-amber-100 border-2 border-amber-400' 
                                        : 'bg-blue-50'
                                }`}>
                                    <div className="font-semibold flex items-center justify-center gap-1">
                                        {match.user_bet_players?.includes(match.player1_name) && <Star className="h-4 w-4 fill-amber-500 text-amber-500" />}
                                        {match.player1_name}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        Odds: {odds[match.player1_name] ? `${odds[match.player1_name]}x` : '⏳ Calculando'}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        Apostas: R$ {stats[match.player1_name]?.total_amount?.toFixed(2) || '0.00'}
                                    </div>
                                </div>
                                <div className={`text-center p-3 rounded relative ${
                                    match.user_bet_players?.includes(match.player2_name)
                                        ? 'bg-amber-100 border-2 border-amber-400' 
                                        : 'bg-green-50'
                                }`}>
                                    <div className="font-semibold flex items-center justify-center gap-1">
                                        {match.user_bet_players?.includes(match.player2_name) && <Star className="h-4 w-4 fill-amber-500 text-amber-500" />}
                                        {match.player2_name}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        Odds: {odds[match.player2_name] ? `${odds[match.player2_name]}x` : '⏳ Calculando'}
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

                    {match.betting_enabled && match.status === 'upcoming' && (
                        <div className="space-y-2">
                            <Button
                                onClick={() => {
                                    setBetAmount('')
                                    setSelectedPlayer('')
                                    setClientSecret(null)
                                    setShowPayment(false)
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
                                {match.user_has_bet ? 'Apostar Novamente' : 'Apostar nesta partida'}
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
                            <Button data-testid="my-bets-button" onClick={() => window.location.href = '/my-bets'} variant="outline" size="sm">
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
                    <div className="mb-8">
                        <button
                            onClick={() => setAvailableMatchesOpen(!availableMatchesOpen)}
                            className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-green-50 hover:from-blue-100 hover:to-green-100 rounded-lg transition-all duration-200 border border-blue-200 mb-4"
                        >
                            <div className="flex items-center gap-2">
                                <Flame className="h-5 w-5 text-blue-600"/>
                                <h2 className="text-xl font-semibold text-blue-900">Partidas Disponíveis</h2>
                                <Badge className="bg-blue-600 text-white">
                                    {matches.filter(m => m.status === 'upcoming').length}
                                </Badge>
                            </div>
                            <ChevronDown className={`h-5 w-5 text-blue-600 transition-transform duration-200 ${availableMatchesOpen ? 'rotate-180' : ''}`}/>
                        </button>
                        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${availableMatchesOpen ? 'max-h-[10000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                            {matches.filter(m => m.status === 'upcoming').length === 0 ? (
                                <Card>
                                    <CardContent className="text-center py-8">
                                        <Users className="h-12 w-12 mx-auto text-gray-400 mb-4"/>
                                        <p className="text-gray-500">Nenhuma partida disponível para apostas</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                matches.filter(m => m.status === 'upcoming').map(match => (
                                    <MatchCard key={match.schedule_id} match={match}/>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Finished Matches */}
                    <div>
                        <button
                            onClick={() => setFinishedMatchesOpen(!finishedMatchesOpen)}
                            className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-slate-50 hover:from-gray-100 hover:to-slate-100 rounded-lg transition-all duration-200 border border-gray-200 mb-4"
                        >
                            <div className="flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-gray-600"/>
                                <h2 className="text-xl font-semibold text-gray-900">Partidas Encerradas</h2>
                                <Badge className="bg-gray-600 text-white">
                                    {matches.filter(m => m.status === 'finished' || m.status === 'cancelled').length}
                                </Badge>
                            </div>
                            <ChevronDown className={`h-5 w-5 text-gray-600 transition-transform duration-200 ${finishedMatchesOpen ? 'rotate-180' : ''}`}/>
                        </button>
                        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${finishedMatchesOpen ? 'max-h-[10000px] opacity-100' : 'max-h-0 opacity-0'}`}>
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
                    </div>
                </div>

                {/* Betting Form */}
                <div>
                    <Card data-testid="betting-form">
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
                                    <div className="flex flex-col gap-3">
                                        <Link to="/login">
                                            <Button data-testid="login-link" className="w-full">Fazer Login</Button>
                                        </Link>
                                        <Link to="/signup">
                                            <Button data-testid="signup-link" variant="outline" className="w-full">Criar Conta</Button>
                                        </Link>
                                    </div>
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

                                    {!showPayment && (
                                        <div>
                                            <Label>Método de Pagamento</Label>
                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                                <Button
                                                    variant="outline"
                                                    className="flex flex-col items-center justify-center py-6 gap-2 h-24"
                                                    onClick={() => handlePlaceBet('pix')}
                                                    disabled={loading || !selectedPlayer || !betAmount}
                                                >
                                                    <QrCode className="h-8 w-8" />
                                                    <span className="text-sm font-medium">PIX</span>
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="flex flex-col items-center justify-center py-6 gap-2 h-24"
                                                    onClick={() => handlePlaceBet('card')}
                                                    disabled={loading || !selectedPlayer || !betAmount}
                                                >
                                                    <CreditCard className="h-8 w-8" />
                                                    <span className="text-sm font-medium">Cartão</span>
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        {showPayment && (
                                            <PaymentForm
                                                paymentData={paymentData}
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
                                                setPaymentData(null)
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