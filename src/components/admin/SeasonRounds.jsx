import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useToast } from '@/contexts/ToastContext'
import { ArrowLeft } from 'lucide-react'
import WOForm from './WOForm'
import MatchResultForm from './MatchResultForm'

const SeasonRounds = () => {
  const navigate = useNavigate()
  const { year } = useParams()
  const [rounds, setRounds] = useState([])
  const [matches, setMatches] = useState([])
  const [selectedRound, setSelectedRound] = useState(null)
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [showResultForm, setShowResultForm] = useState(false)
  const [newRound, setNewRound] = useState({ month: '' })
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [roundToCancel, setRoundToCancel] = useState(null)
  const { toast } = useToast()

  const months = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' }
  ]

  useEffect(() => {
    if (year) fetchRounds()
  }, [year])

  const fetchRounds = async () => {
    try {
      const seasonRes = await fetch(`/api/ranking/seasons/${year}`)
      if (seasonRes.ok) {
        const season = await seasonRes.json()
        const roundsRes = await fetch(`/api/ranking/rounds/${season.id}`)
        if (roundsRes.ok) {
          const data = await roundsRes.json()
          setRounds(data)
        }
      }
    } catch (error) {
      console.error('Error fetching rounds:', error)
    }
  }

  const fetchMatches = async (roundId) => {
    try {
      const response = await fetch(`/api/ranking/rounds/${roundId}/matches`)
      if (response.ok) {
        const data = await response.json()
        setMatches(data)
        if (data.length === 0) {
          toast({ title: 'Nenhuma partida encontrada para esta rodada', variant: 'default' })
        }
      }
    } catch (error) {
      console.error('Error fetching matches:', error)
    }
  }

  const createRound = async () => {
    if (!newRound.month) {
      toast({ title: 'Selecione um mês', variant: 'destructive' })
      return
    }

    try {
      const seasonRes = await fetch(`/api/ranking/seasons/${year}`)
      const season = await seasonRes.json()
      
      const nextRoundNumber = rounds.length + 1
      
      const token = localStorage.getItem('auth_token')
      const response = await fetch('/api/ranking/rounds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          season_id: season.id,
          round_number: nextRoundNumber,
          month: parseInt(newRound.month),
          year: parseInt(year)
        })
      })

      if (response.ok) {
        toast({ title: 'Rodada criada', variant: 'default' })
        setNewRound({ month: '' })
        fetchRounds()
      } else {
        const error = await response.json()
        toast({ title: error.error || 'Erro ao criar rodada', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Erro ao criar rodada', variant: 'destructive' })
    }
  }

  const generateDraw = async (roundId) => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/ranking/rounds/${roundId}/draw`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        toast({ title: 'Sorteio realizado', variant: 'default' })
        await fetchRounds()
        setSelectedRound(roundId)
        await fetchMatches(roundId)
      } else {
        const error = await response.json()
        toast({ title: error.error || 'Erro no sorteio', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Erro no sorteio', variant: 'destructive' })
    }
  }

  const cancelDraw = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/ranking/rounds/${roundToCancel}/draw`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        toast({ title: 'Sorteio cancelado', variant: 'default' })
        setCancelDialogOpen(false)
        setSelectedRound(null)
        setMatches([])
        fetchRounds()
      } else {
        const error = await response.json()
        toast({ title: error.error || 'Erro ao cancelar sorteio', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Erro ao cancelar sorteio', variant: 'destructive' })
    }
  }

  const submitResult = async (data) => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/ranking/matches/${selectedMatch.id}/result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      })

      if (response.ok) {
        toast({ title: 'Resultado registrado', variant: 'default' })
        setSelectedMatch(null)
        setShowResultForm(false)
        fetchMatches(selectedRound)
      } else {
        const error = await response.json()
        toast({ title: error.error || 'Erro ao registrar resultado', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Erro ao registrar resultado', variant: 'destructive' })
    }
  }

  const submitWO = async (data) => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/ranking/matches/${selectedMatch.id}/wo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      })

      if (response.ok) {
        toast({ title: 'W.O. registrado', variant: 'default' })
        setSelectedMatch(null)
        setShowResultForm(false)
        fetchMatches(selectedRound)
      } else {
        const error = await response.json()
        toast({ title: error.error || 'Erro ao registrar W.O.', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Erro ao registrar W.O.', variant: 'destructive' })
    }
  }

  const openRound = async (roundId) => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/ranking/rounds/${roundId}/open`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        toast({ title: 'Rodada aberta', variant: 'default' })
        fetchRounds()
      } else {
        const error = await response.json()
        toast({ title: error.error || 'Erro ao abrir rodada', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Erro ao abrir rodada', variant: 'destructive' })
    }
  }

  const closeRound = async (roundId) => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/ranking/rounds/${roundId}/close`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        toast({ title: 'Rodada fechada', variant: 'default' })
        fetchRounds()
      } else {
        const error = await response.json()
        toast({ title: error.error || 'Erro ao fechar rodada', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Erro ao fechar rodada', variant: 'destructive' })
    }
  }

  const getStatusBadge = (status) => {
    const variants = { pending: 'secondary', drawn: 'default', open: 'default', closed: 'outline' }
    const labels = { pending: 'Pendente', drawn: 'Sorteado', open: 'Aberta', closed: 'Fechada' }
    return <Badge variant={variants[status]}>{labels[status]}</Badge>
  }

  if (selectedMatch && showResultForm) {
    return <MatchResultForm match={selectedMatch} onSubmit={submitResult} onCancel={() => {
      setSelectedMatch(null)
      setShowResultForm(false)
    }} />
  }

  if (selectedMatch && !showResultForm) {
    return <WOForm match={selectedMatch} onSubmit={submitWO} onCancel={() => setSelectedMatch(null)} />
  }

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => navigate('/admin/ranking')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar
      </Button>
      <h1 className="text-2xl font-bold">Rodadas {year}</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Nova Rodada</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Rodada #{rounds.length + 1} - Selecione o mês</label>
            <Select value={newRound.month} onValueChange={(value) => setNewRound({ month: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o mês">
                  {newRound.month ? months.find(m => m.value.toString() === newRound.month)?.label : 'Selecione o mês'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {months.map(month => (
                  <SelectItem key={month.value} value={month.value.toString()}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={createRound}>Criar Rodada</Button>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {rounds.map(round => (
          <Card key={round.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">Rodada {round.round_number}</h3>
                  <p className="text-sm text-gray-600">{months.find(m => m.value === round.month)?.label || `Mês ${round.month}`}</p>
                </div>
                <div className="flex gap-2">
                  {getStatusBadge(round.status)}
                  {round.status === 'pending' && (
                    <Button size="sm" onClick={() => generateDraw(round.id)}>
                      Sortear
                    </Button>
                  )}
                  {round.status === 'drawn' && (
                    <>
                      <Button size="sm" onClick={() => openRound(round.id)}>
                        Abrir Rodada
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => {
                        setRoundToCancel(round.id)
                        setCancelDialogOpen(true)
                      }}>
                        Cancelar Sorteio
                      </Button>
                    </>
                  )}
                  {round.status === 'open' && (
                    <Button size="sm" variant="outline" onClick={() => closeRound(round.id)}>
                      Fechar Rodada
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => {
                    setSelectedRound(round.id)
                    fetchMatches(round.id)
                  }}>
                    Ver Partidas
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedRound && matches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Partidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {matches.map(match => (
                <div key={match.id} className="flex justify-between items-center p-2 border rounded">
                  <div>
                    <span className="font-medium">{match.player1_name} vs {match.player2_name}</span>
                    <Badge className="ml-2">{match.group_type}</Badge>
                    {match.score && <span className="ml-2 text-sm">{match.score}</span>}
                    {match.winner_name && <span className="ml-2 text-sm text-green-600">Vencedor: {match.winner_name}</span>}
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={match.status === 'completed' ? 'default' : 'secondary'}>
                      {match.status === 'completed' ? 'Finalizada' : 'Pendente'}
                    </Badge>
                    {match.status === 'scheduled' && (
                      <>
                        <Button size="sm" onClick={() => {
                          setSelectedMatch(match)
                          setShowResultForm(true)
                        }}>
                          Registrar Resultado
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          setSelectedMatch(match)
                          setShowResultForm(false)
                        }}>
                          W.O.
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Sorteio</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar o sorteio? Todas as partidas serão apagadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={cancelDraw}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default SeasonRounds