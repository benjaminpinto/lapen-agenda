import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DatePicker } from '@/components/ui/date-picker'
import {Calendar as CalendarIcon, Clock, Users, Trophy, GraduationCap, MedalIcon, AlertCircle} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'

const ScheduleForm = () => {
  const { canBookCourts, user } = useAuth()
  const [courts, setCourts] = useState([])
  const [players, setPlayers] = useState([])
  const [availableTimes, setAvailableTimes] = useState([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    court_id: '',
    date: '',
    start_time: '',
    player1_name: '',
    player2_name: '',
    match_type: ''
  })
  const [player1Suggestions, setPlayer1Suggestions] = useState([])
  const [player2Suggestions, setPlayer2Suggestions] = useState([])
  const [showPlayer1Suggestions, setShowPlayer1Suggestions] = useState(false)
  const [showPlayer2Suggestions, setShowPlayer2Suggestions] = useState(false)
  const [rankingMatches, setRankingMatches] = useState([])
  const [selectedMatch, setSelectedMatch] = useState(null)
  
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    fetchCourts()
    fetchPlayers()
    // Auto-fill player1 with user's short_name
    if (user?.short_name) {
      setFormData(prev => ({ ...prev, player1_name: user.short_name }))
    }
  }, [])

  useEffect(() => {
    if (formData.match_type === 'Liga') {
      fetchRankingMatches()
    }
  }, [formData.match_type])

  useEffect(() => {
    if (formData.court_id && formData.date) {
      fetchAvailableTimes()
    }
  }, [formData.court_id, formData.date])

  const fetchCourts = async () => {
    try {
      const response = await fetch(`/api/public/courts?_t=${new Date().getTime()}`)
      if (response.ok) {
        const data = await response.json()
        setCourts(data)
      }
    } catch (error) {
      console.error('Error fetching courts:', error)
    }
  }

  const fetchPlayers = async () => {
    try {
      const response = await fetch(`/api/public/users/short-names?_t=${new Date().getTime()}`)
      if (response.ok) {
        const data = await response.json()
        setPlayers(data)
      }
    } catch (error) {
      console.error('Error fetching players:', error)
    }
  }

  const fetchRankingMatches = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch('/api/ranking/all-open-matches', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (response.ok) {
        const allMatches = await response.json()
        const scheduled = allMatches.filter(m => m.status === 'scheduled')
        
        // Sort: user's matches first
        const myMatches = scheduled.filter(m => m.player1_id === user?.id || m.player2_id === user?.id)
        const otherMatches = scheduled.filter(m => m.player1_id !== user?.id && m.player2_id !== user?.id)
        
        setRankingMatches([...myMatches, ...otherMatches])
      }
    } catch (error) {
      console.error('Error fetching ranking matches:', error)
    }
  }

  const fetchAvailableTimes = async () => {
    try {
      const response = await fetch(`/api/public/available-times?court_id=${formData.court_id}&date=${formData.date}`)
      if (response.ok) {
        const data = await response.json()
        setAvailableTimes(data)
      }
    } catch (error) {
      console.error('Error fetching available times:', error)
    }
  }

  const handlePlayerInput = (playerField, value) => {
    setFormData(prev => ({ ...prev, [playerField]: value }))
    
    if (value.length > 0) {
      // Include user's short_name in suggestions
      const allNames = user?.short_name ? [user.short_name, ...players] : players
      const uniqueNames = [...new Set(allNames)]
      
      const suggestions = uniqueNames.filter(player => 
        player.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 5)
      
      if (playerField === 'player1_name') {
        setPlayer1Suggestions(suggestions)
        setShowPlayer1Suggestions(true)
      } else {
        setPlayer2Suggestions(suggestions)
        setShowPlayer2Suggestions(true)
      }
    } else {
      if (playerField === 'player1_name') {
        setShowPlayer1Suggestions(false)
      } else {
        setShowPlayer2Suggestions(false)
      }
    }
  }

  const selectSuggestion = (playerField, suggestion) => {
    setFormData(prev => ({ ...prev, [playerField]: suggestion }))
    if (playerField === 'player1_name') {
      setShowPlayer1Suggestions(false)
    } else {
      setShowPlayer2Suggestions(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch("/api/public/schedules", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast({
          title: "Agendamento realizado com sucesso!",
          description: "Seu agendamento foi criado. Redirecionando para compartilhamento..."
        })
        
        // Redirect to WhatsApp sharing after a short delay
        setTimeout(() => {
          navigate('/view?share=true')
        }, 2000)
      } else {
        toast({
          title: "Erro no agendamento",
          description: data.error || "Erro ao criar agendamento",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao conectar com o servidor",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const getTodayDate = () => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  }

  if (!canBookCourts) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-0">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="h-6 w-6 mr-2 text-yellow-600" />
              Acesso Restrito
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {!user ? (
                  <>
                    Você precisa estar autenticado como membro LAPEN aprovado para agendar quadras.
                    <div className="mt-4 flex flex-col sm:flex-row gap-3">
                      <Link to="/login">
                        <Button className="w-full sm:w-auto">Fazer Login</Button>
                      </Link>
                      <Link to="/signup">
                        <Button variant="outline" className="w-full sm:w-auto">Criar Conta</Button>
                      </Link>
                    </div>
                  </>
                ) : user.is_lapen_member && !user.lapen_approved ? (
                  <>
                    Sua solicitação de membro LAPEN está pendente de aprovação por um administrador.
                    Você poderá agendar quadras após a aprovação.
                  </>
                ) : (
                  <>
                    Apenas membros LAPEN aprovados podem agendar quadras.
                    Se você é membro da LAPEN, entre em contato com um administrador.
                  </>
                )}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-0">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CalendarIcon className="h-6 w-6 mr-2 text-green-600" />
            Novo Agendamento
          </CardTitle>
          <CardDescription>
            Preencha os dados para agendar sua partida de tênis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Match Type - Cards */}
            <div>
              <Label>Tipo de Partida</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      court_id: '',
                      date: '',
                      start_time: '',
                      player1_name: '',
                      player2_name: '',
                      match_type: 'Liga'
                    })
                    setSelectedMatch(null)
                  }}
                  className={`p-3 border-2 rounded-lg flex items-center gap-2 transition-all ${
                    formData.match_type === 'Liga'
                      ? 'border-green-600 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Trophy className={`h-5 w-5 ${
                    formData.match_type === 'Liga' ? 'text-green-600' : 'text-gray-400'
                  }`} />
                  <span className="font-medium text-sm">Liga</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      court_id: '',
                      date: '',
                      start_time: '',
                      player1_name: user?.short_name || '',
                      player2_name: '',
                      match_type: 'Amistoso'
                    })
                    setSelectedMatch(null)
                  }}
                  className={`p-3 border-2 rounded-lg flex items-center gap-2 transition-all ${
                    formData.match_type === 'Amistoso'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Users className={`h-5 w-5 ${
                    formData.match_type === 'Amistoso' ? 'text-blue-600' : 'text-gray-400'
                  }`} />
                  <span className="font-medium text-sm">Amistoso</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      court_id: '',
                      date: '',
                      start_time: '',
                      player1_name: user?.short_name || '',
                      player2_name: '',
                      match_type: 'Torneio'
                    })
                    setSelectedMatch(null)
                  }}
                  className={`p-3 border-2 rounded-lg flex items-center gap-2 transition-all ${
                    formData.match_type === 'Torneio'
                      ? 'border-yellow-600 bg-yellow-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <MedalIcon className={`h-5 w-5 ${
                    formData.match_type === 'Torneio' ? 'text-yellow-600' : 'text-gray-400'
                  }`} />
                  <span className="font-medium text-sm">Torneio</span>
                </button>
              </div>
            </div>

            {/* Show rest of form only after match type is selected */}
            {formData.match_type && (
              <>
            {/* Ranking Match Selection */}
            {formData.match_type === 'Liga' && (
              <div>
                <Label>Partida de Ranking</Label>
                {rankingMatches.length > 0 ? (
                  <Select value={selectedMatch} onValueChange={(value) => {
                    setSelectedMatch(value)
                    const match = rankingMatches.find(m => m.id.toString() === value)
                    if (match) {
                      setFormData(prev => ({
                        ...prev,
                        player1_name: match.player1_name,
                        player2_name: match.player2_name
                      }))
                    }
                  }} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a partida" />
                    </SelectTrigger>
                    <SelectContent>
                      {rankingMatches.map((match) => {
                        const isMyMatch = match.player1_id === user?.id || match.player2_id === user?.id
                        return (
                          <SelectItem key={match.id} value={match.id.toString()}>
                            {isMyMatch && '⭐ '}
                            {match.player1_name} vs {match.player2_name} - Rodada {match.round_number}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-gray-500 p-2 border rounded">Nenhuma partida de ranking aberta no momento</p>
                )}
              </div>
            )}
            {/* Court Selection */}
            <div>
              <Label htmlFor="court">Quadra</Label>
              <Select value={formData.court_id} onValueChange={(value) => setFormData(prev => ({ ...prev, court_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a quadra">
                    {formData.court_id && courts.find(court => String(court.id) === formData.court_id)?.name || "Selecione a quadra"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {courts.map((court) => (
                    <SelectItem key={court.id} value={String(court.id)}>
                      <div className="flex items-center">
                        <span className="font-medium">{court.name}</span>
                        <span className="ml-2 text-sm text-gray-500">({court.type})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Selection */}
            <div>
              <Label>Data</Label>
              <DatePicker
                value={formData.date}
                onChange={(date) => setFormData(prev => ({ ...prev, date }))}
                disabled={(date) => date < new Date(getTodayDate())}
                placeholder="Selecione a data"
              />
            </div>

            {/* Time Selection */}
            <div>
              <Label htmlFor="time">Horário de Início</Label>
              <Select 
                value={formData.start_time} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, start_time: value }))}
                disabled={!formData.court_id || !formData.date}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    !formData.court_id || !formData.date 
                      ? "Selecione quadra e data primeiro" 
                      : availableTimes.length === 0 
                        ? "Nenhum horário disponível"
                        : "Selecione o horário"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {availableTimes.map((time) => (
                    <SelectItem key={time} value={time}>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2" />
                        {time} (1h30 de duração)
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Player 1 - Only for non-Liga matches */}
            {formData.match_type !== 'Liga' && (
              <div className="relative">
                <Label htmlFor="player1">Jogador 1</Label>
                <Input
                  id="player1"
                  value={formData.player1_name}
                  onChange={(e) => handlePlayerInput('player1_name', e.target.value)}
                  onBlur={() => setTimeout(() => setShowPlayer1Suggestions(false), 200)}
                  placeholder="Digite o nome do primeiro jogador"
                  required
                />
                {showPlayer1Suggestions && player1Suggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                    {player1Suggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => selectSuggestion('player1_name', suggestion)}
                      >
                        {suggestion}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Player 2 - Only for non-Liga matches */}
            {formData.match_type !== 'Liga' && (
              <div className="relative">
                <Label htmlFor="player2">Jogador 2</Label>
                <Input
                  id="player2"
                  value={formData.player2_name}
                  onChange={(e) => handlePlayerInput('player2_name', e.target.value)}
                  onBlur={() => setTimeout(() => setShowPlayer2Suggestions(false), 200)}
                  placeholder="Digite o nome do segundo jogador"
                  required
                />
                {showPlayer2Suggestions && player2Suggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                    {player2Suggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => selectSuggestion('player2_name', suggestion)}
                      >
                        {suggestion}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}



            <div className="flex flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0 sm:space-x-4">
              <Button type="button" variant="outline" onClick={() => navigate('/')} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                {loading ? 'Agendando...' : 'Confirmar Agendamento'}
              </Button>
            </div>
            </>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default ScheduleForm

