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
        if (matchType === 'Liga') return 'bg-yellow-100 text-black border-yellow-300 hover:border-yellow-600'
        if (matchType === 'Aula') return 'bg-purple-100 text-black border-purple-300 hover:border-purple-600'
        if (matchType === 'Torneio') return 'bg-orange-100 text-black border-orange-300 hover:border-orange-600'
        return 'bg-green-100 text-black border-green-300 hover:border-green-600'
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