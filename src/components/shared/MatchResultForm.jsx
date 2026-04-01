import {useEffect, useState} from 'react'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {useToast} from '@/contexts/ToastContext'

const MatchResultForm = ({ match, onSubmit, onCancel }) => {
  const [set1P1, setSet1P1] = useState('')
  const [set1P2, setSet1P2] = useState('')
  const [set2P1, setSet2P1] = useState('')
  const [set2P2, setSet2P2] = useState('')
  const [set3P1, setSet3P1] = useState('')
  const [set3P2, setSet3P2] = useState('')
  const { toast } = useToast()

  const s1p1 = parseInt(set1P1) || 0
  const s1p2 = parseInt(set1P2) || 0
  const s2p1 = parseInt(set2P1) || 0
  const s2p2 = parseInt(set2P2) || 0
  const set1Done = set1P1 !== '' && set1P2 !== ''
  const set2Done = set2P1 !== '' && set2P2 !== ''
  const p1SetsLive = (s1p1 > s1p2 ? 1 : 0) + (s2p1 > s2p2 ? 1 : 0)
  const p2SetsLive = (s1p2 > s1p1 ? 1 : 0) + (s2p2 > s2p1 ? 1 : 0)
  const stbEnabled = set1Done && set2Done && p1SetsLive === 1 && p2SetsLive === 1

  useEffect(() => {
    if (!stbEnabled) {
      setSet3P1('')
      setSet3P2('')
    }
  }, [stbEnabled])

  const handleSubmit = () => {
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

    const p1Sets = (s1p1 > s1p2 ? 1 : 0) + (s2p1 > s2p2 ? 1 : 0)
    const p2Sets = (s1p2 > s1p1 ? 1 : 0) + (s2p2 > s2p1 ? 1 : 0)
    const needsSTB = p1Sets === 1 && p2Sets === 1

    if (needsSTB && (!set3P1 || !set3P2)) {
      toast({ title: 'Preencha o super tiebreak (terceiro set)', variant: 'destructive' })
      return
    }
    if (p1Sets !== 1 && (set3P1 || set3P2)) {
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

    let score = `${set1P1}-${set1P2}, ${set2P1}-${set2P2}`
    if (set3P1 && set3P2) score += `, ${set3P1}-${set3P2}`

    const s3p1 = set3P1 ? parseInt(set3P1) : 0
    const s3p2 = set3P2 ? parseInt(set3P2) : 0
    const finalP1Sets = p1Sets + (s3p1 > s3p2 ? 1 : 0)
    const finalP2Sets = p2Sets + (s3p2 > s3p1 ? 1 : 0)
    
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
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Jogador</th>
                <th className="text-center p-2">1º Set</th>
                <th className="text-center p-2">2º Set</th>
                <th className="text-center p-2">STB</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="p-2 font-medium">{match.player1_name}</td>
                <td className="p-2">
                  <Input
                    type="number"
                    min="0"
                    max="7"
                    className="w-16 text-center"
                    value={set1P1}
                    onChange={(e) => setSet1P1(e.target.value)}
                  />
                </td>
                <td className="p-2">
                  <Input
                    type="number"
                    min="0"
                    max="7"
                    className="w-16 text-center"
                    value={set2P1}
                    onChange={(e) => setSet2P1(e.target.value)}
                  />
                </td>
                <td className="p-2">
                  <Input
                    type="number"
                    min="0"
                    max="99"
                    className="w-16 text-center"
                    value={set3P1}
                    disabled={!stbEnabled}
                    onChange={(e) => setSet3P1(e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <td className="p-2 font-medium">{match.player2_name}</td>
                <td className="p-2">
                  <Input
                    type="number"
                    min="0"
                    max="7"
                    className="w-16 text-center"
                    value={set1P2}
                    onChange={(e) => setSet1P2(e.target.value)}
                  />
                </td>
                <td className="p-2">
                  <Input
                    type="number"
                    min="0"
                    max="7"
                    className="w-16 text-center"
                    value={set2P2}
                    onChange={(e) => setSet2P2(e.target.value)}
                  />
                </td>
                <td className="p-2">
                  <Input
                    type="number"
                    min="0"
                    max="99"
                    className="w-16 text-center"
                    value={set3P2}
                    disabled={!stbEnabled}
                    onChange={(e) => setSet3P2(e.target.value)}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500">
          STB - Super tiebreak {stbEnabled ? <span className="text-amber-600 font-medium">(obrigatório)</span> : '(preenchido automaticamente quando necessário)'}
        </p>

        <div className="flex gap-2">
          <Button onClick={handleSubmit}>Salvar</Button>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default MatchResultForm
