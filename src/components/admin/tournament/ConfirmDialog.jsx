import {Button} from '@/components/ui/button'
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from '@/components/ui/dialog'

/** Confirmation for destructive actions (the app never uses browser dialogs). */
export default function ConfirmDialog({ open, title, description, confirmLabel = 'Confirmar', destructive = false, busy = false, onConfirm, onCancel }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel() }}>
      <DialogContent className="w-full max-w-md" data-testid="confirm-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel} disabled={busy} data-testid="confirm-dialog-cancel" className="min-h-[44px]">Voltar</Button>
          <Button
            onClick={onConfirm} disabled={busy} data-testid="confirm-dialog-confirm"
            className={`min-h-[44px] ${destructive ? 'bg-red-700 hover:bg-red-800 text-white' : 'bg-amber-700 hover:bg-amber-800 text-white'}`}
          >
            {busy ? 'Aguarde…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
