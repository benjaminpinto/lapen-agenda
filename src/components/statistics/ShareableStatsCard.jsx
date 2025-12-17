import { forwardRef } from 'react'
import statsBackground from '/src/static/images/stats_share_img.png'

const ShareableStatsCard = forwardRef(({ stats, player1, player2, matchType, seasonLabel, additionalStats }, ref) => {
  const isH2H = !!player2
  const isGeneral = !player1

  return (
    <div 
      ref={ref}
      className="relative w-[800px] h-[600px] flex flex-col p-8 text-white"
      style={{
        backgroundColor: '#92400e',
        backgroundImage: `url(${statsBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* Header */}
      <div className="bg-black bg-opacity-60 rounded-lg p-4 text-center mb-4">
        <h1 className="text-2xl font-bold mb-1">📊 ESTATÍSTICAS LAPEN</h1>
        <div className="text-sm text-amber-300">{seasonLabel || 'Todas as temporadas'}</div>
        {matchType && <div className="text-xs text-gray-300 mt-1">{matchType}</div>}
      </div>

      {/* General Stats */}
      {isGeneral && stats && (
        <div className="flex-1 space-y-3">
          <div className="bg-black bg-opacity-60 rounded-lg p-4">
            <div className="grid grid-cols-5 gap-3 text-center">
              <div>
                <div className="text-2xl font-bold text-amber-400">{stats.total_matches}</div>
                <div className="text-xs text-gray-300">Partidas</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-400">{stats.total_players}</div>
                <div className="text-xs text-gray-300">Jogadores</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-400">{stats.total_sets}</div>
                <div className="text-xs text-gray-300">Sets</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-300">{stats.total_games}</div>
                <div className="text-xs text-gray-300">Games</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-300">{stats.super_tiebreaks}</div>
                <div className="text-xs text-gray-300">Tiebreaks</div>
              </div>
            </div>
          </div>

          <div className="bg-black bg-opacity-60 rounded-lg p-4">
            <h3 className="text-center text-sm font-semibold text-amber-300 mb-3">TOP 5 JOGADORES</h3>
            <div className="space-y-2">
              {stats.top_players?.slice(0, 5).map((player, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-400">#{idx + 1}</span>
                    <span className="font-medium">{player.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-green-400">{player.wins}V</span>
                    <span className="text-gray-400 text-xs ml-2">{player.win_rate.toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* H2H Stats */}
      {isH2H && stats?.head_to_head && (
        <div className="flex-1 space-y-3">
          <div className="bg-black bg-opacity-60 rounded-lg p-4 text-center">
            <h2 className="text-xl font-bold mb-3">{player1} vs {player2}</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-4xl font-bold text-amber-400">{stats.head_to_head.player1_wins}</div>
                <div className="text-sm text-gray-300">{stats.head_to_head.player1}</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-orange-400">{stats.head_to_head.player2_wins}</div>
                <div className="text-sm text-gray-300">{stats.head_to_head.player2}</div>
              </div>
            </div>
          </div>

          <div className="bg-black bg-opacity-60 rounded-lg p-4">
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <div className="text-xl font-bold text-green-400">{stats.total_matches}</div>
                <div className="text-xs text-gray-300">Partidas</div>
              </div>
              <div>
                <div className="text-xl font-bold text-yellow-400">{stats.sets_won}-{stats.sets_lost}</div>
                <div className="text-xs text-gray-300">Sets</div>
              </div>
              <div>
                <div className="text-xl font-bold text-amber-400">{stats.games_won}-{stats.games_lost}</div>
                <div className="text-xs text-gray-300">Games</div>
              </div>
              <div>
                <div className="text-xl font-bold text-orange-400">{stats.wins}</div>
                <div className="text-xs text-gray-300">Vitórias</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Player Stats */}
      {!isH2H && !isGeneral && stats && (
        <div className="flex-1 space-y-2">
          <div className="bg-black bg-opacity-60 rounded-lg p-3 text-center">
            <h2 className="text-xl font-bold mb-1">{player1}</h2>
            <div className="text-xs text-amber-300">Histórico de Partidas</div>
          </div>

          <div className="bg-black bg-opacity-60 rounded-lg p-3">
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <div className="text-xl font-bold text-amber-400">{stats.total_matches}</div>
                <div className="text-xs text-gray-300">Partidas</div>
              </div>
              <div>
                <div className="text-xl font-bold text-green-400">{stats.wins}</div>
                <div className="text-xs text-gray-300">Vitórias</div>
                <div className="text-xs text-amber-300">
                  {stats.total_matches > 0 ? ((stats.wins / stats.total_matches) * 100).toFixed(0) : 0}%
                </div>
              </div>
              <div>
                <div className="text-lg font-bold text-yellow-400">{stats.sets_won}-{stats.sets_lost}</div>
                <div className="text-xs text-gray-300">Sets</div>
              </div>
              <div>
                <div className="text-lg font-bold text-orange-400">{stats.games_won}-{stats.games_lost}</div>
                <div className="text-xs text-gray-300">Games</div>
              </div>
            </div>
          </div>

          {additionalStats && (
            <div className="bg-black bg-opacity-60 rounded-lg p-2 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-center">
                {additionalStats.bestOpponent && (
                  <div>
                    <div className="text-xs text-green-400">💀 Carrasco do(a):</div>
                    <div className="text-sm font-bold">{additionalStats.bestOpponent.name}</div>
                    <div className="text-xs text-gray-300">{additionalStats.bestOpponent.wins}V-{additionalStats.bestOpponent.losses}D</div>
                  </div>
                )}
                {additionalStats.worstOpponent && (
                  <div>
                    <div className="text-xs text-red-400">❤️ Freguês do(a):</div>
                    <div className="text-sm font-bold">{additionalStats.worstOpponent.name}</div>
                    <div className="text-xs text-gray-300">{additionalStats.worstOpponent.wins}V-{additionalStats.worstOpponent.losses}D</div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-4 gap-3 text-center">
                <div>
                  <div className="text-xs text-green-400 mb-1">🔥 Seq. Vit.</div>
                  <div className="text-2xl font-bold">{additionalStats.maxWinStreak}</div>
                </div>
                <div>
                  <div className="text-xs text-red-400 mb-1">❄️ Seq. Derrotas</div>
                  <div className="text-2xl font-bold">{additionalStats.maxLossStreak}</div>
                </div>
                <div>
                  <div className="text-xs text-yellow-400 mb-1">🎯 Apertadas</div>
                  <div className="text-2xl font-bold">{additionalStats.tiebreaks}</div>
                </div>
                <div>
                  <div className="text-xs text-purple-400 mb-1">📊 Games/Set</div>
                  <div className="text-2xl font-bold">{additionalStats.avgGamesPerSet}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="bg-black bg-opacity-60 rounded-lg p-3 text-center mt-4">
        <div className="text-sm font-semibold">🎾 LAPEN - Penedo Tennis Club</div>
        <div className="text-xs text-amber-300">Sistema de Estatísticas</div>
      </div>
    </div>
  )
})

ShareableStatsCard.displayName = 'ShareableStatsCard'

export default ShareableStatsCard
