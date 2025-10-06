import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

const EmailVerification = () => {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('loading') // loading, success, error
  const [message, setMessage] = useState('')
  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Token de verificação não encontrado')
      return
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ token })
        })

        const data = await response.json()

        if (response.ok) {
          setStatus('success')
          setMessage('Email verificado com sucesso!')
        } else {
          setStatus('error')
          setMessage(data.error || 'Erro ao verificar email')
        }
      } catch (error) {
        setStatus('error')
        setMessage('Erro de conexão. Tente novamente.')
      }
    }

    verifyEmail()
  }, [token])

  const getIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
      case 'success':
        return <CheckCircle className="h-6 w-6 text-green-600" />
      case 'error':
        return <XCircle className="h-6 w-6 text-red-600" />
      default:
        return null
    }
  }

  const getTitle = () => {
    switch (status) {
      case 'loading':
        return 'Verificando...'
      case 'success':
        return 'Email Verificado!'
      case 'error':
        return 'Erro na Verificação'
      default:
        return ''
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            {getIcon()}
          </div>
          <CardTitle className="text-2xl font-bold">{getTitle()}</CardTitle>
          <CardDescription>
            {status === 'loading' && 'Aguarde enquanto verificamos seu email...'}
            {status === 'success' && 'Sua conta foi verificada com sucesso'}
            {status === 'error' && 'Não foi possível verificar sua conta'}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-gray-600">{message}</p>
          
          <div className="space-y-2">
            {status === 'success' && (
              <Link to="/login">
                <Button className="w-full">
                  Fazer Login
                </Button>
              </Link>
            )}
            
            <Link to="/">
              <Button variant="outline" className="w-full">
                Voltar ao Início
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default EmailVerification