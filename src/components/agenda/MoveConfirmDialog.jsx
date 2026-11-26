import {AlertTriangle, ArrowDown} from 'lucide-react'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog'

const formatDate = (iso) => iso.split('-').reverse().join('/')

const Place = ({label, place, className, testId}) => (
    <div className={`rounded-xl border px-3 py-2.5 ${className}`} data-testid={testId}>
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
        <div className="text-sm font-bold text-foreground">{place.court} · <span className="tabular-nums">{place.time}</span></div>
    </div>
)

/**
 * Confirms a drag and drop before the booking moves. Moving someone else's game
 * (`move.own` false) turns the dialog red so it can't be confirmed by mistake.
 */
export default function MoveConfirmDialog({move, onConfirm, onCancel}) {
    if (!move) return null
    const {item, date, own, from, to} = move
    const players = `${item.player1_name} × ${item.player2_name}`

    return (
        <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
            <AlertDialogContent className={`max-w-md ${own ? '' : 'border-2 border-red-600 bg-red-50'}`}
                                data-testid="move-confirm-dialog" data-own={own}>
                <AlertDialogHeader>
                    <AlertDialogTitle className={own ? '' : 'flex items-center gap-2 text-red-700'}>
                        {!own && <AlertTriangle className="h-5 w-5 shrink-0"/>}
                        {own ? 'Mover seu jogo?' : 'Atenção: este jogo não é seu'}
                    </AlertDialogTitle>
                    <AlertDialogDescription className={own ? '' : 'text-red-900'}>
                        {own
                            ? <>{players} · {formatDate(date)}</>
                            : <>Você está alterando o jogo de outras pessoas: <b>{players}</b>, em {formatDate(date)}.</>}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="grid justify-items-stretch gap-1.5">
                    <Place label="De" place={from} className="bg-card" testId="move-confirm-from"/>
                    <ArrowDown className={`h-4 w-4 justify-self-center ${own ? 'text-primary' : 'text-red-700'}`}/>
                    <Place label="Para" place={to} testId="move-confirm-to"
                           className={own ? 'border-primary bg-card' : 'border-red-600 bg-card'}/>
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel data-testid="move-confirm-cancel">Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={onConfirm} data-testid="move-confirm-accept"
                                       className={own ? '' : 'bg-red-600 text-white hover:bg-red-700'}>
                        {own ? 'Confirmar' : 'Mover mesmo assim'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
