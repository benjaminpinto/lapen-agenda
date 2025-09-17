import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Clock, Users, Trophy } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const ScheduleForm = () => {
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
  
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    fetchCourts()
    fetchPlayers()
  }, [])

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
      const response = await fetch(`/api/public/players?_t=${new Date().getTime()}`)
      if (response.ok) {
        const data = await response.json()
        setPlayers(data)
      }
    } catch (error) {
      console.error('Error fetching players:', error)
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
      const suggestions = players.filter(player => 
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
      const response = await fetch("/api/public/schedules", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-6 w-6 mr-2 text-green-600" />
            Novo Agendamento
          </CardTitle>
          <CardDescription>
            Preencha os dados para agendar sua partida de tênis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Court Selection */}
            <div>
              <Label htmlFor="court">Quadra</Label>
              <Select value={formData.court_id} onValueChange={(value) => setFormData(prev => ({ ...prev, court_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a quadra" />
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
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                min={getTodayDate()}
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                required
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

            {/* Player 1 */}
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

            {/* Player 2 */}
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

            {/* Match Type */}
            <div>
              <Label htmlFor="match_type">Tipo de Partida</Label>
              <Select value={formData.match_type} onValueChange={(value) => setFormData(prev => ({ ...prev, match_type: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de partida" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Amistoso">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-2" />
                      Amistoso
                    </div>
                  </SelectItem>
                  <SelectItem value="Liga">
                    <div className="flex items-center">
                      <Trophy className="h-4 w-4 mr-2" />
                      Liga
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" onClick={() => navigate('/')}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Agendando...' : 'Confirmar Agendamento'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default ScheduleForm

