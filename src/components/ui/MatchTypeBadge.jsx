import { GraduationCap, Medal, Trophy, Users } from 'lucide-react'

const MatchTypeBadge = ({ matchType, size = 'default', className = '', iconOnly = false }) => {
    const getIcon = () => {
        const iconSize = size === 'sm' ? 'h-2 w-2' : size === 'xs' ? 'h-3 w-3' : 'h-4 w-4'
        
        if (matchType === 'Liga') return <Trophy className={iconSize} />
        if (matchType === 'Aula') return <GraduationCap className={iconSize} />
        if (matchType === 'Torneio') return <Medal className={iconSize} />
        return <Users className={iconSize} />
    }

    const getColors = () => {
        // Clay palette: each type keeps its own warm hue (no green/blue/purple).
        if (matchType === 'Liga') return 'bg-amber-100 text-amber-950 border-amber-300 hover:border-amber-600'
        if (matchType === 'Aula') return 'bg-stone-200 text-stone-900 border-stone-400 hover:border-stone-600'
        if (matchType === 'Torneio') return 'bg-orange-100 text-orange-950 border-orange-300 hover:border-orange-600'
        return 'bg-rose-100 text-rose-950 border-rose-300 hover:border-rose-600'
    }

    const getTitle = () => {
        if (matchType === 'Liga') return 'Partida oficial da liga'
        if (matchType === 'Aula') return 'Aula de tênis'
        if (matchType === 'Torneio') return 'Partida de torneio'
        return 'Partida amistosa entre jogadores'
    }

    const sizeClasses = {
        xs: 'px-1 py-0 text-xs',
        sm: 'px-2 py-1 text-xs',
        default: 'px-2.5 py-0.5 text-xs'
    }

    return (
        <div
            className={`inline-flex items-center rounded-full font-semibold border-2 transition-all duration-200 cursor-pointer ${getColors()} ${sizeClasses[size]} ${className}`}
            title={getTitle()}
        >
            {getIcon()}
            {!iconOnly && <span className="ml-1">{matchType}</span>}
        </div>
    )
}

export default MatchTypeBadge