import {Link, useNavigate} from 'react-router-dom'
import {Button} from '@/components/ui/button'
import {Award, BarChart3, Calendar, Dices, Home, LogIn, LogOut, Menu, Settings, X} from 'lucide-react'
import {useToast} from '@/contexts/ToastContext'
import {useAuth} from '@/contexts/AuthContext'

import {useState} from 'react'
import {fetchWithAuth} from '@/utils/fetchWithAuth'

const Header = ({ isAdminAuthenticated, setIsAdminAuthenticated }) => {
    const navigate = useNavigate()
    const { toast } = useToast()
    const { user, logout, isAuthenticated } = useAuth()
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    const handleLogout = async () => {
        try {
            const response = await fetchWithAuth('/api/admin/logout', {
                method: 'POST',
                headers: {  }
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
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto px-4 py-3">
                <div className="flex items-center justify-between">
                    <Link to="/" className="flex items-center space-x-2 group" onClick={() => setIsMobileMenuOpen(false)}>
                        <span className="text-2xl sm:text-3xl transition-transform group-hover:scale-110">🎾</span>
                        <h1 className="text-lg sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-orange-600 dark:from-primary dark:to-orange-400">
                            LAPEN
                        </h1>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center space-x-1">
                        <Link to="/">
                            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
                                <Home className="h-4 w-4 mr-2" />
                                Início
                            </Button>
                        </Link>

                        <Link to="/view">
                            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
                                <Calendar className="h-4 w-4 mr-2" />
                                Agenda
                            </Button>
                        </Link>

                        <Link to="/betting">
                            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
                                <Dices className="h-4 w-4 mr-2" />
                                Apostas
                            </Button>
                        </Link>

                        <Link to="/ranking">
                            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
                                <Award className="h-4 w-4 mr-2" />
                                Ranking
                            </Button>
                        </Link>

                        <Link to="/statistics" onClick={() => navigate('/statistics', { replace: true })}>
                            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
                                <BarChart3 className="h-4 w-4 mr-2" />
                                Estatísticas
                            </Button>
                        </Link>

                        {(user?.is_admin === true || user?.is_admin === 1) && (
                            <Link to="/admin">
                                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
                                    <Settings className="h-4 w-4 mr-2" />
                                    Admin
                                </Button>
                            </Link>
                        )}

                        <div className="h-6 w-px bg-border mx-2" />

                        <div className="flex items-center space-x-2">
                            {/* ThemeToggle removed */}

                            {isAuthenticated ? (
                                <>
                                    <Link to="/profile">
                                        <Button variant="ghost" size="sm" className="text-sm font-medium">
                                            {user?.short_name || user?.name?.split(' ')[0]}
                                        </Button>
                                    </Link>
                                    <Button variant="ghost" size="icon" onClick={() => {
                                        logout();
                                        toast({ title: "Logout realizado" });
                                    }}>
                                        <LogOut className="h-4 w-4" />
                                    </Button>
                                </>
                            ) : (
                                <Link to="/login">
                                    <Button size="sm" className="animate-in fade-in zoom-in duration-300">
                                        <LogIn className="h-4 w-4 mr-2" />
                                        Entrar
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </nav>

                    {/* Mobile Menu Button */}
                    <div className="flex items-center space-x-2 md:hidden">
                        {/* ThemeToggle removed */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        >
                            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </Button>
                    </div>
                </div>

                {/* Mobile Navigation */}
                {isMobileMenuOpen && (
                    <nav className="md:hidden mt-4 pb-4 border-t pt-4 animate-in slide-in-from-top-5 fade-in duration-200">
                        <div className="flex flex-col space-y-2">
                            <Link to="/" onClick={() => setIsMobileMenuOpen(false)}>
                                <Button variant="ghost" size="sm" className="w-full justify-start">
                                    <Home className="h-4 w-4 mr-2" />
                                    Início
                                </Button>
                            </Link>

                            <Link to="/view" onClick={() => setIsMobileMenuOpen(false)}>
                                <Button variant="ghost" size="sm" className="w-full justify-start">
                                    <Calendar className="h-4 w-4 mr-2" />
                                    Agenda
                                </Button>
                            </Link>

                            <Link to="/betting" onClick={() => setIsMobileMenuOpen(false)}>
                                <Button variant="ghost" size="sm" className="w-full justify-start">
                                    <Dices className="h-4 w-4 mr-2" />
                                    Apostas
                                </Button>
                            </Link>

                            <Link to="/ranking" onClick={() => setIsMobileMenuOpen(false)}>
                                <Button variant="ghost" size="sm" className="w-full justify-start">
                                    <Award className="h-4 w-4 mr-2" />
                                    Ranking
                                </Button>
                            </Link>

                            <Link to="/statistics" onClick={() => { navigate('/statistics', { replace: true }); setIsMobileMenuOpen(false); }}>
                                <Button variant="ghost" size="sm" className="w-full justify-start">
                                    <BarChart3 className="h-4 w-4 mr-2" />
                                    Estatísticas
                                </Button>
                            </Link>

                            {(user?.is_admin === true || user?.is_admin === 1) && (
                                <Link to="/admin" onClick={() => setIsMobileMenuOpen(false)}>
                                    <Button variant="ghost" size="sm" className="w-full justify-start">
                                        <Settings className="h-4 w-4 mr-2" />
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
                                        className="w-full justify-start text-destructive hover:text-destructive"
                                        onClick={() => {
                                            logout()
                                            toast({ title: "Logout realizado" })
                                            setIsMobileMenuOpen(false)
                                        }}
                                    >
                                        <LogOut className="h-4 w-4 mr-2" />
                                        Sair
                                    </Button>
                                </>
                            ) : (
                                <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}>
                                    <Button size="sm" className="w-full justify-start">
                                        <LogIn className="h-4 w-4 mr-2" />
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

