import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { History, Trophy, DollarSign, Calendar, ArrowLeft, Wallet, TrendingUp, Share2 } from 'lucide-react'
import ShareableMatchCard from './ShareableMatchCard'
import html2canvas from 'html2canvas'

const MyBets = () => {
  const [bets, setBets] = useState([])
  const [loading, setLoading] = useState(true)
  const { isAuthenticated } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    if (isAuthenticated) {
      fetchMyBets()
    }
  }, [isAuthenticated])

  const fetchMyBets = async () => {
    try {
      const response = await fetch('/api/betting/my-bets', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })
      
      const data = await response.json()
      if (response.ok) {
        setBets(data.bets || [])
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar suas apostas",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      'active': { label: 'Ativa', variant: 'default' },
      'won': { label: 'Ganhou', className: 'bg-green-100 text-green-800 hover:bg-green-100' },
      'lost': { label: 'Perdeu', variant: 'destructive' },
      'refunded': { label: 'Reembolsada', variant: 'secondary' }
    }
    
    const config = statusMap[status] || { label: status, variant: 'default' }
    return config.className ? 
      <Badge className={config.className}>{config.label}</Badge> :
      <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getMatchStatusBadge = (status) => {
    const statusMap = {
      'upcoming': { label: 'Agendada', variant: 'outline' },
      'live': { label: 'Ao Vivo', variant: 'default' },
      'finished': { label: 'Finalizada', variant: 'secondary' },
      'cancelled': { label: 'Cancelada', variant: 'destructive' }
    }
    
    const config = statusMap[status] || { label: status, variant: 'outline' }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="text-center py-8">
            <History className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Login Necessário</h2>
            <p className="text-gray-500 mb-4">Faça login para ver suas apostas</p>
            <Button onClick={() => window.location.href = '/login'}>
              Fazer Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Carregando suas apostas...</div>
      </div>
    )
  }

  const BetCard = ({ bet }) => {
    const shareRef = useRef(null)
    const [isSharing, setIsSharing] = useState(false)
    const [showShareDialog, setShowShareDialog] = useState(false)
    const [matchOdds, setMatchOdds] = useState({ odds: {}, stats: {} })

    useEffect(() => {
      if (bet.match.match_id && bet.match.status === 'upcoming') {
        fetch(`/api/betting/match/${bet.match.match_id}/bets`)
          .then(res => res.json())
          .then(data => setMatchOdds({ odds: data.odds || {}, stats: data.betting_stats || {} }))
      }
    }, [bet.match.match_id, bet.match.status])

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
              const file = new File([blob], 'match.png', { type: 'image/png' })
              try {
                await navigator.share({ files: [file], title: `${bet.match.player1_name} vs ${bet.match.player2_name}` })
              } catch {
                await navigator.share({ title: `${bet.match.player1_name} vs ${bet.match.player2_name}`, url: window.location.href })
              }
            }
          } catch {
            const url = canvas.toDataURL()
            const a = document.createElement('a')
            a.href = url
            a.download = `${bet.match.player1_name}_vs_${bet.match.player2_name}.png`
            a.click()
          }
        } else {
          const url = canvas.toDataURL()
          const a = document.createElement('a')
          a.href = url
          a.download = `${bet.match.player1_name}_vs_${bet.match.player2_name}.png`
          a.click()
        }
      } catch (error) {
        toast({ title: "Erro", description: "Erro ao compartilhar", variant: "destructive" })
      } finally {
        setIsSharing(false)
      }
    }

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

    return (
      <Card key={bet.id} className="relative">
        <CardHeader>
          <div>
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center space-x-2">
                <Trophy className="h-5 w-5" />
              </div>
              <div className="flex space-x-2">
                {getStatusBadge(bet.status)}
                {getMatchStatusBadge(bet.match.status)}
              </div>
            </div>
            <CardTitle className="mb-2">
              {bet.match.player1_name} vs {bet.match.player2_name}
            </CardTitle>
            <CardDescription>
              <div className="flex items-center space-x-4">
                <span className="flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  {bet.match.date} às {bet.match.start_time}
                </span>
                <span>{bet.match.court_name}</span>
              </div>
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-500">Jogador Apostado</div>
              <div className="font-semibold">{bet.player_name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Valor Apostado</div>
              <div className="font-semibold flex items-center">
                <Wallet className="h-4 w-4 mr-1" />
                R$ {bet.amount.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Retorno Potencial</div>
              <div className="font-semibold flex items-center">
                <TrendingUp className="h-4 w-4 mr-1" />
                R$ {bet.potential_return.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Data da Aposta</div>
              <div className="font-semibold">
                {new Date(bet.created_at).toLocaleDateString('pt-BR')}
              </div>
            </div>
          </div>
        </CardContent>
        {bet.match.status === 'upcoming' && (
          <>
            <Button
              onClick={isMobile ? handleShare : () => setShowShareDialog(true)}
              disabled={isSharing}
              variant="ghost"
              size="icon"
              className="absolute bottom-3 right-3 h-8 w-8"
            >
              <Share2 className="h-4 w-4" />
            </Button>
            {!isMobile && (
              <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
                <DialogContent className="max-w-md">
                  <ShareableMatchCard
                    ref={shareRef}
                    match={{
                      ...bet.match,
                      schedule_id: bet.match.id,
                      match_id: bet.match.match_id
                    }}
                    odds={matchOdds.odds}
                    stats={matchOdds.stats}
                  />
                  <Button onClick={handleShare} disabled={isSharing} className="w-full mt-4">
                    <Share2 className="h-4 w-4 mr-2" />
                    {isSharing ? 'Compartilhando...' : 'Compartilhar Imagem'}
                  </Button>
                </DialogContent>
              </Dialog>
            )}
            <div style={{ position: 'absolute', left: '-9999px', top: '0' }}>
              <ShareableMatchCard
                ref={shareRef}
                match={{
                  ...bet.match,
                  schedule_id: bet.match.id,
                  match_id: bet.match.match_id
                }}
                odds={matchOdds.odds}
                stats={matchOdds.stats}
              />
            </div>
          </>
        )}
      </Card>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Link to="/betting">
          <Button variant="outline" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Apostas
          </Button>
        </Link>
        <h1 className="text-3xl font-bold mb-2">Minhas Apostas</h1>
        <p className="text-gray-600">Histórico das suas apostas</p>
      </div>

      {bets.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <History className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Nenhuma aposta encontrada</h2>
            <p className="text-gray-500 mb-4">Você ainda não fez nenhuma aposta</p>
            <Button onClick={() => window.location.href = '/betting'}>
              Fazer Primeira Aposta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {bets.map(bet => <BetCard key={bet.id} bet={bet} />)}
        </div>
      )}
    </div>
  )
}

export default MyBets