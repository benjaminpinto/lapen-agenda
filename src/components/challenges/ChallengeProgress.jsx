import React from 'react';
import { Trophy, Swords, Scale } from 'lucide-react';
import { Progress } from "@/components/ui/progress";

const ChallengeProgress = ({ challenge }) => {
    const {
        challenger_name,
        challenged_name,
        challenger_short_name,
        challenged_short_name,
        target_type,
        target_amount,
        progress
    } = challenge;

    if (!progress) return null;

    const { challenger, challenged } = progress;

    // Determine metric to display based on target_type
    let challengerValue = 0;
    let challengedValue = 0;
    let metricLabel = '';
    let Icon = Trophy;

    switch (target_type) {
        case 'victories':
            challengerValue = challenger.victories;
            challengedValue = challenged.victories;
            metricLabel = 'Vitórias';
            Icon = Trophy;
            break;
        case 'sets':
            challengerValue = challenger.sets;
            challengedValue = challenged.sets;
            metricLabel = 'Sets';
            Icon = Swords;
            break;
        case 'balance':
            // Balance is (Games Won - Games Lost)
            // Wait, balance is usually relative to 0. 
            // If I have +5 and you have +2, I am winning.
            // Actually, let's just show "Game Balance" as simple "Games Won" for simplicity if it's a race?
            // No, "Saldo de Games" means Net Games.
            // Let's Calculate Net.
            // Challenger Net = Challenger Games Won - Challenger Games Lost (== Challenged Games Won)
            // So Challenger Net = A_won - B_won
            // Challenged Net = B_won - A_won
            // This is zero sum. One will be positive, one negative.
            // Maybe the challenge is "Who has the highest game balance?"
            // In that case, we can just display the raw Games Won? No, balance is different if they play other people?
            // BUT the matches only count "Between them". So Balance is always X vs -X.
            // So effectively it's just "Who has won more games".
            // Let's display "Games Won" which is clearer visually.
            challengerValue = challenger.games;
            challengedValue = challenged.games;
            metricLabel = 'Games Vencidos';
            Icon = Scale;
            break;
        default:
            challengerValue = 0;
            challengedValue = 0;
    }

    // Calculate percentage for bar
    // If target_amount exists, use it as max. Else use max(val1, val2, 10) * 1.2 for scaling
    const maxVal = target_amount || Math.max(challengerValue, challengedValue, 5) * 1.2;

    const p1Percent = Math.min((challengerValue / maxVal) * 100, 100);
    const p2Percent = Math.min((challengedValue / maxVal) * 100, 100);

    // Determine Leader
    const isP1Leading = challengerValue > challengedValue;
    const isP2Leading = challengedValue > challengerValue;
    const isTie = challengerValue === challengedValue;

    return (
        <div className="w-full bg-orange-50 rounded-xl p-4 border border-orange-200">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-gray-700">
                    <Icon className="w-4 h-4 text-orange-600" />
                    <span className="text-sm font-medium uppercase tracking-wider">{metricLabel}</span>
                </div>
                {target_amount && (
                    <span className="text-xs text-gray-500 font-mono">Alvo: {target_amount}</span>
                )}
            </div>

            <div className="space-y-6">
                {/* Player 1 (Challenger) */}
                <div className="relative">
                    <div className="flex justify-between items-end mb-1">
                        <span className={`text-sm font-bold ${isP1Leading ? 'text-orange-600' : 'text-gray-600'}`}>
                            {challenger_short_name || challenger_name}
                        </span>
                        <span className="text-2xl font-black text-gray-900">{challengerValue}</span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-1000 ease-out ${isP1Leading ? 'bg-gradient-to-r from-orange-600 to-orange-500' : 'bg-gray-400'}`}
                            style={{ width: `${p1Percent}%` }}
                        />
                    </div>
                </div>

                {/* VS Marker */}
                {/* <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-slate-600 bg-slate-900 px-2">VS</div> */}

                {/* Player 2 (Challenged) */}
                <div className="relative">
                    <div className="flex justify-between items-end mb-1">
                        <span className={`text-sm font-bold ${isP2Leading ? 'text-amber-600' : 'text-gray-600'}`}>
                            {challenged_short_name || challenged_name}
                        </span>
                        <span className="text-2xl font-black text-gray-900">{challengedValue}</span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-1000 ease-out ${isP2Leading ? 'bg-gradient-to-r from-amber-600 to-amber-500' : 'bg-gray-400'}`}
                            style={{ width: `${p2Percent}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Footer Info */}
            <div className="mt-4 pt-3 border-t border-orange-200 flex justify-between text-xs text-gray-600">
                <span>{progress.matches_played} partidas jogadas</span>
                <span className={isTie ? 'text-amber-600' : (isP1Leading ? 'text-orange-600' : 'text-amber-600')}>
                    {isTie ? 'Empate' : `Líder: ${isP1Leading ? (challenger_short_name || challenger_name) : (challenged_short_name || challenged_name)}`}
                </span>
            </div>

        </div>
    );
};

export default ChallengeProgress;
