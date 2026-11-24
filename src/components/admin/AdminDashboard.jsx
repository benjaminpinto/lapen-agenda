import {useEffect, useState} from 'react'
import {Link} from 'react-router-dom'
import {Medal} from 'lucide-react'
import {ADMIN_SECTIONS} from './AdminNav'
import {ADMIN_API, request} from './tournament/tournamentApi'
import {fetchWithAuth} from '../../utils/fetchWithAuth.js'

const AdminDashboard = () => {
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [tournamentSummary, setTournamentSummary] = useState(null)

    useEffect(() => {
        fetchDashboardStats()
        request('GET', `${ADMIN_API}/pending-summary`).then((result) => {
            if (result.ok) setTournamentSummary(result.data)
        })
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

    const pendingCard = tournamentSummary?.tournament && (
        <section className="rounded-2xl border border-amber-300 bg-card p-4 shadow-sm" data-testid="tournament-pending-card">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
                <Medal className="h-5 w-5 text-primary" /> {tournamentSummary.tournament.name}
            </h2>
            <div className="grid gap-2 grid-cols-3">
                {[
                    ['pending-registrations', tournamentSummary.pending_registrations, 'inscrições pendentes', 'inscricoes'],
                    ['pending-results', tournamentSummary.overdue_results, 'resultados atrasados', 'partidas'],
                    ['pending-ties', tournamentSummary.ties_to_decide, 'empates a decidir', 'partidas'],
                ].map(([testId, count, label, tab]) => (
                    <Link
                        key={testId} to={`/admin/tournaments/${tournamentSummary.tournament.id}?tab=${tab}`} data-testid={testId}
                        className={`rounded-xl border p-3 min-h-[44px] flex flex-col ${count > 0 ? 'border-orange-400 bg-orange-50 text-orange-900' : 'border-stone-200 text-stone-500'}`}
                    >
                        <span className="font-display text-2xl font-bold tabular-nums" data-testid={`${testId}-count`}>{count}</span>
                        <span className="text-xs leading-tight">{label}</span>
                    </Link>
                ))}
            </div>
        </section>
    )

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold">Painel Administrativo</h1>
                <p className="text-sm text-muted-foreground">Gerencie quadras, jogadores, ranking e torneios</p>
            </div>

            {pendingCard}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {ADMIN_SECTIONS.filter(s => s.to !== '/admin/dashboard').map(({to, label, icon: Icon}) => (
                    <Link key={to} to={to} data-testid={to === '/admin/tournaments' ? 'dashboard-tournaments-card' : `dashboard-${to.split('/').pop()}-card`}
                          className="flex items-center gap-3 rounded-2xl border bg-card p-3 sm:p-4 transition hover:border-primary/40 active:scale-[0.98]">
                        <span className="h-10 w-10 shrink-0 rounded-full bg-accent text-accent-foreground grid place-items-center">
                            <Icon className="h-5 w-5" />
                        </span>
                        <span className="font-semibold">{label}</span>
                    </Link>
                ))}
            </div>
        </div>
    )
}

export default AdminDashboard

