import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/contexts/ToastContext'

const MatchResultForm = ({ match, onSubmit, onCancel }) => {
  const [score, setScore] = useState('')
  const [winnerId, setWinnerId] = useState('')
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()

  const validateScore = (scoreStr) => {
    const regex = /^(\d+-\d+)(,\s*\d+-\d+)*$/
    return regex.test(scoreStr.trim())
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!score.trim() || !winnerId) {
      showToast('Preencha todos os campos', 'error')
      return
    }

    if (!validateScore(score)) {
      showToast('Formato de placar inválido. Use: 6-4, 6-3', 'error')
      return
    }

    setLoading(true)
    try {
      await onSubmit({ score: score.trim(), winner_id: parseInt(winnerId) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar Resultado</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-center p-4 bg-gray-50 rounded">
            <p className="font-medium">
              {match.player1_name} vs {match.player2_name}
            </p>
            <p className="text-sm text-gray-600">
              Grupo {match.group_type === 'elite' ? 'Elite' : 'Challenger'}
            </p>
          </div>

          <div>
            <Label htmlFor="score">Placar</Label>
            <Input
              id="score"
              placeholder="6-4, 6-3"
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              Formato: 6-4, 6-3 ou 6-4, 4-6, 10-8
            </p>
          </div>

          <div>
            <Label>Vencedor</Label>
            <div className="space-y-2 mt-2">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="winner"
                  value={match.player1_id}
                  checked={winnerId === match.player1_id.toString()}
                  onChange={(e) => setWinnerId(e.target.value)}
                />
                <span>{match.player1_name}</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="winner"
                  value={match.player2_id}
                  checked={winnerId === match.player2_id.toString()}
                  onChange={(e) => setWinnerId(e.target.value)}
                />
                <span>{match.player2_name}</span>
              </label>
            </div>
          </div>

          <div className="flex space-x-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Resultado'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export default MatchResultForm