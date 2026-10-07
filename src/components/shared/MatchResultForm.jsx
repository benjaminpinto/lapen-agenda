import {useCallback, useState} from 'react'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Button} from '@/components/ui/button'
import {useToast} from '@/contexts/ToastContext'
import ScoreGrid from './ScoreGrid'
import {emptyGrid, needsSuperTiebreak, scoreFromGrid, setsWon} from '@/utils/scoreGrid'

const MatchResultForm = ({ match, onSubmit, onCancel }) => {
  const [grid, setGrid] = useState(emptyGrid)
  const { toast } = useToast()

  const changeScore = useCallback((key, index, value) => {
    setGrid((current) => ({ ...current, [key]: current[key].map((cell, i) => (i === index ? value : cell)) }))
  }, [])

  const handleSubmit = () => {
    const [[set1P1, set1P2], [set2P1, set2P2], [set3P1, set3P2]] = [grid.set1, grid.set2, grid.stb]

    if (!set1P1 || !set1P2 || !set2P1 || !set2P2) {
      toast({ title: 'Preencha os dois primeiros sets', variant: 'destructive' })
      return
    }

    const s1p1 = parseInt(set1P1)
    const s1p2 = parseInt(set1P2)
    const s2p1 = parseInt(set2P1)
    const s2p2 = parseInt(set2P2)

    if (s1p1 === 0 && s1p2 === 0) {
      toast({ title: '1º set não pode ser 0-0', variant: 'destructive' })
      return
    }
    if (s2p1 === 0 && s2p2 === 0) {
      toast({ title: '2º set não pode ser 0-0', variant: 'destructive' })
      return
    }
    if (Math.max(s1p1, s1p2) > 7) {
      toast({ title: '1º set inválido (máximo 7 games)', variant: 'destructive' })
      return
    }
    if (Math.max(s2p1, s2p2) > 7) {
      toast({ title: '2º set inválido (máximo 7 games)', variant: 'destructive' })
      return
    }
    if (s1p1 === s1p2) {
      toast({ title: '1º set sem vencedor claro', variant: 'destructive' })
      return
    }
    if (s2p1 === s2p2) {
      toast({ title: '2º set sem vencedor claro', variant: 'destructive' })
      return
    }

    const needsSTB = needsSuperTiebreak(grid)

    if (needsSTB && (!set3P1 || !set3P2)) {
      toast({ title: 'Preencha o super tiebreak (terceiro set)', variant: 'destructive' })
      return
    }
    if (!needsSTB && (set3P1 || set3P2)) {
      toast({ title: 'Terceiro set informado mas já há vencedor nos dois primeiros sets', variant: 'destructive' })
      return
    }

    if (set3P1 && set3P2) {
      const s3p1 = parseInt(set3P1)
      const s3p2 = parseInt(set3P2)
      if (Math.max(s3p1, s3p2) < 10) {
        toast({ title: 'Super tiebreak inválido (mínimo 10 pontos)', variant: 'destructive' })
        return
      }
      if (Math.abs(s3p1 - s3p2) < 2) {
        toast({ title: 'Super tiebreak sem vencedor claro (diferença mínima de 2)', variant: 'destructive' })
        return
      }
    }

    const score = scoreFromGrid(grid)
    const [finalP1Sets, finalP2Sets] = setsWon(grid)

    const winnerId = finalP1Sets > finalP2Sets ? match.player1_id : match.player2_id
    const winnerName = finalP1Sets > finalP2Sets ? match.player1_name : match.player2_name
    onSubmit({ score, winner_id: winnerId, winner_name: winnerName })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar Resultado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScoreGrid
          players={[match.player1_name, match.player2_name]}
          grid={grid}
          onChange={changeScore}
          stbEnabled={needsSuperTiebreak(grid)}
        />

        <div className="flex gap-2">
          <Button onClick={handleSubmit}>Salvar</Button>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default MatchResultForm
