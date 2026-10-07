import {RefreshCw} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {updatedText} from './format'

/** "Atualizado às 14:32" + manual refresh. The data also refreshes by itself every minute while the tab is visible. */
export default function RefreshBar({ updatedAt, refreshing, error, onRefresh }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground" data-testid="refresh-bar">
      <span data-testid="updated-at">
        {updatedAt ? `Atualizado às ${updatedText(updatedAt)}` : 'Carregando…'}
        {error && updatedAt ? <span role="status" className="ml-2 text-orange-800 dark:text-orange-300" data-testid="refresh-error">Não foi possível atualizar agora.</span> : null}
      </span>
      <Button type="button" variant="outline" size="sm" className="min-h-[44px]" onClick={onRefresh} disabled={refreshing} data-testid="refresh-button">
        <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
        Atualizar
      </Button>
    </div>
  )
}
