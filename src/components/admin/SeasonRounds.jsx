import {useEffect, useState} from 'react'
import {useNavigate, useParams} from 'react-router-dom'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog'
import {useToast} from '@/contexts/ToastContext'
import {ArrowLeft} from 'lucide-react'
import WOForm from './WOForm'
import MatchResultForm from './MatchResultForm'
import {fetchWithAuth} from "../../utils/fetchWithAuth.js";

const SeasonRounds = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const [rounds, setRounds] = useState([])
  const [matches, setMatches] = useState([])
  const [selectedRound, setSelectedRound] = useState(null)
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [showResultForm, setShowResultForm] = useState(false)
  const [newRound, setNewRound] = useState({ month: '', description: '' })
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
    if (id) fetchRounds()
  }, [id])

  const fetchRounds = async () => {
    try {
      const seasonRes = await fetchWithAuth(`/api/ranking/seasons/${id}`)
      if (seasonRes.ok) {
        const season = await seasonRes.json()
        const roundsRes = await fetchWithAuth(`/api/ranking/rounds/${season.id}`)
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
      const response = await fetchWithAuth(`/api/ranking/rounds/${roundId}/matches`)
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
      const seasonRes = await fetchWithAuth(`/api/ranking/seasons/${id}`)
      const season = await seasonRes.json()
      
      const nextRoundNumber = rounds.length + 1
      
      const response = await fetchWithAuth('/api/ranking/rounds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          season_id: season.id,
          round_number: nextRoundNumber,
          month: parseInt(newRound.month),
          year: season.year,
          description: newRound.description
        })
      })

      if (response.ok) {
        toast({ title: 'Rodada criada', variant: 'default' })
        setNewRound({ month: '', description: '' })
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
      const response = await fetchWithAuth(`/api/ranking/rounds/${roundId}/draw`, {
        method: 'POST',
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
      const response = await fetchWithAuth(`/api/ranking/rounds/${roundToCancel}/draw`, {
        method: 'DELETE',
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
      const response = await fetchWithAuth(`/api/ranking/matches/${selectedMatch.id}/result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      const response = await fetchWithAuth(`/api/ranking/matches/${selectedMatch.id}/wo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      const response = await fetchWithAuth(`/api/ranking/rounds/${roundId}/open`, {
        method: 'PUT',
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
      const response = await fetchWithAuth(`/api/ranking/rounds/${roundId}/close`, {
        method: 'PUT',
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
    <div className="space-y-4 sm:space-y-6">
      <Button variant="outline" onClick={() => navigate('/admin/ranking')} className="w-full sm:w-auto">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar
      </Button>
      <h1 className="text-xl sm:text-2xl font-bold">Rodadas da Temporada</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Nova Rodada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Rodada #{rounds.length + 1} - Selecione o mês</label>
              <Select value={newRound.month} onValueChange={(value) => setNewRound({ ...newRound, month: value })}>
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
            <div>
              <label className="text-sm font-medium mb-2 block">Descrição (opcional)</label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Ex: Fase de grupos"
                value={newRound.description}
                onChange={(e) => setNewRound({ ...newRound, description: e.target.value })}
              />
            </div>
          </div>
          <Button onClick={createRound} className="w-full sm:w-auto">Criar Rodada</Button>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {rounds.map(round => (
          <Card key={round.id}>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center">
                <div>
                  <h3 className="font-semibold">
                    Rodada {round.round_number}{round.description ? ` - ${round.description}` : ''}
                  </h3>
                  <p className="text-sm text-gray-600">{months.find(m => m.value === round.month)?.label || `Mês ${round.month}`}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  {getStatusBadge(round.status)}
                  {round.status === 'pending' && (
                    <Button size="sm" onClick={() => generateDraw(round.id)} className="w-full sm:w-auto">
                      Sortear
                    </Button>
                  )}
                  {round.status === 'drawn' && (
                    <>
                      <Button size="sm" onClick={() => openRound(round.id)} className="w-full sm:w-auto">
                        Abrir Rodada
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => {
                        setRoundToCancel(round.id)
                        setCancelDialogOpen(true)
                      }} className="w-full sm:w-auto">  
                        Cancelar Sorteio
                      </Button>
                    </>
                  )}
                  {round.status === 'open' && (
                    <Button size="sm" variant="outline" onClick={() => closeRound(round.id)} className="w-full sm:w-auto">
                      Fechar Rodada
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => {
                    setSelectedRound(round.id)
                    fetchMatches(round.id)
                  }} className="w-full sm:w-auto">
                    Ver Partidas
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedRound && matches.length > 0 && (() => {
        const eliteMatches = matches.filter(m => m.group_type === 'elite')
        const challengerMatches = matches.filter(m => m.group_type === 'challenger')
        
        const MatchCard = ({ match }) => (
          <div key={match.id} className="bg-white border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{match.player1_name}</div>
                <div className="text-xs text-gray-500">vs</div>
                <div className="font-medium text-sm truncate">{match.player2_name}</div>
              </div>
              <Badge variant={match.status === 'completed' ? 'default' : 'secondary'} className="shrink-0">
                {match.status === 'completed' ? '✓' : '○'}
              </Badge>
            </div>
            {match.score && (
              <div className="text-sm font-semibold text-center py-1 bg-gray-50 rounded">
                {match.score}
              </div>
            )}
            {match.winner_name && (
              <div className="text-xs text-green-600 text-center truncate">
                🏆 {match.winner_name}
              </div>
            )}
            {match.status === 'scheduled' && (
              <div className="flex gap-1">
                <Button size="sm" onClick={() => {
                  setSelectedMatch(match)
                  setShowResultForm(true)
                }} className="flex-1 h-8 text-xs">
                  Resultado
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  setSelectedMatch(match)
                  setShowResultForm(false)
                }} className="flex-1 h-8 text-xs">
                  W.O.
                </Button>
              </div>
            )}
          </div>
        )
        
        return (
          <div className="space-y-4">
            {eliteMatches.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className="text-amber-600">👑</span>
                    Elite ({eliteMatches.length} partidas)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {eliteMatches.map(match => <MatchCard key={match.id} match={match} />)}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {challengerMatches.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className="text-blue-600">⚔️</span>
                    Challenger ({challengerMatches.length} partidas)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {challengerMatches.map(match => <MatchCard key={match.id} match={match} />)}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )
      })()}

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