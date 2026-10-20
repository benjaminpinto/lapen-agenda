import {useState} from 'react'
import {Button} from '@/components/ui/button'
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {useToast} from '@/contexts/ToastContext'
import {ADMIN_API, errorMessage, request} from '../tournamentApi'
import {matchTitle} from '../schedule/scheduleUtils'

/** W.O. in one choice: who did not show up (the other one wins), or neither did. Each button records the result. */
export default function WalkoverDialog({ tournament, match, onClose, onSaved }) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const record = async (body) => {
    setSaving(true)
    const result = await request('PUT', `${ADMIN_API}/${tournament.id}/matches/${match.id}/result`, body)
    setSaving(false)
    if (result.ok) {
      toast({ title: 'W.O. registrado' })
      onSaved()
    } else {
      toast({ title: errorMessage(result), variant: 'destructive' })
    }
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !saving) onClose() }}>
      <DialogContent className="w-full max-w-md" data-testid="walkover-dialog">
        <DialogHeader>
          <DialogTitle>Registrar W.O.</DialogTitle>
          <DialogDescription data-testid="walkover-match">{match.category_name} · {match.round_name} · {matchTitle(match)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {match.sides.map((side, index) => (
            <Button
              key={index} type="button" variant="outline" disabled={saving} data-testid={`walkover-absent-${index + 1}`}
              onClick={() => record({ outcome: 'wo', winner_registration_id: match.sides[1 - index].registration_id })}
              className="min-h-[44px] w-full justify-start whitespace-normal text-left"
            >
              {side.name} não compareceu
            </Button>
          ))}
          <Button
            type="button" variant="outline" disabled={saving} data-testid="walkover-double" onClick={() => record({ outcome: 'double_wo' })}
            className="min-h-[44px] w-full justify-start whitespace-normal border-red-300 text-left text-red-700"
          >
            Nenhum dos dois compareceu (duplo W.O.)
          </Button>
        </div>
        <p className="text-xs text-stone-600">Quem comparece vence. O resultado pode ser anulado depois, clicando no jogo na grade.</p>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving} data-testid="walkover-cancel" className="min-h-[44px]">Voltar</Button>
      </DialogContent>
    </Dialog>
  )
}
