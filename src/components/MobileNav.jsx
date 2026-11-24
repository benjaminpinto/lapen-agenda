import {Link, useLocation} from 'react-router-dom'
import {Award, CalendarDays, Home, Plus, Trophy} from 'lucide-react'

const ITEMS = [
    {to: '/', label: 'Início', icon: Home, match: (p) => p === '/'},
    {to: '/view', label: 'Agenda', icon: CalendarDays, match: (p) => p === '/view'},
    {to: '/schedule', label: 'Agendar', icon: Plus, primary: true, match: (p) => p === '/schedule'},
    {to: '/ranking', label: 'Ranking', icon: Award, match: (p) => p.startsWith('/ranking')},
    {to: '/tournaments', label: 'Torneios', icon: Trophy, match: (p) => p.startsWith('/tournaments')},
]

// Thumb-reach navigation for phones; the admin area and the live TV board keep the full screen.
export const showsMobileNav = (pathname) => !pathname.startsWith('/admin') && !pathname.endsWith('/ao-vivo')

const MobileNav = () => {
    const {pathname} = useLocation()
    if (!showsMobileNav(pathname)) return null

    return (
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 pb-[env(safe-area-inset-bottom)]"
             data-testid="mobile-nav">
            <div className="grid grid-cols-5 h-16 max-w-md mx-auto">
                {ITEMS.map(({to, label, icon: Icon, primary, match}) => {
                    const active = match(pathname)
                    if (primary) {
                        return (
                            <Link key={to} to={to} aria-label={label} data-testid="mobile-nav-schedule"
                                  className="flex flex-col items-center justify-center -mt-5">
                                <span className="h-14 w-14 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-lg shadow-primary/30 ring-4 ring-background active:scale-95 transition">
                                    <Icon className="h-6 w-6" strokeWidth={2.5}/>
                                </span>
                            </Link>
                        )
                    }
                    return (
                        <Link key={to} to={to} data-testid={`mobile-nav-${label.toLowerCase()}`}
                              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                            <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2}/>
                            {label}
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}

export default MobileNav
