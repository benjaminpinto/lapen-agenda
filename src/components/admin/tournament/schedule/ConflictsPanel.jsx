import {AlertTriangle} from 'lucide-react'
import {Button} from '@/components/ui/button'

/** Everything wrong with the schedule right now (recalculated by the server on every read). */
export default function ConflictsPanel({ conflicts, onShow }) {
  if (conflicts.length === 0) {
    return <p className="rounded-md border border-dashed border-stone-300 p-4 text-center text-sm text-stone-600" data-testid="conflicts-empty">Nenhum conflito. Tudo certo com os horários atuais.</p>
  }
  return (
    <ul className="space-y-2" data-testid="conflicts-list">
      {conflicts.map((conflict, index) => (
        <li
          key={index} data-testid={`conflict-${index}`} data-severity={conflict.severity}
          className={`rounded-md border p-2 text-sm ${conflict.severity === 'error' ? 'border-red-400 bg-red-50' : 'border-orange-400 bg-orange-50'}`}
        >
          <p className="flex items-start gap-1.5">
            <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${conflict.severity === 'error' ? 'text-red-700' : 'text-orange-700'}`} aria-hidden="true" />
            <span><strong>{conflict.severity === 'error' ? 'Conflito: ' : 'Aviso: '}</strong>{conflict.message}</span>
          </p>
          <Button type="button" size="sm" variant="outline" className="mt-2 min-h-[40px]" onClick={() => onShow(conflict)} data-testid={`conflict-show-${index}`}>Ver no quadro</Button>
        </li>
      ))}
    </ul>
  )
}
