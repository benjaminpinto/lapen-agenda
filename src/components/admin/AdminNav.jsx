import {useEffect, useRef} from 'react'
import {Link, useLocation} from 'react-router-dom'
import {Award, Calendar, Clock, LayoutGrid, MapPin, Medal, Trophy, UserCog, Users} from 'lucide-react'

export const ADMIN_SECTIONS = [
    {to: '/admin/dashboard', label: 'Painel', icon: LayoutGrid},
    {to: '/admin/tournaments', label: 'Torneios', icon: Medal},
    {to: '/admin/ranking', label: 'Ranking', icon: Award},
    {to: '/admin/lapen-approvals', label: 'Membros', icon: Users},
    {to: '/admin/users', label: 'Usuários', icon: UserCog},
    {to: '/admin/courts', label: 'Quadras', icon: MapPin},
    {to: '/admin/holidays', label: 'Feriados', icon: Calendar},
    {to: '/admin/recurring', label: 'Recorrências', icon: Clock},
    {to: '/admin/matches', label: 'Apostas', icon: Trophy},
]

// One strip of sections across every admin page: scrolls sideways on a phone, wraps on a computer.
const AdminNav = ({isAdminAuthenticated}) => {
    const {pathname} = useLocation()
    const navRef = useRef(null)
    const current = ADMIN_SECTIONS.find(s => pathname.startsWith(s.to))?.to

    useEffect(() => {
        navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({block: 'nearest', inline: 'center'})
    }, [current])

    if (!isAdminAuthenticated || !pathname.startsWith('/admin/')) return null

    return (
        <nav ref={navRef} aria-label="Administração" data-testid="admin-nav"
             className="-mx-4 sm:mx-0 mb-5 flex gap-2 overflow-x-auto no-scrollbar px-4 sm:px-0 sm:flex-wrap">
            {ADMIN_SECTIONS.map(({to, label, icon: Icon}) => (
                <Link key={to} to={to} data-testid={`admin-nav-${to.split('/').pop()}`}
                      aria-current={current === to ? 'page' : undefined}
                      className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border text-sm font-semibold transition ${current === to
                          ? 'bg-foreground text-background border-foreground'
                          : 'bg-card text-muted-foreground hover:text-foreground'}`}>
                    <Icon className="h-4 w-4"/>
                    {label}
                </Link>
            ))}
        </nav>
    )
}

export default AdminNav
