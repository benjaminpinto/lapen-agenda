import {Link, useNavigate} from 'react-router-dom'
import {Button} from '@/components/ui/button'
import {Calendar, Eye, Home, LogIn, LogOut, Menu, Settings, Trophy, X, Award, BarChart3} from 'lucide-react'
import {useToast} from '@/contexts/ToastContext'
import {useAuth} from '@/contexts/AuthContext'
import {useState} from 'react'

const Header = ({isAdminAuthenticated, setIsAdminAuthenticated}) => {
    const navigate = useNavigate()
    const {toast} = useToast()
    const {user, logout, isAuthenticated} = useAuth()
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    const handleLogout = async () => {
        try {
            const response = await fetch('/api/admin/logout', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
            })

            if (response.ok) {
                setIsAdminAuthenticated(false)
                logout()
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
                        <span className="text-2xl sm:text-4xl">🎾</span>
                        <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Agenda LAPEN</h1>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center space-x-4">
                        <Link to="/">
                            <Button variant="ghost" size="sm">
                                <Home className="h-4 w-4 mr-2"/>
                                Início
                            </Button>
                        </Link>

                        <Link to="/view">
                            <Button variant="ghost" size="sm">
                                <Calendar className="h-4 w-4 mr-2"/>
                                Agenda
                            </Button>
                        </Link>

                        <Link to="/betting">
                            <Button variant="ghost" size="sm">
                                <Trophy className="h-4 w-4 mr-2"/>
                                Apostas
                            </Button>
                        </Link>

                        <Link to="/ranking">
                            <Button variant="ghost" size="sm">
                                <Award className="h-4 w-4 mr-2"/>
                                Ranking
                            </Button>
                        </Link>

                        <Link to="/statistics">
                            <Button variant="ghost" size="sm">
                                <BarChart3 className="h-4 w-4 mr-2"/>
                                Estatísticas
                            </Button>
                        </Link>

                        {(user?.is_admin === true || user?.is_admin === 1) && (
                            <Link to="/admin">
                                <Button variant="ghost" size="sm">
                                    <Settings className="h-4 w-4 mr-2"/>
                                    Admin
                                </Button>
                            </Link>
                        )}

                        <div className="flex items-center space-x-2">
                            {isAuthenticated ? (
                                <>
                                    <Link to="/profile">
                                        <Button variant="ghost" size="sm" className="text-sm text-gray-600">
                                            Olá, {user?.short_name || user?.name}
                                        </Button>
                                    </Link>
                                    <Button variant="ghost" size="sm" onClick={() => {
                                        logout();
                                        toast({title: "Logout realizado"});
                                    }}>
                                        <LogOut className="h-4 w-4 mr-2"/>
                                        Sair
                                    </Button>
                                </>
                            ) : (
                                <Link to="/login">
                                    <Button variant="ghost" size="sm">
                                        <LogIn className="h-4 w-4 mr-2"/>
                                        Entrar
                                    </Button>
                                </Link>
                            )}


                        </div>
                    </nav>

                    {/* Mobile Menu Button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="md:hidden"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? <X className="h-5 w-5"/> : <Menu className="h-5 w-5"/>}
                    </Button>
                </div>

                {/* Mobile Navigation */}
                {isMobileMenuOpen && (
                    <nav className="md:hidden mt-4 pb-4 border-t pt-4">
                        <div className="flex flex-col space-y-2">
                            <Link to="/" onClick={() => setIsMobileMenuOpen(false)}>
                                <Button variant="ghost" size="sm" className="w-full justify-start">
                                    <Home className="h-4 w-4 mr-2"/>
                                    Início
                                </Button>
                            </Link>

                            <Link to="/view" onClick={() => setIsMobileMenuOpen(false)}>
                                <Button variant="ghost" size="sm" className="w-full justify-start">
                                    <Calendar className="h-4 w-4 mr-2"/>
                                    Agenda
                                </Button>
                            </Link>

                            <Link to="/betting" onClick={() => setIsMobileMenuOpen(false)}>
                                <Button variant="ghost" size="sm" className="w-full justify-start">
                                    <Trophy className="h-4 w-4 mr-2"/>
                                    Apostas
                                </Button>
                            </Link>

                            <Link to="/ranking" onClick={() => setIsMobileMenuOpen(false)}>
                                <Button variant="ghost" size="sm" className="w-full justify-start">
                                    <Award className="h-4 w-4 mr-2"/>
                                    Ranking
                                </Button>
                            </Link>

                            <Link to="/statistics" onClick={() => setIsMobileMenuOpen(false)}>
                                <Button variant="ghost" size="sm" className="w-full justify-start">
                                    <BarChart3 className="h-4 w-4 mr-2"/>
                                    Estatísticas
                                </Button>
                            </Link>

                            {(user?.is_admin === true || user?.is_admin === 1) && (
                                <Link to="/admin" onClick={() => setIsMobileMenuOpen(false)}>
                                    <Button variant="ghost" size="sm" className="w-full justify-start">
                                        <Settings className="h-4 w-4 mr-2"/>
                                        Admin
                                    </Button>
                                </Link>
                            )}

                            {isAuthenticated ? (
                                <>
                                    <Link to="/profile" onClick={() => setIsMobileMenuOpen(false)}>
                                        <Button variant="ghost" size="sm" className="w-full justify-start">
                                            Olá, {user?.short_name || user?.name}
                                        </Button>
                                    </Link>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start"
                                        onClick={() => {
                                            logout()
                                            toast({title: "Logout realizado"})
                                            setIsMobileMenuOpen(false)
                                        }}
                                    >
                                        <LogOut className="h-4 w-4 mr-2"/>
                                        Sair
                                    </Button>
                                </>
                            ) : (
                                <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}>
                                    <Button variant="ghost" size="sm" className="w-full justify-start">
                                        <LogIn className="h-4 w-4 mr-2"/>
                                        Entrar
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </nav>
                )}
            </div>
        </header>
    )
}

export default Header

