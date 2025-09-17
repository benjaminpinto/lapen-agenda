import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Settings, LogOut, Calendar, Home } from 'lucide-react'
import { useToast } from '@/components/hooks/use-toast'

const Header = ({ isAdminAuthenticated, setIsAdminAuthenticated }) => {
  const navigate = useNavigate()
  const { toast } = useToast()

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include'
      })
      
      if (response.ok) {
        setIsAdminAuthenticated(false)
        sessionStorage.removeItem('admin_authenticated')
        navigate('/')
        toast({
          title: "Logout realizado",
          description: "Você foi desconectado com sucesso."
        })
      }
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <Calendar className="h-8 w-8 text-green-600" />
            <h1 className="text-2xl font-bold text-gray-900">Agenda LAPEN</h1>
          </Link>
          
          <nav className="flex items-center space-x-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <Home className="h-4 w-4 mr-2" />
                Início
              </Button>
            </Link>
            
            <Link to="/schedule">
              <Button variant="ghost" size="sm">
                <Calendar className="h-4 w-4 mr-2" />
                Agendar
              </Button>
            </Link>
            
            <Link to="/view">
              <Button variant="ghost" size="sm">
                Ver Agenda
              </Button>
            </Link>
            
            {isAdminAuthenticated ? (
              <div className="flex items-center space-x-2">
                <Link to="/admin/dashboard">
                  <Button variant="ghost" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Admin
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </Button>
              </div>
            ) : (
              <Link to="/admin">
                <Button variant="ghost" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}

export default Header

