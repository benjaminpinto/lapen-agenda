import {useState} from 'react'
import {Copy, Share2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Textarea} from '@/components/ui/textarea'
import {useToast} from '@/contexts/ToastContext'

/** "Compartilhar no WhatsApp", as the agenda does it: the generated message, editable, and a button that opens WhatsApp with it. */
export default function ShareDialog({ description, text, onClose }) {
  const { toast } = useToast()
  const [message, setMessage] = useState(text)

  const share = () => window.open(`whatsapp://send?text=${encodeURIComponent(message)}`, '_blank')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message)
      toast({ title: 'Mensagem copiada' })
    } catch {
      toast({ title: 'Não foi possível copiar. Selecione o texto e copie.', variant: 'destructive' })
    }
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="mx-4 max-w-2xl sm:mx-auto" data-testid="share-dialog">
        <DialogHeader>
          <DialogTitle>Compartilhar no WhatsApp</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={14} className="font-mono text-sm" data-testid="share-text" aria-label="Mensagem" />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} data-testid="share-close" className="min-h-[44px]">Fechar</Button>
            <Button type="button" variant="outline" onClick={copy} data-testid="share-copy" className="min-h-[44px]"><Copy className="mr-2 h-4 w-4" aria-hidden="true" />Copiar</Button>
            <Button type="button" onClick={share} data-testid="share-whatsapp" className="min-h-[44px] bg-green-600 hover:bg-green-700"><Share2 className="mr-2 h-4 w-4" aria-hidden="true" />Compartilhar no WhatsApp</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
