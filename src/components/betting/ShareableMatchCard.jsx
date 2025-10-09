import { forwardRef } from 'react'
import betBackground from '/src/static/images/bet-img-bkgnd.png'

const ShareableMatchCard = forwardRef(({ match, odds, stats }, ref) => {
  return (
    <div 
      ref={ref}
      className="relative w-[400px] h-[600px] bg-cover bg-center flex flex-col justify-between p-6 text-white"
      style={{ backgroundImage: `url(${betBackground})` }}
    >
      {/* Header */}
      <div className="bg-black bg-opacity-50 rounded-lg p-4 text-center">
        <h1 className="text-2xl font-bold mb-2">🐯 TIGRINHO LAPEN</h1>
        <div className="text-lg">
          {new Date(match.date).toLocaleDateString('pt-BR')} às {match.start_time}
        </div>
      </div>

      {/* Players */}
      <div className="bg-black bg-opacity-50 rounded-lg p-4 text-center">
        <div className="text-3xl font-bold mb-4">
          {match.player1_name} <span className="text-yellow-400">VS</span> {match.player2_name}
        </div>
      </div>

      {/* Odds and Bets */}
      <div className="space-y-4">
        <div className="bg-black bg-opacity-50 rounded-lg p-4">
          <div className="text-center mb-3">
            <h3 className="text-xl font-semibold text-yellow-400">ODDS ATUAIS</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="font-semibold text-lg">{match.player1_name}</div>
              <div className="text-2xl font-bold text-green-400">
                {odds[match.player1_name] ? `${odds[match.player1_name]}x` : 'N/A'}
              </div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-lg">{match.player2_name}</div>
              <div className="text-2xl font-bold text-green-400">
                {odds[match.player2_name] ? `${odds[match.player2_name]}x` : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-black bg-opacity-50 rounded-lg p-4">
          <div className="text-center mb-3">
            <h3 className="text-xl font-semibold text-yellow-400">APOSTAS ATUAIS</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="font-semibold">{match.player1_name}</div>
              <div className="text-lg font-bold">
                R$ {stats[match.player1_name]?.total_amount?.toFixed(2) || '0.00'}
              </div>
            </div>
            <div className="text-center">
              <div className="font-semibold">{match.player2_name}</div>
              <div className="text-lg font-bold">
                R$ {stats[match.player2_name]?.total_amount?.toFixed(2) || '0.00'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-black bg-opacity-50 rounded-lg p-3 text-center">
        <div className="text-sm">Aposte com responsabilidade</div>
        <div className="text-xs text-yellow-400">LAPEN - Penedo Tennis Club</div>
      </div>
    </div>
  )
})

ShareableMatchCard.displayName = 'ShareableMatchCard'

export default ShareableMatchCard