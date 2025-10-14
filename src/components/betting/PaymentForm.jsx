import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

const CheckoutForm = ({ clientSecret, onSuccess, onError, loading, setLoading, betAmount, selectedPlayer, selectedMatch }) => {
  const stripe = useStripe()
  const elements = useElements()

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setLoading(true)

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + '/betting'
      },
      redirect: 'if_required'
    })

    if (error) {
      onError(error.message)
      setLoading(false)
    } else {
      onSuccess(setLoading, betAmount, selectedPlayer, selectedMatch)
    }
  }

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded">
          <div className="flex flex-col items-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm text-gray-600">Processando pagamento...</p>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <PaymentElement
            options={{
              layout: 'accordion',
              paymentMethodOrder: ['pix', 'card', 'boleto', 'apple_pay', 'google_pay']
            }}
          />
        </div>
        <Button 
          type="submit" 
          disabled={!stripe || loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            'Confirmar Pagamento'
          )}
        </Button>
      </form>
    </div>
  )
}

const PaymentForm = ({ clientSecret, onSuccess, onError, betAmount, selectedPlayer, selectedMatch }) => {
  const [loading, setLoading] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pagamento</CardTitle>
      </CardHeader>
      <CardContent>
        <Elements 
          stripe={stripePromise}
          options={{
            clientSecret,
            locale: 'pt-BR',
            appearance: {
              theme: 'stripe'
            }
          }}
        >
          <CheckoutForm 
            clientSecret={clientSecret}
            onSuccess={onSuccess}
            onError={onError}
            loading={loading}
            setLoading={setLoading}
            betAmount={betAmount}
            selectedPlayer={selectedPlayer}
            selectedMatch={selectedMatch}
          />
        </Elements>
      </CardContent>
    </Card>
  )
}

export default PaymentForm