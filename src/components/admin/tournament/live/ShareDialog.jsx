import {useEffect, useState} from 'react'
import {Copy, Image as ImageIcon, Share2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Textarea} from '@/components/ui/textarea'
import {useToast} from '@/contexts/ToastContext'

/**
 * "Compartilhar no WhatsApp", as the agenda does it: the generated message, editable, and a button that opens WhatsApp with it.
 * With `buildImage` (resolves to a PNG blob) the dialog also offers the picture: a preview of the very image that is shared,
 * and a button that shares it, or downloads it where sharing files is not possible.
 */
export default function ShareDialog({ description, text, onClose, buildImage, filename = 'compartilhar.png' }) {
  const { toast } = useToast()
  const [message, setMessage] = useState(text)
  const [view, setView] = useState(buildImage ? 'image' : 'text')
  const [image, setImage] = useState(null) // { blob, url }
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    if (!buildImage) return undefined
    let cancelled = false
    let url = null
    buildImage().then((blob) => {
      if (cancelled) return
      url = URL.createObjectURL(blob)
      setImage({ blob, url })
    }).catch(() => { if (!cancelled) setImageFailed(true) })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [buildImage])

  const share = () => window.open(`whatsapp://send?text=${encodeURIComponent(message)}`, '_blank')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message)
      toast({ title: 'Mensagem copiada' })
    } catch {
      toast({ title: 'Não foi possível copiar. Selecione o texto e copie.', variant: 'destructive' })
    }
  }

  const shareImage = async () => {
    const file = new File([image.blob], filename, { type: 'image/png' })
    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: description })
      } else {
        const link = document.createElement('a')
        link.href = image.url
        link.download = filename
        link.click()
        toast({ title: 'Imagem salva', description: 'A imagem foi baixada. Envie-a no grupo.' })
      }
    } catch (error) {
      if (error?.name !== 'AbortError') toast({ title: 'Não foi possível compartilhar a imagem.', variant: 'destructive' })
    }
  }

  const tab = (key, label) => (
    <button
      type="button" role="tab" aria-selected={view === key} data-testid={`share-view-${key}`} onClick={() => setView(key)}
      className={`min-h-[44px] rounded-md border px-4 text-sm font-medium ${view === key ? 'border-amber-800 bg-amber-800 text-white' : 'bg-white hover:bg-stone-50'}`}
    >
      {label}
    </button>
  )

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="mx-4 max-h-[92vh] max-w-2xl overflow-y-auto sm:mx-auto" data-testid="share-dialog">
        <DialogHeader>
          <DialogTitle>Compartilhar no WhatsApp</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {buildImage && <div role="tablist" aria-label="Formato" className="flex gap-1">{tab('image', 'Imagem')}{tab('text', 'Mensagem')}</div>}
        {view === 'text' ? (
          <div className="space-y-4">
            <Textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={14} className="font-mono text-sm" data-testid="share-text" aria-label="Mensagem" />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={onClose} data-testid="share-close" className="min-h-[44px]">Fechar</Button>
              <Button type="button" variant="outline" onClick={copy} data-testid="share-copy" className="min-h-[44px]"><Copy className="mr-2 h-4 w-4" aria-hidden="true" />Copiar</Button>
              <Button type="button" onClick={share} data-testid="share-whatsapp" className="min-h-[44px] bg-green-600 hover:bg-green-700"><Share2 className="mr-2 h-4 w-4" aria-hidden="true" />Compartilhar no WhatsApp</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="max-h-[60vh] overflow-auto rounded-md border bg-stone-100 p-2" data-testid="share-image-preview">
              {image && <img src={image.url} alt="Prévia da imagem do resumo" className="mx-auto w-full max-w-[480px]" data-testid="share-image" />}
              {!image && !imageFailed && <p className="py-12 text-center text-sm text-stone-600">Gerando a imagem…</p>}
              {imageFailed && <p className="py-12 text-center text-sm text-red-700" data-testid="share-image-error">Não foi possível gerar a imagem. Use a mensagem.</p>}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={onClose} data-testid="share-close" className="min-h-[44px]">Fechar</Button>
              <Button type="button" onClick={shareImage} disabled={!image} data-testid="share-image-button" className="min-h-[44px] bg-green-600 hover:bg-green-700">
                <ImageIcon className="mr-2 h-4 w-4" aria-hidden="true" />Compartilhar imagem
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
