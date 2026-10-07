import {useEffect} from 'react'
import {Input} from '@/components/ui/input'
import {SCORE_COLUMNS} from '@/utils/scoreGrid'

/**
 * Jogador x sets table. `grid` is { set1: [p1, p2], set2: [...], stb: [...] } (see utils/scoreGrid) and
 * `onChange(key, playerIndex, value)` updates one cell. The STB column is only editable while `stbEnabled`
 * and is cleared as soon as it is not needed.
 */
export default function ScoreGrid({ players, grid, onChange, columns = SCORE_COLUMNS.best_of_3_super_tb, stbEnabled = false, testIdPrefix = 'score' }) {
  const hasStb = columns.some((column) => column.key === 'stb')

  useEffect(() => {
    if (hasStb && !stbEnabled && (grid.stb[0] !== '' || grid.stb[1] !== '')) {
      onChange('stb', 0, '')
      onChange('stb', 1, '')
    }
  }, [hasStb, stbEnabled, grid.stb, onChange])

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" data-testid={`${testIdPrefix}-grid`}>
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Jogador</th>
              {columns.map((column) => <th key={column.key} className="text-center p-2">{column.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {players.map((player, index) => (
              <tr key={index} className={index === 0 ? 'border-b' : ''}>
                <td className="p-2 font-medium">{player}</td>
                {columns.map((column) => (
                  <td key={column.key} className="p-2">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max={column.max}
                      className="w-16 text-center"
                      aria-label={`${player}: ${column.label}`}
                      data-testid={`${testIdPrefix}-${column.key}-${index + 1}`}
                      value={grid[column.key][index]}
                      disabled={column.key === 'stb' && !stbEnabled}
                      onChange={(event) => onChange(column.key, index, event.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasStb && (
        <p className="text-xs text-gray-500">
          STB - Super tiebreak {stbEnabled ? <span className="text-amber-600 font-medium">(obrigatório)</span> : '(preenchido automaticamente quando necessário)'}
        </p>
      )}
    </div>
  )
}
