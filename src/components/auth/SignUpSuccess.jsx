import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, Mail } from 'lucide-react'

const SignUpSuccess = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Conta Criada!</CardTitle>
          <CardDescription>
            Sua conta foi criada com sucesso
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-2 text-gray-600">
            <Mail className="h-5 w-5" />
            <span>Verifique seu email</span>
          </div>
          
          <p className="text-sm text-gray-600">
            Enviamos um email de confirmação para você. 
            Clique no link do email para verificar sua conta e começar a apostar.
          </p>
          
          <div className="space-y-2">
            <Link to="/login">
              <Button className="w-full">
                Fazer Login
              </Button>
            </Link>
            
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

export default SignUpSuccess