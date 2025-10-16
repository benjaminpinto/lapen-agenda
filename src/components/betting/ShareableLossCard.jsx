import { forwardRef } from 'react'
import loserBackground from '/src/static/images/loser-background.png'

const ShareableLossCard = forwardRef(({ bet }, ref) => {
  const funnyMessages = [
    "Quase! 😅",
    "Na próxima! 💪",
    "Foi por pouco! 🎾",
    "Aprendizado! 📚"
  ]
  const randomMessage = funnyMessages[Math.floor(Math.random() * funnyMessages.length)]

  return (
    <div 
      ref={ref}
      className="relative w-[400px] h-[600px] flex flex-col justify-between p-6 text-white"
      style={{
        backgroundColor: '#991b1b',
        backgroundImage: `url(${loserBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* Header */}
      <div className="bg-black bg-opacity-60 rounded-lg p-3 text-center">
        <h1 className="text-2xl font-bold mb-1">😅 {randomMessage}</h1>
        <div className="text-sm text-gray-300">Não foi dessa vez!</div>
      </div>

      {/* Match Info */}
      <div className="bg-black bg-opacity-60 rounded-lg p-3 text-center">
        <div className="text-xs text-gray-300 mb-1">
          {new Date(bet.match.date + 'T00:00:00').toLocaleDateString('pt-BR')}
        </div>
        <div className="text-base font-bold mb-2">
          {bet.match.player1_name} vs {bet.match.player2_name}
        </div>
        <div className="text-sm">
          <span className="text-gray-300">Você apostou em:</span> {bet.player_name}
        </div>
      </div>

      {/* Loss Info */}
      <div className="bg-black bg-opacity-60 rounded-lg p-4">
        <div className="text-center space-y-3">
          <div>
            <div className="text-xs text-gray-300">Valor Apostado</div>
            <div className="text-2xl font-bold text-red-400">
              R$ {bet.amount.toFixed(2)}
            </div>
          </div>

          <div className="text-3xl">💸</div>

          <div className="border-t border-white border-opacity-30 pt-3">
            <div className="text-base text-gray-300 mb-2">
              Mas não desanime!
            </div>
            <div className="text-sm text-yellow-300">
              🎾 A próxima é sua!
            </div>
            <div className="text-xs text-gray-400 mt-2">
              Continue apostando com responsabilidade
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

ShareableLossCard.displayName = 'ShareableLossCard'

export default ShareableLossCard
