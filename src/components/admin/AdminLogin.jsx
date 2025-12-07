import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Lock, AlertCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'

const AdminLogin = ({ setIsAdminAuthenticated }) => {
  const navigate = useNavigate()
  const { user, isAuthenticated, loading } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        toast({
          title: "Autenticação necessária",
          description: "Faça login para acessar a área administrativa",
          variant: "destructive"
        })
        navigate('/login')
      } else if (!user?.is_admin) {
        toast({
          title: "Acesso negado",
          description: "Você não tem permissão para acessar esta área",
          variant: "destructive"
        })
        navigate('/')
      } else {
        setIsAdminAuthenticated(true)
        navigate('/admin/dashboard')
      }
    }
  }, [user, isAuthenticated, loading, navigate, setIsAdminAuthenticated, toast])

  return (
    <div className="max-w-md mx-auto mt-20">
      <Card>
        <CardHeader className="text-center">
          <Lock className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <CardTitle>Área Administrativa</CardTitle>
          <CardDescription>
            Verificando permissões...
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <div className="animate-pulse text-gray-500">
            Aguarde...
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default AdminLogin

