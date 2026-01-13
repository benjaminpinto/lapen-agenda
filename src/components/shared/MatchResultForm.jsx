import {useState} from 'react'
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

  const handleSubmit = () => {
    if (!set1P1 || !set1P2 || !set2P1 || !set2P2) {
      toast({ title: 'Preencha os dois primeiros sets', variant: 'destructive' })
      return
    }

    const s1p1 = parseInt(set1P1)
    const s1p2 = parseInt(set1P2)
    const s2p1 = parseInt(set2P1)
    const s2p2 = parseInt(set2P2)

    const p1Sets = (s1p1 > s1p2 ? 1 : 0) + (s2p1 > s2p2 ? 1 : 0)
    const p2Sets = (s1p2 > s1p1 ? 1 : 0) + (s2p2 > s2p1 ? 1 : 0)

    if (p1Sets === 1 && p2Sets === 1 && (!set3P1 || !set3P2)) {
      toast({ title: 'Preencha o super tiebreak (terceiro set)', variant: 'destructive' })
      return
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
                    max="15"
                    className="w-16 text-center"
                    value={set3P1}
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
                    max="15"
                    className="w-16 text-center"
                    value={set3P2}
                    onChange={(e) => setSet3P2(e.target.value)}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500">STB - Super tiebreak (opcional)</p>

        <div className="flex gap-2">
          <Button onClick={handleSubmit}>Salvar</Button>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default MatchResultForm
