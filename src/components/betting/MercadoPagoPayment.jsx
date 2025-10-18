import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy, ExternalLink } from 'lucide-react'
import { useState, useEffect } from 'react'

const MercadoPagoPayment = ({ paymentData, onSuccess, onCancel }) => {
  const [copied, setCopied] = useState(false)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    const checkPaymentStatus = async () => {
      try {
        const response = await fetch(`/api/payments/${paymentData.payment_id}/status`)
        const data = await response.json()
        if (data.status === 'approved') {
          onSuccess()
        }
      } catch (error) {
        console.error('Error checking payment:', error)
      }
    }

    const interval = setInterval(checkPaymentStatus, 3000)
    return () => clearInterval(interval)
  }, [paymentData.payment_id, onSuccess])

  const copyToClipboard = () => {
    navigator.clipboard.writeText(paymentData.qr_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pagamento PIX</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-4">
            Escaneie o QR Code com seu app bancário ou copie o código PIX
          </p>
          
          {paymentData.qr_code_base64 && (
            <div className="flex justify-center mb-4">
              <img 
                src={`data:image/png;base64,${paymentData.qr_code_base64}`}
                alt="QR Code PIX"
                className="w-64 h-64 border-2 border-gray-200 rounded"
              />
            </div>
          )}

          <div className="space-y-2">
            <Button
              onClick={copyToClipboard}
              variant="outline"
              className="w-full"
            >
              <Copy className="mr-2 h-4 w-4" />
              {copied ? 'Código Copiado!' : 'Copiar Código PIX'}
            </Button>

            {paymentData.ticket_url && (
              <Button
                onClick={() => window.open(paymentData.ticket_url, '_blank')}
                variant="outline"
                className="w-full"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Ver Detalhes do Pagamento
              </Button>
            )}
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              Após realizar o pagamento, aguarde alguns segundos para a confirmação automática.
            </p>
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={async () => {
              setChecking(true)
              try {
                const response = await fetch(`/api/payments/${paymentData.payment_id}/status`)
                const data = await response.json()
                if (data.status === 'approved') {
                  onSuccess()
                } else {
                  alert('Pagamento ainda não confirmado. Por favor, aguarde.')
                }
              } catch (error) {
                alert('Erro ao verificar pagamento')
              } finally {
                setChecking(false)
              }
            }} className="flex-1" disabled={checking}>
              {checking ? 'Verificando...' : 'Já Paguei'}
            </Button>
            <Button onClick={onCancel} variant="outline" className="flex-1">
              Cancelar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default MercadoPagoPayment
