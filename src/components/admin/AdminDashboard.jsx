import {useEffect, useState} from 'react'
import {Link} from 'react-router-dom'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Button} from '@/components/ui/button'
import {Award, Calendar, Clock, MapPin, Trophy, UserCog, Users} from 'lucide-react'

const AdminDashboard = () => {
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchDashboardStats()
    }, [])

    const fetchDashboardStats = async () => {
        try {
            const response = await fetchWithAuth('/api/admin/dashboard', {
                headers: {  }
            })
            if (response.ok) {
                const data = await response.json()
                setStats(data)
            } else {
                console.error('Dashboard API error:', response.status, await response.text())
            }
        } catch (error) {
            console.error('Error fetching dashboard stats:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return <div className="text-center py-8">Carregando estatísticas...</div>
    }

    return (
        <div className="max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    Painel Administrativo
                </h1>
                <p className="text-gray-600">
                    Gerencie quadras, jogadores e agendamentos
                </p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 auto-cols-fr">
                <Link to="/admin/courts">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                        <CardHeader className="text-center pb-2">
                            <MapPin className="h-8 w-8 text-green-600 mx-auto" />
                            <CardTitle className="text-lg whitespace-nowrap">Quadras</CardTitle>
                        </CardHeader>
                        <CardContent className="text-center">
                            <Button variant="ghost" size="sm">Gerenciar</Button>
                        </CardContent>
                    </Card>
                </Link>

                <Link to="/admin/holidays">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                        <CardHeader className="text-center pb-2">
                            <Calendar className="h-8 w-8 text-red-600 mx-auto" />
                            <CardTitle className="text-lg whitespace-nowrap">Feriados</CardTitle>
                        </CardHeader>
                        <CardContent className="text-center">
                            <Button variant="ghost" size="sm">Gerenciar</Button>
                        </CardContent>
                    </Card>
                </Link>

                <Link to="/admin/recurring">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                        <CardHeader className="text-center pb-2">
                            <Clock className="h-8 w-8 text-purple-600 mx-auto" />
                            <CardTitle className="text-lg whitespace-nowrap">Recorrências</CardTitle>
                        </CardHeader>
                        <CardContent className="text-center">
                            <Button variant="ghost" size="sm">Gerenciar</Button>
                        </CardContent>
                    </Card>
                </Link>

                <Link to="/admin/matches">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                        <CardHeader className="text-center pb-2">
                            <Trophy className="h-8 w-8 text-yellow-600 mx-auto" />
                            <CardTitle className="text-lg whitespace-nowrap">Apostas</CardTitle>
                        </CardHeader>
                        <CardContent className="text-center">
                            <Button variant="ghost" size="sm">Gerenciar</Button>
                        </CardContent>
                    </Card>
                </Link>

                <Link to="/admin/lapen-approvals">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                        <CardHeader className="text-center pb-2">
                            <Users className="h-8 w-8 text-orange-600 mx-auto" />
                            <CardTitle className="text-lg whitespace-nowrap">Membros</CardTitle>
                        </CardHeader>
                        <CardContent className="text-center">
                            <Button variant="ghost" size="sm">Aprovar</Button>
                        </CardContent>
                    </Card>
                </Link>

                <Link to="/admin/users">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                        <CardHeader className="text-center pb-2">
                            <UserCog className="h-8 w-8 text-blue-600 mx-auto" />
                            <CardTitle className="text-lg whitespace-nowrap">Usuários</CardTitle>
                        </CardHeader>
                        <CardContent className="text-center">
                            <Button variant="ghost" size="sm">Gerenciar</Button>
                        </CardContent>
                    </Card>
                </Link>

                <Link to="/admin/ranking">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                        <CardHeader className="text-center pb-2">
                            <Award className="h-8 w-8 text-indigo-600 mx-auto" />
                            <CardTitle className="text-lg whitespace-nowrap">Ranking</CardTitle>
                        </CardHeader>
                        <CardContent className="text-center">
                            <Button variant="ghost" size="sm">Gerenciar</Button>
                        </CardContent>
                    </Card>
                </Link>
            </div>
        </div>
    )
}

export default AdminDashboard

