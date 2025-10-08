import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Trophy, Clock, Users, DollarSign, Share2, Wallet } from 'lucide-react'
import ShareableMatchCard from './ShareableMatchCard'
import html2canvas from 'html2canvas'

const BettingDashboard = () => {
  const [matches, setMatches] = useState([])
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [betAmount, setBetAmount] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [loading, setLoading] = useState(false)
  const { isAuthenticated, user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    fetchMatches()
  }, [])

  const fetchMatches = async () => {
    try {
      const response = await fetch('/api/matches/')
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
      // Create payment intent
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

      // Place bet with payment intent ID
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
          payment_intent_id: paymentData.payment_intent_id
        })
      })

      const betData = await betResponse.json()

      if (betResponse.ok) {
        toast({
          title: "Aposta realizada!",
          description: `Aposta de R$ ${betAmount} em ${selectedPlayer}`
        })
        setBetAmount('')
        setSelectedPlayer('')
        setSelectedMatch(null)
        fetchMatches()
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
      setLoading(false)
    }
  }

  const FinishedMatchCard = ({ match }) => {
    const [odds, setOdds] = useState({})
    const [stats, setStats] = useState({})

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

    return (
      <Card className="mb-3">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div>
                <div className="font-semibold">
                  {match.player1_name} vs {match.player2_name}
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(match.date + 'T00:00:00').toLocaleDateString('pt-BR')} às {match.start_time}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="text-center">
                <div className="text-sm text-gray-500">Total Apostas</div>
                <div className="font-semibold flex items-center">
                  <Wallet className="h-4 w-4 mr-1" />
                  R$ {Object.values(stats).reduce((sum, stat) => sum + (stat.total_amount || 0), 0).toFixed(2)}
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-sm text-gray-500">Apostadores</div>
                <div className="font-semibold flex items-center">
                  <Users className="h-4 w-4 mr-1" />
                  {Object.values(stats).reduce((sum, stat) => sum + stat.bet_count, 0)}
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-sm text-gray-500">Status</div>
                <div className="font-semibold text-gray-600">
                  {match.status === 'cancelled' ? 'Cancelada' : 'Finalizada'}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const MatchCard = ({ match }) => {
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
          scale: 2
        })
        
        canvas.toBlob(async (blob) => {
          if (navigator.share) {
            try {
              const file = new File([blob], 'match.png', { type: 'image/png' })
              await navigator.share({
                files: [file],
                title: `${match.player1_name} vs ${match.player2_name}`,
                text: 'Confira esta partida no LAPEN Betting!'
              })
            } catch (shareError) {
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
        })
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
            <Trophy className="h-5 w-5 text-yellow-500" />
          </CardTitle>
          <CardDescription>
            <div className="flex items-center space-x-4 text-sm">
              <span className="flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                {new Date(match.date + 'T00:00:00').toLocaleDateString('pt-BR')} às {match.start_time}
              </span>
              <span className="flex items-center">
                <Wallet className="h-4 w-4 mr-1" />
                Apostas: R$ {(Object.values(stats).reduce((sum, stat) => sum + (stat.total_amount || 0), 0)).toFixed(2)}
              </span>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
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
          </div>
          
          {match.betting_enabled && match.status === 'upcoming' && (
            <div className="space-y-2">
              <Button 
                onClick={() => setSelectedMatch(match)}
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
                  <Share2 className="h-4 w-4 mr-2" />
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
                    <Share2 className="h-4 w-4 mr-2" />
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
                        <Share2 className="h-4 w-4 mr-2" />
                        {isSharing ? 'Compartilhando...' : 'Compartilhar Imagem'}
                      </Button>
                    </DialogContent>
                  </Dialog>
                </>
              )}
              <div className="hidden">
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">Tigrinho LAPEN 🐯</h1>
            <p className="text-gray-600">Aposte nas partidas de tênis da LAPEN</p>
          </div>
          {isAuthenticated && (
            <Button onClick={() => window.location.href = '/my-bets'} variant="outline">
              Minhas Apostas
            </Button>
          )}
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
                <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">Nenhuma partida disponível para apostas</p>
              </CardContent>
            </Card>
          ) : (
            <div className="mb-8">
              {matches.filter(m => m.status === 'upcoming').map(match => (
                <MatchCard key={match.schedule_id} match={match} />
              ))}
            </div>
          )}
          
          {/* Finished Matches */}
          <h2 className="text-xl font-semibold mb-4">Partidas Encerradas</h2>
          {matches.filter(m => m.status === 'finished' || m.status === 'cancelled').length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Trophy className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">Nenhuma partida encerrada</p>
              </CardContent>
            </Card>
          ) : (
            matches.filter(m => m.status === 'finished' || m.status === 'cancelled').map(match => (
              <FinishedMatchCard key={match.schedule_id} match={match} />
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
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Button
                      onClick={handlePlaceBet}
                      disabled={loading || !selectedPlayer || !betAmount}
                      className="w-full"
                    >
                      {loading ? 'Processando...' : 'Confirmar Aposta'}
                    </Button>
                    <Button
                      onClick={() => {
                        setSelectedMatch(null)
                        setBetAmount('')
                        setSelectedPlayer('')
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