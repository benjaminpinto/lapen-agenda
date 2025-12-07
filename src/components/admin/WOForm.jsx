import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/contexts/ToastContext'

const WOForm = ({ match, onSubmit, onCancel }) => {
  const [winnerId, setWinnerId] = useState('')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!winnerId) {
      showToast('Selecione o vencedor', 'error')
      return
    }

    setLoading(true)
    try {
      await onSubmit({ winner_id: parseInt(winnerId), comment })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Definir W.O.</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-center p-4 bg-gray-50 rounded">
            <p className="font-medium">
              {match.player1_name} vs {match.player2_name}
            </p>
          </div>

          <div>
            <Label>Vencedor por W.O.</Label>
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

          <div>
            <Label htmlFor="comment">Comentário</Label>
            <Textarea
              id="comment"
              placeholder="Motivo do W.O. (opcional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <div className="flex space-x-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Confirmar W.O.'}
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

export default WOForm