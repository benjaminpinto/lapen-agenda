import { forwardRef } from 'react'
import winnerBackground from '/src/static/images/winner-background.png'

const ShareableWinCard = forwardRef(({ bet }, ref) => {
  const profit = bet.potential_return - bet.amount
  const profitPercentage = ((profit / bet.amount) * 100).toFixed(0)

  return (
    <div 
      ref={ref}
      className="relative w-[400px] h-[600px] flex flex-col justify-between p-6 text-white"
      style={{
        backgroundColor: '#15803d',
        backgroundImage: `url(${winnerBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* Header */}
      <div className="bg-black bg-opacity-60 rounded-lg p-3 text-center">
        <h1 className="text-2xl font-bold mb-1">🏆 VITÓRIA!</h1>
        <div className="text-sm text-yellow-300">Você ganhou!</div>
      </div>

      {/* Match Info */}
      <div className="bg-black bg-opacity-60 rounded-lg p-3 text-center">
        <div className="text-xs text-gray-300 mb-1">
          {new Date(bet.match.date).toLocaleDateString('pt-BR')}
        </div>
        <div className="text-base font-bold mb-2">
          {bet.match.player1_name} vs {bet.match.player2_name}
        </div>
        <div className="text-sm">
          <span className="text-yellow-300">Vencedor:</span> {bet.player_name}
        </div>
      </div>

      {/* Winnings */}
      <div className="bg-black bg-opacity-60 rounded-lg p-4">
        <div className="text-center space-y-3">
          <div>
            <div className="text-xs text-gray-300">Aposta</div>
            <div className="text-xl font-bold">R$ {bet.amount.toFixed(2)}</div>
          </div>
          
          <div className="text-2xl font-bold text-yellow-300">↓</div>
          
          <div>
            <div className="text-xs text-gray-300">Retorno</div>
            <div className="text-2xl font-bold text-green-400">
              R$ {bet.potential_return.toFixed(2)}
            </div>
          </div>

          <div className="border-t border-white border-opacity-30 pt-2">
            <div className="text-xs text-gray-300">Lucro</div>
            <div className="text-xl font-bold text-yellow-300">
              +R$ {profit.toFixed(2)}
            </div>
            <div className="text-lg font-bold text-green-400 mt-1">
              +{profitPercentage}% 🚀
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-black bg-opacity-60 rounded-lg p-2 text-center">
        <div className="text-xs font-semibold">🐯 TIGRINHO LAPEN</div>
        <div className="text-xs text-yellow-300">Penedo Tennis Club</div>
      </div>
    </div>
  )
})

ShareableWinCard.displayName = 'ShareableWinCard'

export default ShareableWinCard
